import hashlib
import json
import math
from datetime import date, datetime

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from database import db
from models.tutor import Tutor
from models.slots import TutorSlot
from services.cache_service import cache_get, cache_set
from services.search_service import search_tutors, search_tutors_geo
from utils.categories import get_all_topics

api_search_bp = Blueprint('api_search_bp', __name__, url_prefix='/api/v1')


def _photo_url(photo):
    """Build the full avatar URL from a profile_photo value."""
    if not photo:
        return None
    if photo.startswith('http') or photo.startswith('/'):
        return photo
    return f'/static/uploads/photos/{photo}'


def _modes_from_teaching_mode(teaching_mode):
    """Derive a list of mode strings from the teaching_mode column value."""
    if not teaching_mode:
        return ['online', 'in_person']
    tm = teaching_mode.lower()
    if tm == 'both':
        return ['online', 'in_person']
    if tm in ('online',):
        return ['online']
    # in-person, in_person, offline, etc.
    return ['in_person']


def _ok(data):
    return jsonify({'success': True, 'data': data})


def _err(message, code=400):
    return jsonify({'success': False, 'error': {'message': message, 'code': code}}), code


# ---------------------------------------------------------------------------
# 1. GET /api/v1/search/tutors
# ---------------------------------------------------------------------------

@api_search_bp.route('/search/tutors', methods=['GET'])
def api_search_tutors():
    q = request.args.get('q', '').strip()
    subject = request.args.get('subject', '').strip() or None
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    radius_km = request.args.get('radius_km', 25, type=float)
    min_price = request.args.get('min_price', type=float)
    max_price = request.args.get('max_price', type=float)
    min_rating = request.args.get('min_rating', type=float)
    mode = request.args.get('mode', '').strip() or None  # online | in_person | both
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 12, type=int), 24)

    if page < 1:
        page = 1
    if per_page < 1:
        per_page = 12

    # --- cache key from full query string ---
    raw_qs = request.query_string.decode('utf-8', errors='replace')
    cache_key = 'apisearch:' + hashlib.md5(raw_qs.encode()).hexdigest()
    cached = cache_get(cache_key)
    if cached is not None:
        return _ok(cached)

    # --- build filters dict ---
    filters = {}
    if subject:
        filters['subject'] = subject
    if min_price is not None:
        filters['min_price'] = min_price
    if max_price is not None:
        filters['max_price'] = max_price
    if min_rating is not None:
        filters['min_rating'] = min_rating

    # teaching_mode mapping for the service layer
    if mode == 'online':
        filters['teaching_mode'] = 'online'
    elif mode == 'in_person':
        filters['teaching_mode'] = 'offline'
    elif mode == 'both':
        pass  # None / omit means "don't filter"

    use_geo = lat is not None and lng is not None

    if use_geo:
        raw_results = search_tutors_geo(
            student_lat=lat,
            student_lng=lng,
            query_text=q or None,
            filters=filters,
            sort='distance',
            limit=200,
        )
        tutor_ids = [r['id'] for r in raw_results]
        # Fetch availability_next per tutor
        availability_map = _availability_next_map(tutor_ids)
        # Fetch full tutor objects for fields not in geo result dicts
        tutor_objs = {t.id: t for t in Tutor.query.filter(Tutor.id.in_(tutor_ids)).all()} if tutor_ids else {}

        tutors_out = []
        for r in raw_results:
            t = tutor_objs.get(r['id'])
            tutors_out.append({
                'id': r['id'],
                'name': r['name'],
                'avatar_url': _photo_url(t.profile_photo if t else None),
                'subject': r['subject'],
                'subjects_additional': t.subjects_additional if t else None,
                'hourly_rate': r['hourly_rate'],
                'rating_avg': r.get('rating', 0),
                'total_reviews': t.total_reviews if t else 0,
                'total_sessions': t.total_sessions_completed if t else 0,
                'verification_status': t.verification_status if t else None,
                'bio': (t.bio[:150] if t and t.bio and len(t.bio) > 150 else (t.bio if t else None)),
                'latitude': r.get('lat'),
                'longitude': r.get('lng'),
                'distance_km': r.get('distance_km'),
                'service_radius_km': t.service_radius_km if t else None,
                'modes': _modes_from_teaching_mode(r.get('teaching_mode')),
                'availability_next': availability_map.get(r['id']),
                'is_featured': (t.verification_status == 'verified') if t else False,
            })
    else:
        tutor_objs_list = search_tutors(
            query_text=q or None,
            filters=filters,
            sort='relevance',
            limit=200,
        )
        tutor_ids = [t.id for t in tutor_objs_list]
        availability_map = _availability_next_map(tutor_ids)

        tutors_out = []
        for t in tutor_objs_list:
            tutors_out.append({
                'id': t.id,
                'name': t.name,
                'avatar_url': _photo_url(t.profile_photo),
                'subject': t.subject,
                'subjects_additional': t.subjects_additional,
                'hourly_rate': t.hourly_rate or 0,
                'rating_avg': t.rating_avg or 0,
                'total_reviews': t.total_reviews or 0,
                'total_sessions': t.total_sessions_completed or 0,
                'verification_status': t.verification_status,
                'bio': (t.bio[:150] if t.bio and len(t.bio) > 150 else t.bio),
                'latitude': t.latitude,
                'longitude': t.longitude,
                'distance_km': None,
                'service_radius_km': t.service_radius_km,
                'modes': _modes_from_teaching_mode(t.teaching_mode),
                'availability_next': availability_map.get(t.id),
                'is_featured': t.verification_status == 'verified',
            })

    # --- pagination ---
    total = len(tutors_out)
    pages = math.ceil(total / per_page) if per_page else 1
    start = (page - 1) * per_page
    end = start + per_page
    page_items = tutors_out[start:end]

    result = {
        'tutors': page_items,
    }
    meta = {
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': pages,
    }

    cache_set(cache_key, {**result, 'meta': meta}, ttl=900)
    return jsonify({'success': True, 'data': result, 'meta': meta})


