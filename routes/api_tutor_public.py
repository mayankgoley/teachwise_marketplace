"""
Public tutor profile and student favorites API.

Blueprint prefix: /api/v1
All endpoints return the standard envelope:
  {"success": True,  "data": {...}}
  {"success": False, "error": {"message": "...", "code": 400}}
"""

from datetime import date, timedelta
from functools import wraps

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from database import db
from models.tutor import Tutor
from models.slots import TutorSlot
from models.booking import Booking
from models.review import Review
from models.student import Student
from models.favorite import FavoriteTutor
from services.cache_service import cache_get, cache_set, cache_delete

api_tutor_public_bp = Blueprint(
    'api_tutor_public', __name__, url_prefix='/api/v1'
)


# ── Helpers ──────────────────────────────────────────────────────────

def _ok(data, status=200):
    return jsonify({"success": True, "data": data}), status


def _err(message, code=400):
    return jsonify({"success": False, "error": {"message": message, "code": code}}), code


def _photo_url(photo_value):
    """Build a full photo URL from a stored value."""
    if not photo_value:
        return None
    if photo_value.startswith("http") or photo_value.startswith("/"):
        return photo_value
    return f"/static/uploads/photos/{photo_value}"


def _student_required(f):
    """Decorator: login required + user must be a student."""
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if current_user.user_type != 'student':
            return _err("Access denied", 403)
        return f(*args, **kwargs)
    return decorated


def _teaching_modes(teaching_mode):
    """Convert teaching_mode column to a list of mode strings."""
    if not teaching_mode:
        return ['online', 'in_person']
    mode = teaching_mode.strip().lower()
    if mode == 'both':
        return ['online', 'in_person']
    if mode in ('offline', 'in-person', 'in_person'):
        return ['in_person']
    if mode == 'online':
        return ['online']
    return ['online', 'in_person']


def _build_subjects_list(tutor):
    """Return a flat list of all subjects the tutor teaches."""
    subjects = []
    if tutor.subject:
        subjects.append(tutor.subject)
    additional = tutor.subjects_additional
    if isinstance(additional, list):
        subjects.extend(additional)
    elif isinstance(additional, str):
        subjects.extend([s.strip() for s in additional.split(',') if s.strip()])
    return subjects


def _build_slot_dict(slot):
    """Serialise a TutorSlot to a JSON-safe dict."""
    return {
        "id": slot.id,
        "date": slot.date.isoformat(),
        "start_time": slot.start_time.strftime("%H:%M"),
        "end_time": slot.end_time.strftime("%H:%M"),
        "mode": slot.mode or "online",
        "subject": slot.subject or None,
        "price": slot.price or 0,
        "is_group": slot.is_group or False,
        "max_students": slot.max_students or 1,
        "current_students": slot.current_students or 0,
        "spots_remaining": (slot.max_students or 1) - (slot.current_students or 0),
    }


def _build_tutor_search_dict(tutor, open_slots_count=0):
    """Build the search-result shape dict for a tutor (used by favorites list)."""
    return {
        "id": tutor.id,
        "name": tutor.name,
        "subject": tutor.subject,
        "subjects": _build_subjects_list(tutor),
        "rating": tutor.rating_avg or 0,
        "total_reviews": tutor.total_reviews or 0,
        "experience": tutor.experience or 0,
        "hourly_rate": tutor.hourly_rate or 0,
        "city": tutor.city or "",
        "teaching_mode": tutor.teaching_mode or "Both",
        "bio": (tutor.bio or "")[:200],
        "avatar_url": _photo_url(tutor.profile_photo),
        "profile_url": f"/tutor/{tutor.id}",
        "open_slots": open_slots_count,
        "has_online": tutor.teaching_mode in ("online", "Both"),
        "has_offline": tutor.teaching_mode in ("in-person", "Both", "offline"),
        "lat": tutor.latitude,
        "lng": tutor.longitude,
    }


# ═════════════════════════════════════════════════════════════════════
# 1. GET /api/v1/tutors/<tutor_id>/profile
# ═════════════════════════════════════════════════════════════════════

