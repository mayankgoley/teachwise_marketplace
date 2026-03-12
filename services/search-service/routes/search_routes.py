from flask import Blueprint, render_template, request, jsonify, current_app
from database import db
from models.tutor import Tutor
from models.slots import TutorSlot
from datetime import date
import math

search_bp = Blueprint('search_bp', __name__)


def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance in km between two points."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


@search_bp.route('/search')
def search_page():
    subjects = db.session.query(Tutor.subject).filter(
        Tutor.verification_status == 'verified'
    ).distinct().order_by(Tutor.subject).all()
    subject_list = [s[0] for s in subjects if s[0]]

    return render_template('search.html', subjects=subject_list)


@search_bp.route('/api/search')
def api_search():
    from services.search_service import search_tutors
    from services.recommendation_service import get_recommended_tutors

    q = request.args.get('q', '').strip()
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    radius = request.args.get('radius', 25, type=int)
    sort = request.args.get('sort', 'relevance')

    filters = {}
    for key in ['subject', 'teaching_mode']:
        val = request.args.get(key, '').strip()
        if val:
            filters[key] = val
    for key in ['min_rating', 'min_price', 'max_price']:
        val = request.args.get(key, type=float)
        if val is not None:
            filters[key] = val
    for key in ['min_experience']:
        val = request.args.get(key, type=int)
        if val is not None:
            filters[key] = val

    # Text search
    if q:
        tutors = search_tutors(q, filters=filters, sort=sort)
        return _tutors_to_json(tutors, lat, lng)

    # Location-based search
    if lat is not None and lng is not None:
        tutors = _find_nearby_tutors(lat, lng, radius,
                                      subject=filters.get('subject'))
        return _tutors_to_json(tutors, lat, lng)

    # Recommendation (no query, no location)
    tutors = get_recommended_tutors(
        student_lat=lat, student_lng=lng,
        subject=filters.get('subject'), limit=50)
    return _tutors_to_json(tutors, lat, lng)


@search_bp.route('/api/recommendations')
def api_recommendations():
    from services.recommendation_service import get_recommended_tutors

    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    subject = request.args.get('subject', '').strip() or None
    limit = request.args.get('limit', 20, type=int)

    tutors = get_recommended_tutors(
        student_lat=lat, student_lng=lng,
        subject=subject, limit=min(limit, 50))
    return _tutors_to_json(tutors, lat, lng)


def _find_nearby_tutors(lat, lng, radius_km, subject=None, limit=100):
    query = Tutor.query.filter(
        Tutor.verification_status == 'verified',
        Tutor.latitude.isnot(None),
        Tutor.longitude.isnot(None),
    )
    if subject:
        query = query.filter(Tutor.subject.ilike(f"%{subject}%"))

    all_tutors = query.all()

    nearby = []
    for t in all_tutors:
        dist = haversine_distance(lat, lng, t.latitude, t.longitude)
        if dist <= radius_km:
            nearby.append((t, dist))

    nearby.sort(key=lambda x: x[1])
    return [t for t, _ in nearby[:limit]]


def _tutors_to_json(tutors, ref_lat=None, ref_lng=None):
    tutor_ids = [t.id for t in tutors]
    open_slots = {}
    if tutor_ids:
        counts = db.session.query(
            TutorSlot.tutor_id, db.func.count(TutorSlot.id)
        ).filter(
            TutorSlot.tutor_id.in_(tutor_ids),
            TutorSlot.status == 'pending',
            TutorSlot.date >= date.today()
        ).group_by(TutorSlot.tutor_id).all()
        open_slots = {tid: cnt for tid, cnt in counts}

    data = []
    for t in tutors:
        dist = None
        if ref_lat and ref_lng and t.latitude and t.longitude:
            dist = round(haversine_distance(
                ref_lat, ref_lng, t.latitude, t.longitude), 1)
        data.append({
            'id': t.id, 'name': t.name, 'subject': t.subject,
            'rating': t.rating_avg or 0, 'experience': t.experience or 0,
            'hourly_rate': t.hourly_rate or 0, 'city': t.city or '',
            'teaching_mode': t.teaching_mode or 'Both',
            'lat': t.latitude, 'lng': t.longitude,
            'distance_km': dist, 'profile_url': f'/tutor/{t.id}',
            'open_slots': open_slots.get(t.id, 0)
        })
    return jsonify(data)
