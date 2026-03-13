from flask import (Blueprint, render_template, request, jsonify,
                    current_app)
from flask_login import current_user
from database import db
from services.location_service import find_nearby_tutors, get_tutor_location_data
from models.tutor import Tutor
from extensions import limiter
from utils.distance import haversine_distance
from datetime import datetime
import json

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
    JSON API with full-text search, filters, and sorting.
    Supports multi-subject via repeated subject params or comma-separated.
    """
    from services.search_service import search_tutors
    from services.recommendation_service import get_recommended_tutors

    q = request.args.get('q', '').strip()
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    radius = request.args.get('radius', 25, type=int)
    sort = request.args.get('sort', 'relevance')

    filters = {}

    # Multi-subject support: accept repeated params or comma-separated
    raw_subjects = request.args.getlist('subject')
    subjects = []
    for s in raw_subjects:
        subjects.extend([x.strip() for x in s.split(',') if x.strip()])
    if len(subjects) == 1:
        filters['subject'] = subjects[0]
    elif len(subjects) > 1:
        filters['subjects'] = subjects

    for key in ['teaching_mode']:
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

    # Route 1: Geospatial search (lat/lng provided)
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
            _save_recent_search(q, filters, len(results))
            return jsonify(results)
        except Exception as e:
            current_app.logger.warning(f'Geo search failed, falling back: {e}')
            if q:
                tutors = search_tutors(q, filters=filters, sort=sort)
                _save_recent_search(q, filters, len(tutors))
                return _tutors_to_json(tutors, lat, lng)
            results = find_nearby_tutors(
                lat, lng, min(radius, 200),
                subject=filters.get('subject'), limit=100)
            return jsonify(get_tutor_location_data(results))

    # Route 2: Text search without location
    if q:
        tutors = search_tutors(q, filters=filters, sort=sort)
        _save_recent_search(q, filters, len(tutors))
        return _tutors_to_json(tutors, lat, lng)

    # Route 3: Recommendation (no query, no specific location)
    sub = filters.get('subject') or (filters.get('subjects', [None])[0] if filters.get('subjects') else None)
    tutors = get_recommended_tutors(
        student_lat=lat, student_lng=lng,
        subject=sub, limit=50)
    return _tutors_to_json(tutors, lat, lng)


@search_bp.route('/search/suggest')
@limiter.limit('60 per minute')
def search_suggest():
    """Return autocomplete suggestions for search input."""
    from services.cache_service import cache_get, cache_set

    q = request.args.get('q', '').strip()
    if len(q) < 2:
        return jsonify({'suggestions': []})

    cache_key = f'suggest:{q.lower()[:20]}'
    cached = cache_get(cache_key)
    if cached is not None:
        return jsonify({'suggestions': cached})

    suggestions = []

    # Tutor names matching prefix
    tutors = Tutor.query.filter(
        Tutor.verification_status == 'verified',
        Tutor.name.ilike(f'{q}%')
    ).limit(3).all()
    for t in tutors:
        suggestions.append({
            'text': t.name, 'type': 'tutor', 'id': t.id,
            'sub': t.subject or ''
        })

    # Subjects/topics matching
    from utils.categories import get_all_topics
    topics = get_all_topics()
    matching = [t for t in topics if t.lower().startswith(q.lower())][:3]
    if len(matching) < 3:
        # Also match anywhere in topic name
        extra = [t for t in topics
                 if q.lower() in t.lower() and t not in matching][:3 - len(matching)]
        matching.extend(extra)
    for topic in matching:
        suggestions.append({'text': topic, 'type': 'subject'})

    suggestions = suggestions[:8]
    cache_set(cache_key, suggestions, ttl=60)
    return jsonify({'suggestions': suggestions})


@search_bp.route('/search/recent')
def recent_searches():
    """Return user's recent searches from Redis."""
    if not current_user.is_authenticated:
        return jsonify({'searches': []})
    from services.cache_service import cache_get
    key = _recent_key()
    searches = cache_get(key) or []
    return jsonify({'searches': searches})


@search_bp.route('/search/recent', methods=['DELETE'])
def clear_recent_searches():
    """Clear user's recent search history."""
    if not current_user.is_authenticated:
        return jsonify({'success': True})
    from services.cache_service import cache_delete
    cache_delete(_recent_key())
    return jsonify({'success': True})


def _recent_key():
    """Redis key for current user's recent searches."""
    return f'recent_searches:{current_user.user_type}_{current_user.id}'


def _save_recent_search(query_text, filters, result_count):
    """Save a search to user's recent searches in Redis."""
    if not query_text or not current_user.is_authenticated:
        return
    if result_count == 0:
        return
    try:
        from services.cache_service import cache_get, cache_set
        key = _recent_key()
        searches = cache_get(key) or []
        entry = {
            'query': query_text,
            'result_count': result_count,
            'timestamp': datetime.utcnow().isoformat()
        }
        # Prepend, deduplicate by query text, keep last 5
        searches = [entry] + [s for s in searches if s['query'] != query_text][:4]
        cache_set(key, searches, ttl=86400 * 30)
    except Exception:
        pass


def _tutors_to_json(tutors, ref_lat=None, ref_lng=None):
    """Convert tutor list to JSON response."""
    from models.slots import TutorSlot
    from datetime import date

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
