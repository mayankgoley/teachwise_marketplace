from flask import (Blueprint, render_template, request, redirect,
                   url_for, flash, jsonify, current_app)
from flask_login import login_required, current_user
from utils.auth import role_required
from database import db
from extensions import limiter
from models.wallet import Wallet
from models.wallet_transaction import WalletTransaction
from decimal import Decimal
from datetime import datetime

wallet_bp = Blueprint('wallet_bp', __name__)


def _get_or_create_wallet(student_id):
    """Get existing wallet or create a new one."""
    wallet = Wallet.query.filter_by(student_id=student_id).first()
    if not wallet:
        wallet = Wallet(student_id=student_id, balance=Decimal('0.00'))
        db.session.add(wallet)
        db.session.commit()
    return wallet


@wallet_bp.route('/student/wallet')
@role_required('student')
def wallet_dashboard():
    wallet = _get_or_create_wallet(current_user.id)

    # Item 3: Transaction history date filter
    date_from = request.args.get('date_from', '')
    date_to = request.args.get('date_to', '')
    txn_type = request.args.get('type', '')

    query = wallet.transactions
    if date_from:
        try:
            dt_from = datetime.strptime(date_from, '%Y-%m-%d')
            query = query.filter(WalletTransaction.created_at >= dt_from)
        except ValueError:
            pass
    if date_to:
        try:
            dt_to = datetime.strptime(date_to, '%Y-%m-%d').replace(
                hour=23, minute=59, second=59)
            query = query.filter(WalletTransaction.created_at <= dt_to)
        except ValueError:
            pass
    if txn_type:
        query = query.filter(WalletTransaction.type == txn_type)

    transactions = query.limit(50).all()
    return render_template('wallet.html', wallet=wallet,
                           transactions=transactions,
                           date_from=date_from, date_to=date_to,
                           txn_type=txn_type)


@wallet_bp.route('/student/wallet/topup', methods=['GET', 'POST'])
@role_required('student')
@limiter.limit('10 per hour', methods=['POST'])
def wallet_topup():
    min_topup = current_app.config.get('WALLET_MIN_TOPUP', 5)
    max_topup = current_app.config.get('WALLET_MAX_TOPUP', 500)

    if request.method == 'POST':
        try:
            amount = Decimal(request.form.get('amount', '0'))
        except Exception:
            flash('Invalid amount.', 'danger')
            return redirect(url_for('wallet_bp.wallet_topup'))

        if amount < Decimal(str(min_topup)) or amount > Decimal(str(max_topup)):
            flash(f'Amount must be between ${min_topup} and ${max_topup}.', 'warning')
            return redirect(url_for('wallet_bp.wallet_topup'))

        # Create Stripe Checkout for wallet top-up
        try:
            import stripe
            amount_cents = int(amount * 100)
            session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': 'usd',
                        'unit_amount': amount_cents,
                        'product_data': {
                            'name': 'TeachWise Wallet Top-Up',
                            'description': f'Add ${amount:.2f} to your wallet',
                        },
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=url_for('wallet_bp.topup_success',
                                    amount=str(amount), _external=True),
                cancel_url=url_for('wallet_bp.wallet_topup', _external=True),
                customer_email=current_user.email,
                metadata={
                    'type': 'wallet_topup',
                    'student_id': str(current_user.id),
                    'amount': str(amount),
                },
            )
            return redirect(session.url)
        except Exception as e:
            current_app.logger.error(f'Wallet topup Stripe error: {e}')
            flash('Payment service unavailable. Please try later.', 'danger')
            return redirect(url_for('wallet_bp.wallet_topup'))

    return render_template('wallet_topup.html',
                           min_topup=min_topup, max_topup=max_topup)


@wallet_bp.route('/student/wallet/topup-success')
@role_required('student')
def topup_success():
    amount_str = request.args.get('amount', '0')
    try:
        amount = Decimal(amount_str)
    except Exception:
        amount = Decimal('0')

    if amount > 0:
        wallet = _get_or_create_wallet(current_user.id)
        wallet.balance = Decimal(str(wallet.balance)) + amount
        txn = WalletTransaction(
            wallet_id=wallet.id,
            amount=amount,
            type='topup',
            description=f'Wallet top-up of ${amount:.2f}',
            balance_after=wallet.balance,
        )
        db.session.add(txn)
        db.session.commit()
        flash(f'${amount:.2f} added to your wallet!', 'success')

    return redirect(url_for('wallet_bp.wallet_dashboard'))


@wallet_bp.route('/api/wallet/balance')
@role_required('student')
def api_wallet_balance():
    wallet = _get_or_create_wallet(current_user.id)
    return jsonify({
        'balance': float(wallet.balance),
        'currency': wallet.currency,
    })
