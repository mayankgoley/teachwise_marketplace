from flask import (Blueprint, render_template, request, redirect,
                    url_for, flash, jsonify, current_app)
from flask_login import current_user, login_required
from database import db
from models.message import Conversation, Message
from extensions import limiter, socketio
from models.tutor import Tutor
from models.student import Student
from models.booking import Booking
from utils.sanitizer import sanitize_input_length
from flask_socketio import emit, join_room, leave_room
from datetime import datetime, timedelta
from sqlalchemy import func
import uuid
import os

chat_bp = Blueprint('chat_bp', __name__)

ALLOWED_FILE_TYPES = {
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'application/zip'
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _get_user_info():
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
    if not convs:
        return {}
    conv_ids = [c.id for c in convs]
    max_time = (
        db.session.query(
            Message.conversation_id,
            func.max(Message.created_at).label('max_created')
        )
        .filter(Message.conversation_id.in_(conv_ids))
        .group_by(Message.conversation_id)
        .subquery()
    )
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
        if msg.is_deleted:
            preview = 'This message was deleted'
        elif msg.message_type in ('image', 'file'):
            preview = f'[{msg.file_name or "File"}]'
        else:
            preview = msg.content[:50] + ('...' if len(msg.content) > 50 else '')
        last_msgs[msg.conversation_id] = {'text': preview, 'sender_type': msg.sender_type}
    return last_msgs


# ═══════════════════════════════════════════════════════════
# PAGE ROUTES
# ═══════════════════════════════════════════════════════════

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

    # Mark messages as read + update status
    Message.query.filter_by(
        conversation_id=conv_id, is_read=False
    ).filter(Message.sender_type != user_type).update({
        'is_read': True,
        'status': 'read',
        'read_at': datetime.utcnow()
    })
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


# ═══════════════════════════════════════════════════════════
# CONVERSATION CREATION
# ═══════════════════════════════════════════════════════════

@chat_bp.route('/chat/start-with-tutor/<int:tutor_id>', methods=['POST'])
@login_required
def start_with_tutor(tutor_id):
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


# ═══════════════════════════════════════════════════════════
# SEND MESSAGE (HTTP + form fallback)
# ═══════════════════════════════════════════════════════════

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
        content=content,
        status='sent'
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
    msg_type = data.get('type', 'text')
    file_url = data.get('file_url')
    file_name = data.get('file_name')
    file_size = data.get('file_size')
    file_mime = data.get('file_mime_type')

    if msg_type == 'text' and not content:
        return jsonify(error='Empty message'), 400

    msg = Message(
        conversation_id=conv_id,
        sender_type=user_type,
        sender_id=user_id,
        content=content or '',
        status='sent',
        message_type=msg_type,
        file_url=file_url,
        file_name=file_name,
        file_size=file_size,
        file_mime_type=file_mime
    )
    db.session.add(msg)
    conv.last_message_at = datetime.utcnow()
    db.session.commit()

    payload = {
        'id': msg.id,
        'conversation_id': conv_id,
        'sender_type': user_type,
        'sender_name': user_name,
        'content': msg.content,
        'timestamp': msg.created_at.strftime('%I:%M %p'),
        'is_read': False,
        'status': 'sent',
        'message_type': msg_type,
        'file_url': file_url,
        'file_name': file_name,
        'file_size': file_size,
        'file_mime_type': file_mime
    }

    try:
        socketio.emit('new_message', payload, room=f'conv_{conv_id}')
    except Exception:
        pass

    return jsonify(**payload)


# ═══════════════════════════════════════════════════════════
# READ / STATUS / UNREAD
# ═══════════════════════════════════════════════════════════

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

    now = datetime.utcnow()
    Message.query.filter_by(
        conversation_id=conv_id, is_read=False
    ).filter(Message.sender_type != user_type).update({
        'is_read': True,
        'status': 'read',
        'read_at': now
    })
    db.session.commit()

    try:
        socketio.emit('messages_read', {
            'conversation_id': conv_id,
            'read_by': user_type
        }, room=f'conv_{conv_id}')
    except Exception:
        pass

    return jsonify(success=True)


# ═══════════════════════════════════════════════════════════
# BLOCK / UNBLOCK
# ═══════════════════════════════════════════════════════════

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

    if request.headers.get('Accept') == 'application/json':
        return jsonify(success=True)
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


# ═══════════════════════════════════════════════════════════
# FILE UPLOAD
# ═══════════════════════════════════════════════════════════

@chat_bp.route('/chat/upload', methods=['POST'])
@login_required
@limiter.limit('20 per minute')
def upload_file():
    user_type, user_id, _ = _get_user_info()
    conv_id = request.form.get('conversation_id', type=int)
    if not conv_id:
        return jsonify(error='Missing conversation_id'), 400

    conv = Conversation.query.get_or_404(conv_id)
    if not _user_in_conversation(conv, user_type, user_id):
        return jsonify(error='Unauthorized'), 403

    file = request.files.get('file')
    if not file or not file.filename:
        return jsonify(error='No file selected'), 400

    # Validate size
    file_bytes = file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        return jsonify(error='File too large (max 10 MB)'), 400

    # Validate type
    content_type = file.content_type or 'application/octet-stream'
    if content_type not in ALLOWED_FILE_TYPES:
        return jsonify(error='File type not allowed'), 400

    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else 'bin'
    r2_path = f'chat-attachments/{conv_id}/{uuid.uuid4().hex[:12]}.{ext}'

    from services.storage_service import upload_public_file
    url = upload_public_file(file_bytes, r2_path, content_type)
    if not url:
        return jsonify(error='Upload failed'), 500

    msg_type = 'image' if content_type.startswith('image/') else 'file'

    return jsonify(
        url=url,
        file_name=file.filename,
        file_size=len(file_bytes),
        mime_type=content_type,
        message_type=msg_type
    )


# ═══════════════════════════════════════════════════════════
# MESSAGE SEARCH
# ═══════════════════════════════════════════════════════════

@chat_bp.route('/chat/<int:conv_id>/search')
def search_messages(conv_id):
    user_type, user_id, _ = _get_user_info()
    if not user_type:
        return jsonify(error='Not logged in'), 401

    conv = Conversation.query.get_or_404(conv_id)
    if not _user_in_conversation(conv, user_type, user_id):
        return jsonify(error='Unauthorized'), 403

    q = request.args.get('q', '').strip()
    if len(q) < 2:
        return jsonify(results=[])

    msgs = Message.query.filter(
        Message.conversation_id == conv_id,
        Message.is_deleted == False,
        Message.content.ilike(f'%{q}%')
    ).order_by(Message.created_at.desc()).limit(20).all()

    results = []
    for m in msgs:
        sender_name = ''
        if m.sender_type == 'student':
            s = Student.query.get(m.sender_id)
            sender_name = s.name if s else 'Student'
        else:
            t = Tutor.query.get(m.sender_id)
            sender_name = t.name if t else 'Tutor'

        results.append({
            'id': m.id,
            'content': m.content[:200],
            'sender_name': sender_name,
            'sender_type': m.sender_type,
            'created_at': m.created_at.strftime('%b %d, %I:%M %p')
        })

    return jsonify(results=results)


# ═══════════════════════════════════════════════════════════
# MESSAGE EDIT / DELETE
# ═══════════════════════════════════════════════════════════

@chat_bp.route('/chat/message/<int:msg_id>', methods=['PUT'])
@login_required
def edit_message(msg_id):
    user_type, user_id, _ = _get_user_info()
    msg = Message.query.get_or_404(msg_id)

    if msg.sender_type != user_type or msg.sender_id != user_id:
        return jsonify(error='Can only edit your own messages'), 403

    # 15-minute edit window
    if datetime.utcnow() - msg.created_at > timedelta(minutes=15):
        return jsonify(error='Edit window expired (15 minutes)'), 403

    if msg.is_deleted:
        return jsonify(error='Cannot edit deleted message'), 400

    data = request.get_json() or {}
    new_content = sanitize_input_length(data.get('content', ''), 2000)
    if not new_content:
        return jsonify(error='Content cannot be empty'), 400

    msg.content = new_content
    msg.edited_at = datetime.utcnow()
    db.session.commit()

    try:
        socketio.emit('message_edited', {
            'message_id': msg.id,
            'content': msg.content,
            'edited_at': msg.edited_at.strftime('%I:%M %p')
        }, room=f'conv_{msg.conversation_id}')
    except Exception:
        pass

    return jsonify(success=True, content=msg.content)


@chat_bp.route('/chat/message/<int:msg_id>', methods=['DELETE'])
@login_required
def delete_message(msg_id):
    user_type, user_id, _ = _get_user_info()
    msg = Message.query.get_or_404(msg_id)

    # Admins can delete any message
    is_admin = user_type == 'admin'
    is_owner = msg.sender_type == user_type and msg.sender_id == user_id

    if not is_owner and not is_admin:
        return jsonify(error='Can only delete your own messages'), 403

    msg.is_deleted = True
    msg.content = ''
    db.session.commit()

    try:
        socketio.emit('message_deleted', {
            'message_id': msg.id
        }, room=f'conv_{msg.conversation_id}')
    except Exception:
        pass

    return jsonify(success=True)


# ═══════════════════════════════════════════════════════════
# SOCKET.IO EVENT HANDLERS
# ═══════════════════════════════════════════════════════════

@socketio.on('join_conversation')
def handle_join(data):
    conv_id = data.get('conversation_id')
    if conv_id:
        join_room(f'conv_{conv_id}')


@socketio.on('leave_conversation')
def handle_leave(data):
    conv_id = data.get('conversation_id')
    if conv_id:
        leave_room(f'conv_{conv_id}')


@socketio.on('typing_start')
def handle_typing_start(data):
    conv_id = data.get('conversation_id')
    if conv_id:
        emit('user_typing', {
            'user_type': data.get('user_type', ''),
            'user_name': data.get('user_name', '')
        }, room=f'conv_{conv_id}', include_self=False)


@socketio.on('typing_stop')
def handle_typing_stop(data):
    conv_id = data.get('conversation_id')
    if conv_id:
        emit('user_stopped_typing', {
            'user_type': data.get('user_type', '')
        }, room=f'conv_{conv_id}', include_self=False)


@socketio.on('typing')
def handle_typing_compat(data):
    """Backward-compatible handler for existing 'typing' event."""
    conv_id = data.get('conversation_id')
    if conv_id:
        emit('user_typing', {
            'user_type': data.get('user_type', ''),
            'user_name': data.get('user_name', '')
        }, room=f'conv_{conv_id}', include_self=False)


@socketio.on('message_received')
def handle_message_received(data):
    """Client acknowledges receipt - update status to delivered."""
    msg_id = data.get('message_id')
    if not msg_id:
        return
    msg = Message.query.get(msg_id)
    if msg and msg.status == 'sent':
        msg.status = 'delivered'
        db.session.commit()
        emit('message_status', {
            'message_id': msg.id,
            'status': 'delivered',
            'conversation_id': msg.conversation_id
        }, room=f'conv_{msg.conversation_id}')


@socketio.on('mark_read')
def handle_mark_read(data):
    """Mark all messages in conversation as read via Socket."""
    from flask_login import current_user as sock_user
    conv_id = data.get('conversation_id')
    user_type = data.get('user_type')
    if not conv_id or not user_type:
        return

    now = datetime.utcnow()
    Message.query.filter(
        Message.conversation_id == conv_id,
        Message.sender_type != user_type,
        Message.is_read == False
    ).update({
        'is_read': True,
        'status': 'read',
        'read_at': now
    })
    db.session.commit()

    emit('messages_read', {
        'conversation_id': conv_id,
        'read_by': user_type
    }, room=f'conv_{conv_id}', include_self=False)
