from database import db
from datetime import datetime, date
from flask_login import UserMixin


class Student(UserMixin, db.Model):
    __tablename__ = 'students'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    date_of_birth = db.Column(db.Date, nullable=False)
    major = db.Column(db.String(100), nullable=True)
    grade_level = db.Column(db.String(50), nullable=True)
    bio = db.Column(db.Text, nullable=True)
    email_verified = db.Column(db.Boolean, default=False)

    # Guardian link (required if under 18)
    guardian_id = db.Column(db.Integer, db.ForeignKey('guardians.id'), nullable=True)

    timezone = db.Column(db.String(50), default='America/New_York')

    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    city = db.Column(db.String(100), nullable=True)

    notification_prefs = db.Column(db.JSON, default=lambda: {
        'booking_confirm': True, 'reminder_24h': True,
        'reminder_1h': True, 'session_complete': True
    })

    notification_sound = db.Column(db.Boolean, default=True)  # A1
    email_digest_frequency = db.Column(db.String(20), default='instant')  # A5
    reminder_times = db.Column(db.JSON, default=lambda: {})  # A6
    push_subscription = db.Column(db.JSON, nullable=True)  # A7

    has_seen_tour = db.Column(db.Boolean, default=False)

    failed_login_attempts = db.Column(db.Integer, default=0)
    locked_until = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    bookings = db.relationship('Booking', backref='student', lazy=True)
    reviews = db.relationship('Review', backref='student', lazy=True)

    @property
    def user_type(self):
        return 'student'

    def get_id(self):
        return f'student_{self.id}'

    @property
    def is_minor(self):
        """True if student is under 18. Computed live from date_of_birth."""
        if not self.date_of_birth:
            return False
        today = date.today()
        age = today.year - self.date_of_birth.year - (
            (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
        )
        return age < 18

    @property
    def guardian_verified(self):
        """True if adult, or if minor with verified guardian."""
        if not self.is_minor:
            return True
        if not self.guardian:
            return False
        return self.guardian.is_verified

    def __repr__(self):
        return f'<Student {self.name}>'
