from flask import (Blueprint, render_template, redirect, url_for, flash, Response)
from flask_login import current_user
from database import db
from models.slots import TutorSlot
from models.tutor import Tutor
from models.booking import Booking
from services.video_service import JITSI_DOMAIN, generate_room_name
from datetime import datetime, timedelta

session_bp = Blueprint('session_bp', __name__)

# Time gates: join from 15 min before to 30 min after start
JOIN_BEFORE_MINUTES = 15
JOIN_AFTER_MINUTES = 30


def _get_user_info():
    """Return (user_type, user_id) for the current user."""
    if current_user.is_authenticated:
        return current_user.user_type, current_user.id
    return None, None


@session_bp.route('/session/<int:slot_id>/join')
def join_session(slot_id):
    user_type, user_id = _get_user_info()
    if not user_type:
        flash('Please log in.', 'warning')
        return redirect(url_for('student_bp.login_student'))

    slot = TutorSlot.query.get_or_404(slot_id)

    # Authorization: only the booked student or the tutor can join
    if user_type == 'student' and slot.student_id != user_id:
        flash('You are not authorized to join this session.', 'danger')
        return redirect(url_for('student_bp.dashboard'))
    if user_type == 'tutor' and slot.tutor_id != user_id:
        flash('You are not authorized to join this session.', 'danger')
        return redirect(url_for('tutor_bp.tutor_dashboard'))

    # Only booked or live slots can be joined
    if slot.status not in ('booked', 'live'):
        flash('This session is not available for joining.', 'warning')
        if user_type == 'tutor':
            return redirect(url_for('tutor_bp.tutor_dashboard'))
        return redirect(url_for('student_bp.dashboard'))

    # Time gate check
    now = datetime.utcnow()
    session_start = datetime.combine(slot.date, slot.start_time)
    session_end = datetime.combine(slot.date, slot.end_time)
    earliest_join = session_start - timedelta(minutes=JOIN_BEFORE_MINUTES)
    latest_join = session_start + timedelta(minutes=JOIN_AFTER_MINUTES)

    if now < earliest_join:
        mins_until = int((earliest_join - now).total_seconds() / 60)
        flash(f'Session not open yet. You can join in {mins_until} minutes.', 'info')
        if user_type == 'tutor':
            return redirect(url_for('tutor_bp.tutor_dashboard'))
        return redirect(url_for('student_bp.dashboard'))

    if now > latest_join:
        flash('The join window for this session has passed.', 'warning')
        if user_type == 'tutor':
            return redirect(url_for('tutor_bp.tutor_dashboard'))
        return redirect(url_for('student_bp.dashboard'))

    # Generate room name if not already set
    if not slot.jitsi_room_name:
        slot.jitsi_room_name = generate_room_name(slot.id)
        db.session.commit()

    # Mark slot as live and publish session.started event
    if slot.status == 'booked':
        slot.status = 'live'
        db.session.commit()

        # Publish session.started for learning-service & notification-service
        try:
            from shared.event_bus import publish_event
            publish_event('session.started', {
                'slot_id': slot.id,
                'tutor_id': slot.tutor_id,
                'student_id': slot.student_id,
                'date': slot.date.isoformat() if slot.date else '',
                'start_time': slot.start_time.strftime('%I:%M %p') if slot.start_time else '',
                'mode': slot.mode or '',
                'jitsi_room': slot.jitsi_room_name or '',
            })
        except Exception:
            pass  # Event failure must not block session join

    tutor = Tutor.query.get(slot.tutor_id)

    # Determine display name
    if user_type == 'tutor':
        display_name = tutor.name
    else:
        display_name = current_user.name

    return render_template('session_room.html',
                           slot=slot, tutor=tutor,
                           room_name=slot.jitsi_room_name,
                           jitsi_domain=JITSI_DOMAIN,
                           display_name=display_name,
                           user_type=user_type,
                           session_end=session_end)


@session_bp.route('/session/<int:slot_id>/end', methods=['POST'])
def end_session(slot_id):
    user_type, user_id = _get_user_info()
    if not user_type:
        flash('Please log in.', 'warning')
        return redirect(url_for('student_bp.login_student'))

    slot = TutorSlot.query.get_or_404(slot_id)

    # Only tutor or the booked student can end
    if user_type == 'tutor' and slot.tutor_id != user_id:
        flash('Unauthorized.', 'danger')
        return redirect(url_for('tutor_bp.tutor_dashboard'))
    if user_type == 'student' and slot.student_id != user_id:
        flash('Unauthorized.', 'danger')
        return redirect(url_for('student_bp.dashboard'))

    if slot.status in ('booked', 'live'):
        slot.status = 'completed'
        db.session.commit()

        # Update booking status too
        booking = Booking.query.filter_by(
            slot_id=slot_id, student_id=slot.student_id
        ).first()
        if booking and booking.status not in ('Cancelled',):
            booking.status = 'Completed'
            db.session.commit()

        # Publish session.ended for learning-service & notification-service
        try:
            from shared.event_bus import publish_event
            publish_event('session.ended', {
                'slot_id': slot.id,
                'tutor_id': slot.tutor_id,
                'student_id': slot.student_id,
                'booking_id': booking.id if booking else None,
                'date': slot.date.isoformat() if slot.date else '',
                'ended_by': user_type,
            })
        except Exception:
            pass  # Event failure must not block session end

    flash('Session ended. Thank you!', 'success')

    if user_type == 'student':
        # Redirect student to leave a review
        booking = Booking.query.filter_by(
            slot_id=slot_id, student_id=user_id
        ).first()
        if booking:
            return redirect(url_for('student_bp.submit_review', booking_id=booking.id))
        return redirect(url_for('student_bp.dashboard'))
    return redirect(url_for('tutor_bp.tutor_dashboard'))


@session_bp.route('/receipt/<int:booking_id>')
def view_receipt(booking_id):
    if not current_user.is_authenticated:
        flash('Please log in.', 'warning')
        return redirect(url_for('student_bp.login_student'))

    booking = Booking.query.get_or_404(booking_id)

    # Verify access: student, tutor, or admin can view
    allowed = False
    if current_user.user_type == 'student' and booking.student_id == current_user.id:
        allowed = True
    elif current_user.user_type == 'tutor' and booking.tutor_id == current_user.id:
        allowed = True
    elif current_user.user_type == 'admin':
        allowed = True

    if not allowed:
        flash('Access denied.', 'danger')
        return redirect(url_for('main.index'))

    slot = TutorSlot.query.get(booking.slot_id)
    from models.student import Student
    student = Student.query.get(booking.student_id)
    tutor = Tutor.query.get(booking.tutor_id)

    from models.payment import Payment
    payment = Payment.query.filter_by(booking_id=booking.id).first()

    from services.invoice_service import generate_invoice_html
    html = generate_invoice_html(booking, slot, student, tutor, payment)

    return Response(html, content_type='text/html')
