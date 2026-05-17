from database import db
from datetime import datetime
import uuid


class ChatbotConversation(db.Model):
    __tablename__ = 'chatbot_conversations'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.Integer, nullable=True)
    user_role = db.Column(db.String(20), default='guest')
    status = db.Column(db.String(20), default='active')
    escalated_to = db.Column(db.String(100), nullable=True)
    escalation_reason = db.Column(db.Text, nullable=True)
    message_count = db.Column(db.Integer, default=0)
    total_tokens = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = db.relationship(
        'ChatbotMessage', backref='conversation',
        lazy='dynamic', cascade='all, delete-orphan',
        order_by='ChatbotMessage.created_at'
    )

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_role': self.user_role,
            'status': self.status,
            'message_count': self.message_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class ChatbotMessage(db.Model):
    __tablename__ = 'chatbot_messages'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = db.Column(
        db.String(36),
        db.ForeignKey('chatbot_conversations.id', ondelete='CASCADE'),
        nullable=False
    )
    role = db.Column(db.String(20), nullable=False)
    content = db.Column(db.Text, nullable=False)
    tool_calls = db.Column(db.JSON, nullable=True)
    tool_results = db.Column(db.JSON, nullable=True)
    tokens_used = db.Column(db.Integer, default=0)
    feedback = db.Column(db.String(20), nullable=True)  # helpful / unhelpful
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'role': self.role,
            'content': self.content,
            'feedback': self.feedback,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
