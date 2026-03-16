"""
JSON API endpoints for admin recording management and session consent.

Blueprint prefix: /api/v1
All endpoints return the standard envelope:
  {"success": True,  "data": {...}}
  {"success": False, "error": {"message": "...", "code": 400}}
"""

from flask import Blueprint, jsonify, request, current_app
from flask_login import current_user, login_required
from functools import wraps
from datetime import datetime, timedelta
from database import db
from models.recording import SessionRecording
from models.slots import TutorSlot
from models.booking import Booking
from models.student import Student
from models.tutor import Tutor
from models.audit_log import AuditLog

api_recordings_bp = Blueprint('api_recordings', __name__, url_prefix='/api/v1')


# -- Helpers ----------------------------------------------------------------

def _ok(data, status=200):
    return jsonify({"success": True, "data": data}), status


def _err(message, code=400, field=None):
    payload = {"success": False, "error": {"message": message, "code": code}}
    if field:
        payload["error"]["field"] = field
    return jsonify(payload), code


def _admin_required(f):
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if current_user.user_type != 'admin':
            return _err("Admin access required", 403)
        return f(*args, **kwargs)
    return decorated


def _log_action(action, target_type=None, target_id=None, details=None):
    """Create an audit log entry for the current admin."""
    log = AuditLog(
        admin_id=current_user.id,
        admin_name=current_user.name,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
        ip_address=request.remote_addr,
    )
    db.session.add(log)


# -- GET /api/v1/admin/recordings -----------------------------------------

@api_recordings_bp.route('/admin/recordings', methods=['GET'])
@_admin_required
def list_recordings():
    slot_id = request.args.get('slot_id', type=int)
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    query = db.session.query(
        SessionRecording, TutorSlot, Student, Tutor
    ).join(
        TutorSlot, SessionRecording.slot_id == TutorSlot.id
    ).outerjoin(
        Student, TutorSlot.student_id == Student.id
    ).join(
        Tutor, TutorSlot.tutor_id == Tutor.id
    ).filter(
        SessionRecording.is_deleted == False
    )

    if slot_id:
        query = query.filter(SessionRecording.slot_id == slot_id)

    paginated = query.order_by(SessionRecording.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    recordings = []
    for rec, slot, student, tutor in paginated.items:
        recordings.append({
            "id": rec.id,
            "slot_id": rec.slot_id,
            "student_name": student.name if student else None,
            "tutor_name": tutor.name if tutor else None,
            "subject": slot.subject if slot else None,
            "session_date": slot.date.isoformat() if slot else None,
            "duration_minutes": round(rec.duration_seconds / 60, 1) if rec.duration_seconds else None,
            "quality": rec.quality,
            "file_size_mb": round(rec.file_size_bytes / 1048576, 2) if rec.file_size_bytes else None,
            "student_consent": rec.consent_student,
            "tutor_consent": rec.consent_tutor,
            "expires_at": rec.expires_at.isoformat() if rec.expires_at else None,
            "created_at": rec.created_at.isoformat() if rec.created_at else None,
            "is_expired": rec.is_expired,
        })

    return _ok({
        "recordings": recordings,
        "meta": {
            "total": paginated.total,
            "page": paginated.page,
            "per_page": paginated.per_page,
        },
    })


# -- GET /api/v1/admin/recordings/<id>/access -----------------------------

@api_recordings_bp.route('/admin/recordings/<int:recording_id>/access', methods=['GET'])
@_admin_required
def access_recording(recording_id):
    reason = request.args.get('reason', '')
    if not reason or len(reason) < 10:
        return _err("A reason of at least 10 characters is required", 400, field="reason")

    recording = SessionRecording.query.get(recording_id)
    if not recording:
        return _err("Recording not found", 404)

    if recording.is_deleted:
        return _err("Recording has been deleted", 404)

    if recording.is_expired:
        return _err("Recording has expired", 410)

    # Generate a placeholder presigned URL (in production would use R2 client)
    expires_at = datetime.utcnow() + timedelta(hours=4)
    stream_url = f"/api/v1/admin/recordings/{recording_id}/stream?expires={int(expires_at.timestamp())}"

    # Create audit log entry
    _log_action('recording_accessed', 'recording', recording_id, {
        'reason': reason,
        'accessed_at': datetime.utcnow().isoformat(),
    })

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Audit log commit error for recording {recording_id}: {e}")

    slot = TutorSlot.query.get(recording.slot_id)
    student = Student.query.get(slot.student_id) if slot and slot.student_id else None
    tutor = Tutor.query.get(slot.tutor_id) if slot else None

    return _ok({
        "stream_url": stream_url,
        "expires_at": expires_at.isoformat(),
        "recording": {
            "id": recording.id,
            "slot_id": recording.slot_id,
            "student_name": student.name if student else None,
            "tutor_name": tutor.name if tutor else None,
            "subject": slot.subject if slot else None,
            "session_date": slot.date.isoformat() if slot else None,
            "duration_minutes": round(recording.duration_seconds / 60, 1) if recording.duration_seconds else None,
            "quality": recording.quality,
            "created_at": recording.created_at.isoformat() if recording.created_at else None,
        },
    })


# -- DELETE /api/v1/admin/recordings/<id> ----------------------------------

@api_recordings_bp.route('/admin/recordings/<int:recording_id>', methods=['DELETE'])
@_admin_required
def delete_recording(recording_id):
    # Superadmin role check
    if getattr(current_user, 'role', None) != 'superadmin':
        return _err("Only superadmin can delete recordings", 403)

    recording = SessionRecording.query.get(recording_id)
    if not recording:
        return _err("Recording not found", 404)

    recording.is_deleted = True

    _log_action('recording_deleted', 'recording', recording_id, {
        'slot_id': recording.slot_id,
        'deleted_at': datetime.utcnow().isoformat(),
    })

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Recording delete error for recording {recording_id}: {e}")
        return _err("Failed to delete recording", 500)

    return _ok({})


# -- POST /api/v1/session/<slot_id>/recording/consent ---------------------

@api_recordings_bp.route('/session/<int:slot_id>/recording/consent', methods=['POST'])
@login_required
def recording_consent(slot_id):
    body = request.get_json(silent=True)
    if body is None:
        return _err("Request body must be JSON", 400)

    consent = body.get('consent', False)

    booking = Booking.query.filter_by(slot_id=slot_id).first()
    if not booking:
        return _err("No booking found for this session", 404)

    # Verify current user is a participant
    is_student = current_user.user_type == 'student' and booking.student_id == current_user.id
    is_tutor = current_user.user_type == 'tutor' and booking.tutor_id == current_user.id

    if not is_student and not is_tutor:
        return _err("You are not a participant of this session", 403)

    if is_student:
        booking.recording_consent_student = consent
    elif is_tutor:
        booking.recording_consent_tutor = consent

    both_consented = bool(booking.recording_consent_student and booking.recording_consent_tutor)

    # If both parties have consented, create the SessionRecording record
    if both_consented:
        existing = SessionRecording.query.filter_by(
            slot_id=slot_id, booking_id=booking.id
        ).first()

        if not existing:
            recording = SessionRecording(
                slot_id=slot_id,
                booking_id=booking.id,
                consent_student=True,
                consent_tutor=True,
                expires_at=datetime.utcnow() + timedelta(days=90),
            )
            db.session.add(recording)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Recording consent error for slot {slot_id}: {e}")
        return _err("Failed to update consent", 500)

    return _ok({"both_consented": both_consented})
