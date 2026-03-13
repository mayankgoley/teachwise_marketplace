import stripe
from flask import (Blueprint, request, redirect, url_for, flash,
                    render_template, current_app, jsonify, make_response)
from flask_login import current_user, login_required
from database import db
from extensions import limiter
from models.booking import Booking
from models.payment import Payment
from models.tutor import Tutor
from models.slots import TutorSlot
from services.booking_service import reopen_slot
from datetime import datetime

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

    slot = None
    tutor = None
    payment = None
    can_retry = False

    if booking:
        from models.slots import TutorSlot
        slot = TutorSlot.query.get(booking.slot_id)
        tutor = Tutor.query.get(booking.tutor_id)
        payment = Payment.query.filter_by(
            booking_id=booking.id, status='pending').first()

    # Clean up the pending booking if payment was cancelled
    if booking and booking.status == 'Pending Payment':
        if slot:
            # Check if the slot can be retried (still in the future)
            from datetime import datetime, date as date_type
            if slot.date and slot.date >= date_type.today():
                can_retry = True

            reopen_slot(slot)

        if payment:
            payment.status = 'failed'

        booking.status = 'Cancelled'
        booking.cancelled_by = 'payment_cancelled'
        db.session.commit()

    return render_template('payment_cancel.html', booking=booking,
                           slot=slot, tutor=tutor, can_retry=can_retry)


@payment_bp.route('/payment/retry/<int:booking_id>', methods=['POST'])
@login_required
def payment_retry(booking_id):
    """Retry a failed/cancelled payment by creating a new Stripe checkout."""
    from models.slots import TutorSlot
    from models.student import Student
    from services.payment_service import create_checkout_session
    from services.booking_service import create_booking
    from datetime import date as date_type

    booking = Booking.query.get_or_404(booking_id)

    # Only the student who made the booking can retry
    if current_user.user_type != 'student' or booking.student_id != current_user.id:
        flash('Access denied.', 'danger')
        return redirect(url_for('student_bp.dashboard'))

    if booking.status not in ('Cancelled',):
        flash('This booking cannot be retried.', 'warning')
        return redirect(url_for('student_bp.dashboard'))

    slot = TutorSlot.query.get(booking.slot_id)
    if not slot:
        flash('Session slot no longer exists.', 'danger')
        return redirect(url_for('student_bp.dashboard'))

    # Check slot is still in the future and available
    if slot.date < date_type.today():
        flash('This session date has passed.', 'warning')
        return redirect(url_for('student_bp.dashboard'))

    if not slot.is_group and slot.status != 'pending':
        flash('This slot is no longer available.', 'warning')
        return redirect(url_for('student_bp.dashboard'))

    if slot.is_group and slot.current_students >= slot.max_students:
        flash('This group session is now full.', 'warning')
        return redirect(url_for('student_bp.dashboard'))

    try:
        # Re-book the slot
        if slot.is_group:
            slot.current_students += 1
            if slot.current_students >= slot.max_students:
                slot.status = 'booked'
        else:
            slot.student_id = current_user.id
            slot.status = 'booked'

        # Create new booking
        new_booking = Booking(
            student_id=current_user.id,
            tutor_id=booking.tutor_id,
            slot_id=slot.id
        )
        db.session.add(new_booking)
        db.session.flush()

        new_booking.status = 'Pending Payment'
        db.session.commit()

        tutor = Tutor.query.get(booking.tutor_id)
        student = Student.query.get(current_user.id)
        checkout_url = create_checkout_session(new_booking, slot, student, tutor)
        return redirect(checkout_url)
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Payment retry error: {e}')
        flash('Could not restart payment. Please try booking again.', 'danger')
        return redirect(url_for('tutor_bp.view_tutor_profile', tutor_id=booking.tutor_id))


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
                except Exception as e:
                    current_app.logger.error(f'Failed to publish payment.completed event: {e}')
                    pass  # Event publish failure must not block payment flow
        except Exception as e:
            current_app.logger.error(f'Failed to process webhook confirmation emails for checkout session {checkout_session["id"]}: {e}')

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
        except Exception as e:
            current_app.logger.error(f'Failed to verify Stripe account {tutor.stripe_account_id}: {e}')
            flash('Could not verify Stripe account.', 'danger')

    return redirect(url_for('tutor_bp.tutor_dashboard'))


# ═══════════════════════════════════════════════════════════
# Item 1: Price Breakdown Before Checkout
# ═══════════════════════════════════════════════════════════

@payment_bp.route('/payment/checkout/<int:booking_id>')
@login_required
def payment_checkout(booking_id):
    """Show price breakdown before redirecting to Stripe."""
    booking = Booking.query.get_or_404(booking_id)

    if current_user.user_type != 'student' or booking.student_id != current_user.id:
        flash('Access denied.', 'danger')
        return redirect(url_for('student_bp.dashboard'))

    if booking.status != 'Pending Payment':
        flash('This booking is not awaiting payment.', 'warning')
        return redirect(url_for('student_bp.dashboard'))

    slot = TutorSlot.query.get(booking.slot_id)
    tutor = Tutor.query.get(booking.tutor_id)

    fee_pct = current_app.config['PLATFORM_FEE_PERCENT']
    price = float(slot.price or 0)
    platform_fee = round(price * fee_pct / 100, 2)

    return render_template('payment_checkout.html',
                           booking=booking, slot=slot, tutor=tutor,
                           price=price, platform_fee=platform_fee,
                           total=price, fee_pct=fee_pct)


