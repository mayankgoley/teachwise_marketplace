from database import db
from datetime import datetime, timedelta


class SessionRecording(db.Model):
    __tablename__ = 'session_recordings'

    id = db.Column(db.Integer, primary_key=True)
    slot_id = db.Column(db.Integer, db.ForeignKey('tutor_slots.id'), nullable=False)
    booking_id = db.Column(db.Integer, db.ForeignKey('bookings.id'), nullable=True)
    r2_object_key = db.Column(db.Text, nullable=True)
    file_encryption_key = db.Column(db.Text, nullable=True)
    duration_seconds = db.Column(db.Integer, nullable=True)
    file_size_bytes = db.Column(db.Integer, nullable=True)
    quality = db.Column(db.String(20), nullable=True)  # C1: 'low','medium','high'
    consent_student = db.Column(db.Boolean, default=False)
    consent_tutor = db.Column(db.Boolean, default=False)
    expires_at = db.Column(db.DateTime, nullable=True)
    is_deleted = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    slot = db.relationship('TutorSlot', backref='recordings')
    booking = db.relationship('Booking', backref='recording')

    @property
    def is_consented(self):
        return self.consent_student and self.consent_tutor

    @property
    def is_expired(self):
        if not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at

    def __repr__(self):
        return f'<SessionRecording {self.id} for slot {self.slot_id}>'
