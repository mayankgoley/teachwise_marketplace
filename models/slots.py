from database import db
from datetime import datetime


class TutorSlot(db.Model):
    __tablename__ = 'tutor_slots'

    id = db.Column(db.Integer, primary_key=True)
    tutor_id = db.Column(db.Integer, db.ForeignKey('tutors.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=True)
    date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    mode = db.Column(db.String(50), default='online')
    subject = db.Column(db.String(100), nullable=True)
    grade_level = db.Column(db.String(50), nullable=True)
    price = db.Column(db.Float, default=0.0)

    is_group = db.Column(db.Boolean, default=False)
    max_students = db.Column(db.Integer, default=1)
    current_students = db.Column(db.Integer, default=0)

    # Session lifecycle: pending -> booked -> live -> completed | cancelled
    status = db.Column(db.String(50), default='pending')
    session_link = db.Column(db.String(255), nullable=True)
    jitsi_room_name = db.Column(db.String(255), nullable=True)

    # Reminder tracking (prevents duplicate emails)
    reminder_24h_sent = db.Column(db.Boolean, default=False)
    reminder_1h_sent = db.Column(db.Boolean, default=False)

    location_address = db.Column(db.String(255), nullable=True)
    location_latitude = db.Column(db.Float, nullable=True)
    location_longitude = db.Column(db.Float, nullable=True)
    location_label = db.Column(db.String(100), nullable=True)
    location_is_default = db.Column(db.Boolean, default=True)
    radius_miles = db.Column(db.Float, nullable=True)
    radius_is_default = db.Column(db.Boolean, default=True)
    cancellation_reason = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    student = db.relationship('Student', backref='slots', lazy=True)
