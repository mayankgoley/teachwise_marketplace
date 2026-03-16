"""
JSON API endpoints for real-time chat (conversations and messages).

Blueprint prefix: /api/v1
All endpoints return the standard envelope:
  {"success": True,  "data": {...}}
  {"success": False, "error": {"message": "...", "code": 400}}
"""

from datetime import datetime
from functools import wraps

from flask import Blueprint, jsonify, request, current_app
from flask_login import current_user, login_required

from database import db
from models.message import Conversation, Message
from models.student import Student
from models.tutor import Tutor

api_chat_bp = Blueprint(
    'api_chat', __name__, url_prefix='/api/v1'
)


# ── Helpers ──────────────────────────────────────────────────────────

def _ok(data, status=200):
    return jsonify({"success": True, "data": data}), status


def _err(message, code=400, field=None):
    payload = {"success": False, "error": {"message": message, "code": code}}
    if field:
        payload["error"]["field"] = field
    return jsonify(payload), code


def _photo_url(photo_value):
    if not photo_value:
        return None
    if photo_value.startswith("http") or photo_value.startswith("/"):
        return photo_value
    return f"/static/uploads/photos/{photo_value}"


def _user_can_access_conversation(conv):
    """Check if the current user is a participant of this conversation."""
    if current_user.user_type == 'student' and conv.student_id == current_user.id:
        return True
    if current_user.user_type == 'tutor' and conv.tutor_id == current_user.id:
        return True
    return False


def _get_other_party(conv):
    """Get the other party's info in the conversation."""
    if current_user.user_type == 'student':
        tutor = Tutor.query.get(conv.tutor_id)
        return {
            "id": tutor.id if tutor else None,
            "name": tutor.name if tutor else "Unknown",
            "avatar_url": _photo_url(tutor.profile_photo) if tutor else None,
            "type": "tutor",
        }
    else:
        student = Student.query.get(conv.student_id)
        return {
            "id": student.id if student else None,
            "name": student.name if student else "Unknown",
            "avatar_url": None,  # Students don't have profile photos
            "type": "student",
        }


def _serialize_conversation(conv):
    """Serialize a Conversation to dict with last message preview."""
    other = _get_other_party(conv)

    # Get last message
    last_msg = (
        Message.query
        .filter_by(conversation_id=conv.id)
        .filter_by(is_deleted=False)
        .order_by(Message.created_at.desc())
        .first()
    )

    # Count unread messages for current user
    unread_count = Message.query.filter(
        Message.conversation_id == conv.id,
        Message.is_read == False,
        Message.is_deleted == False,
        Message.sender_type != current_user.user_type,
    ).count()

    return {
        "id": conv.id,
        "other_party": other,
        "last_message": {
            "content": last_msg.content if last_msg else None,
            "sender_type": last_msg.sender_type if last_msg else None,
            "created_at": last_msg.created_at.isoformat() if last_msg else None,
            "message_type": last_msg.message_type if last_msg else None,
        } if last_msg else None,
        "unread_count": unread_count,
        "is_blocked": conv.is_blocked(),
        "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
    }


def _serialize_message(msg):
    """Serialize a Message to dict."""
    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender_type": msg.sender_type,
        "sender_id": msg.sender_id,
        "content": msg.content if not msg.is_deleted else "[Message deleted]",
        "is_read": msg.is_read,
        "status": msg.status,
        "read_at": msg.read_at.isoformat() if msg.read_at else None,
        "message_type": msg.message_type,
        "file_url": msg.file_url,
        "file_name": msg.file_name,
        "file_size": msg.file_size,
        "file_mime_type": msg.file_mime_type,
        "edited_at": msg.edited_at.isoformat() if msg.edited_at else None,
        "is_deleted": msg.is_deleted,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }


# ═══════════════════════════════════════════════════════════════════════
# 1. GET /api/v1/chat/conversations
# ═══════════════════════════════════════════════════════════════════════

@api_chat_bp.route('/chat/conversations', methods=['GET'])
@login_required
def list_conversations():
    if current_user.user_type == 'student':
        convs = Conversation.query.filter_by(
            student_id=current_user.id
        ).order_by(Conversation.last_message_at.desc()).all()
    elif current_user.user_type == 'tutor':
        convs = Conversation.query.filter_by(
            tutor_id=current_user.id
        ).order_by(Conversation.last_message_at.desc()).all()
    else:
        return _err("Access denied", 403)

    return _ok({
        "conversations": [_serialize_conversation(c) for c in convs],
    })


# ═══════════════════════════════════════════════════════════════════════
# 2. GET /api/v1/chat/conversations/<id>/messages
# ═══════════════════════════════════════════════════════════════════════

