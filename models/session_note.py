from database import db
from datetime import datetime


class SessionNote(db.Model):
    __tablename__ = 'session_notes'

    id = db.Column(db.Integer, primary_key=True)
    slot_id = db.Column(db.Integer, db.ForeignKey('tutor_slots.id'), nullable=False)
    author_type = db.Column(db.String(20), nullable=False)   # 'student' or 'tutor'
    author_id = db.Column(db.Integer, nullable=False)
    content = db.Column(db.Text, nullable=False)
    is_private = db.Column(db.Boolean, default=False)  # private = only author sees it
    attachments = db.Column(db.JSON, nullable=True)  # B6: [{key, encryption_key, name, size}]
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow)

    slot = db.relationship('TutorSlot', backref='notes', lazy=True)
    versions = db.relationship('NoteVersion', backref='note', lazy=True,
                               order_by='NoteVersion.created_at.desc()')


class NoteVersion(db.Model):
    """B3: Track edit history of session notes."""
    __tablename__ = 'note_versions'

    id = db.Column(db.Integer, primary_key=True)
    note_id = db.Column(db.Integer, db.ForeignKey('session_notes.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    edited_by = db.Column(db.String(20), nullable=False)  # 'student' or 'tutor'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
