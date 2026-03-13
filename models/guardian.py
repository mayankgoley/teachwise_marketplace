from database import db
from datetime import datetime
from flask import current_app
from flask_login import UserMixin
from cryptography.fernet import Fernet


class Guardian(UserMixin, db.Model):
    __tablename__ = 'guardians'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    _phone_encrypted = db.Column('phone_encrypted', db.Text, nullable=True)
    relationship = db.Column(db.String(50), nullable=False)
    password_hash = db.Column(db.String(255), nullable=True)
    is_verified = db.Column(db.Boolean, default=False)
    verified_on = db.Column(db.DateTime, nullable=True)
    notification_prefs = db.Column(db.JSON, default=lambda: {
        'booking_notifications': True, 'session_reminders': True,
        'spending_alerts': True
    })
    child_notification_config = db.Column(db.JSON, default=lambda: {})  # B3
    weekly_spending_limit = db.Column(db.Float, nullable=True)  # B6
    monthly_spending_limit = db.Column(db.Float, nullable=True)  # B6

    last_login = db.Column(db.DateTime, nullable=True)

    failed_login_attempts = db.Column(db.Integer, default=0)
    locked_until = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    students = db.relationship('Student', backref='guardian', lazy=True)

    @property
    def user_type(self):
        return 'guardian'

    def get_id(self):
        return f'guardian_{self.id}'

    @property
    def phone(self):
        if not self._phone_encrypted:
            return None
        try:
            key = current_app.config['FERNET_KEY'].encode()
            return Fernet(key).decrypt(self._phone_encrypted.encode()).decode()
        except Exception:
            return '[encrypted]'

    @phone.setter
    def phone(self, value):
        if value:
            key = current_app.config['FERNET_KEY'].encode()
            self._phone_encrypted = Fernet(key).encrypt(value.encode()).decode()
        else:
            self._phone_encrypted = None

    def __repr__(self):
        return f'<Guardian {self.name}>'