@api_chat_bp.route('/chat/conversations/<int:conv_id>/messages', methods=['GET'])
@login_required
def get_messages(conv_id):
    conv = Conversation.query.get(conv_id)
    if not conv:
        return _err("Conversation not found", 404)

    if not _user_can_access_conversation(conv):
        return _err("Access denied", 403)

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 100)

    query = (
        Message.query
        .filter_by(conversation_id=conv.id)
        .order_by(Message.created_at.desc())
    )
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    # Mark unread messages from the other party as read
    now = datetime.utcnow()
    unread = Message.query.filter(
        Message.conversation_id == conv.id,
        Message.is_read == False,
        Message.sender_type != current_user.user_type,
    ).all()
    for msg in unread:
        msg.is_read = True
        msg.status = 'read'
        msg.read_at = now
    if unread:
        db.session.commit()

    messages = [_serialize_message(m) for m in paginated.items]
    # Reverse to get chronological order for the page
    messages.reverse()

    other = _get_other_party(conv)

    return _ok({
        "messages": messages,
        "other_party": other,
        "is_blocked": conv.is_blocked(),
        "meta": {
            "page": paginated.page,
            "per_page": paginated.per_page,
            "total": paginated.total,
            "pages": paginated.pages,
            "has_next": paginated.has_next,
            "has_prev": paginated.has_prev,
        },
    })


# ═══════════════════════════════════════════════════════════════════════
# 3. POST /api/v1/chat/conversations/<id>/messages
# ═══════════════════════════════════════════════════════════════════════

@api_chat_bp.route('/chat/conversations/<int:conv_id>/messages', methods=['POST'])
@login_required
def send_message(conv_id):
    conv = Conversation.query.get(conv_id)
    if not conv:
        return _err("Conversation not found", 404)

    if not _user_can_access_conversation(conv):
        return _err("Access denied", 403)

    if conv.is_blocked():
        return _err("This conversation is blocked", 423)

    # Support both JSON and multipart (for file uploads)
    content = ''
    message_type = 'text'
    file_url = None
    file_name = None
    file_size = None
    file_mime_type = None

    if request.content_type and 'multipart' in request.content_type:
        content = request.form.get('content', '').strip()
        uploaded = request.files.get('file')
        if uploaded and uploaded.filename:
            from services.storage_service import upload_document
            file_bytes = uploaded.read()
            if len(file_bytes) > 10 * 1024 * 1024:  # 10 MB limit
                return _err("File size exceeds 10 MB limit", 400)

            result = upload_document(file_bytes, current_user.id, uploaded.filename)
            if result:
                file_url = result.get('r2_object_key')
                file_name = uploaded.filename
                file_size = len(file_bytes)
                file_mime_type = uploaded.content_type
                # Determine message type
                if file_mime_type and file_mime_type.startswith('image/'):
                    message_type = 'image'
                else:
                    message_type = 'file'
    else:
        body = request.get_json(silent=True)
        if not body:
            return _err("Request body must be JSON", 400)
        content = body.get('content', '').strip()

    if not content and not file_url:
        return _err("Message content or file is required", 400)

    msg = Message(
        conversation_id=conv.id,
        sender_type=current_user.user_type,
        sender_id=current_user.id,
        content=content or '',
        message_type=message_type,
        file_url=file_url,
        file_name=file_name,
        file_size=file_size,
        file_mime_type=file_mime_type,
    )
    db.session.add(msg)
    conv.last_message_at = datetime.utcnow()
    db.session.commit()

    serialized = _serialize_message(msg)

    # Emit via Socket.IO if available
    try:
        from extensions import socketio
        room = f'chat_{conv.id}'
        socketio.emit('new_message', serialized, room=room)
    except Exception:
        pass

    # Send notification to the other party
    try:
        from models.in_app_notification import InAppNotification
        if current_user.user_type == 'student':
            notif_user_id = conv.tutor_id
            notif_role = 'tutor'
        else:
            notif_user_id = conv.student_id
            notif_role = 'student'

        notif = InAppNotification(
            user_id=notif_user_id,
            user_role=notif_role,
            title='New Message',
            message=f'{current_user.name}: {content[:60]}' if content else f'{current_user.name} sent a file',
            type='message',
            url=f'/dashboard/{notif_role}/chat',
        )
        db.session.add(notif)
        db.session.commit()
    except Exception:
        pass

    return _ok(serialized, status=201)


# ═══════════════════════════════════════════════════════════════════════
# 4. POST /api/v1/chat/conversations/start
# ═══════════════════════════════════════════════════════════════════════

@api_chat_bp.route('/chat/conversations/start', methods=['POST'])
@login_required
def start_conversation():
    body = request.get_json(silent=True)
    if not body:
        return _err("Request body must be JSON", 400)

    if current_user.user_type == 'student':
        tutor_id = body.get('tutor_id')
        if not tutor_id:
            return _err("tutor_id is required", 400, field="tutor_id")

        tutor = Tutor.query.get(tutor_id)
        if not tutor:
            return _err("Tutor not found", 404)

        student_id = current_user.id

    elif current_user.user_type == 'tutor':
        student_id = body.get('student_id')
        if not student_id:
            return _err("student_id is required", 400, field="student_id")

        student = Student.query.get(student_id)
        if not student:
            return _err("Student not found", 404)

        tutor_id = current_user.id
    else:
        return _err("Access denied", 403)

    # Check if conversation already exists
    existing = Conversation.query.filter_by(
        student_id=student_id,
        tutor_id=tutor_id,
    ).first()

    if existing:
        return _ok(_serialize_conversation(existing))

    conv = Conversation(
        student_id=student_id,
        tutor_id=tutor_id,
        started_by=current_user.user_type,
    )
    db.session.add(conv)
    db.session.commit()

    return _ok(_serialize_conversation(conv), status=201)
