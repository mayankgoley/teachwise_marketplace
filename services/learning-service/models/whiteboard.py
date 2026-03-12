from database import db
from datetime import datetime


class WhiteboardSession(db.Model):
    __tablename__ = 'whiteboard_sessions'

    id = db.Column(db.Integer, primary_key=True)
    slot_id = db.Column(db.Integer, nullable=False)
    created_by = db.Column(db.String(20), nullable=False)
    data = db.Column(db.JSON, default=dict)
    snapshot_url = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow)
