from database import db
from datetime import datetime


class TutorQualityScore(db.Model):
    __tablename__ = 'tutor_quality_scores'

    id = db.Column(db.Integer, primary_key=True)
    tutor_id = db.Column(db.Integer, db.ForeignKey('tutors.id'),
                         unique=True, nullable=False, index=True)
    score = db.Column(db.Float, nullable=True)               # null when provisional
    is_provisional = db.Column(db.Boolean, default=True, nullable=False)

    rating_score = db.Column(db.Float, nullable=True)
    completion_rate = db.Column(db.Float, nullable=True)
    response_time_score = db.Column(db.Float, nullable=True)
    repeat_rate = db.Column(db.Float, nullable=True)
    profile_completeness = db.Column(db.Float, nullable=True)

    sessions_in_window = db.Column(db.Integer, default=0, nullable=False)
    computed_at = db.Column(db.DateTime, default=datetime.utcnow,
                            nullable=False)

    tutor = db.relationship('Tutor', backref=db.backref(
        'quality_score', uselist=False))

    def to_dict(self):
        return {
            'tutor_id': self.tutor_id,
            'score': self.score,
            'is_provisional': self.is_provisional,
            'components': {
                'rating': self.rating_score,
                'completion': self.completion_rate,
                'response_time': self.response_time_score,
                'repeat_rate': self.repeat_rate,
                'profile_completeness': self.profile_completeness,
            },
            'sessions_in_window': self.sessions_in_window,
            'computed_at': self.computed_at.isoformat()
                if self.computed_at else None,
        }


class TutorQualityScoreSnapshot(db.Model):
    """Weekly snapshot for the 12-week trend chart."""
    __tablename__ = 'tutor_quality_score_snapshots'

    id = db.Column(db.Integer, primary_key=True)
    tutor_id = db.Column(db.Integer, db.ForeignKey('tutors.id'),
                         nullable=False, index=True)
    score = db.Column(db.Float, nullable=True)
    is_provisional = db.Column(db.Boolean, default=True, nullable=False)
    saved_at = db.Column(db.DateTime, default=datetime.utcnow,
                         nullable=False, index=True)

    tutor = db.relationship('Tutor')

    def to_dict(self):
        return {
            'score': self.score,
            'is_provisional': self.is_provisional,
            'saved_at': self.saved_at.isoformat() if self.saved_at else None,
        }