@payment_bp.route('/payment/checkout/<int:booking_id>/proceed', methods=['POST'])
@login_required
def payment_checkout_proceed(booking_id):
    """Proceed from price breakdown to Stripe checkout."""
    from models.student import Student
    from services.payment_service import create_checkout_session

    booking = Booking.query.get_or_404(booking_id)

    if current_user.user_type != 'student' or booking.student_id != current_user.id:
        flash('Access denied.', 'danger')
        return redirect(url_for('student_bp.dashboard'))

    if booking.status != 'Pending Payment':
        flash('This booking is not awaiting payment.', 'warning')
        return redirect(url_for('student_bp.dashboard'))

    slot = TutorSlot.query.get(booking.slot_id)
    tutor = Tutor.query.get(booking.tutor_id)
    student = Student.query.get(current_user.id)

    try:
        checkout_url = create_checkout_session(booking, slot, student, tutor)
        return redirect(checkout_url)
    except Exception as e:
        current_app.logger.error(f'Stripe checkout error: {e}')
        flash('Payment service unavailable. Please try later.', 'danger')
        return redirect(url_for('student_bp.dashboard'))


# ═══════════════════════════════════════════════════════════
# Item 5: Downloadable PDF Invoice
# ═══════════════════════════════════════════════════════════

@payment_bp.route('/payment/<int:payment_id>/invoice')
@login_required
def download_invoice(payment_id):
    """Generate and download a PDF invoice for a completed payment."""
    import io
    from fpdf import FPDF

    payment = Payment.query.get_or_404(payment_id)

    # Only the student or tutor involved can download
    if current_user.user_type == 'student' and payment.student_id != current_user.id:
        flash('Access denied.', 'danger')
        return redirect(url_for('student_bp.dashboard'))
    if current_user.user_type == 'tutor' and payment.tutor_id != current_user.id:
        flash('Access denied.', 'danger')
        return redirect(url_for('tutor_bp.tutor_dashboard'))

    if payment.status not in ('completed', 'refunded', 'partial_refund'):
        flash('Invoice not available for this payment.', 'warning')
        return redirect(url_for('student_bp.dashboard'))

    booking = payment.booking
    slot = TutorSlot.query.get(booking.slot_id)
    tutor = Tutor.query.get(payment.tutor_id)
    from models.student import Student
    student = Student.query.get(payment.student_id)

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Header
    pdf.set_font('Helvetica', 'B', 22)
    pdf.set_text_color(30, 64, 175)
    pdf.cell(0, 12, 'TeachWise', ln=True)
    pdf.set_font('Helvetica', '', 10)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 6, 'Education Platform', ln=True)
    pdf.ln(4)

    # Invoice title
    pdf.set_draw_color(30, 64, 175)
    pdf.set_line_width(0.5)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(6)
    pdf.set_font('Helvetica', 'B', 16)
    pdf.set_text_color(31, 41, 55)
    pdf.cell(0, 10, 'INVOICE', ln=True)

    # Invoice details
    pdf.set_font('Helvetica', '', 10)
    pdf.set_text_color(75, 85, 99)
    invoice_num = f'INV-{payment.id:06d}'
    pdf.cell(95, 6, f'Invoice Number: {invoice_num}')
    pdf.cell(95, 6, f'Date: {(payment.completed_at or payment.created_at).strftime("%B %d, %Y")}', ln=True)
    pdf.cell(95, 6, f'Payment Status: {payment.status.title()}')
    if payment.stripe_payment_intent_id:
        pdf.cell(95, 6, f'Reference: {payment.stripe_payment_intent_id[-12:]}', ln=True)
    else:
        pdf.ln()
    pdf.ln(8)

    # Bill To / Session Info
    pdf.set_font('Helvetica', 'B', 11)
    pdf.set_text_color(31, 41, 55)
    pdf.cell(95, 7, 'Bill To:')
    pdf.cell(95, 7, 'Session Details:', ln=True)
    pdf.set_font('Helvetica', '', 10)
    pdf.set_text_color(75, 85, 99)
    pdf.cell(95, 6, student.name if student else 'Student')
    pdf.cell(95, 6, f'Tutor: {tutor.name if tutor else "N/A"}', ln=True)
    pdf.cell(95, 6, student.email if student else '')
    pdf.cell(95, 6, f'Subject: {slot.subject or (tutor.subject if tutor else "N/A")}', ln=True)
    pdf.cell(95, 6, '')
    date_str = slot.date.strftime('%B %d, %Y') if slot and slot.date else 'N/A'
    time_str = slot.start_time.strftime('%I:%M %p') if slot and slot.start_time else 'N/A'
    pdf.cell(95, 6, f'Date: {date_str} at {time_str}', ln=True)
    pdf.cell(95, 6, '')
    pdf.cell(95, 6, f'Mode: {(slot.mode or "N/A").title()}', ln=True)
    pdf.ln(10)

    # Payment Table
    pdf.set_fill_color(243, 244, 246)
    pdf.set_font('Helvetica', 'B', 10)
    pdf.set_text_color(31, 41, 55)
    pdf.cell(100, 8, 'Description', border=1, fill=True)
    pdf.cell(45, 8, 'Amount', border=1, fill=True, align='R')
    pdf.cell(45, 8, '', border=0, ln=True)

    pdf.set_font('Helvetica', '', 10)
    pdf.set_text_color(75, 85, 99)
    subject_name = slot.subject or (tutor.subject if tutor else 'Session')
    pdf.cell(100, 8, f'{subject_name} Session', border=1)
    pdf.cell(45, 8, f'${float(payment.amount):.2f}', border=1, align='R')
    pdf.cell(45, 8, '', border=0, ln=True)

    fee_pct = current_app.config['PLATFORM_FEE_PERCENT']
    pdf.cell(100, 8, f'Platform Fee ({fee_pct}%)', border=1)
    pdf.cell(45, 8, 'Included', border=1, align='R')
    pdf.cell(45, 8, '', border=0, ln=True)

    if payment.refund_amount and float(payment.refund_amount) > 0:
        pdf.set_text_color(220, 38, 38)
        pdf.cell(100, 8, 'Refund', border=1)
        pdf.cell(45, 8, f'-${float(payment.refund_amount):.2f}', border=1, align='R')
        pdf.cell(45, 8, '', border=0, ln=True)

    pdf.set_font('Helvetica', 'B', 11)
    pdf.set_text_color(31, 41, 55)
    total = float(payment.amount)
    if payment.refund_amount:
        total -= float(payment.refund_amount)
    pdf.cell(100, 8, 'Total Charged', border=1, fill=True)
    pdf.cell(45, 8, f'${total:.2f} {payment.currency.upper()}', border=1, fill=True, align='R')
    pdf.cell(45, 8, '', border=0, ln=True)
    pdf.ln(12)

    # Footer
    pdf.set_font('Helvetica', '', 9)
    pdf.set_text_color(156, 163, 175)
    pdf.cell(0, 5, 'Thank you for using TeachWise!', ln=True, align='C')
    pdf.cell(0, 5, 'This is an automatically generated invoice.', ln=True, align='C')

    # Output PDF
    pdf_output = pdf.output(dest='S')
    if isinstance(pdf_output, str):
        pdf_output = pdf_output.encode('latin-1')

    response = make_response(pdf_output)
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = f'attachment; filename=TeachWise_Invoice_{invoice_num}.pdf'
    return response


