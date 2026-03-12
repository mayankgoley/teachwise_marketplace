"""Chatbot REST API — all routes under /api/chatbot/*"""

import os
from flask import Blueprint, request, jsonify, current_app
from flask_login import current_user
from database import db

_dir = os.path.dirname(os.path.abspath(__file__))
_frontend = os.path.join(os.path.dirname(_dir), 'frontend')

chatbot_bp = Blueprint(
    'chatbot_widget', __name__,
    url_prefix='/api/chatbot',
    static_folder=_frontend,
    static_url_path='/static',
)


def _user_info():
    if current_user.is_authenticated:
        return current_user.id, getattr(current_user, 'user_type', 'student')
    return None, 'guest'


@chatbot_bp.route('/conversations', methods=['POST'])
def create_conversation():
    user_id, user_role = _user_info()
    from chatbot.backend.service import get_or_create_conversation
    conv = get_or_create_conversation(user_id, user_role)
    return jsonify(conv.to_dict()), 201


@chatbot_bp.route('/conversations/active')
def get_active_conversation():
    user_id, user_role = _user_info()
    from chatbot.backend.models import ChatbotConversation

    if not user_id:
        return jsonify({}), 200

    conv = ChatbotConversation.query.filter_by(
        user_id=user_id, user_role=user_role, status='active'
    ).first()

    if not conv:
        return jsonify({}), 200

    msgs = [m.to_dict() for m in conv.messages.order_by(
        db.text('created_at ASC')).limit(50).all()]

    result = conv.to_dict()
    result['messages'] = msgs
    return jsonify(result)


@chatbot_bp.route('/conversations/<conversation_id>')
def get_conversation(conversation_id):
    from chatbot.backend.service import get_conversation_with_messages
    result = get_conversation_with_messages(conversation_id)
    if not result:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(result)


@chatbot_bp.route('/conversations/<conversation_id>/messages', methods=['POST'])
def send_message(conversation_id):
    from chatbot.backend.models import ChatbotConversation
    from chatbot.backend.service import send_message as do_send

    conv = ChatbotConversation.query.get(conversation_id)
    if not conv:
        return jsonify({'error': 'Not found'}), 404
    if conv.status != 'active':
        return jsonify({'error': 'Conversation is not active'}), 400

    data = request.get_json(silent=True) or {}
    content = (data.get('content') or '').strip()
    if not content:
        return jsonify({'error': 'Message content required'}), 400
    if len(content) > 2000:
        return jsonify({'error': 'Message too long (max 2000 chars)'}), 400

    user_id, user_role = _user_info()

    try:
        result = do_send(conversation_id, content, user_id, user_role)
        if 'error' in result and 'message' not in result:
            return jsonify(result), 400
        return jsonify({
            'reply': {
                'content': result.get('message', ''),
                'created_at': None,
            },
            'conversation_id': result.get('conversation_id'),
            'tokens_used': result.get('tokens_used'),
            'status': result.get('status', 'active'),
        })
    except Exception as e:
        current_app.logger.error(f'Chatbot error: {e}')
        return jsonify({
            'error': 'Something went wrong.',
            'reply': {'content': "I'm having trouble right now. Please try again.", 'created_at': None},
        }), 500


@chatbot_bp.route('/conversations/<conversation_id>/resolve', methods=['PATCH'])
def resolve_conversation(conversation_id):
    from chatbot.backend.service import resolve_conversation as do_resolve
    from chatbot.backend.models import ChatbotConversation

    conv = ChatbotConversation.query.get(conversation_id)
    if not conv:
        return jsonify({'error': 'Not found'}), 404

    do_resolve(conversation_id)
    return jsonify({'status': 'resolved'})
