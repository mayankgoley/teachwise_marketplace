from database import db
from datetime import datetime
from flask_login import UserMixin


class Tutor(UserMixin, db.Model):
    __tablename__ = 'tutors'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    subject = db.Column(db.String(100), nullable=False)
    subjects_additional = db.Column(db.JSON, nullable=True)
    experience = db.Column(db.Integer, default=0)
    bio = db.Column(db.Text, nullable=True)
    qualification = db.Column(db.String(200), nullable=True)
    institution = db.Column(db.String(200), nullable=True)
    teaching_mode = db.Column(db.String(50), default='Both')
    hourly_rate = db.Column(db.Float, nullable=True)
    address = db.Column(db.String(255), nullable=True)
    emergency_contact = db.Column(db.String(50), nullable=True)
    profile_photo = db.Column(db.String(255), nullable=True)

    timezone = db.Column(db.String(50), default='America/New_York')

    notification_prefs = db.Column(db.JSON, default=lambda: {
        'booking_notifications': True, 'session_reminders': True,
        'review_alerts': True, 'marketing_emails': True, 'email_digest': False
    })

    weekly_availability_template = db.Column(db.JSON, nullable=True)

    stripe_account_id = db.Column(db.String(255), nullable=True)
    stripe_onboarding_complete = db.Column(db.Boolean, default=False)

    is_profile_complete = db.Column(db.Boolean, default=False)

    verification_status = db.Column(db.String(50), default='pending_documents')
    # States: pending_documents -> documents_submitted -> under_review
    #         -> verified | rejected | revision_required -> verification_expired
    verified_on = db.Column(db.DateTime, nullable=True)

    admin_feedback = db.Column(db.Text, nullable=True)
    reviewed_by = db.Column(db.String(100), nullable=True)
    reviewed_on = db.Column(db.DateTime, nullable=True)

    rating_avg = db.Column(db.Float, default=0.0)
    total_reviews = db.Column(db.Integer, default=0)
    total_sessions_completed = db.Column(db.Integer, default=0)
    response_time_avg = db.Column(db.Integer, nullable=True)

    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    city = db.Column(db.String(100), nullable=True)
    service_radius_km = db.Column(db.Integer, default=25)
    default_location_label = db.Column(db.String(100), nullable=True)
    default_radius_miles = db.Column(db.Float, default=10.0)

    search_vector = db.Column(db.Text, nullable=True)

    failed_login_attempts = db.Column(db.Integer, default=0)
    locked_until = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    slots = db.relationship('TutorSlot', backref='tutor', lazy=True)
    reviews = db.relationship('Review', backref='tutor', lazy=True)

    @property
    def user_type(self):
        return 'tutor'

    def get_id(self):
        return f'tutor_{self.id}'

    @property
    def is_verified(self):
        return self.verification_status == 'verified'

    @property
    def average_rating(self):
        if not self.reviews:
            return 0
        return round(sum(r.rating for r in self.reviews) / len(self.reviews), 1)

    def __repr__(self):
        return f'<Tutor {self.name}>'