# ═══════════════════════════════════════════════════════════
# Item 4: Self-Service Refund Request
# ═══════════════════════════════════════════════════════════

@payment_bp.route('/payment/<int:payment_id>/refund-request', methods=['GET', 'POST'])
@login_required
def request_refund(payment_id):
    """Student self-service refund request."""
    from models.refund_request import RefundRequest

    payment = Payment.query.get_or_404(payment_id)

    if current_user.user_type != 'student' or payment.student_id != current_user.id:
        flash('Access denied.', 'danger')
        return redirect(url_for('student_bp.dashboard'))

    if payment.status not in ('completed',):
        flash('Refund not available for this payment.', 'warning')
        return redirect(url_for('student_bp.dashboard'))

    # Check if there's already a pending request
    existing = RefundRequest.query.filter_by(
        payment_id=payment_id, status='pending').first()
    if existing:
        flash('You already have a pending refund request for this payment.', 'info')
        return redirect(url_for('student_bp.dashboard'))

    booking = payment.booking
    slot = TutorSlot.query.get(booking.slot_id)
    tutor = Tutor.query.get(payment.tutor_id)

    # Calculate refund eligibility
    from services.booking_service import calculate_refund_percentage
    refund_pct = calculate_refund_percentage(slot) if slot else 0

    if request.method == 'POST':
        reason = request.form.get('reason', '').strip()
        if not reason:
            flash('Please provide a reason for your refund request.', 'warning')
            return redirect(url_for('payment_bp.request_refund',
                                    payment_id=payment_id))

        refund_req = RefundRequest(
            payment_id=payment_id,
            student_id=current_user.id,
            booking_id=booking.id,
            reason=reason,
            refund_percentage=refund_pct,
            refund_amount=round(float(payment.amount) * refund_pct / 100, 2),
        )
        db.session.add(refund_req)
        db.session.commit()

        flash('Refund request submitted. You will be notified once it is reviewed.', 'success')
        return redirect(url_for('student_bp.dashboard'))

    return render_template('refund_request.html',
                           payment=payment, booking=booking,
                           slot=slot, tutor=tutor,
                           refund_pct=refund_pct)
