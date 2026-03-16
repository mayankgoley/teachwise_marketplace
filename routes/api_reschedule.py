"""
JSON API endpoints for reschedule operations (students and tutors).

Blueprint prefix: /api/v1
All endpoints return the standard envelope:
  {"success": True,  "data": {...}}
  {"success": False, "error": {"message": "...", "code": 400}}
"""

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from functools import wraps
from datetime import datetime, timedelta, date
from database import db
from models.booking import Booking
from models.slots import TutorSlot
from models.student import Student
from models.tutor import Tutor
from models.reschedule import RescheduleRequest
from models.in_app_notification import InAppNotification

api_reschedule_bp = Blueprint('api_reschedule', __name__, url_prefix='/api/v1')


# -- Helpers ----------------------------------------------------------------

def _ok(data, status=200):
    return jsonify({"success": True, "data": data}), status


def _err(message, code=400, field=None):
    payload = {"success": False, "error": {"message": message, "code": code}}
    if field:
        payload["error"]["field"] = field
    return jsonify(payload), code


def _student_required(f):
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if current_user.user_type != 'student':
            return _err("Student access required", 403)
        return f(*args, **kwargs)
    return decorated


def _tutor_required(f):
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if current_user.user_type != 'tutor':
            return _err("Tutor access required", 403)
        return f(*args, **kwargs)
    return decorated


# -- GET /api/v1/bookings/<id>/reschedule-options --------------------------

@api_reschedule_bp.route('/bookings/<int:booking_id>/reschedule-options', methods=['GET'])
@_student_required
def reschedule_options(booking_id):
    booking = Booking.query.get(booking_id)
    if not booking:
        return _err("Booking not found", 404)

    if booking.student_id != current_user.id:
        return _err("Unauthorized", 403)

    slot = TutorSlot.query.get(booking.slot_id)
    if not slot:
        return _err("Slot not found", 404)

    if slot.status not in ('pending', 'booked'):
        return _err("This booking cannot be rescheduled", 400)

    # Check session is > 6 hours away
    session_start = datetime.combine(slot.date, slot.start_time)
    hours_until = (session_start - datetime.utcnow()).total_seconds() / 3600
    if hours_until < 6:
        return _err("Too close to session start to reschedule (minimum 6 hours)", 400)

    # Count existing reschedule requests (excluding rejected)
    count = RescheduleRequest.query.filter_by(
        booking_id=booking.id
    ).filter(
        RescheduleRequest.status != 'rejected'
    ).count()

    if count >= 2:
        return _err("Maximum reschedules reached", 400)

    # Query available slots: same tutor, within next 30 days, pending, no student
    today = date.today()
    max_date = today + timedelta(days=30)

    available = TutorSlot.query.filter(
        TutorSlot.tutor_id == slot.tutor_id,
        TutorSlot.date >= today,
        TutorSlot.date <= max_date,
        TutorSlot.status == 'pending',
        TutorSlot.student_id.is_(None),
    ).order_by(TutorSlot.date.asc(), TutorSlot.start_time.asc()).all()

    slots_data = [{
        "id": s.id,
        "date": s.date.isoformat(),
        "start_time": s.start_time.strftime('%H:%M'),
        "end_time": s.end_time.strftime('%H:%M'),
        "subject": s.subject,
        "mode": s.mode,
        "price": s.price,
    } for s in available]

    return _ok({
        "slots": slots_data,
        "reschedules_remaining": 2 - count,
    })


# -- POST /api/v1/bookings/<id>/reschedule --------------------------------

@api_reschedule_bp.route('/bookings/<int:booking_id>/reschedule', methods=['POST'])
@_student_required
def request_reschedule(booking_id):
    booking = Booking.query.get(booking_id)
    if not booking:
        return _err("Booking not found", 404)

    if booking.student_id != current_user.id:
        return _err("Unauthorized", 403)

    slot = TutorSlot.query.get(booking.slot_id)
    if not slot:
        return _err("Slot not found", 404)

    if slot.status not in ('pending', 'booked'):
        return _err("This booking cannot be rescheduled", 400)

    # Check session is > 6 hours away
    session_start = datetime.combine(slot.date, slot.start_time)
    hours_until = (session_start - datetime.utcnow()).total_seconds() / 3600
    if hours_until < 6:
        return _err("Too close to session start to reschedule (minimum 6 hours)", 400)

    # Count existing reschedule requests (excluding rejected)
    count = RescheduleRequest.query.filter_by(
        booking_id=booking.id
    ).filter(
        RescheduleRequest.status != 'rejected'
    ).count()

    if count >= 2:
        return _err("Maximum reschedules reached", 400)

    body = request.get_json(silent=True)
    if not body:
        return _err("Request body must be JSON", 400)

    new_slot_id = body.get('new_slot_id')
    reason = body.get('reason', '')

    if not new_slot_id:
        return _err("new_slot_id is required", 400, field="new_slot_id")

    # Validate the proposed slot
    new_slot = TutorSlot.query.get(new_slot_id)
    if not new_slot:
        return _err("Proposed slot not found", 404)

    if new_slot.tutor_id != slot.tutor_id:
        return _err("Proposed slot must belong to the same tutor", 400)

    if new_slot.status != 'pending' or new_slot.student_id is not None:
        return _err("Proposed slot is not available", 400)

    # Create the reschedule request
    rr = RescheduleRequest(
        booking_id=booking.id,
        original_slot_id=booking.slot_id,
        proposed_slot_id=new_slot_id,
        requested_by='student',
        reason=reason,
        expires_at=datetime.utcnow() + timedelta(hours=48),
    )
    db.session.add(rr)

    # Create notification for tutor
    student = Student.query.get(current_user.id)
    notification = InAppNotification(
        user_id=booking.tutor_id,
        user_type='tutor',
        type='reschedule',
        title='Reschedule Request',
        message=f'{student.name} has requested to reschedule a session.',
        icon='fas fa-calendar-alt',
        color='yellow',
    )
    db.session.add(notification)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return _err("Failed to create reschedule request", 500)

    return _ok({
        "reschedule_request_id": rr.id,
        "message": "Reschedule request sent to tutor",
    })