def _availability_next_map(tutor_ids):
    """Return {tutor_id: 'YYYY-MM-DD'} for the earliest future available slot."""
    if not tutor_ids:
        return {}
    rows = (
        db.session.query(
            TutorSlot.tutor_id,
            db.func.min(TutorSlot.date).label('next_date'),
        )
        .filter(
            TutorSlot.tutor_id.in_(tutor_ids),
            TutorSlot.status.in_(['pending', 'available']),
            TutorSlot.date >= date.today(),
        )
        .group_by(TutorSlot.tutor_id)
        .all()
    )
    return {
        row.tutor_id: row.next_date.isoformat() if row.next_date else None
        for row in rows
    }


# ---------------------------------------------------------------------------
# 2. GET /api/v1/search/suggestions
# ---------------------------------------------------------------------------

@api_search_bp.route('/search/suggestions', methods=['GET'])
def api_search_suggestions():
    q = request.args.get('q', '').strip()
    if len(q) < 2:
        return _ok({'suggestions': []})

    cache_key = f'suggestions:{q.lower()}'
    cached = cache_get(cache_key)
    if cached is not None:
        return _ok(cached)

    suggestions = []

    # Subject / topic matches first
    topics = get_all_topics()
    q_lower = q.lower()
    for topic in topics:
        if q_lower in topic.lower():
            suggestions.append({
                'type': 'subject',
                'label': topic,
                'value': topic,
            })
        if len(suggestions) >= 5:
            break

    # Tutor name and subject matches
    tutor_rows = Tutor.query.filter(
        Tutor.verification_status == 'verified',
        db.or_(
            Tutor.name.ilike(f'%{q}%'),
            Tutor.subject.ilike(f'%{q}%'),
        ),
    ).limit(8).all()

    for t in tutor_rows:
        if len(suggestions) >= 8:
            break
        suggestions.append({
            'type': 'tutor',
            'label': f'{t.name} - {t.subject}',
            'value': t.name,
            'tutor_id': t.id,
        })

    suggestions = suggestions[:8]

    result = {'suggestions': suggestions}
    cache_set(cache_key, result, ttl=300)
    return _ok(result)


# ---------------------------------------------------------------------------
# 3. GET /api/v1/search/recent
# ---------------------------------------------------------------------------

@api_search_bp.route('/search/recent', methods=['GET'])
@login_required
def api_get_recent_searches():
    if getattr(current_user, 'user_type', None) != 'student':
        return _err('Only students can access recent searches.', 403)

    from services.cache_service import _get_redis
    r = _get_redis()
    if not r:
        return _ok({'searches': []})

    redis_key = f'recent_searches:student:{current_user.id}'
    try:
        items = r.lrange(redis_key, 0, 4)
    except Exception:
        items = []

    return _ok({'searches': items or []})


# ---------------------------------------------------------------------------
# 4. POST /api/v1/search/recent
# ---------------------------------------------------------------------------

@api_search_bp.route('/search/recent', methods=['POST'])
@login_required
def api_save_recent_search():
    if getattr(current_user, 'user_type', None) != 'student':
        return _err('Only students can save recent searches.', 403)

    body = request.get_json(silent=True) or {}
    query_text = (body.get('query') or '').strip()
    if not query_text:
        return _err('query is required.', 400)

    from services.cache_service import _get_redis
    r = _get_redis()
    if not r:
        return _ok({'saved': True})

    redis_key = f'recent_searches:student:{current_user.id}'
    try:
        r.lpush(redis_key, query_text)
        r.ltrim(redis_key, 0, 4)
    except Exception:
        pass

    return _ok({'saved': True})
