from flask import (Blueprint, render_template, request, jsonify,
                    current_app)
from database import db
from services.location_service import find_nearby_tutors, get_tutor_location_data
from models.tutor import Tutor
from extensions import limiter
from utils.distance import haversine_distance

search_bp = Blueprint('search_bp', __name__)


@search_bp.route('/search')
@limiter.limit('30 per minute')
def search_page():
    """
    Render the search page with Leaflet.js map.
    Query params are optional; the JS on the page calls /api/search.
    """
    from utils.categories import get_categories_json
    return render_template('search.html',
                           categories_json=get_categories_json())


@search_bp.route('/api/search')
@limiter.limit('30 per minute')
def api_search():
    """
    Enhanced JSON API with full-text search, filters, and sorting.

    Query params:
      q:              free-text query ('calculus PhD')
      lat, lng:       search center for distance
      radius:         km radius (default 25)
      subject:        subject filter
      min_rating:     minimum rating (e.g., 4.0)
      min_price:      minimum hourly rate
      max_price:      maximum hourly rate
      min_experience: minimum years
      teaching_mode:  'online' | 'in-person' | 'Both'
      sort:           'relevance' | 'rating_desc' | 'price_asc'
                      | 'price_desc' | 'experience_desc' | 'distance'
    """
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

    # Route 1: Geospatial search (lat/lng provided) — uses per-slot locations
    if lat is not None and lng is not None:
        try:
            from services.search_service import search_tutors_geo
            results = search_tutors_geo(
                student_lat=lat, student_lng=lng,
                query_text=q or None,
                filters=filters,
                sort=sort if sort != 'relevance' else 'distance',
                limit=100
            )
            return jsonify(results)
        except Exception as e:
            # Fallback to legacy search if PostGIS unavailable
            current_app.logger.warning(f'Geo search failed, falling back: {e}')
            if q:
                tutors = search_tutors(q, filters=filters, sort=sort)
                return _tutors_to_json(tutors, lat, lng)
            results = find_nearby_tutors(
                lat, lng, min(radius, 200),
                subject=filters.get('subject'), limit=100)
            return jsonify(get_tutor_location_data(results))

    # Route 2: Text search without location
    if q:
        tutors = search_tutors(q, filters=filters, sort=sort)
        return _tutors_to_json(tutors, lat, lng)

    # Route 3: Recommendation (no query, no specific location)
    tutors = get_recommended_tutors(
        student_lat=lat, student_lng=lng,
        subject=filters.get('subject'), limit=50)
    return _tutors_to_json(tutors, lat, lng)


def _tutors_to_json(tutors, ref_lat=None, ref_lng=None):
    """Convert tutor list to JSON response."""
    from models.slots import TutorSlot
    from datetime import date

    # Batch-fetch open slot counts for all tutors in one query
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
        dist_miles = None
        if ref_lat and ref_lng and t.latitude and t.longitude:
            dist = round(haversine_distance(ref_lat, ref_lng, t.latitude, t.longitude), 1)
            dist_miles = round(dist / 1.60934, 1)
        data.append({
            'id': t.id, 'name': t.name, 'subject': t.subject,
            'rating': t.rating_avg or 0, 'experience': t.experience or 0,
            'hourly_rate': t.hourly_rate or 0, 'city': t.city or '',
            'teaching_mode': t.teaching_mode or 'Both',
            'lat': t.latitude, 'lng': t.longitude,
            'distance_km': dist, 'distance_miles': dist_miles,
            'profile_url': f'/tutor/{t.id}',
            'open_slots': open_slots.get(t.id, 0),
            'has_online': t.teaching_mode in ('online', 'Both'),
            'has_offline': t.teaching_mode in ('in-person', 'Both'),
        })
    return jsonify(data)
