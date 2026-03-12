from database import db
from datetime import datetime


class LearningGoal(db.Model):
    __tablename__ = 'learning_goals'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, nullable=False)
    tutor_id = db.Column(db.Integer, nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='active')
    target_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    entries = db.relationship('ProgressEntry', backref='goal',
                              lazy=True, order_by='ProgressEntry.created_at.desc()')


class ProgressEntry(db.Model):
    __tablename__ = 'progress_entries'

    id = db.Column(db.Integer, primary_key=True)
    goal_id = db.Column(db.Integer, db.ForeignKey('learning_goals.id'), nullable=False)
    slot_id = db.Column(db.Integer, nullable=True)
    note = db.Column(db.Text, nullable=False)
    rating = db.Column(db.Integer, nullable=True)
    created_by = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
