from database import db
from models.tutor import Tutor
from sqlalchemy import func, text, desc, case, literal_column, and_, or_
from services.cache_service import cache_get, cache_set
import hashlib


def search_tutors_geo(student_lat, student_lng, query_text=None, filters=None,
                      sort='distance', limit=50):
    """
    Location-aware search using PostGIS per-slot locations.
    Returns list of dicts with tutor info + distance + slot aggregates.
    """
    from models.slots import TutorSlot
    from geoalchemy2.functions import ST_DWithin, ST_Distance, ST_MakePoint, ST_SetSRID
    from datetime import date

    filters = filters or {}

    # Build cache key
    cache_key = _build_cache_key(
        f'geo:{student_lat}:{student_lng}:{query_text or ""}', filters, sort)
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    # Student point as geography
    student_point = func.ST_SetSRID(
        func.ST_MakePoint(student_lng, student_lat), 4326
    ).cast(db.String)  # Cast to text for parameter binding

    student_geog = text(
        "ST_SetSRID(ST_MakePoint(:s_lng, :s_lat), 4326)::geography"
    ).params(s_lng=student_lng, s_lat=student_lat)

    # Distance in meters from slot location to student
    distance_expr = func.ST_Distance(
        TutorSlot.location_point,
        text("ST_SetSRID(ST_MakePoint(:d_lng, :d_lat), 4326)::geography").params(
            d_lng=student_lng, d_lat=student_lat)
    )
    distance_miles = (distance_expr / 1609.34).label('distance_miles')

    # Base query: slots joined with tutors
    query = db.session.query(
        Tutor.id.label('tutor_id'),
        Tutor.name,
        Tutor.subject,
        Tutor.rating_avg,
        Tutor.experience,
        Tutor.hourly_rate,
        Tutor.city,
        Tutor.teaching_mode,
        Tutor.latitude.label('tutor_lat'),
        Tutor.longitude.label('tutor_lng'),
        Tutor.profile_photo,
        func.min(distance_expr / 1609.34).label('nearest_distance'),
        func.bool_or(TutorSlot.mode == 'online').label('has_online'),
        func.bool_or(TutorSlot.mode != 'online').label('has_offline'),
        func.min(TutorSlot.price).label('min_price'),
        func.max(TutorSlot.price).label('max_price'),
        func.count(TutorSlot.id).label('available_slots'),
    ).join(
        TutorSlot, TutorSlot.tutor_id == Tutor.id
    ).filter(
        Tutor.verification_status == 'verified',
        TutorSlot.status == 'pending',
        TutorSlot.date >= date.today(),
    )

    # Slot visibility: offline within radius OR online
    query = query.filter(
        or_(
            TutorSlot.mode == 'online',
            and_(
                TutorSlot.mode != 'online',
                TutorSlot.location_point.isnot(None),
                func.ST_DWithin(
                    TutorSlot.location_point,
                    text("ST_SetSRID(ST_MakePoint(:w_lng, :w_lat), 4326)::geography").params(
                        w_lng=student_lng, w_lat=student_lat),
                    TutorSlot.radius_miles * 1609.34
                )
            )
        )
    )

    # Text search filter
    if query_text and query_text.strip():
        words = query_text.strip().split()
        tsquery_str = ' & '.join(w for w in words if w)
        query = query.filter(
            text("tutors.search_vector @@ to_tsquery('english', :q)").params(q=tsquery_str)
        )

    # Apply filters
    if filters.get('min_rating'):
        query = query.filter(Tutor.rating_avg >= filters['min_rating'])
    if filters.get('max_price'):
        query = query.filter(TutorSlot.price <= filters['max_price'])
    if filters.get('min_price'):
        query = query.filter(TutorSlot.price >= filters['min_price'])
    if filters.get('min_experience'):
        query = query.filter(Tutor.experience >= filters['min_experience'])
    if filters.get('teaching_mode') and filters['teaching_mode'] != 'Both':
        if filters['teaching_mode'] == 'online':
            query = query.filter(TutorSlot.mode == 'online')
        else:
            query = query.filter(TutorSlot.mode != 'online')
    if filters.get('subject'):
        query = query.filter(
            or_(
                Tutor.subject.ilike(f"%{filters['subject']}%"),
                TutorSlot.subject.ilike(f"%{filters['subject']}%")
            )
        )

    # Group by tutor
    query = query.group_by(
        Tutor.id, Tutor.name, Tutor.subject, Tutor.rating_avg,
        Tutor.experience, Tutor.hourly_rate, Tutor.city,
        Tutor.teaching_mode, Tutor.latitude, Tutor.longitude,
        Tutor.profile_photo
    )

    # Sort
    if sort == 'distance':
        query = query.order_by(text('nearest_distance ASC NULLS LAST'))
    elif sort == 'price_asc':
        query = query.order_by(text('min_price ASC NULLS LAST'))
    elif sort == 'price_desc':
        query = query.order_by(text('max_price DESC NULLS LAST'))
    elif sort == 'rating_desc':
        query = query.order_by(desc(Tutor.rating_avg))
    else:
        query = query.order_by(text('nearest_distance ASC NULLS LAST'))

    results = query.limit(limit).all()

    # Format response
    data = []
    for row in results:
        nearest_dist = round(row.nearest_distance, 1) if row.nearest_distance else None
        data.append({
            'id': row.tutor_id,
            'name': row.name,
            'subject': row.subject,
            'rating': row.rating_avg or 0,
            'experience': row.experience or 0,
            'hourly_rate': row.hourly_rate or 0,
            'city': row.city or '',
            'teaching_mode': row.teaching_mode or 'Both',
            'lat': row.tutor_lat,
            'lng': row.tutor_lng,
            'distance_km': round(nearest_dist * 1.60934, 1) if nearest_dist else None,
            'distance_miles': nearest_dist,
            'profile_url': f'/tutor/{row.tutor_id}',
            'open_slots': row.available_slots,
            'has_online': row.has_online,
            'has_offline': row.has_offline,
            'min_price': float(row.min_price) if row.min_price else 0,
            'max_price': float(row.max_price) if row.max_price else 0,
        })

    cache_set(cache_key, data)
    return data


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
