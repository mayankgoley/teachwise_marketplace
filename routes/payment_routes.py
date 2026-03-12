import stripe
from flask import (Blueprint, request, redirect, url_for, flash,
                    render_template, current_app, jsonify)
from flask_login import current_user, login_required
from database import db
from extensions import limiter
from models.booking import Booking
from models.payment import Payment
from models.tutor import Tutor
from services.booking_service import reopen_slot

payment_bp = Blueprint('payment_bp', __name__)


@payment_bp.route('/payment/success')
@login_required
def payment_success():
    booking_id = request.args.get('booking_id')
    booking = Booking.query.get(booking_id) if booking_id else None
    return render_template('payment_success.html', booking=booking)


@payment_bp.route('/payment/cancel')
@login_required
def payment_cancel():
    booking_id = request.args.get('booking_id')
    booking = Booking.query.get(booking_id) if booking_id else None

    # Clean up the pending booking if payment was cancelled
    if booking and booking.status == 'Pending Payment':
        from models.slots import TutorSlot
        slot = TutorSlot.query.get(booking.slot_id)
        if slot:
            reopen_slot(slot)

        # Remove pending payment
        payment = Payment.query.filter_by(
            booking_id=booking.id, status='pending').first()
        if payment:
            payment.status = 'failed'

        booking.status = 'Cancelled'
        booking.cancelled_by = 'payment_cancelled'
        db.session.commit()

    return render_template('payment_cancel.html', booking=booking)


@payment_bp.route('/payment/webhook', methods=['POST'])
def stripe_webhook():
    payload = request.get_data()
    sig_header = request.headers.get('Stripe-Signature')
    webhook_secret = current_app.config.get('STRIPE_WEBHOOK_SECRET', '')

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret)
    except (ValueError, stripe.error.SignatureVerificationError):
        return jsonify(error='Invalid signature'), 400

    if event['type'] == 'checkout.session.completed':
        checkout_session = event['data']['object']
        from services.payment_service import process_successful_payment
        process_successful_payment(checkout_session['id'])

        # Send confirmation emails + publish payment.completed event
        try:
            payment = Payment.query.filter_by(
                stripe_checkout_session_id=checkout_session['id']).first()
            if payment and payment.booking:
                booking = payment.booking
                from models.slots import TutorSlot
                from models.student import Student
                slot = TutorSlot.query.get(booking.slot_id)
                tutor = Tutor.query.get(booking.tutor_id)
                student = Student.query.get(booking.student_id)
                if slot and tutor and student:
                    from services.email_service import (
                        send_email, email_booking_confirmation,
                        email_booking_tutor_notify)
                    d = slot.date.strftime('%B %d, %Y')
                    t = slot.start_time.strftime('%I:%M %p')
                    s, h = email_booking_confirmation(
                        student.name, tutor.name, d, t, slot.mode)
                    send_email(student.email, s, h,
                               'booking_confirm', 'student', booking.id)
                    s, h = email_booking_tutor_notify(
                        tutor.name, student.name, d, t, slot.mode)
                    send_email(tutor.email, s, h,
                               'booking_tutor_notify', 'tutor', booking.id)
                    booking.confirmation_email_sent = True
                    db.session.commit()

                # Publish payment.completed event for notification-service
                try:
                    from shared.event_bus import publish_event
                    publish_event('payment.completed', {
                        'payment_id': payment.id,
                        'booking_id': booking.id,
                        'student_id': booking.student_id,
                        'tutor_id': booking.tutor_id,
                        'amount': float(payment.amount) if payment.amount else 0,
                        'student_name': student.name if student else '',
                        'tutor_name': tutor.name if tutor else '',
                    })
                except Exception:
                    pass  # Event publish failure must not block payment flow
        except Exception:
            pass

    return jsonify(received=True), 200


@payment_bp.route('/tutor/stripe-onboard')
def stripe_onboard():
    if not current_user.is_authenticated or current_user.user_type != 'tutor':
        flash('Please log in.', 'warning')
        return redirect(url_for('tutor_bp.login'))
    tutor = current_user

    try:
        from services.payment_service import create_connect_account_link
        onboard_url = create_connect_account_link(tutor)
        return redirect(onboard_url)
    except Exception as e:
        flash(f'Could not start Stripe onboarding: {e}', 'danger')
        return redirect(url_for('tutor_bp.tutor_dashboard'))


@payment_bp.route('/tutor/stripe-callback')
def stripe_callback():
    if not current_user.is_authenticated or current_user.user_type != 'tutor':
        flash('Please log in.', 'warning')
        return redirect(url_for('tutor_bp.login'))
    tutor = current_user

    if tutor.stripe_account_id:
        try:
            account = stripe.Account.retrieve(tutor.stripe_account_id)
            if account.charges_enabled:
                tutor.stripe_onboarding_complete = True
                db.session.commit()
                flash('Stripe payouts connected!', 'success')
            else:
                flash('Stripe onboarding not yet complete. Please try again.',
                      'warning')
        except Exception:
            flash('Could not verify Stripe account.', 'danger')

    return redirect(url_for('tutor_bp.tutor_dashboard'))
