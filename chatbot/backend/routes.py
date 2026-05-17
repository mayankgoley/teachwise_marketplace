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

        # follow-up action cards
        follow_ups = _extract_follow_ups(result.get('message', ''), user_role)

        return jsonify({
            'reply': {
                'content': result.get('message', ''),
                'created_at': None,
            },
            'conversation_id': result.get('conversation_id'),
            'tokens_used': result.get('tokens_used'),
            'status': result.get('status', 'active'),
            'follow_ups': follow_ups,
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


# delete conversation
@chatbot_bp.route('/conversations/<conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    from chatbot.backend.models import ChatbotConversation
    conv = ChatbotConversation.query.get(conversation_id)
    if not conv:
        return jsonify({'error': 'Not found'}), 404

    conv.status = 'resolved'
    db.session.commit()
    return jsonify({'status': 'deleted'})


# message feedback
@chatbot_bp.route('/conversations/<conversation_id>/messages/<message_id>/feedback', methods=['POST'])
def message_feedback(conversation_id, message_id):
    from chatbot.backend.models import ChatbotMessage

    msg = ChatbotMessage.query.get(message_id)
    if not msg or msg.conversation_id != conversation_id:
        return jsonify({'error': 'Not found'}), 404

    data = request.get_json(silent=True) or {}
    feedback = data.get('feedback')
    if feedback not in ('helpful', 'unhelpful'):
        return jsonify({'error': 'Invalid feedback'}), 400

    msg.feedback = feedback
    db.session.commit()
    return jsonify({'success': True, 'feedback': feedback})


# modify a booking from the chat
@chatbot_bp.route('/conversations/<conversation_id>/modify-booking', methods=['POST'])
def modify_booking(conversation_id):
    from chatbot.backend.models import ChatbotConversation
    conv = ChatbotConversation.query.get(conversation_id)
    if not conv:
        return jsonify({'error': 'Not found'}), 404

    data = request.get_json(silent=True) or {}
    booking_id = data.get('booking_id')
    action = data.get('action')  # cancel, reschedule

    if not booking_id or not action:
        return jsonify({'error': 'booking_id and action required'}), 400

    from models.booking import Booking
    booking = Booking.query.get(booking_id)
    if not booking:
        return jsonify({'error': 'Booking not found'}), 404

    user_id, user_role = _user_info()

    # Verify ownership
    if user_role == 'student' and booking.student_id != user_id:
        return jsonify({'error': 'Not your booking'}), 403
    if user_role == 'tutor' and booking.tutor_id != user_id:
        return jsonify({'error': 'Not your booking'}), 403

    if action == 'cancel':
        try:
            from services.booking_service import cancel_booking
            result = cancel_booking(booking, user_role, refund_pct=100)
            return jsonify({'success': True, 'message': 'Booking cancelled successfully.'})
        except Exception as e:
            return jsonify({'error': str(e)}), 400

    return jsonify({'error': f'Action "{action}" not supported yet'}), 400


# quick replies
@chatbot_bp.route('/quick-replies')
def quick_replies():
    user_id, user_role = _user_info()

    replies = [
        {'text': 'Help with my booking', 'icon': 'fa-calendar'},
        {'text': 'I want a refund', 'icon': 'fa-undo'},
        {'text': 'Find a tutor', 'icon': 'fa-search'},
    ]

    if user_role == 'student':
        replies.extend([
            {'text': 'Check my upcoming sessions', 'icon': 'fa-clock'},
            {'text': 'Cancel a booking', 'icon': 'fa-times-circle'},
        ])
    elif user_role == 'tutor':
        replies.extend([
            {'text': 'View my schedule', 'icon': 'fa-calendar-alt'},
            {'text': 'Check my earnings', 'icon': 'fa-dollar-sign'},
        ])

    replies.extend([
        {'text': 'Trouble signing up', 'icon': 'fa-exclamation-circle'},
        {'text': 'Talk to a human', 'icon': 'fa-user'},
    ])

    return jsonify(replies)


def _extract_follow_ups(message, user_role):
    """Pull follow-up action suggestions out of the assistant's response."""
    follow_ups = []
    msg_lower = (message or '').lower()

    if any(w in msg_lower for w in ['cancel', 'cancellation', 'cancelled']):
        follow_ups.append({
            'text': 'Cancel another booking',
            'action': 'cancel_booking',
            'icon': 'fa-times-circle'
        })
    if any(w in msg_lower for w in ['refund', 'money back']):
        follow_ups.append({
            'text': 'Check refund status',
            'action': 'check_refund',
            'icon': 'fa-undo'
        })
    if any(w in msg_lower for w in ['book', 'session', 'schedule']):
        follow_ups.append({
            'text': 'Book a new session',
            'action': 'book_session',
            'icon': 'fa-calendar-plus'
        })
    if any(w in msg_lower for w in ['tutor', 'find', 'search']):
        follow_ups.append({
            'text': 'Search for tutors',
            'action': 'search_tutors',
            'icon': 'fa-search'
        })

    return follow_ups[:3]