# -- GET /api/v1/tutor/reschedule-requests --------------------------------

@api_reschedule_bp.route('/tutor/reschedule-requests', methods=['GET'])
@_tutor_required
def tutor_reschedule_requests():
    requests_query = RescheduleRequest.query.join(
        TutorSlot, RescheduleRequest.original_slot_id == TutorSlot.id
    ).filter(
        TutorSlot.tutor_id == current_user.id,
        RescheduleRequest.status == 'pending',
    ).order_by(RescheduleRequest.created_at.desc()).all()

    results = []
    for rr in requests_query:
        booking = Booking.query.get(rr.booking_id)
        student = Student.query.get(booking.student_id) if booking else None
        original_slot = TutorSlot.query.get(rr.original_slot_id)
        proposed_slot = TutorSlot.query.get(rr.proposed_slot_id)

        results.append({
            "id": rr.id,
            "booking_id": rr.booking_id,
            "student_name": student.name if student else None,
            "subject": original_slot.subject if original_slot else None,
            "original_date": original_slot.date.isoformat() if original_slot else None,
            "original_start_time": original_slot.start_time.strftime('%H:%M') if original_slot else None,
            "proposed_date": proposed_slot.date.isoformat() if proposed_slot else None,
            "proposed_start_time": proposed_slot.start_time.strftime('%H:%M') if proposed_slot else None,
            "reason": rr.reason,
            "expires_at": rr.expires_at.isoformat() if rr.expires_at else None,
            "status": rr.status,
        })

    return _ok({"requests": results})


# -- POST /api/v1/tutor/reschedule-requests/<id>/approve -------------------

@api_reschedule_bp.route('/tutor/reschedule-requests/<int:request_id>/approve', methods=['POST'])
@_tutor_required
def approve_reschedule(request_id):
    rr = RescheduleRequest.query.get(request_id)
    if not rr:
        return _err("Reschedule request not found", 404)

    original_slot = TutorSlot.query.get(rr.original_slot_id)
    if not original_slot or original_slot.tutor_id != current_user.id:
        return _err("Unauthorized", 403)

    if rr.status != 'pending':
        return _err("This request has already been processed", 400)

    booking = Booking.query.get(rr.booking_id)
    proposed_slot = TutorSlot.query.get(rr.proposed_slot_id)

    if not booking or not proposed_slot:
        return _err("Booking or proposed slot not found", 404)

    if proposed_slot.status != 'pending' or proposed_slot.student_id is not None:
        return _err("Proposed slot is no longer available", 400)

    # Move booking to proposed slot
    booking.slot_id = rr.proposed_slot_id

    # Update proposed slot
    proposed_slot.student_id = booking.student_id
    proposed_slot.status = 'booked'

    # Free up original slot
    original_slot.student_id = None
    original_slot.status = 'pending'

    # Update request status
    rr.status = 'approved'
    rr.responded_at = datetime.utcnow()

    # Notify student
    notification = InAppNotification(
        user_id=booking.student_id,
        user_type='student',
        type='reschedule',
        title='Reschedule Approved',
        message=f'Your reschedule request has been approved. New session: {proposed_slot.date.isoformat()} at {proposed_slot.start_time.strftime("%H:%M")}.',
        icon='fas fa-check-circle',
        color='green',
    )
    db.session.add(notification)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return _err("Failed to approve reschedule", 500)

    return _ok({"message": "Reschedule approved"})


# -- POST /api/v1/tutor/reschedule-requests/<id>/reject --------------------

@api_reschedule_bp.route('/tutor/reschedule-requests/<int:request_id>/reject', methods=['POST'])
@_tutor_required
def reject_reschedule(request_id):
    rr = RescheduleRequest.query.get(request_id)
    if not rr:
        return _err("Reschedule request not found", 404)

    original_slot = TutorSlot.query.get(rr.original_slot_id)
    if not original_slot or original_slot.tutor_id != current_user.id:
        return _err("Unauthorized", 403)

    if rr.status != 'pending':
        return _err("This request has already been processed", 400)

    body = request.get_json(silent=True)
    reason = body.get('reason', '') if body else ''

    rr.status = 'rejected'
    rr.responded_at = datetime.utcnow()

    # Notify student
    booking = Booking.query.get(rr.booking_id)
    if booking:
        message = 'Your reschedule request has been rejected.'
        if reason:
            message += f' Reason: {reason}'

        notification = InAppNotification(
            user_id=booking.student_id,
            user_type='student',
            type='reschedule',
            title='Reschedule Rejected',
            message=message,
            icon='fas fa-times-circle',
            color='red',
        )
        db.session.add(notification)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return _err("Failed to reject reschedule", 500)

    return _ok({"message": "Reschedule rejected"})
