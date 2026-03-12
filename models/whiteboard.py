from database import db
from datetime import datetime


class WhiteboardSession(db.Model):
    __tablename__ = 'whiteboard_sessions'

    id = db.Column(db.Integer, primary_key=True)
    slot_id = db.Column(db.Integer, db.ForeignKey('tutor_slots.id'), nullable=False)
    json_state = db.Column(db.Text, nullable=True)  # Fabric.js canvas JSON
    snapshots = db.Column(db.JSON, default=list)  # [{url, key, encryption_key, created_at}]
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    slot = db.relationship('TutorSlot', backref='whiteboard_session', uselist=False)

    def __repr__(self):
        return f'<WhiteboardSession {self.id} for slot {self.slot_id}>'