@api_tutor_public_bp.route('/tutors/<int:tutor_id>/profile', methods=['GET'])
def tutor_profile(tutor_id):
    """
    Public tutor profile.  No login required.
    If the caller is an authenticated student we also return is_favorite.
    Cached for 300 s.
    """
    # ── Cache check ──────────────────────────────────────────────────
    cache_key = f"tutor_profile:{tutor_id}"
    cached = cache_get(cache_key)

    # is_favorite is per-user so we compute it outside the cache
    is_favorite = False
    if (current_user.is_authenticated
            and getattr(current_user, 'user_type', None) == 'student'):
        fav = FavoriteTutor.query.filter_by(
            student_id=current_user.id, tutor_id=tutor_id
        ).first()
        is_favorite = fav is not None

    if cached is not None:
        cached["is_favorite"] = is_favorite
        return _ok(cached)

    # ── Load tutor ───────────────────────────────────────────────────
    tutor = Tutor.query.get(tutor_id)
    if not tutor or tutor.verification_status == 'rejected':
        return _err("Tutor not found", 404)

    # ── Available slots (next 14 days, status == 'pending') ──────────
    today = date.today()
    end_date = today + timedelta(days=14)

    slots = (
        TutorSlot.query
        .filter(
            TutorSlot.tutor_id == tutor_id,
            TutorSlot.date >= today,
            TutorSlot.date <= end_date,
            TutorSlot.status.in_(['pending', 'available']),
        )
        .order_by(TutorSlot.date, TutorSlot.start_time)
        .limit(50)
        .all()
    )

    slots_data = [_build_slot_dict(s) for s in slots]

    # ── Reviews (5 most recent) + rating breakdown ───────────────────
    reviews_query = (
        db.session.query(Review, Student)
        .outerjoin(Student, Student.id == Review.student_id)
        .filter(Review.tutor_id == tutor_id)
        .order_by(Review.created_at.desc())
        .limit(5)
        .all()
    )

    reviews_data = []
    for review, student in reviews_query:
        reviews_data.append({
            "id": review.id,
            "rating": review.rating,
            "rating_knowledge": review.rating_knowledge,
            "rating_communication": review.rating_communication,
            "rating_punctuality": review.rating_punctuality,
            "rating_value": review.rating_value,
            "comment": review.comment,
            "tutor_response": review.tutor_response,
            "tutor_response_at": (
                review.tutor_response_at.isoformat()
                if review.tutor_response_at else None
            ),
            "created_at": review.created_at.isoformat() if review.created_at else None,
            "student_name": student.name if student else "Anonymous",
            "student_avatar": _photo_url(
                getattr(student, 'profile_photo', None)
            ) if student else None,
        })

    # Rating breakdown: count of reviews per star (1-5)
    breakdown_rows = (
        db.session.query(Review.rating, db.func.count(Review.id))
        .filter(Review.tutor_id == tutor_id)
        .group_by(Review.rating)
        .all()
    )
    rating_breakdown = {str(i): 0 for i in range(1, 6)}
    for star, cnt in breakdown_rows:
        if 1 <= star <= 5:
            rating_breakdown[str(star)] = cnt

    # ── Teaching modes & subjects ────────────────────────────────────
    modes = _teaching_modes(tutor.teaching_mode)
    subjects = _build_subjects_list(tutor)

    # ── Build profile payload ────────────────────────────────────────
    profile = {
        "id": tutor.id,
        "name": tutor.name,
        "email": tutor.email,
        "subject": tutor.subject,
        "subjects": subjects,
        "experience": tutor.experience or 0,
        "bio": tutor.bio or "",
        "qualification": tutor.qualification or "",
        "institution": tutor.institution or "",
        "hourly_rate": tutor.hourly_rate or 0,
        "teaching_mode": tutor.teaching_mode or "Both",
        "modes": modes,
        "avatar_url": _photo_url(tutor.profile_photo),
        "verification_status": tutor.verification_status,
        "rating_avg": tutor.rating_avg or 0,
        "total_reviews": tutor.total_reviews or 0,
        "total_sessions_completed": tutor.total_sessions_completed or 0,
        "city": tutor.city or "",
        "latitude": tutor.latitude,
        "longitude": tutor.longitude,
        "service_radius_km": tutor.service_radius_km or 25,
        "languages": [],
        "available_slots": slots_data,
        "reviews": reviews_data,
        "rating_breakdown": rating_breakdown,
        "is_favorite": is_favorite,
    }

    # Cache the profile (is_favorite is injected per-request)
    cache_payload = dict(profile)
    cache_payload.pop("is_favorite", None)
    cache_set(cache_key, cache_payload, ttl=300)

    return _ok(profile)


