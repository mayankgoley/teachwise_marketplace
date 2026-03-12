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
    is_verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    booking = db.relationship('Booking', backref='review', uselist=False)
