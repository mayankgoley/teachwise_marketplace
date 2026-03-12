"""Core chatbot service — OpenAI gpt-4o with function calling."""

import os
import json
import time
from datetime import datetime, timedelta
from openai import OpenAI, APIError
from flask import current_app
from database import db
from chatbot.backend.models import ChatbotConversation, ChatbotMessage
from chatbot.backend.tools import TOOLS, dispatch_tool

MODEL = 'gpt-4o'
MAX_TOKENS = 1024
MAX_TOOL_ROUNDS = 5
RATE_LIMIT_WINDOW = 10  # minutes
RATE_LIMIT_MAX = 30  # messages per window
TOKEN_ESCALATION_THRESHOLD = 100_000

SYSTEM_PROMPT = (
    "You are the TeachWise support assistant. TeachWise is an online platform "
    "that connects students with tutors for personalized learning sessions.\n\n"
    "Your role is to help users with booking sessions, managing their account, "
    "processing refunds, finding tutors, and answering platform questions.\n\n"
    "Refund policy:\n"
    "- More than 24 hours before session: 100% refund\n"
    "- 12-24 hours before session: 50% refund\n"
    "- Less than 12 hours before session: no refund\n\n"
    "Rules:\n"
    "- Be concise, friendly, and helpful\n"
    "- Use available tools to look up real data before answering\n"
    "- Never fabricate booking IDs, user details, or payment info\n"
    "- If you cannot resolve an issue, escalate to a human agent\n"
    "- Do not share sensitive info like payment intent IDs\n"
    "- Confirm destructive actions (cancellations) before proceeding\n"
)


def _get_client():
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        current_app.logger.error('OPENAI_API_KEY not set')
        return None
    return OpenAI(api_key=api_key)


def _build_system(user_id, user_role):
    if user_role == 'guest':
        return (
            SYSTEM_PROMPT +
            "\nThe user is a guest (not logged in). Account-specific actions "
            "require login. You can help with general questions and searching tutors.\n"
        )
    return SYSTEM_PROMPT + f"\nUser ID: {user_id}, role: {user_role}.\n"


def get_or_create_conversation(user_id, user_role):
    conv = ChatbotConversation.query.filter_by(
        user_id=user_id, status='active'
    ).first()
    if conv:
        return conv

    conv = ChatbotConversation(user_id=user_id, user_role=user_role, status='active')
    db.session.add(conv)
    db.session.commit()
    return conv


def resolve_conversation(conversation_id):
    conv = ChatbotConversation.query.get(conversation_id)
    if conv:
        conv.status = 'resolved'
        db.session.commit()
    return conv


def get_conversation_with_messages(conversation_id, limit=50):
    conv = ChatbotConversation.query.get(conversation_id)
    if not conv:
        return None

    msgs = conv.messages.order_by(
        ChatbotMessage.created_at.desc()
    ).limit(limit).all()
    msgs.reverse()

    result = conv.to_dict()
    result['messages'] = [m.to_dict() for m in msgs]
    return result


def send_message(conversation_id, user_message, user_id=None, user_role='guest'):
    conv = ChatbotConversation.query.get(conversation_id)
    if not conv:
        return {'error': 'Conversation not found'}

    # Rate limit check
    if conv.message_count and conv.message_count > RATE_LIMIT_MAX:
        window = datetime.utcnow() - timedelta(minutes=RATE_LIMIT_WINDOW)
        recent = ChatbotMessage.query.filter(
            ChatbotMessage.conversation_id == conversation_id,
            ChatbotMessage.role == 'user',
            ChatbotMessage.created_at >= window
        ).count()
        if recent > RATE_LIMIT_MAX:
            return {'error': 'Too many messages. Please wait a moment.'}

    # Save user message
    user_msg = ChatbotMessage(
        conversation_id=conversation_id,
        role='user',
        content=user_message
    )
    db.session.add(user_msg)
    conv.message_count = (conv.message_count or 0) + 1
    db.session.commit()

    # Build message history (last 20 text messages)
    db_msgs = ChatbotMessage.query.filter(
        ChatbotMessage.conversation_id == conversation_id,
        ChatbotMessage.tool_calls.is_(None),
        ChatbotMessage.tool_results.is_(None)
    ).order_by(ChatbotMessage.created_at.desc()).limit(20).all()
    db_msgs.reverse()

    messages = [{'role': m.role, 'content': m.content} for m in db_msgs if m.role in ('user', 'assistant')]

    # Call OpenAI
    client = _get_client()
    if not client:
        return {'error': 'AI service not configured'}

    system = _build_system(user_id, user_role)
    response = _call_openai(client, system, messages)
    if not response:
        return {'error': "I'm having trouble connecting. Please try again."}

    # Tool call loop
    tool_rounds = 0
    all_tool_calls = []
    all_tool_results = []

    while response.choices[0].finish_reason == 'tool_calls' and tool_rounds < MAX_TOOL_ROUNDS:
        tool_rounds += 1
        assistant_msg = response.choices[0].message

        # Add assistant message (with tool_calls) to history
        messages.append(assistant_msg)

        for tc in assistant_msg.tool_calls:
            result = dispatch_tool(tc.function.name, tc.function.arguments, conversation_id)
            all_tool_calls.append({
                'tool_name': tc.function.name,
                'arguments': tc.function.arguments,
                'tool_call_id': tc.id,
            })
            all_tool_results.append({
                'tool_call_id': tc.id,
                'result': result,
            })
            messages.append({
                'role': 'tool',
                'tool_call_id': tc.id,
                'content': json.dumps(result),
            })

        response = _call_openai(client, system, messages)
        if not response:
            return {'error': "I'm having trouble connecting. Please try again."}

    # Extract final text
    assistant_text = response.choices[0].message.content or ''
    tokens_used = response.usage.total_tokens if response.usage else 0

    # Save assistant message
    assistant_db = ChatbotMessage(
        conversation_id=conversation_id,
        role='assistant',
        content=assistant_text,
        tool_calls=all_tool_calls if all_tool_calls else None,
        tool_results=all_tool_results if all_tool_results else None,
        tokens_used=tokens_used
    )
    db.session.add(assistant_db)
    conv.total_tokens = (conv.total_tokens or 0) + tokens_used
    db.session.commit()

    # Auto-escalate on high token usage
    if conv.total_tokens > TOKEN_ESCALATION_THRESHOLD:
        dispatch_tool('escalate_to_human', json.dumps({
            'reason': 'Token usage exceeded threshold',
            'priority': 'low',
            'summary': 'Auto-escalated due to high token usage.'
        }), conversation_id)

    return {
        'message': assistant_text,
        'conversation_id': conversation_id,
        'tokens_used': tokens_used,
        'status': conv.status,
    }


def _call_openai(client, system, messages):
    full_messages = [{'role': 'system', 'content': system}] + messages

    for attempt in range(3):
        try:
            return client.chat.completions.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                messages=full_messages,
                tools=TOOLS,
            )
        except APIError as e:
            current_app.logger.error(f'OpenAI API error (attempt {attempt + 1}/3): {e}')
            if attempt < 2:
                time.sleep(2 ** attempt)
        except Exception as e:
            current_app.logger.error(f'OpenAI unexpected error: {e}')
            return None
    return None
