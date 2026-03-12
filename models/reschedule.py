from database import db
from datetime import datetime, timedelta


class RescheduleRequest(db.Model):
    __tablename__ = 'reschedule_requests'

    id = db.Column(db.Integer, primary_key=True)
    booking_id = db.Column(db.Integer, db.ForeignKey('bookings.id'), nullable=False)
    original_slot_id = db.Column(db.Integer, db.ForeignKey('tutor_slots.id'), nullable=False)
    proposed_slot_id = db.Column(db.Integer, db.ForeignKey('tutor_slots.id'), nullable=False)
    requested_by = db.Column(db.String(10), nullable=False)  # 'student' or 'tutor'
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected, expired
    reason = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    responded_at = db.Column(db.DateTime, nullable=True)
    expires_at = db.Column(db.DateTime, nullable=False,
                           default=lambda: datetime.utcnow() + timedelta(hours=48))

    booking = db.relationship('Booking', backref='reschedule_requests')
    original_slot = db.relationship('TutorSlot', foreign_keys=[original_slot_id])
    proposed_slot = db.relationship('TutorSlot', foreign_keys=[proposed_slot_id])

    def __repr__(self):
        return f'<RescheduleRequest {self.id} {self.status}>'
