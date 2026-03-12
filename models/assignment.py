from database import db
from datetime import datetime


class Assignment(db.Model):
    __tablename__ = 'assignments'

    id = db.Column(db.Integer, primary_key=True)
    tutor_id = db.Column(db.Integer, db.ForeignKey('tutors.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    due_date = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), default='assigned')  # assigned/submitted/reviewed/overdue
    file_urls = db.Column(db.JSON, default=list)  # [{name, key, encryption_key}]
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    tutor = db.relationship('Tutor', backref='assignments_given')
    student = db.relationship('Student', backref='assignments_received')
    submission = db.relationship('Submission', backref='assignment', uselist=False)

    def __repr__(self):
        return f'<Assignment {self.id}: {self.title}>'


class Submission(db.Model):
    __tablename__ = 'submissions'

    id = db.Column(db.Integer, primary_key=True)
    assignment_id = db.Column(db.Integer, db.ForeignKey('assignments.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    text_response = db.Column(db.Text, nullable=True)
    file_urls = db.Column(db.JSON, default=list)
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    grade = db.Column(db.String(10), nullable=True)
    feedback = db.Column(db.Text, nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)

    student = db.relationship('Student', backref='submissions')

    def __repr__(self):
        return f'<Submission {self.id} for Assignment {self.assignment_id}>'
