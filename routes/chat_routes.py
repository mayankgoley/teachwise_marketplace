from flask import (Blueprint, render_template, request, redirect,
                    url_for, flash, jsonify)
from flask_login import current_user, login_required
from database import db
from models.message import Conversation, Message
from extensions import limiter
from models.tutor import Tutor
from models.student import Student
from models.booking import Booking
from utils.sanitizer import sanitize_input_length
from datetime import datetime

chat_bp = Blueprint('chat_bp', __name__)


def _get_user_info():
    """Return (user_type, user_id, user_name) for current user."""
    if current_user.is_authenticated:
        return current_user.user_type, current_user.id, current_user.name
    return None, None, None


def _user_in_conversation(conv, user_type, user_id):
    if user_type == 'student' and conv.student_id == user_id:
        return True
    if user_type == 'tutor' and conv.tutor_id == user_id:
        return True
    return False


def _get_conversations(user_type, user_id):
    """Get conversations for a user, excluding ones they blocked."""
    if user_type == 'student':
        return Conversation.query.filter_by(student_id=user_id)\
            .filter(Conversation.is_blocked_by_student == False)\
            .order_by(Conversation.last_message_at.desc()).all()
    else:
        return Conversation.query.filter_by(tutor_id=user_id)\
            .filter(Conversation.is_blocked_by_tutor == False)\
            .order_by(Conversation.last_message_at.desc()).all()


def _get_unread_counts(convs, user_type):
    """Batch query: Get unread counts for all conversations in ONE query."""
    if not convs:
        return {}
    from sqlalchemy import func
    conv_ids = [c.id for c in convs]
    rows = (
        db.session.query(
            Message.conversation_id,
            func.count(Message.id)
        )
        .filter(
            Message.conversation_id.in_(conv_ids),
            Message.is_read == False,
            Message.sender_type != user_type
        )
        .group_by(Message.conversation_id)
        .all()
    )
    result = {cid: 0 for cid in conv_ids}
    for conv_id, count in rows:
        result[conv_id] = count
    return result


def _get_last_messages(convs):
    """Batch query: Get last message for each conversation in ONE query."""
    if not convs:
        return {}
    from sqlalchemy import func
    conv_ids = [c.id for c in convs]

    # Subquery: max created_at per conversation
    max_time = (
        db.session.query(
            Message.conversation_id,
            func.max(Message.created_at).label('max_created')
        )
        .filter(Message.conversation_id.in_(conv_ids))
        .group_by(Message.conversation_id)
        .subquery()
    )

    # Join to get the actual message rows
    rows = (
        db.session.query(Message)
        .join(
            max_time,
            db.and_(
                Message.conversation_id == max_time.c.conversation_id,
                Message.created_at == max_time.c.max_created
            )
        )
        .all()
    )

    last_msgs = {}
    for msg in rows:
        preview = msg.content[:50] + ('...' if len(msg.content) > 50 else '')
        last_msgs[msg.conversation_id] = {'text': preview, 'sender_type': msg.sender_type}
    return last_msgs


@chat_bp.route('/chat')
def chat_list():
    user_type, user_id, _ = _get_user_info()
    if not user_type:
        flash('Please log in.', 'warning')
        return redirect(url_for('student_bp.login_student'))

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
        flash('Please log in.', 'warning')
        return redirect(url_for('student_bp.login_student'))

    conv = Conversation.query.get_or_404(conv_id)
    if not _user_in_conversation(conv, user_type, user_id):
        flash('Unauthorized.', 'danger')
        return redirect(url_for('chat_bp.chat_list'))

    # Mark messages as read
    Message.query.filter_by(
        conversation_id=conv_id, is_read=False
    ).filter(Message.sender_type != user_type).update({'is_read': True})
    db.session.commit()

    msgs = Message.query.filter_by(conversation_id=conv_id)\
        .order_by(Message.created_at.asc()).limit(200).all()

    # All conversations for sidebar
    convs = _get_conversations(user_type, user_id)
    unread = _get_unread_counts(convs, user_type)
    last_msgs = _get_last_messages(convs)

    return render_template('chat.html', conversations=convs,
                           active_conv=conv, messages=msgs,
                           unread=unread, user_type=user_type,
                           user_id=user_id, last_msgs=last_msgs)


