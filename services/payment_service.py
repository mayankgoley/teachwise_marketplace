import stripe
from flask import current_app, url_for
from models.payment import Payment
from database import db
from datetime import datetime


def create_checkout_session(booking, slot, student, tutor):
    try:
        amount_cents = int(float(slot.price) * 100)
        fee_pct = current_app.config['PLATFORM_FEE_PERCENT']
        platform_fee_cents = int(amount_cents * fee_pct / 100)

        payment = Payment(
            booking_id=booking.id,
            student_id=student.id,
            tutor_id=tutor.id,
            amount=slot.price,
            platform_fee=round(float(slot.price) * fee_pct / 100, 2),
            tutor_payout=round(float(slot.price) * (100 - fee_pct) / 100, 2),
            status='pending'
        )
        db.session.add(payment)
        db.session.flush()  # Get payment.id without committing

        checkout_params = {
            'payment_method_types': ['card'],
            'line_items': [{
                'price_data': {
                    'currency': 'usd',
                    'unit_amount': amount_cents,
                    'product_data': {
                        'name': f'{slot.subject} Session with {tutor.name}',
                        'description': (
                            f'{slot.date.strftime("%B %d, %Y")} at '
                            f'{slot.start_time.strftime("%I:%M %p")}'
                        ),
                    },
                },
                'quantity': 1,
            }],
            'mode': 'payment',
            'success_url': url_for(
                'payment_bp.payment_success',
                booking_id=booking.id, _external=True),
            'cancel_url': url_for(
                'payment_bp.payment_cancel',
                booking_id=booking.id, _external=True),
            'metadata': {
                'booking_id': str(booking.id),
                'payment_id': str(payment.id),
            },
            'customer_email': student.email,
        }

        if tutor.stripe_account_id and tutor.stripe_onboarding_complete:
            checkout_params['payment_intent_data'] = {
                'application_fee_amount': platform_fee_cents,
                'transfer_data': {'destination': tutor.stripe_account_id},
            }

        session = stripe.checkout.Session.create(**checkout_params)
        payment.stripe_checkout_session_id = session.id
        db.session.commit()

        return session.url
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Checkout session creation error: {e}')
        raise


def process_successful_payment(checkout_session_id):
    payment = Payment.query.filter_by(
        stripe_checkout_session_id=checkout_session_id).first()
    if not payment:
        return False

    session = stripe.checkout.Session.retrieve(checkout_session_id)
    payment.stripe_payment_intent_id = session.payment_intent
    payment.status = 'completed'
    payment.completed_at = datetime.utcnow()

    booking = payment.booking
    booking.status = 'Confirmed'

    db.session.commit()
    return True


def process_refund(payment_id, refund_percent):
    payment = Payment.query.get(payment_id)
    if not payment or payment.status not in ('completed', 'partial_refund'):
        return None

    refund_amount_cents = int(float(payment.amount) * 100 * refund_percent / 100)
    if refund_amount_cents <= 0:
        return None

    try:
        refund = stripe.Refund.create(
            payment_intent=payment.stripe_payment_intent_id,
            amount=refund_amount_cents,
        )
        payment.refund_amount = round(refund_amount_cents / 100, 2)
        payment.stripe_refund_id = refund.id
        payment.status = 'refunded' if refund_percent == 100 else 'partial_refund'
        db.session.commit()
        return refund
    except stripe.error.StripeError as e:
        db.session.rollback()
        current_app.logger.error(f'Stripe refund error: {e}')
        return None


def create_connect_account_link(tutor):
    if not tutor.stripe_account_id:
        account = stripe.Account.create(
            type='express',
            email=tutor.email,
            capabilities={
                'card_payments': {'requested': True},
                'transfers': {'requested': True},
            },
        )
        tutor.stripe_account_id = account.id
        db.session.commit()

    account_link = stripe.AccountLink.create(
        account=tutor.stripe_account_id,
        refresh_url=url_for('payment_bp.stripe_onboard', _external=True),
        return_url=url_for('payment_bp.stripe_callback', _external=True),
        type='account_onboarding',
    )
    return account_link.url
