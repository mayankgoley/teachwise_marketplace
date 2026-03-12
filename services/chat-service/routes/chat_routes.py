from flask import (Blueprint, render_template, request, redirect,
                    url_for, flash, jsonify)
from database import db
from models.message import Conversation, Message
from shared.jwt_auth import get_jwt_from_request, decode_jwt_token
from datetime import datetime
from sqlalchemy import func
import bleach

chat_bp = Blueprint('chat_bp', __name__)


def _get_user_info():
    token = get_jwt_from_request()
    if not token:
        return None, None, None
    try:
        payload = decode_jwt_token(token)
        uid = payload.get('uid', '')
        role = payload.get('role', '')
        name = payload.get('name', '')
        if '_' in uid:
            user_id = int(uid.split('_', 1)[1])
        else:
            user_id = int(uid)
        return role, user_id, name
    except Exception:
        return None, None, None


def _sanitize_input(text, max_length=2000):
    if not text:
        return ''
    text = bleach.clean(text.strip(), tags=[], strip=True)
    return text[:max_length]


def _user_in_conversation(conv, user_type, user_id):
    if user_type == 'student' and conv.student_id == user_id:
        return True
    if user_type == 'tutor' and conv.tutor_id == user_id:
        return True
    return False


def _get_conversations(user_type, user_id):
    if user_type == 'student':
        return Conversation.query.filter_by(student_id=user_id)\
            .filter(Conversation.is_blocked_by_student == False)\
            .order_by(Conversation.last_message_at.desc()).all()
    else:
        return Conversation.query.filter_by(tutor_id=user_id)\
            .filter(Conversation.is_blocked_by_tutor == False)\
            .order_by(Conversation.last_message_at.desc()).all()


def _get_unread_counts(convs, user_type):
    if not convs:
        return {}
    conv_ids = [c.id for c in convs]
    rows = (
        db.session.query(Message.conversation_id, func.count(Message.id))
        .filter(
            Message.conversation_id.in_(conv_ids),
            Message.is_read == False,
            Message.sender_type != user_type
        )
        .group_by(Message.conversation_id).all()
    )
    result = {cid: 0 for cid in conv_ids}
    for conv_id, count in rows:
        result[conv_id] = count
    return result


def _get_last_messages(convs):
    if not convs:
        return {}
    conv_ids = [c.id for c in convs]
    max_time = (
        db.session.query(
            Message.conversation_id,
            func.max(Message.created_at).label('max_created')
        )
        .filter(Message.conversation_id.in_(conv_ids))
        .group_by(Message.conversation_id).subquery()
    )
    rows = (
        db.session.query(Message)
        .join(max_time, db.and_(
            Message.conversation_id == max_time.c.conversation_id,
            Message.created_at == max_time.c.max_created
        )).all()
    )
    last_msgs = {}
    for msg in rows:
        preview = msg.content[:50] + ('...' if len(msg.content) > 50 else '')
        last_msgs[msg.conversation_id] = {
            'text': preview, 'sender_type': msg.sender_type
        }
    return last_msgs


@chat_bp.route('/chat')
def chat_list():
    user_type, user_id, _ = _get_user_info()
    if not user_type:
        return jsonify(error='Authentication required'), 401

    convs = _get_conversations(user_type, user_id)
    unread = _get_unread_counts(convs, user_type)
    last_msgs = _get_last_messages(convs)

    return render_template('chat.html', conversations=convs,
                           active_conv=None, messages=[],
                           unread=unread, user_type=user_type,
                           user_id=user_id, last_msgs=last_msgs)


@chat_bp.route('/chat/<int:conv_id>')
def chat_room(conv_id):
    user_type, user_id, _ = _get_user_info()
    if not user_type:
        return jsonify(error='Authentication required'), 401

    conv = Conversation.query.get_or_404(conv_id)
    if not _user_in_conversation(conv, user_type, user_id):
        return jsonify(error='Unauthorized'), 403

    Message.query.filter_by(
        conversation_id=conv_id, is_read=False
    ).filter(Message.sender_type != user_type).update({'is_read': True})
    db.session.commit()

    msgs = Message.query.filter_by(conversation_id=conv_id)\
        .order_by(Message.created_at.asc()).limit(200).all()

    convs = _get_conversations(user_type, user_id)
    unread = _get_unread_counts(convs, user_type)
    last_msgs = _get_last_messages(convs)

    return render_template('chat.html', conversations=convs,
                           active_conv=conv, messages=msgs,
                           unread=unread, user_type=user_type,
                           user_id=user_id, last_msgs=last_msgs)


