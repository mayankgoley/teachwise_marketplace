from database import db
from models.tutor import Tutor
from sqlalchemy import func, text, desc
from services.cache_service import cache_get, cache_set
import hashlib


def search_tutors(query_text, filters=None, sort='relevance', limit=50):
    filters = filters or {}

    cache_key = _build_cache_key(query_text, filters, sort)
    cached = cache_get(cache_key)
    if cached:
        ids = cached
        tutors = Tutor.query.filter(Tutor.id.in_(ids)).all()
        id_order = {tid: i for i, tid in enumerate(ids)}
        tutors.sort(key=lambda t: id_order.get(t.id, 999))
        return tutors

    query = Tutor.query.filter(
        Tutor.verification_status == 'verified'
    )

    ts_rank = None
    if query_text and query_text.strip():
        words = query_text.strip().split()
        tsquery_str = ' & '.join(w for w in words if w)
        query = query.filter(
            text("search_vector @@ to_tsquery('english', :q)").params(q=tsquery_str)
        )
        ts_rank = func.ts_rank(
            text('search_vector'),
            func.to_tsquery('english', tsquery_str)
        )

    if filters.get('min_rating'):
        query = query.filter(Tutor.rating_avg >= filters['min_rating'])
    if filters.get('max_price'):
        query = query.filter(Tutor.hourly_rate <= filters['max_price'])
    if filters.get('min_price'):
        query = query.filter(Tutor.hourly_rate >= filters['min_price'])
    if filters.get('min_experience'):
        query = query.filter(Tutor.experience >= filters['min_experience'])
    if filters.get('teaching_mode') and filters['teaching_mode'] != 'Both':
        query = query.filter(
            (Tutor.teaching_mode == filters['teaching_mode']) |
            (Tutor.teaching_mode == 'Both')
        )
    if filters.get('subject'):
        query = query.filter(Tutor.subject.ilike(f"%{filters['subject']}%"))

    if sort == 'relevance' and ts_rank is not None:
        query = query.order_by(desc(ts_rank))
    elif sort == 'rating_desc':
        query = query.order_by(desc(Tutor.rating_avg))
    elif sort == 'price_asc':
        query = query.order_by(Tutor.hourly_rate.asc().nullslast())
    elif sort == 'price_desc':
        query = query.order_by(Tutor.hourly_rate.desc().nullslast())
    elif sort == 'experience_desc':
        query = query.order_by(desc(Tutor.experience))
    else:
        query = query.order_by(desc(Tutor.rating_avg))

    results = query.limit(limit).all()
    cache_set(cache_key, [t.id for t in results])
    return results


def _build_cache_key(query_text, filters, sort):
    raw = f'{query_text}|{sorted(filters.items())}|{sort}'
    h = hashlib.md5(raw.encode()).hexdigest()[:12]
    return f'search:{h}'
