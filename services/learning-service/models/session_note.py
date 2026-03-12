from database import db
from datetime import datetime


class SessionNote(db.Model):
    __tablename__ = 'session_notes'

    id = db.Column(db.Integer, primary_key=True)
    slot_id = db.Column(db.Integer, nullable=False)
    author_type = db.Column(db.String(20), nullable=False)
    author_id = db.Column(db.Integer, nullable=False)
    content = db.Column(db.Text, nullable=False)
    is_private = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow)
