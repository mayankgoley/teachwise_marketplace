from database import db
from datetime import datetime


class WalletTransaction(db.Model):
    __tablename__ = 'wallet_transactions'

    id = db.Column(db.Integer, primary_key=True)
    wallet_id = db.Column(db.Integer, db.ForeignKey('wallets.id'), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    # topup, booking_payment, refund, bonus
    type = db.Column(db.String(30), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    reference_id = db.Column(db.String(100), nullable=True)  # booking_id, etc
    stripe_charge_id = db.Column(db.String(255), nullable=True)
    balance_after = db.Column(db.Numeric(10, 2), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<WalletTxn {self.type} {self.amount}>'
