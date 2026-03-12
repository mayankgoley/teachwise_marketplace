from database import db
from datetime import datetime


class Conversation(db.Model):
    __tablename__ = 'conversations'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, nullable=False)
    tutor_id = db.Column(db.Integer, nullable=False)
    started_by = db.Column(db.String(10), default='student')
    is_blocked_by_student = db.Column(db.Boolean, default=False)
    is_blocked_by_tutor = db.Column(db.Boolean, default=False)
    last_message_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('student_id', 'tutor_id', name='uq_conversation_pair'),
    )

    messages = db.relationship('Message', backref='conversation',
                               lazy='dynamic', order_by='Message.created_at')

    def is_blocked(self):
        return self.is_blocked_by_student or self.is_blocked_by_tutor

    def __repr__(self):
        return f'<Conversation {self.id}>'


class Message(db.Model):
    __tablename__ = 'messages'

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversations.id'), nullable=False)
    sender_type = db.Column(db.String(10), nullable=False)
    sender_id = db.Column(db.Integer, nullable=False)
    content = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Message {self.id}>'
