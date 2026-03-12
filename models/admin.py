from database import db
from datetime import datetime
from flask_login import UserMixin


class Admin(UserMixin, db.Model):
    __tablename__ = 'admins'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), default='admin')
    # Roles: reviewer, verification_officer, admin, superadmin
    timezone = db.Column(db.String(50), default='UTC')

    failed_login_attempts = db.Column(db.Integer, default=0)
    locked_until = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def user_type(self):
        return 'admin'

    def get_id(self):
        return f'admin_{self.id}'

    def __repr__(self):
        return f'<Admin {self.name} ({self.role})>'
