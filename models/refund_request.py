from database import db
from datetime import datetime


class RefundRequest(db.Model):
    __tablename__ = 'refund_requests'

    id = db.Column(db.Integer, primary_key=True)
    payment_id = db.Column(db.Integer, db.ForeignKey('payments.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    booking_id = db.Column(db.Integer, db.ForeignKey('bookings.id'), nullable=False)

    reason = db.Column(db.Text, nullable=False)
    refund_percentage = db.Column(db.Integer, default=0)  # calculated at request time
    refund_amount = db.Column(db.Numeric(10, 2), default=0)

    # pending, approved, denied
    status = db.Column(db.String(20), default='pending')
    admin_note = db.Column(db.Text, nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    payment = db.relationship('Payment', backref='refund_requests')
    student = db.relationship('Student', backref='refund_requests')

    def __repr__(self):
        return f'<RefundRequest {self.id} payment={self.payment_id} {self.status}>'
