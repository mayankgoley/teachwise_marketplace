from database import db
from datetime import datetime


class Assignment(db.Model):
    __tablename__ = 'assignments'

    id = db.Column(db.Integer, primary_key=True)
    tutor_id = db.Column(db.Integer, db.ForeignKey('tutors.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    subject = db.Column(db.String(100), nullable=True)
    due_date = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), default='assigned')  # assigned/submitted/reviewed/overdue/returned
    file_urls = db.Column(db.JSON, default=list)  # [{name, key, encryption_key}]
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Item 4: Grading rubric
    rubric = db.Column(db.JSON, nullable=True)
    # Format: [{"criterion": "Understanding", "max_points": 25, "description": "..."}, ...]

    # Item 8: Late submission policy
    allow_late_submission = db.Column(db.Boolean, default=False)
    grace_period_hours = db.Column(db.Integer, default=0)
    late_penalty_percent = db.Column(db.Integer, default=0)  # % deduction per day

    # Item 9: Resubmission
    allow_resubmission = db.Column(db.Boolean, default=True)
    max_resubmissions = db.Column(db.Integer, default=1)

    tutor = db.relationship('Tutor', backref='assignments_given')
    student = db.relationship('Student', backref='assignments_received')
    submission = db.relationship('Submission', backref='assignment', uselist=False,
                                foreign_keys='Submission.assignment_id')

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

    # Item 3: Draft support
    status = db.Column(db.String(20), default='submitted')  # draft/submitted/graded/returned

    # Item 4: Rubric scores
    rubric_scores = db.Column(db.JSON, nullable=True)
    # Format: [{"criterion": "Understanding", "score": 20, "max_points": 25}, ...]

    # Item 8: Late tracking
    is_late = db.Column(db.Boolean, default=False)
    late_hours = db.Column(db.Numeric(10, 2), nullable=True)

    # Item 9: Resubmission
    resubmission_allowed = db.Column(db.Boolean, default=False)
    resubmission_count = db.Column(db.Integer, default=0)
    parent_submission_id = db.Column(db.Integer, db.ForeignKey('submissions.id'), nullable=True)

    student = db.relationship('Student', backref='submissions')
    parent_submission = db.relationship('Submission', remote_side='Submission.id',
                                        backref='resubmissions')

    def __repr__(self):
        return f'<Submission {self.id} for Assignment {self.assignment_id}>'