@chat_bp.route('/api/chat/<int:conv_id>/send', methods=['POST'])
def send_message_api(conv_id):
    user_type, user_id, user_name = _get_user_info()
    if not user_type:
        return jsonify(error='Not logged in'), 401

    conv = Conversation.query.get_or_404(conv_id)
    if not _user_in_conversation(conv, user_type, user_id):
        return jsonify(error='Unauthorized'), 403

    if conv.is_blocked():
        return jsonify(error='Conversation is blocked'), 403

    data = request.get_json() or {}
    content = _sanitize_input(data.get('content', ''), 2000)
    if not content:
        return jsonify(error='Empty message'), 400

    msg = Message(
        conversation_id=conv_id,
        sender_type=user_type,
        sender_id=user_id,
        content=content
    )
    db.session.add(msg)
    conv.last_message_at = datetime.utcnow()
    db.session.commit()

    try:
        from app import socketio
        socketio.emit('new_message', {
            'id': msg.id,
            'conversation_id': conv_id,
            'sender_type': user_type,
            'sender_name': user_name,
            'content': msg.content,
            'timestamp': msg.created_at.strftime('%I:%M %p'),
            'is_read': False
        }, room=f'conv_{conv_id}')
    except Exception:
        pass

    try:
        from shared.event_bus import publish_event
        publish_event('message.sent', {
            'conversation_id': conv_id,
            'sender_type': user_type,
            'sender_id': user_id,
            'sender_name': user_name,
            'message_id': msg.id,
            'preview': content[:80],
        })
    except Exception:
        pass

    return jsonify(
        id=msg.id,
        sender_type=user_type,
        sender_name=user_name,
        content=msg.content,
        timestamp=msg.created_at.strftime('%I:%M %p')
    )


@chat_bp.route('/chat/<int:conv_id>/send', methods=['POST'])
def send_message_http(conv_id):
    user_type, user_id, user_name = _get_user_info()
    if not user_type:
        return jsonify(error='Not logged in'), 401

    conv = Conversation.query.get_or_404(conv_id)
    if not _user_in_conversation(conv, user_type, user_id):
        return jsonify(error='Unauthorized'), 403

    if conv.is_blocked():
        return redirect(url_for('chat_bp.chat_room', conv_id=conv_id))

    content = _sanitize_input(request.form.get('content', ''), 2000)
    if not content:
        return redirect(url_for('chat_bp.chat_room', conv_id=conv_id))

    msg = Message(
        conversation_id=conv_id,
        sender_type=user_type,
        sender_id=user_id,
        content=content
    )
    db.session.add(msg)
    conv.last_message_at = datetime.utcnow()
    db.session.commit()

    return redirect(url_for('chat_bp.chat_room', conv_id=conv_id))


@chat_bp.route('/api/chat/unread-count')
def unread_count():
    user_type, user_id, _ = _get_user_info()
    if not user_type:
        return jsonify(count=0)

    if user_type == 'student':
        conv_ids = [c.id for c in Conversation.query.filter_by(
            student_id=user_id, is_blocked_by_student=False).all()]
    else:
        conv_ids = [c.id for c in Conversation.query.filter_by(
            tutor_id=user_id, is_blocked_by_tutor=False).all()]

    if not conv_ids:
        return jsonify(count=0)

    count = Message.query.filter(
        Message.conversation_id.in_(conv_ids),
        Message.sender_type != user_type,
        Message.is_read == False
    ).count()

    return jsonify(count=count)


@chat_bp.route('/api/chat/<int:conv_id>/read', methods=['POST'])
def mark_read(conv_id):
    user_type, user_id, _ = _get_user_info()
    if not user_type:
        return jsonify(error='Not logged in'), 401

    conv = Conversation.query.get_or_404(conv_id)
    if not _user_in_conversation(conv, user_type, user_id):
        return jsonify(error='Unauthorized'), 403

    Message.query.filter_by(
        conversation_id=conv_id, is_read=False
    ).filter(Message.sender_type != user_type).update({'is_read': True})
    db.session.commit()

    return jsonify(success=True)


@chat_bp.route('/api/chat/<int:conv_id>/block', methods=['POST'])
def block_conversation(conv_id):
    user_type, user_id, _ = _get_user_info()
    if not user_type:
        return jsonify(error='Not logged in'), 401

    conv = Conversation.query.get_or_404(conv_id)
    if not _user_in_conversation(conv, user_type, user_id):
        return jsonify(error='Unauthorized'), 403

    if user_type == 'student':
        conv.is_blocked_by_student = True
    else:
        conv.is_blocked_by_tutor = True
    db.session.commit()

    return redirect(url_for('chat_bp.chat_list'))


@chat_bp.route('/api/chat/<int:conv_id>/unblock', methods=['POST'])
def unblock_conversation(conv_id):
    user_type, user_id, _ = _get_user_info()
    if not user_type:
        return jsonify(error='Not logged in'), 401

    conv = Conversation.query.get_or_404(conv_id)
    if not _user_in_conversation(conv, user_type, user_id):
        return jsonify(error='Unauthorized'), 403

    if user_type == 'student':
        conv.is_blocked_by_student = False
    else:
        conv.is_blocked_by_tutor = False
    db.session.commit()

    return redirect(url_for('chat_bp.chat_room', conv_id=conv_id))
