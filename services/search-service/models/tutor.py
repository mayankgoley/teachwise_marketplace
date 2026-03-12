from database import db
from datetime import datetime


class Tutor(db.Model):
    __tablename__ = 'tutors'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    subject = db.Column(db.String(100), nullable=False)
    subjects_additional = db.Column(db.JSON, nullable=True)
    experience = db.Column(db.Integer, default=0)
    bio = db.Column(db.Text, nullable=True)
    qualification = db.Column(db.String(200), nullable=True)
    institution = db.Column(db.String(200), nullable=True)
    teaching_mode = db.Column(db.String(50), default='Both')
    hourly_rate = db.Column(db.Float, nullable=True)
    profile_photo = db.Column(db.String(255), nullable=True)

    verification_status = db.Column(db.String(50), default='pending_documents')

    rating_avg = db.Column(db.Float, default=0.0)
    total_reviews = db.Column(db.Integer, default=0)
    total_sessions_completed = db.Column(db.Integer, default=0)

    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    city = db.Column(db.String(100), nullable=True)
    service_radius_km = db.Column(db.Integer, default=25)

    search_vector = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def average_rating(self):
        return self.rating_avg or 0

    def __repr__(self):
        return f'<Tutor {self.name}>'
