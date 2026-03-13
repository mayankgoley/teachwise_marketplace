from database import db
from datetime import datetime


class GuardianMessage(db.Model):
    __tablename__ = 'guardian_messages'

    id = db.Column(db.Integer, primary_key=True)
    guardian_id = db.Column(db.Integer, db.ForeignKey('guardians.id'), nullable=False)
    tutor_id = db.Column(db.Integer, db.ForeignKey('tutors.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    sender_type = db.Column(db.String(20), nullable=False)  # guardian or tutor
    content = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    guardian = db.relationship('Guardian', backref='messages_sent')
    tutor = db.relationship('Tutor', backref='guardian_messages')
    student = db.relationship('Student', backref='guardian_messages')

    def to_dict(self):
        return {
            'id': self.id,
            'guardian_id': self.guardian_id,
            'tutor_id': self.tutor_id,
            'student_id': self.student_id,
            'sender_type': self.sender_type,
            'content': self.content,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<GuardianMessage {self.id}>'
