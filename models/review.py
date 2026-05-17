from database import db
from datetime import datetime


class Review(db.Model):
    __tablename__ = 'reviews'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    tutor_id = db.Column(db.Integer, db.ForeignKey('tutors.id'), nullable=False)
    booking_id = db.Column(db.Integer, db.ForeignKey('bookings.id'), nullable=True)
    rating = db.Column(db.Integer, nullable=False)  # 1 to 5 (overall)
    rating_knowledge = db.Column(db.Integer, nullable=True)      # 1-5
    rating_communication = db.Column(db.Integer, nullable=True)  # 1-5
    rating_punctuality = db.Column(db.Integer, nullable=True)    # 1-5
    rating_value = db.Column(db.Integer, nullable=True)          # 1-5
    comment = db.Column(db.Text, nullable=True)
    tutor_response = db.Column(db.Text, nullable=True)
    tutor_response_at = db.Column(db.DateTime, nullable=True)
    is_verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    booking = db.relationship('Booking', backref='review', uselist=False)
    reports = db.relationship('ReviewReport', backref='review', lazy=True)
    votes = db.relationship('ReviewVote', backref='review', lazy=True)

    @property
    def helpful_count(self):
        return sum(1 for v in self.votes if v.is_helpful)

    @property
    def unhelpful_count(self):
        return sum(1 for v in self.votes if not v.is_helpful)


class ReviewReport(db.Model):
    """Flag/report inappropriate reviews."""
    __tablename__ = 'review_reports'

    id = db.Column(db.Integer, primary_key=True)
    review_id = db.Column(db.Integer, db.ForeignKey('reviews.id'), nullable=False)
    reporter_id = db.Column(db.Integer, nullable=False)
    reporter_type = db.Column(db.String(20), nullable=False)  # 'student','tutor'
    reason = db.Column(db.String(50), nullable=False)  # 'spam','inappropriate','fake','other'
    details = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='pending')  # pending, reviewed, dismissed
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class ReviewVote(db.Model):
    """Helpfulness voting on reviews."""
    __tablename__ = 'review_votes'

    id = db.Column(db.Integer, primary_key=True)
    review_id = db.Column(db.Integer, db.ForeignKey('reviews.id'), nullable=False)
    voter_id = db.Column(db.Integer, nullable=False)
    voter_type = db.Column(db.String(20), nullable=False)
    is_helpful = db.Column(db.Boolean, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('review_id', 'voter_id', 'voter_type', name='uq_review_vote'),
    )
