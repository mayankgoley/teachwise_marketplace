from database import db
from datetime import datetime


class ContentReport(db.Model):
    __tablename__ = 'content_reports'

    id = db.Column(db.Integer, primary_key=True)
    reporter_id = db.Column(db.Integer, nullable=False)
    reporter_type = db.Column(db.String(20), nullable=False)
    content_type = db.Column(db.String(50), nullable=False)  # review, note, profile
    content_id = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(100), nullable=False)
    details = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='pending')  # pending, reviewed, dismissed
    reviewed_by = db.Column(db.String(100), nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'reporter_id': self.reporter_id,
            'reporter_type': self.reporter_type,
            'content_type': self.content_type,
            'content_id': self.content_id,
            'reason': self.reason,
            'details': self.details,
            'status': self.status,
            'reviewed_by': self.reviewed_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<ContentReport {self.id} {self.content_type}>'
