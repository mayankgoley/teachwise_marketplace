from database import db
from datetime import datetime


class GuardianChildSettings(db.Model):
    __tablename__ = 'guardian_child_settings'

    id = db.Column(db.Integer, primary_key=True)
    guardian_id = db.Column(db.Integer, db.ForeignKey('guardians.id'),
                            nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'),
                           nullable=False, index=True)

    monthly_spending_cap = db.Column(db.Float, nullable=True)
    session_window_start = db.Column(db.Time, nullable=True)
    session_window_end = db.Column(db.Time, nullable=True)
    requires_approval_for_booking = db.Column(db.Boolean, default=True,
                                              nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('guardian_id', 'student_id',
                            name='uq_guardian_student_settings'),
    )

    guardian = db.relationship('Guardian', backref='child_settings')
    student = db.relationship('Student', backref='guardian_settings')

    def to_dict(self):
        return {
            'id': self.id,
            'guardian_id': self.guardian_id,
            'student_id': self.student_id,
            'monthly_spending_cap': self.monthly_spending_cap,
            'session_window_start': self.session_window_start.isoformat()
                if self.session_window_start else None,
            'session_window_end': self.session_window_end.isoformat()
                if self.session_window_end else None,
            'requires_approval_for_booking': self.requires_approval_for_booking,
        }

    def __repr__(self):
        return f'<GuardianChildSettings g={self.guardian_id} s={self.student_id}>'