@chat_bp.route('/chat/start-with-tutor/<int:tutor_id>', methods=['POST'])
@login_required
def start_with_tutor(tutor_id):
    """Student starts conversation with a verified tutor."""
    tutor = Tutor.query.get_or_404(tutor_id)
    if not tutor.is_verified:
        flash('This tutor is not yet verified.', 'warning')
        return redirect(url_for('tutor_bp.view_tutor_profile', tutor_id=tutor_id))

    existing = Conversation.query.filter_by(
        student_id=current_user.id, tutor_id=tutor_id).first()
    if existing:
        return redirect(url_for('chat_bp.chat_room', conv_id=existing.id))

    conv = Conversation(student_id=current_user.id, tutor_id=tutor_id,
                        started_by='student')
    db.session.add(conv)
    db.session.commit()
    return redirect(url_for('chat_bp.chat_room', conv_id=conv.id))


@chat_bp.route('/chat/start-with-student/<int:student_id>', methods=['POST'])
def start_with_student(student_id):
    """Tutor starts conversation with a student they have a booking with."""
    if not current_user.is_authenticated or current_user.user_type != 'tutor':
        flash('Please log in as tutor.', 'warning')
        return redirect(url_for('tutor_bp.login'))
    tutor_id = current_user.id

    student = Student.query.get_or_404(student_id)

    has_booking = Booking.query.filter_by(
        student_id=student_id, tutor_id=tutor_id
    ).filter(Booking.status.in_(['Booked', 'Confirmed', 'Completed'])).first()
    if not has_booking:
        flash('You can only message students you have a booking with.', 'warning')
        return redirect(url_for('tutor_bp.tutor_dashboard'))

    existing = Conversation.query.filter_by(
        student_id=student_id, tutor_id=tutor_id).first()
    if existing:
        return redirect(url_for('chat_bp.chat_room', conv_id=existing.id))

    conv = Conversation(student_id=student_id, tutor_id=tutor_id,
                        started_by='tutor')
    db.session.add(conv)
    db.session.commit()
    return redirect(url_for('chat_bp.chat_room', conv_id=conv.id))


@chat_bp.route('/chat/<int:conv_id>/send', methods=['POST'])
def send_message_http(conv_id):
    user_type, user_id, user_name = _get_user_info()
    if not user_type:
        return jsonify(error='Not logged in'), 401

    conv = Conversation.query.get_or_404(conv_id)
    if not _user_in_conversation(conv, user_type, user_id):
        return jsonify(error='Unauthorized'), 403

    if conv.is_blocked():
        flash('This conversation is blocked.', 'warning')
        return redirect(url_for('chat_bp.chat_room', conv_id=conv_id))

    content = sanitize_input_length(request.form.get('content', ''), 2000)
    if not content:
        flash('Message cannot be empty.', 'warning')
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


@chat_bp.route('/api/chat/<int:conv_id>/send', methods=['POST'])
@limiter.limit('60 per minute')
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
    content = sanitize_input_length(data.get('content', ''), 2000)
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

    # Emit via SocketIO if available
    try:
        from flask_socketio import emit
        from extensions import socketio
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

    return jsonify(
        id=msg.id,
        sender_type=user_type,
        sender_name=user_name,
        content=msg.content,
        timestamp=msg.created_at.strftime('%I:%M %p')
    )


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

    # Emit read receipt
    try:
        from flask_socketio import emit
        from extensions import socketio
        socketio.emit('read_receipt', {
            'conversation_id': conv_id,
            'read_by': user_type
        }, room=f'conv_{conv_id}')
    except Exception:
        pass

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

    flash('Conversation blocked.', 'info')
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

    flash('Conversation unblocked.', 'info')
    return redirect(url_for('chat_bp.chat_room', conv_id=conv_id))
