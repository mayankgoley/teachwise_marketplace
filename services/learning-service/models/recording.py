from database import db
from datetime import datetime


class SessionRecording(db.Model):
    __tablename__ = 'session_recordings'

    id = db.Column(db.Integer, primary_key=True)
    slot_id = db.Column(db.Integer, nullable=False)
    recorded_by = db.Column(db.String(20), nullable=False)
    file_url = db.Column(db.String(500), nullable=True)
    file_key = db.Column(db.String(500), nullable=True)
    encryption_key = db.Column(db.String(500), nullable=True)
    duration_seconds = db.Column(db.Integer, nullable=True)
    file_size_bytes = db.Column(db.Integer, nullable=True)
    status = db.Column(db.String(20), default='processing')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
