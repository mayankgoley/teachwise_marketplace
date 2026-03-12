from flask import (Blueprint, request, redirect, url_for, flash,
                    render_template)
from flask_login import current_user, login_required
from database import db
from models.booking import Booking
from models.slots import TutorSlot
from models.tutor import Tutor
from models.reschedule import RescheduleRequest
from utils.sanitizer import sanitize_input_length
from datetime import datetime, timedelta

reschedule_bp = Blueprint('reschedule_bp', __name__)

MAX_RESCHEDULES_PER_BOOKING = 2
MIN_HOURS_BEFORE_SESSION = 6


def _hours_until_slot(slot):
    session_start = datetime.combine(slot.date, slot.start_time)
    return (session_start - datetime.utcnow()).total_seconds() / 3600


@reschedule_bp.route('/booking/<int:booking_id>/reschedule', methods=['GET'])
@login_required
def select_slot(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    if booking.student_id != current_user.id:
        flash('Unauthorized.', 'danger')
        return redirect(url_for('student_bp.dashboard'))

    slot = TutorSlot.query.get(booking.slot_id)
    if not slot or _hours_until_slot(slot) < MIN_HOURS_BEFORE_SESSION:
        flash('Too close to session start to reschedule.', 'warning')
        return redirect(url_for('student_bp.dashboard'))

    count = RescheduleRequest.query.filter_by(
        booking_id=booking.id).filter(
        RescheduleRequest.status.in_(['pending', 'approved'])).count()
    if count >= MAX_RESCHEDULES_PER_BOOKING:
        flash('Maximum reschedule attempts reached for this booking.', 'warning')
        return redirect(url_for('student_bp.dashboard'))

    # Get tutor's available slots (excluding current)
    tutor = Tutor.query.get(booking.tutor_id)
    available = TutorSlot.query.filter(
        TutorSlot.tutor_id == tutor.id,
        TutorSlot.status == 'pending',
        TutorSlot.date >= datetime.utcnow().date(),
        TutorSlot.id != slot.id
    ).order_by(TutorSlot.date.asc()).all()

    return render_template('reschedule_select_slot.html',
                           booking=booking, current_slot=slot,
                           tutor=tutor, available_slots=available)


@reschedule_bp.route('/booking/<int:booking_id>/reschedule', methods=['POST'])
@login_required
def request_reschedule(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    if booking.student_id != current_user.id:
        flash('Unauthorized.', 'danger')
        return redirect(url_for('student_bp.dashboard'))

    slot = TutorSlot.query.get(booking.slot_id)
    if not slot or _hours_until_slot(slot) < MIN_HOURS_BEFORE_SESSION:
        flash('Too close to session start to reschedule.', 'warning')
        return redirect(url_for('student_bp.dashboard'))

    count = RescheduleRequest.query.filter_by(
        booking_id=booking.id).filter(
        RescheduleRequest.status.in_(['pending', 'approved'])).count()
    if count >= MAX_RESCHEDULES_PER_BOOKING:
        flash('Maximum reschedule attempts reached.', 'warning')
        return redirect(url_for('student_bp.dashboard'))

    proposed_slot_id = request.form.get('proposed_slot_id', type=int)
    proposed_slot = TutorSlot.query.get(proposed_slot_id)
    if not proposed_slot or proposed_slot.status != 'pending':
        flash('Selected slot is no longer available.', 'warning')
        return redirect(url_for('reschedule_bp.select_slot',
                                booking_id=booking.id))

    reason = sanitize_input_length(request.form.get('reason', ''), 500)

    rr = RescheduleRequest(
        booking_id=booking.id,
        original_slot_id=slot.id,
        proposed_slot_id=proposed_slot.id,
        requested_by='student',
        reason=reason,
        expires_at=datetime.utcnow() + timedelta(hours=48)
    )
    db.session.add(rr)
    db.session.commit()

    # Notify tutor
    try:
        tutor = Tutor.query.get(booking.tutor_id)
        from services.email_service import send_email
        subject = f'Reschedule Request from {current_user.name}'
        html = (
            f'<p>{current_user.name} has requested to reschedule their session '
            f'on {slot.date.strftime("%B %d, %Y")} at {slot.start_time.strftime("%I:%M %p")} '
            f'to {proposed_slot.date.strftime("%B %d, %Y")} at '
            f'{proposed_slot.start_time.strftime("%I:%M %p")}.</p>'
            f'<p>Please log in to your dashboard to approve or reject.</p>'
        )
        if reason:
            html += f'<p>Reason: {reason}</p>'
        send_email(tutor.email, subject, html, 'reschedule_request', 'tutor')
    except Exception:
        pass

    flash('Reschedule request sent! The tutor has 48 hours to respond.', 'success')
    return redirect(url_for('student_bp.dashboard'))


@reschedule_bp.route('/tutor/booking/<int:booking_id>/reschedule', methods=['POST'])
def tutor_request_reschedule(booking_id):
    if not current_user.is_authenticated or current_user.user_type != 'tutor':
        flash('Please log in.', 'warning')
        return redirect(url_for('tutor_bp.login'))
    tutor = current_user

    booking = Booking.query.get_or_404(booking_id)
    slot = TutorSlot.query.get(booking.slot_id)
    if not slot or slot.tutor_id != tutor.id:
        flash('Unauthorized.', 'danger')
        return redirect(url_for('tutor_bp.tutor_dashboard'))

    if _hours_until_slot(slot) < MIN_HOURS_BEFORE_SESSION:
        flash('Too close to session start to reschedule.', 'warning')
        return redirect(url_for('tutor_bp.tutor_dashboard'))

    proposed_slot_id = request.form.get('proposed_slot_id', type=int)
    proposed_slot = TutorSlot.query.get(proposed_slot_id)
    if not proposed_slot or proposed_slot.status != 'pending':
        flash('Selected slot is no longer available.', 'warning')
        return redirect(url_for('tutor_bp.tutor_dashboard'))

    reason = sanitize_input_length(request.form.get('reason', ''), 500)

    rr = RescheduleRequest(
        booking_id=booking.id,
        original_slot_id=slot.id,
        proposed_slot_id=proposed_slot.id,
        requested_by='tutor',
        reason=reason,
        expires_at=datetime.utcnow() + timedelta(hours=48)
    )
    db.session.add(rr)
    db.session.commit()

    # Notify student
    try:
        from models.student import Student
        from services.email_service import send_email
        student = Student.query.get(booking.student_id)
        subject = f'Reschedule Request from {tutor.name}'
        html = (
            f'<p>{tutor.name} has requested to reschedule your session '
            f'on {slot.date.strftime("%B %d, %Y")} at {slot.start_time.strftime("%I:%M %p")} '
            f'to {proposed_slot.date.strftime("%B %d, %Y")} at '
            f'{proposed_slot.start_time.strftime("%I:%M %p")}.</p>'
            f'<p>Please log in to your dashboard to approve or reject.</p>'
        )
        send_email(student.email, subject, html, 'reschedule_request', 'student')
    except Exception:
        pass

    flash('Reschedule request sent to student.', 'success')
    return redirect(url_for('tutor_bp.tutor_dashboard'))


@reschedule_bp.route('/reschedule/<int:request_id>/approve', methods=['POST'])
def approve_reschedule(request_id):
    rr = RescheduleRequest.query.get_or_404(request_id)
    if rr.status != 'pending':
        flash('This request has already been processed.', 'warning')
        return _redirect_back(rr)

    if datetime.utcnow() > rr.expires_at:
        rr.status = 'expired'
        db.session.commit()
        flash('This request has expired.', 'warning')
        return _redirect_back(rr)

    # Verify the approver is the other party
    if not _can_respond(rr):
        flash('Unauthorized.', 'danger')
        return _redirect_back(rr)

    original = TutorSlot.query.get(rr.original_slot_id)
    proposed = TutorSlot.query.get(rr.proposed_slot_id)
    booking = rr.booking

    if not proposed or proposed.status != 'pending':
        flash('The proposed slot is no longer available.', 'warning')
        rr.status = 'rejected'
        rr.responded_at = datetime.utcnow()
        db.session.commit()
        return _redirect_back(rr)

    # Swap slots — mark original as cancelled so it doesn't show on dashboard
    original.status = 'cancelled'
    original.student_id = None

    proposed.status = 'booked'
    proposed.student_id = booking.student_id

    booking.slot_id = proposed.id

    rr.status = 'approved'
    rr.responded_at = datetime.utcnow()
    db.session.commit()

    # Notify requester
    try:
        from services.email_service import send_email
        if rr.requested_by == 'student':
            from models.student import Student
            student = Student.query.get(booking.student_id)
            send_email(student.email,
                       'Reschedule Approved',
                       f'<p>Your reschedule request has been approved. '
                       f'New time: {proposed.date.strftime("%B %d, %Y")} at '
                       f'{proposed.start_time.strftime("%I:%M %p")}.</p>',
                       'reschedule_approved', 'student')
        else:
            tutor = Tutor.query.get(booking.tutor_id)
            send_email(tutor.email,
                       'Reschedule Approved',
                       f'<p>The student approved your reschedule. '
                       f'New time: {proposed.date.strftime("%B %d, %Y")} at '
                       f'{proposed.start_time.strftime("%I:%M %p")}.</p>',
                       'reschedule_approved', 'tutor')
    except Exception:
        pass

    flash('Reschedule approved! Session moved to the new time.', 'success')
    return _redirect_back(rr)


@reschedule_bp.route('/reschedule/<int:request_id>/reject', methods=['POST'])
def reject_reschedule(request_id):
    rr = RescheduleRequest.query.get_or_404(request_id)
    if rr.status != 'pending':
        flash('This request has already been processed.', 'warning')
        return _redirect_back(rr)

    if not _can_respond(rr):
        flash('Unauthorized.', 'danger')
        return _redirect_back(rr)

    rr.status = 'rejected'
    rr.responded_at = datetime.utcnow()
    db.session.commit()

    # Notify requester
    try:
        from services.email_service import send_email
        booking = rr.booking
        if rr.requested_by == 'student':
            from models.student import Student
            student = Student.query.get(booking.student_id)
            send_email(student.email,
                       'Reschedule Rejected',
                       '<p>Your reschedule request was rejected. '
                       'The original session time remains unchanged.</p>',
                       'reschedule_rejected', 'student')
        else:
            tutor = Tutor.query.get(booking.tutor_id)
            send_email(tutor.email,
                       'Reschedule Rejected',
                       '<p>The student rejected your reschedule request. '
                       'The original session time remains unchanged.</p>',
                       'reschedule_rejected', 'tutor')
    except Exception:
        pass

    flash('Reschedule request rejected.', 'info')
    return _redirect_back(rr)


@reschedule_bp.route('/tutor/reschedule-requests')
def tutor_reschedule_requests():
    if not current_user.is_authenticated or current_user.user_type != 'tutor':
        flash('Please log in.', 'warning')
        return redirect(url_for('tutor_bp.login'))
    tutor = current_user

    pending = RescheduleRequest.query.join(Booking).filter(
        Booking.tutor_id == tutor.id,
        RescheduleRequest.status == 'pending',
        RescheduleRequest.requested_by == 'student'
    ).order_by(RescheduleRequest.created_at.desc()).all()

    return render_template('tutor_reschedule_requests.html',
                           requests=pending, tutor=tutor)


def _can_respond(rr):
    """Only the other party can approve/reject."""
    if not current_user.is_authenticated:
        return False
    booking = rr.booking
    if rr.requested_by == 'student':
        # Tutor must respond
        return current_user.user_type == 'tutor' and current_user.id == booking.tutor_id
    else:
        # Student must respond
        return current_user.user_type == 'student' and current_user.id == booking.student_id


def _redirect_back(rr):
    if rr.requested_by == 'student':
        return redirect(url_for('reschedule_bp.tutor_reschedule_requests'))
    return redirect(url_for('student_bp.dashboard'))