# ═════════════════════════════════════════════════════════════════════
# 2. GET /api/v1/tutors/<tutor_id>/slots
# ═════════════════════════════════════════════════════════════════════

@api_tutor_public_bp.route('/tutors/<int:tutor_id>/slots', methods=['GET'])
def tutor_slots(tutor_id):
    """
    Public endpoint returning available slots for a tutor within
    an optional date range (defaults to today .. today+14).
    """
    tutor = Tutor.query.get(tutor_id)
    if not tutor or tutor.verification_status == 'rejected':
        return _err("Tutor not found", 404)

    today = date.today()

    from_date_str = request.args.get('from_date')
    to_date_str = request.args.get('to_date')

    try:
        from_date = date.fromisoformat(from_date_str) if from_date_str else today
    except (ValueError, TypeError):
        from_date = today

    try:
        to_date = date.fromisoformat(to_date_str) if to_date_str else today + timedelta(days=14)
    except (ValueError, TypeError):
        to_date = today + timedelta(days=14)

    # Clamp from_date to today at earliest
    if from_date < today:
        from_date = today

    slots = (
        TutorSlot.query
        .filter(
            TutorSlot.tutor_id == tutor_id,
            TutorSlot.date >= from_date,
            TutorSlot.date <= to_date,
            TutorSlot.status == 'pending',
        )
        .order_by(TutorSlot.date, TutorSlot.start_time)
        .all()
    )

    return _ok({"slots": [_build_slot_dict(s) for s in slots]})


# ═════════════════════════════════════════════════════════════════════
# 3. POST /api/v1/student/favorites  (toggle)
# ═════════════════════════════════════════════════════════════════════

@api_tutor_public_bp.route('/student/favorites', methods=['POST'])
@_student_required
def toggle_favorite():
    """
    Toggle a tutor in the student's favorites.
    Body: {"tutor_id": int}
    Returns: {"is_favorite": bool}
    """
    payload = request.get_json(silent=True) or {}
    tutor_id = payload.get('tutor_id')

    if not tutor_id or not isinstance(tutor_id, int):
        return _err("tutor_id is required and must be an integer", 422)

    tutor = Tutor.query.get(tutor_id)
    if not tutor:
        return _err("Tutor not found", 404)

    existing = FavoriteTutor.query.filter_by(
        student_id=current_user.id, tutor_id=tutor_id
    ).first()

    if existing:
        db.session.delete(existing)
        db.session.commit()
        is_favorite = False
    else:
        fav = FavoriteTutor(student_id=current_user.id, tutor_id=tutor_id)
        db.session.add(fav)
        db.session.commit()
        is_favorite = True

    # Invalidate cached profile so is_favorite stays fresh for other
    # consumers that may embed it.
    cache_delete(f"tutor_profile:{tutor_id}")

    return _ok({"is_favorite": is_favorite})


# ═════════════════════════════════════════════════════════════════════
# 4. GET /api/v1/student/favorites
# ═════════════════════════════════════════════════════════════════════

@api_tutor_public_bp.route('/student/favorites', methods=['GET'])
@_student_required
def list_favorites():
    """
    Return the student's favorited tutors in the same shape as
    search results.
    """
    favorites = (
        db.session.query(FavoriteTutor, Tutor)
        .join(Tutor, Tutor.id == FavoriteTutor.tutor_id)
        .filter(FavoriteTutor.student_id == current_user.id)
        .order_by(FavoriteTutor.created_at.desc())
        .all()
    )

    # Batch-fetch open slot counts for all favorited tutor IDs
    tutor_ids = [t.id for _, t in favorites]
    open_slots = {}
    if tutor_ids:
        today = date.today()
        counts = (
            db.session.query(TutorSlot.tutor_id, db.func.count(TutorSlot.id))
            .filter(
                TutorSlot.tutor_id.in_(tutor_ids),
                TutorSlot.status == 'pending',
                TutorSlot.date >= today,
            )
            .group_by(TutorSlot.tutor_id)
            .all()
        )
        open_slots = {tid: cnt for tid, cnt in counts}

    tutors_data = []
    for fav, tutor in favorites:
        entry = _build_tutor_search_dict(tutor, open_slots.get(tutor.id, 0))
        entry["favorited_at"] = fav.created_at.isoformat() if fav.created_at else None
        tutors_data.append(entry)

    return _ok({"tutors": tutors_data})
