from database import db
from datetime import datetime


class EmailNotification(db.Model):
    __tablename__ = 'email_notifications'

    id = db.Column(db.Integer, primary_key=True)
    recipient_email = db.Column(db.String(120), nullable=False)
    recipient_type = db.Column(db.String(30), nullable=False)
    email_type = db.Column(db.String(50), nullable=False)
    subject_line = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(20), default='queued')
    error_message = db.Column(db.Text, nullable=True)
    related_booking_id = db.Column(db.Integer, db.ForeignKey('bookings.id'), nullable=True)
    sent_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
