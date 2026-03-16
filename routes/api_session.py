"""
JSON API endpoints for video sessions (join, end, summary, receipt).

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
from models.slots import TutorSlot
from models.booking import Booking
from models.student import Student
from models.tutor import Tutor
from models.session_note import SessionNote
from models.recording import SessionRecording

api_session_bp = Blueprint(
    'api_session', __name__, url_prefix='/api/v1'
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


def _user_in_session(slot):
    """Check if the current user is a participant of the session."""
    if current_user.user_type == 'student' and slot.student_id == current_user.id:
        return True
    if current_user.user_type == 'tutor' and slot.tutor_id == current_user.id:
        return True
    return False


# ═══════════════════════════════════════════════════════════════════════
# 1. GET /api/v1/session/<slot_id>/join
# ═══════════════════════════════════════════════════════════════════════

@api_session_bp.route('/session/<int:slot_id>/join', methods=['GET'])
@login_required
def join_session(slot_id):
    slot = TutorSlot.query.get(slot_id)
    if not slot:
        return _err("Session not found", 404)

    if not _user_in_session(slot):
        return _err("Access denied", 403)

    if slot.status not in ('booked', 'live'):
        return _err(f"Session is not available for joining (status: {slot.status})", 400)

    # Get the booking
    booking = Booking.query.filter_by(slot_id=slot.id).first()

    # Generate Jitsi room name if not set
    if not slot.jitsi_room_name:
        import uuid
        slot.jitsi_room_name = f"teachwise-{slot.id}-{uuid.uuid4().hex[:8]}"
        db.session.commit()

    # Get participant info
    tutor = Tutor.query.get(slot.tutor_id)
    student = Student.query.get(slot.student_id) if slot.student_id else None

    # Build Jitsi config
    jitsi_domain = current_app.config.get('JITSI_DOMAIN', 'meet.jit.si')

    return _ok({
        "slot_id": slot.id,
        "room_name": slot.jitsi_room_name,
        "jitsi_domain": jitsi_domain,
        "subject": slot.subject,
        "date": slot.date.isoformat() if slot.date else None,
        "start_time": slot.start_time.strftime("%H:%M") if slot.start_time else None,
        "end_time": slot.end_time.strftime("%H:%M") if slot.end_time else None,
        "mode": slot.mode,
        "status": slot.status,
        "tutor": {
            "id": tutor.id,
            "name": tutor.name,
            "avatar_url": _photo_url(tutor.profile_photo),
        } if tutor else None,
        "student": {
            "id": student.id,
            "name": student.name,
        } if student else None,
        "user_role": current_user.user_type,
        "user_name": current_user.name,
        "recording_consent": {
            "student": booking.recording_consent_student if booking else False,
            "tutor": booking.recording_consent_tutor if booking else False,
        },
    })


# ═══════════════════════════════════════════════════════════════════════
# 2. POST /api/v1/session/<slot_id>/end
# ═══════════════════════════════════════════════════════════════════════

@api_session_bp.route('/session/<int:slot_id>/end', methods=['POST'])
@login_required
def end_session(slot_id):
    slot = TutorSlot.query.get(slot_id)
    if not slot:
        return _err("Session not found", 404)

    # Only tutor can end the session
    if current_user.user_type != 'tutor' or slot.tutor_id != current_user.id:
        return _err("Only the tutor can end the session", 403)

    if slot.status not in ('booked', 'live'):
        return _err(f"Session cannot be ended (status: {slot.status})", 400)

    slot.status = 'completed'
    db.session.commit()

    # Update tutor's completed session count
    tutor = Tutor.query.get(slot.tutor_id)
    if tutor:
        tutor.total_sessions_completed = (tutor.total_sessions_completed or 0) + 1
        db.session.commit()

    # Notify student
    try:
        from models.in_app_notification import InAppNotification
        if slot.student_id:
            notif = InAppNotification(
                user_id=slot.student_id,
                user_role='student',
                title='Session Completed',
                message=f'Your session for {slot.subject or "tutoring"} has ended',
                type='session',
                url=f'/dashboard/student/bookings',
            )
            db.session.add(notif)
            db.session.commit()
    except Exception:
        pass

    return _ok({
        "slot_id": slot.id,
        "status": "completed",
        "message": "Session ended successfully",
    })


# ═══════════════════════════════════════════════════════════════════════
# 3. GET /api/v1/session/<slot_id>/summary
# ═══════════════════════════════════════════════════════════════════════

@api_session_bp.route('/session/<int:slot_id>/summary', methods=['GET'])
@login_required
def session_summary(slot_id):
    slot = TutorSlot.query.get(slot_id)
    if not slot:
        return _err("Session not found", 404)

    if not _user_in_session(slot):
        return _err("Access denied", 403)

    tutor = Tutor.query.get(slot.tutor_id)
    student = Student.query.get(slot.student_id) if slot.student_id else None
    booking = Booking.query.filter_by(slot_id=slot.id).first()

    # Get session notes
    notes = SessionNote.query.filter_by(slot_id=slot.id).order_by(
        SessionNote.created_at.desc()
    ).all()

    # Filter private notes
    visible_notes = []
    for n in notes:
        if n.is_private:
            if (current_user.user_type == n.author_type and
                    current_user.id == n.author_id):
                visible_notes.append(n)
        else:
            visible_notes.append(n)

    # Get recordings
    recordings = SessionRecording.query.filter_by(
        slot_id=slot.id, is_deleted=False
    ).all()

    # Calculate duration
    duration_minutes = None
    if slot.start_time and slot.end_time:
        start_dt = datetime.combine(datetime.today(), slot.start_time)
        end_dt = datetime.combine(datetime.today(), slot.end_time)
        duration_minutes = int((end_dt - start_dt).total_seconds() / 60)

    return _ok({
        "slot_id": slot.id,
        "subject": slot.subject,
        "date": slot.date.isoformat() if slot.date else None,
        "start_time": slot.start_time.strftime("%H:%M") if slot.start_time else None,
        "end_time": slot.end_time.strftime("%H:%M") if slot.end_time else None,
        "duration_minutes": duration_minutes,
        "mode": slot.mode,
        "status": slot.status,
        "price": float(slot.price) if slot.price else 0,
        "tutor": {
            "id": tutor.id,
            "name": tutor.name,
            "avatar_url": _photo_url(tutor.profile_photo),
        } if tutor else None,
        "student": {
            "id": student.id,
            "name": student.name,
        } if student else None,
        "notes": [
            {
                "id": n.id,
                "content": n.content,
                "author_type": n.author_type,
                "is_private": n.is_private,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in visible_notes
        ],
        "recordings": [
            {
                "id": r.id,
                "duration_seconds": r.duration_seconds,
                "is_consented": r.is_consented,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in recordings
        ],
        "booking": {
            "id": booking.id,
            "status": booking.status,
            "booked_on": booking.booked_on.isoformat() if booking.booked_on else None,
        } if booking else None,
    })


# ═══════════════════════════════════════════════════════════════════════
# 4. GET /api/v1/session/<slot_id>/receipt
# ═══════════════════════════════════════════════════════════════════════

@api_session_bp.route('/session/<int:slot_id>/receipt', methods=['GET'])
@login_required
def session_receipt(slot_id):
    slot = TutorSlot.query.get(slot_id)
    if not slot:
        return _err("Session not found", 404)

    if not _user_in_session(slot):
        return _err("Access denied", 403)

    if slot.status != 'completed':
        return _err("Receipt is only available for completed sessions", 400)

    tutor = Tutor.query.get(slot.tutor_id)
    student = Student.query.get(slot.student_id) if slot.student_id else None
    booking = Booking.query.filter_by(slot_id=slot.id).first()

    # Calculate duration
    duration_minutes = None
    if slot.start_time and slot.end_time:
        start_dt = datetime.combine(datetime.today(), slot.start_time)
        end_dt = datetime.combine(datetime.today(), slot.end_time)
        duration_minutes = int((end_dt - start_dt).total_seconds() / 60)

    # Get payment info if available
    payment_info = None
    try:
        from models.payment import Payment
        payment = Payment.query.filter_by(
            booking_id=booking.id
        ).first() if booking else None
        if payment:
            payment_info = {
                "id": payment.id,
                "amount": float(payment.amount) if payment.amount else 0,
                "status": payment.status,
                "paid_at": payment.created_at.isoformat() if payment.created_at else None,
            }
    except Exception:
        pass

    price = float(slot.price) if slot.price else 0
    platform_fee = round(price * 0.15, 2)  # 15% platform fee
    tutor_payout = round(price - platform_fee, 2)

    return _ok({
        "slot_id": slot.id,
        "subject": slot.subject,
        "date": slot.date.isoformat() if slot.date else None,
        "start_time": slot.start_time.strftime("%H:%M") if slot.start_time else None,
        "end_time": slot.end_time.strftime("%H:%M") if slot.end_time else None,
        "duration_minutes": duration_minutes,
        "mode": slot.mode,
        "tutor": {
            "id": tutor.id,
            "name": tutor.name,
        } if tutor else None,
        "student": {
            "id": student.id,
            "name": student.name,
        } if student else None,
        "pricing": {
            "session_price": price,
            "platform_fee": platform_fee,
            "tutor_payout": tutor_payout,
        },
        "payment": payment_info,
        "booking": {
            "id": booking.id,
            "booked_on": booking.booked_on.isoformat() if booking.booked_on else None,
        } if booking else None,
        "generated_at": datetime.utcnow().isoformat(),
    })
