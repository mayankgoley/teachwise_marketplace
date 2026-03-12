from database import db
from datetime import datetime


class InAppNotification(db.Model):
    __tablename__ = 'in_app_notifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)
    user_type = db.Column(db.String(20), nullable=False)

    type = db.Column(db.String(50), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=True)
    icon = db.Column(db.String(50), default='fas fa-bell')
    color = db.Column(db.String(20), default='blue')
    url = db.Column(db.String(500), nullable=True)

    is_read = db.Column(db.Boolean, default=False)
    read_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type,
            'title': self.title,
            'message': self.message,
            'icon': self.icon,
            'color': self.color,
            'url': self.url,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat(),
        }
