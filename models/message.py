from database import db
from datetime import datetime


class Conversation(db.Model):
    __tablename__ = 'conversations'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    tutor_id = db.Column(db.Integer, db.ForeignKey('tutors.id'), nullable=False)
    started_by = db.Column(db.String(10), default='student')  # 'student' or 'tutor'
    is_blocked_by_student = db.Column(db.Boolean, default=False)
    is_blocked_by_tutor = db.Column(db.Boolean, default=False)
    last_message_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('student_id', 'tutor_id', name='uq_conversation_pair'),
    )

    student = db.relationship('Student', backref='conversations')
    tutor = db.relationship('Tutor', backref='conversations')
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
    sender_type = db.Column(db.String(10), nullable=False)  # 'student' or 'tutor'
    sender_id = db.Column(db.Integer, nullable=False)
    content = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Delivery status: sent -> delivered -> read
    status = db.Column(db.String(20), default='sent')
    read_at = db.Column(db.DateTime, nullable=True)

    # File/image sharing
    message_type = db.Column(db.String(20), default='text')  # text, image, file
    file_url = db.Column(db.String(500), nullable=True)
    file_name = db.Column(db.String(255), nullable=True)
    file_size = db.Column(db.Integer, nullable=True)
    file_mime_type = db.Column(db.String(100), nullable=True)

    # Editing and deletion
    edited_at = db.Column(db.DateTime, nullable=True)
    is_deleted = db.Column(db.Boolean, default=False)

    def __repr__(self):
        return f'<Message {self.id}>'
