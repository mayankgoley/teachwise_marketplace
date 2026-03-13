from database import db
from datetime import datetime


class PlatformSetting(db.Model):
    __tablename__ = 'platform_settings'

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text, nullable=True)
    category = db.Column(db.String(50), default='general')
    updated_by = db.Column(db.String(100), nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    @staticmethod
    def get(key, default=None):
        s = PlatformSetting.query.filter_by(key=key).first()
        return s.value if s else default

    @staticmethod
    def set(key, value, description=None, category='general', updated_by=None):
        s = PlatformSetting.query.filter_by(key=key).first()
        if s:
            s.value = str(value)
            s.updated_by = updated_by
            s.updated_at = datetime.utcnow()
        else:
            s = PlatformSetting(
                key=key, value=str(value),
                description=description, category=category,
                updated_by=updated_by
            )
            db.session.add(s)
        db.session.commit()
        return s

    def to_dict(self):
        return {
            'id': self.id,
            'key': self.key,
            'value': self.value,
            'description': self.description,
            'category': self.category,
            'updated_by': self.updated_by,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f'<PlatformSetting {self.key}>'
