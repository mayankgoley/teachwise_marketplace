from database import db
from datetime import datetime


class FavoriteTutor(db.Model):
    __tablename__ = 'favorite_tutors'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    tutor_id = db.Column(db.Integer, db.ForeignKey('tutors.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('student_id', 'tutor_id', name='uq_student_tutor_fav'),
    )

    student = db.relationship('Student', backref='favorites')
    tutor = db.relationship('Tutor', backref='favorited_by')
