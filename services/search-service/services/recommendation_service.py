from flask import current_app
from models.tutor import Tutor
from models.slots import TutorSlot
from database import db
from services.cache_service import cache_get, cache_set
from datetime import datetime, timedelta
from sqlalchemy import func
import math


def _batch_slot_counts(tutor_ids):
    now = datetime.utcnow()
    next_week = now + timedelta(days=7)

    rows = (
        db.session.query(
            TutorSlot.tutor_id,
            func.count(TutorSlot.id)
        )
        .filter(
            TutorSlot.tutor_id.in_(tutor_ids),
            TutorSlot.status == 'pending',
            TutorSlot.date >= now.date(),
            TutorSlot.date <= next_week.date()
        )
        .group_by(TutorSlot.tutor_id)
        .all()
    )
    return {tutor_id: count for tutor_id, count in rows}


def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def calculate_tutor_score(tutor, student_lat=None, student_lng=None,
                           target_subject=None, slot_count=0):
    config = current_app.config

    subject_score = 0.0
    if target_subject:
        if tutor.subject and target_subject.lower() in tutor.subject.lower():
            subject_score = 1.0
        elif tutor.subjects_additional:
            for s in tutor.subjects_additional:
                if target_subject.lower() in s.lower():
                    subject_score = 0.7
                    break
    else:
        subject_score = 0.5

    rating = tutor.rating_avg or tutor.average_rating or 0
    rating_score = min(rating / 5.0, 1.0)

    distance_score = 0.5
    if (student_lat and student_lng and tutor.latitude and tutor.longitude):
        dist_km = haversine_distance(
            student_lat, student_lng, tutor.latitude, tutor.longitude)
        distance_score = max(0.0, 1.0 - (dist_km / 50.0))

    exp = tutor.experience or 0
    experience_score = min(exp / 20.0, 1.0)
    availability_score = min(slot_count / 10.0, 1.0)

    total = (
        subject_score * config['REC_WEIGHT_SUBJECT'] +
        rating_score * config['REC_WEIGHT_RATING'] +
        distance_score * config['REC_WEIGHT_DISTANCE'] +
        experience_score * config['REC_WEIGHT_EXPERIENCE'] +
        availability_score * config['REC_WEIGHT_AVAILABILITY']
    )

    return round(total * 100, 1)


def get_recommended_tutors(student_lat=None, student_lng=None,
                            subject=None, limit=20):
    cache_key = f'rec:{subject or "all"}:{student_lat}:{student_lng}'
    cached = cache_get(cache_key)
    if cached:
        ids = cached
        tutors = Tutor.query.filter(Tutor.id.in_(ids)).all()
        id_order = {tid: i for i, tid in enumerate(ids)}
        tutors.sort(key=lambda t: id_order.get(t.id, 999))
        return tutors

    tutors = Tutor.query.filter(
        Tutor.verification_status == 'verified'
    ).all()

    tutor_ids = [t.id for t in tutors]
    slot_counts = _batch_slot_counts(tutor_ids) if tutor_ids else {}

    scored = []
    for tutor in tutors:
        score = calculate_tutor_score(
            tutor,
            student_lat=student_lat,
            student_lng=student_lng,
            target_subject=subject,
            slot_count=slot_counts.get(tutor.id, 0)
        )
        scored.append((tutor, score))

    scored.sort(key=lambda x: x[1], reverse=True)
    top = [t for t, s in scored[:limit]]

    cache_set(cache_key, [t.id for t in top], ttl=3600)
    return top
