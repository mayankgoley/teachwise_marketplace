from database import db
from datetime import datetime


class LearningGoal(db.Model):
    __tablename__ = 'learning_goals'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    tutor_id = db.Column(db.Integer, db.ForeignKey('tutors.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='active')  # active, completed, paused
    target_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    student = db.relationship('Student', backref='learning_goals', lazy=True)
    tutor = db.relationship('Tutor', backref='learning_goals', lazy=True)
    entries = db.relationship('ProgressEntry', backref='goal',
                              lazy=True, order_by='ProgressEntry.created_at.desc()')


class ProgressEntry(db.Model):
    __tablename__ = 'progress_entries'

    id = db.Column(db.Integer, primary_key=True)
    goal_id = db.Column(db.Integer, db.ForeignKey('learning_goals.id'), nullable=False)
    slot_id = db.Column(db.Integer, db.ForeignKey('tutor_slots.id'), nullable=True)
    note = db.Column(db.Text, nullable=False)
    rating = db.Column(db.Integer, nullable=True)  # 1-5, how the session went
    created_by = db.Column(db.String(20), nullable=False)  # 'student' or 'tutor'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    slot = db.relationship('TutorSlot', backref='progress_entries', lazy=True)
