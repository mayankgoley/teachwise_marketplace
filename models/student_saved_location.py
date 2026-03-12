from database import db
from datetime import datetime


class StudentSavedLocation(db.Model):
    __tablename__ = 'student_saved_locations'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    label = db.Column(db.String(100), nullable=False)
    address = db.Column(db.String(255), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    location_type = db.Column(db.String(50), nullable=False, default='other')
    is_primary = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    student = db.relationship('Student', backref=db.backref('saved_locations', lazy=True))

    def __repr__(self):
        return f'<StudentSavedLocation {self.label}>'
