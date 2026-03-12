from datetime import datetime
from database import db
from flask import current_app


def calculate_refund_percentage(slot):
    """Return refund % based on hours until session start."""
    session_start = datetime.combine(slot.date, slot.start_time)
    hours_until = (session_start - datetime.utcnow()).total_seconds() / 3600
    if hours_until > 24:
        return 100
    elif hours_until >= 12:
        return 50
    return 0


def reopen_slot(slot):
    if slot is None:
        return False

    if slot.is_group:
        slot.current_students = max(0, slot.current_students - 1)
        if slot.current_students < slot.max_students:
            slot.status = 'pending'
    else:
        slot.status = 'pending'
        slot.student_id = None

    return True


def cancel_booking(booking, cancelled_by, refund_pct=None, slot=None):
    from models.slots import TutorSlot

    if slot is None:
        slot = TutorSlot.query.get(booking.slot_id)

    booking.status = 'Cancelled'
    booking.cancelled_by = cancelled_by
    booking.cancelled_on = datetime.utcnow()

    slot_reopened = reopen_slot(slot) if slot else False

    if refund_pct is None:
        if cancelled_by == 'student' and slot:
            refund_pct = calculate_refund_percentage(slot)
        else:
            refund_pct = 100

    db.session.commit()

    refund_processed = False
    if refund_pct > 0:
        try:
            from models.payment import Payment
            from services.payment_service import process_refund
            payment = Payment.query.filter_by(
                booking_id=booking.id, status='completed').first()
            if payment:
                result = process_refund(payment.id, refund_pct)
                refund_processed = result is not None
        except Exception as e:
            current_app.logger.error(f'Refund processing error: {e}')

    try:
        from shared.event_bus import publish_event
        publish_event('booking.cancelled', {
            'booking_id': booking.id,
            'student_id': booking.student_id,
            'tutor_id': booking.tutor_id,
            'slot_id': booking.slot_id,
            'cancelled_by': cancelled_by,
            'refund_pct': refund_pct,
        })
    except Exception as e:
        current_app.logger.warning(f'Event publish error (booking.cancelled): {e}')

    return {
        'refund_pct': refund_pct,
        'refund_processed': refund_processed,
        'slot_reopened': slot_reopened,
    }


def create_booking(student_id, tutor_id, slot_id, student_name=None,
                   student_email=None, is_minor=False, guardian=None):
    """Create a booking with row-level slot locking.
    Returns (booking, error_message)."""
    from models.booking import Booking
    from models.slots import TutorSlot
    from models.tutor import Tutor

    try:
        locked_slot = TutorSlot.query.with_for_update().get(slot_id)
        if not locked_slot:
            db.session.rollback()
            return None, 'Slot not found.'

        if locked_slot.is_group:
            if locked_slot.current_students >= locked_slot.max_students:
                db.session.rollback()
                return None, 'This group session is now full.'
            locked_slot.current_students += 1
            if locked_slot.current_students >= locked_slot.max_students:
                locked_slot.status = 'booked'
            locked_slot.student_id = student_id
        else:
            if locked_slot.status != 'pending':
                db.session.rollback()
                return None, 'This slot has already been booked.'
            locked_slot.student_id = student_id
            locked_slot.status = 'booked'

        try:
            from services.cache_service import cache_delete_pattern
            cache_delete_pattern('search:*')
            cache_delete_pattern('rec:*')
        except Exception:
            pass

        if locked_slot.mode in ('online', 'both') and not locked_slot.jitsi_room_name:
            from services.video_service import generate_room_name
            locked_slot.jitsi_room_name = generate_room_name(slot_id)

        booking = Booking(
            student_id=student_id,
            tutor_id=tutor_id,
            slot_id=slot_id
        )
        db.session.add(booking)
        db.session.commit()

        try:
            from shared.event_bus import publish_event
            publish_event('booking.created', {
                'booking_id': booking.id,
                'student_id': student_id,
                'tutor_id': tutor_id,
                'slot_id': slot_id,
                'student_name': student_name or '',
                'date': locked_slot.date.isoformat() if locked_slot.date else '',
                'start_time': locked_slot.start_time.strftime('%I:%M %p') if locked_slot.start_time else '',
                'mode': locked_slot.mode or '',
            })
        except Exception as e:
            current_app.logger.warning(f'Event publish error (booking.created): {e}')

        return booking, None

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Booking creation error: {e}')
        return None, 'An error occurred while creating the booking.'


def send_booking_emails(booking, slot, student_name, student_email,
                        is_minor=False, guardian=None):
    try:
        from models.tutor import Tutor
        from services.email_service import (
            send_email, email_booking_confirmation,
            email_booking_tutor_notify, email_guardian_booking_alert
        )
        tutor = Tutor.query.get(slot.tutor_id)
        d = slot.date.strftime('%B %d, %Y')
        t = slot.start_time.strftime('%I:%M %p')

        s, h = email_booking_confirmation(
            student_name, tutor.name, d, t, slot.mode)
        if student_email:
            send_email(student_email, s, h,
                       'booking_confirm', 'student', booking.id)

        s, h = email_booking_tutor_notify(
            tutor.name, student_name, d, t, slot.mode)
        send_email(tutor.email, s, h,
                   'booking_tutor_notify', 'tutor', booking.id)

        if is_minor and guardian:
            s, h = email_guardian_booking_alert(
                guardian.name, student_name, tutor.name, d, t)
            send_email(guardian.email, s, h,
                       'guardian_booking_alert', 'guardian', booking.id)
            booking.guardian_notified = True

        booking.confirmation_email_sent = True
        db.session.commit()
    except Exception as e:
        current_app.logger.error(f'Booking email error: {e}')
