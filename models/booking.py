from database import db
from datetime import datetime


class Booking(db.Model):
    __tablename__ = 'bookings'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    tutor_id = db.Column(db.Integer, db.ForeignKey('tutors.id'), nullable=False)
    slot_id = db.Column(db.Integer, db.ForeignKey('tutor_slots.id'), nullable=False)
    status = db.Column(db.String(50), default='Booked')
    booked_on = db.Column(db.DateTime, default=datetime.utcnow)

    confirmation_email_sent = db.Column(db.Boolean, default=False)
    guardian_notified = db.Column(db.Boolean, default=False)
    cancelled_by = db.Column(db.String(50), nullable=True)
    cancelled_on = db.Column(db.DateTime, nullable=True)

    # Guardian approval for minor students (None = not applicable, True/False = decision)
    guardian_approved = db.Column(db.Boolean, nullable=True)
    guardian_approved_on = db.Column(db.DateTime, nullable=True)

    recording_consent_student = db.Column(db.Boolean, default=False)
    recording_consent_tutor = db.Column(db.Boolean, default=False)

    meeting_latitude = db.Column(db.Float, nullable=True)
    meeting_longitude = db.Column(db.Float, nullable=True)
    meeting_address = db.Column(db.String(255), nullable=True)
    meeting_address_encrypted = db.Column(db.LargeBinary, nullable=True)
    meeting_location_type = db.Column(db.String(50), nullable=True)
    meeting_location_label = db.Column(db.String(100), nullable=True)

    def __repr__(self):
        return f'<Booking {self.id}>'
