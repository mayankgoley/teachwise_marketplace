"""
JSON API dashboard endpoints for Next.js frontend.

Blueprint prefix: /api/v1
All endpoints return the standard envelope:
  {"success": True,  "data": {...}}
  {"success": False, "error": {"message": "...", "code": 400}}
"""

import json
from datetime import date, datetime, timedelta
from functools import wraps

from flask import Blueprint, jsonify, request, current_app
from flask_login import current_user, login_required
from sqlalchemy import func, case

from database import db

api_dashboard_bp = Blueprint('api_dashboard', __name__, url_prefix='/api/v1')


# ── Helpers ──────────────────────────────────────────────────────────

def _ok(data, status=200):
    return jsonify({"success": True, "data": data}), status


def _err(message, code=400, field=None):
    payload = {"success": False, "error": {"message": message, "code": code}}
    if field:
        payload["error"]["field"] = field
    return jsonify(payload), code


def _get_cache():
    """Get Redis client, return None if unavailable."""
    try:
        from services.cache_service import _get_redis
        return _get_redis()
    except Exception:
        return None


def _cache_get(key):
    """Try to read a JSON value from Redis cache."""
    r = _get_cache()
    if not r:
        return None
    try:
        cached = r.get(key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass
    return None


def _cache_set(key, data, ttl):
    """Write a JSON value to Redis cache with TTL."""
    r = _get_cache()
    if not r:
        return
    try:
        r.setex(key, ttl, json.dumps(data, default=str))
    except Exception:
        pass


def _cache_delete(key):
    """Delete a key from Redis cache."""
    r = _get_cache()
    if not r:
        return
    try:
        r.delete(key)
    except Exception:
        pass


def _role_required(role):
    """Decorator to check if user has the correct role."""
    def decorator(f):
        @wraps(f)
        @login_required
        def decorated(*args, **kwargs):
            if current_user.user_type != role:
                return _err("Access denied", 403)
            return f(*args, **kwargs)
        return decorated
    return decorator


def _photo_url(photo_value):
    """Build a full photo URL from a stored value."""
    if not photo_value:
        return None
    if photo_value.startswith("http") or photo_value.startswith("/"):
        return photo_value
    return f"/static/uploads/photos/{photo_value}"


# ═══════════════════════════════════════════════════════════════════════
# GET /api/v1/student/dashboard
# ═══════════════════════════════════════════════════════════════════════

@api_dashboard_bp.route('/student/dashboard', methods=['GET'])
@_role_required('student')
def student_dashboard():
    uid = current_user.id
    cache_key = f"dashboard:student:{uid}"

    cached = _cache_get(cache_key)
    if cached:
        return _ok(cached)

    from models.booking import Booking
    from models.slots import TutorSlot
    from models.assignment import Assignment
    from models.learning_goal import LearningGoal
    from models.tutor import Tutor
    from models.wallet import Wallet

    today = date.today()

    # ── Stats ─────────────────────────────────────────────────
    total_bookings = Booking.query.filter_by(student_id=uid).count()
    completed_sessions = (
        db.session.query(func.count(Booking.id))
        .join(TutorSlot, Booking.slot_id == TutorSlot.id)
        .filter(Booking.student_id == uid, TutorSlot.status == 'completed')
        .scalar()
    )
    active_goals = LearningGoal.query.filter_by(
        student_id=uid, status='active'
    ).count()
    pending_assignments = Assignment.query.filter_by(
        student_id=uid, status='assigned'
    ).count()

    # Wallet balance
    wallet = Wallet.query.filter_by(student_id=uid).first()
    wallet_balance = float(wallet.balance) if wallet else 0.0

    # ── Upcoming sessions (max 3) ─────────────────────────────
    upcoming_rows = (
        db.session.query(Booking, TutorSlot, Tutor)
        .join(TutorSlot, Booking.slot_id == TutorSlot.id)
        .join(Tutor, Booking.tutor_id == Tutor.id)
        .filter(
            Booking.student_id == uid,
            TutorSlot.status.in_(['confirmed', 'live', 'booked']),
            TutorSlot.date >= today,
        )
        .order_by(TutorSlot.date.asc(), TutorSlot.start_time.asc())
        .limit(3)
        .all()
    )
    upcoming_sessions = []
    for booking, slot, tutor in upcoming_rows:
        upcoming_sessions.append({
            "id": booking.id,
            "date": slot.date.isoformat(),
            "start_time": slot.start_time.strftime("%H:%M"),
            "end_time": slot.end_time.strftime("%H:%M"),
            "mode": slot.mode,
            "subject": slot.subject or tutor.subject,
            "status": slot.status,
            "tutor_name": tutor.name,
            "tutor_avatar_url": _photo_url(tutor.profile_photo),
            "jitsi_room_name": None,
        })

    # ── Recent bookings (max 5) ───────────────────────────────
    recent_rows = (
        db.session.query(Booking, TutorSlot, Tutor)
        .join(TutorSlot, Booking.slot_id == TutorSlot.id)
        .join(Tutor, Booking.tutor_id == Tutor.id)
        .filter(Booking.student_id == uid)
        .order_by(Booking.booked_on.desc())
        .limit(5)
        .all()
    )
    recent_bookings = []
    for booking, slot, tutor in recent_rows:
        recent_bookings.append({
            "id": booking.id,
            "status": booking.status,
            "booked_on": booking.booked_on.isoformat() if booking.booked_on else None,
            "date": slot.date.isoformat(),
            "start_time": slot.start_time.strftime("%H:%M"),
            "subject": slot.subject or tutor.subject,
            "tutor_name": tutor.name,
            "amount": float(slot.price or 0),
        })

    # ── Active goals (max 3) ──────────────────────────────────
    goals = (
        LearningGoal.query
        .filter_by(student_id=uid, status='active')
        .order_by(LearningGoal.created_at.desc())
        .limit(3)
        .all()
    )
    active_goals_list = [
        {
            "id": g.id,
            "title": g.title,
            "target_date": g.target_date.isoformat() if g.target_date else None,
            "entries_count": len(g.entries) if g.entries else 0,
            "status": g.status,
            "skill_tags": [],
        }
        for g in goals
    ]

    # ── Pending assignments (max 3) ───────────────────────────
    assignments = (
        Assignment.query
        .filter_by(student_id=uid, status='assigned')
        .order_by(Assignment.due_date.asc())
        .limit(3)
        .all()
    )
    pending_assignments_list = [
        {
            "id": a.id,
            "title": a.title,
            "subject": a.subject,
            "due_date": a.due_date.isoformat() if a.due_date else None,
            "tutor_name": a.tutor.name if hasattr(a, 'tutor') and a.tutor else "",
            "status": a.status,
        }
        for a in assignments
    ]

    data = {
        "stats": {
            "total_bookings": total_bookings,
            "upcoming_sessions": len(upcoming_sessions),
            "completed_sessions": completed_sessions,
            "active_goals": active_goals,
            "pending_assignments": pending_assignments,
            "wallet_balance": wallet_balance,
        },
        "upcoming_sessions": upcoming_sessions,
        "recent_bookings": recent_bookings,
        "active_goals": active_goals_list,
        "pending_assignments": pending_assignments_list,
    }

    _cache_set(cache_key, data, 120)
    return _ok(data)


# ═══════════════════════════════════════════════════════════════════════
# GET /api/v1/tutor/dashboard
# ═══════════════════════════════════════════════════════════════════════

@api_dashboard_bp.route('/tutor/dashboard', methods=['GET'])
@_role_required('tutor')
def tutor_dashboard():
    uid = current_user.id
    cache_key = f"dashboard:tutor:{uid}"

    cached = _cache_get(cache_key)
    if cached:
        return _ok(cached)

    from models.booking import Booking
    from models.slots import TutorSlot
    from models.payment import Payment
    from models.review import Review
    from models.student import Student
    from models.message import Conversation, Message

    today = date.today()

    # ── Stats ─────────────────────────────────────────────────
    total_students = (
        db.session.query(func.count(func.distinct(Booking.student_id)))
        .join(TutorSlot, Booking.slot_id == TutorSlot.id)
        .filter(Booking.tutor_id == uid, TutorSlot.status == 'completed')
        .scalar()
    ) or 0

    # Total earnings: sum of tutor_payout for completed payments
    total_earnings = (
        db.session.query(func.coalesce(func.sum(Payment.tutor_payout), 0))
        .filter(Payment.tutor_id == uid, Payment.status == 'completed')
        .scalar()
    )
    total_earnings = float(total_earnings)

    # Pending payout: Payment model has no payout_status field.
    # We approximate "pending" as completed payments that haven't been
    # transferred via Stripe Connect yet.  Since there is no explicit
    # payout_status column, we report 0 and note the assumption.
    # NOTE: If a payout_status column is added later, update this query.
    pending_payout = 0.0

    average_rating = current_user.rating_avg or 0.0

    # ── Upcoming sessions (max 3) ─────────────────────────────
    upcoming_rows = (
        db.session.query(Booking, TutorSlot, Student)
        .join(TutorSlot, Booking.slot_id == TutorSlot.id)
        .join(Student, Booking.student_id == Student.id)
        .filter(
            Booking.tutor_id == uid,
            TutorSlot.status.in_(['confirmed', 'live', 'booked']),
            TutorSlot.date >= today,
        )
        .order_by(TutorSlot.date.asc(), TutorSlot.start_time.asc())
        .limit(3)
        .all()
    )
    upcoming_sessions = []
    for booking, slot, student in upcoming_rows:
        upcoming_sessions.append({
            "id": booking.id,
            "date": slot.date.isoformat(),
            "start_time": slot.start_time.strftime("%H:%M"),
            "end_time": slot.end_time.strftime("%H:%M"),
            "mode": slot.mode,
            "subject": slot.subject or current_user.subject,
            "status": slot.status,
            "tutor_name": student.name,
            "tutor_avatar_url": None,
        })

    # ── Recent earnings (max 5) ───────────────────────────────
    earnings_rows = (
        db.session.query(Payment, Booking, Student)
        .join(Booking, Payment.booking_id == Booking.id)
        .join(Student, Payment.student_id == Student.id)
        .filter(Payment.tutor_id == uid, Payment.status == 'completed')
        .order_by(Payment.completed_at.desc())
        .limit(5)
        .all()
    )
    recent_earnings = []
    for payment, booking, student in earnings_rows:
        slot = TutorSlot.query.get(booking.slot_id)
        recent_earnings.append({
            "id": payment.id,
            "student_name": student.name,
            "subject": (slot.subject or current_user.subject) if slot else current_user.subject,
            "date": payment.completed_at.isoformat() if payment.completed_at else None,
            "gross_amount": float(payment.amount),
            "platform_fee": float(payment.platform_fee),
            "payout": float(payment.tutor_payout),
            "status": payment.status,
        })

    # ── Pending reviews (max 3) ───────────────────────────────
    # Reviews where tutor has not yet responded
    pending_review_rows = (
        db.session.query(Review, Student)
        .join(Student, Review.student_id == Student.id)
        .filter(
            Review.tutor_id == uid,
            Review.tutor_response.is_(None),
        )
        .order_by(Review.created_at.desc())
        .limit(3)
        .all()
    )
    pending_reviews = []
    for review, student in pending_review_rows:
        pending_reviews.append({
            "id": review.id,
            "rating": review.rating,
            "comment": review.comment,
            "student_name": student.name,
            "created_at": review.created_at.isoformat() if review.created_at else None,
            "has_responded": review.tutor_response is not None,
        })

    # ── Unread messages count ─────────────────────────────────
    unread_messages = (
        db.session.query(func.count(Message.id))
        .join(Conversation, Message.conversation_id == Conversation.id)
        .filter(
            Conversation.tutor_id == uid,
            Message.sender_type == 'student',
            Message.is_read.is_(False),
            Message.is_deleted.is_(False),
        )
        .scalar()
    ) or 0

    data = {
        "stats": {
            "total_students": total_students,
            "total_earnings": total_earnings,
            "pending_payout": pending_payout,
            "average_rating": round(average_rating, 1),
            "total_reviews": current_user.total_reviews or 0,
            "completed_sessions": current_user.total_sessions_completed or 0,
            "upcoming_sessions": len(upcoming_sessions),
            "verification_status": current_user.verification_status,
        },
        "unread_messages": unread_messages,
        "upcoming_sessions": upcoming_sessions,
        "recent_earnings": recent_earnings,
        "pending_reviews": pending_reviews,
    }

    _cache_set(cache_key, data, 120)
    return _ok(data)


# ═══════════════════════════════════════════════════════════════════════
# GET /api/v1/admin/dashboard
# ═══════════════════════════════════════════════════════════════════════

@api_dashboard_bp.route('/admin/dashboard', methods=['GET'])
@_role_required('admin')
def admin_dashboard():
    uid = current_user.id
    cache_key = f"dashboard:admin:{uid}"

    cached = _cache_get(cache_key)
    if cached:
        return _ok(cached)

    from models.student import Student
    from models.tutor import Tutor
    from models.booking import Booking
    from models.slots import TutorSlot
    from models.payment import Payment
    from models.content_report import ContentReport
    from models.tutor_document import TutorDocument

    today = date.today()

    # ── Aggregate stats ───────────────────────────────────────
    total_students = Student.query.count()
    total_tutors = Tutor.query.count()
    total_bookings = Booking.query.count()

    total_revenue = (
        db.session.query(func.coalesce(func.sum(Payment.platform_fee), 0))
        .filter(Payment.status == 'completed')
        .scalar()
    )
    total_revenue = float(total_revenue)

    pending_verifications_count = Tutor.query.filter_by(
        verification_status='documents_submitted'
    ).count()

    # ContentReport uses 'pending' as default status, not 'open'
    open_reports_count = ContentReport.query.filter_by(status='pending').count()

    active_sessions_now = TutorSlot.query.filter_by(status='live').count()

    # ── Pending verifications list ────────────────────────────
    pending_tutors = (
        Tutor.query
        .filter_by(verification_status='documents_submitted')
        .order_by(Tutor.created_at.desc())
        .limit(10)
        .all()
    )
    pending_verifications_list = []
    for t in pending_tutors:
        doc_count = TutorDocument.query.filter_by(tutor_id=t.id).count()
        pending_verifications_list.append({
            "id": t.id,
            "tutor_name": t.name,
            "email": t.email,
            "subject": t.subject,
            "submitted_at": t.created_at.isoformat() if t.created_at else None,
            "document_count": doc_count,
        })

    # ── Recent bookings (last 5) ──────────────────────────────
    recent_booking_rows = (
        db.session.query(Booking, TutorSlot)
        .join(TutorSlot, Booking.slot_id == TutorSlot.id)
        .order_by(Booking.booked_on.desc())
        .limit(5)
        .all()
    )
    recent_bookings = []
    for booking, slot in recent_booking_rows:
        # Fetch names (lazy to avoid N+1 in a small list)
        from models.student import Student as S
        student = S.query.get(booking.student_id)
        tutor = Tutor.query.get(booking.tutor_id)
        recent_bookings.append({
            "id": booking.id,
            "status": booking.status,
            "date": slot.date.isoformat(),
            "subject": slot.subject or (tutor.subject if tutor else None),
            "student_name": student.name if student else "Unknown",
            "tutor_name": tutor.name if tutor else "Unknown",
            "amount": float(slot.price or 0),
        })

    # ── Recent content reports (last 5) ───────────────────────
    recent_reports = (
        ContentReport.query
        .order_by(ContentReport.created_at.desc())
        .limit(5)
        .all()
    )
    recent_reports_list = [r.to_dict() for r in recent_reports]

    # ── Revenue last 7 days (for sparkline) ───────────────────
    seven_days_ago = today - timedelta(days=6)
    revenue_rows = (
        db.session.query(
            func.date(Payment.completed_at).label('day'),
            func.coalesce(func.sum(Payment.platform_fee), 0).label('revenue'),
        )
        .filter(
            Payment.status == 'completed',
            Payment.completed_at >= datetime.combine(seven_days_ago, datetime.min.time()),
        )
        .group_by(func.date(Payment.completed_at))
        .order_by(func.date(Payment.completed_at).asc())
        .all()
    )
    # Build a dict for all 7 days (fill gaps with 0)
    revenue_by_day = {row.day: float(row.revenue) for row in revenue_rows}
    revenue_last_7_days = []
    for i in range(7):
        d = seven_days_ago + timedelta(days=i)
        # func.date returns a date or string depending on the DB driver
        day_key = d.isoformat() if d.isoformat() not in revenue_by_day else d
        revenue_last_7_days.append({
            "date": d.isoformat(),
            "revenue": revenue_by_day.get(d, revenue_by_day.get(d.isoformat(), 0.0)),
        })

    data = {
        "stats": {
            "total_students": total_students,
            "total_tutors": total_tutors,
            "total_bookings": total_bookings,
            "total_revenue": total_revenue,
            "pending_verifications": pending_verifications_count,
            "open_reports": open_reports_count,
            "active_sessions_now": active_sessions_now,
        },
        "pending_verifications": pending_verifications_list,
        "recent_bookings": recent_bookings,
        "recent_reports": recent_reports_list,
        "revenue_last_7_days": revenue_last_7_days,
    }

    _cache_set(cache_key, data, 60)
    return _ok(data)


# ═══════════════════════════════════════════════════════════════════════
# GET /api/v1/guardian/dashboard
# ═══════════════════════════════════════════════════════════════════════

@api_dashboard_bp.route('/guardian/dashboard', methods=['GET'])
@_role_required('guardian')
def guardian_dashboard():
    uid = current_user.id
    cache_key = f"dashboard:guardian:{uid}"

    cached = _cache_get(cache_key)
    if cached:
        return _ok(cached)

    from models.student import Student
    from models.booking import Booking
    from models.slots import TutorSlot
    from models.tutor import Tutor
    from models.payment import Payment
    from models.assignment import Assignment

    today = date.today()
    now = datetime.utcnow()

    # ── Children ──────────────────────────────────────────────
    children = Student.query.filter_by(guardian_id=uid).all()
    child_ids = [c.id for c in children]
    linked_children_count = len(child_ids)

    # ── Per-child details ─────────────────────────────────────
    children_details = []
    for child in children:
        # Upcoming sessions for this child (max 3)
        upcoming = (
            db.session.query(Booking, TutorSlot, Tutor)
            .join(TutorSlot, Booking.slot_id == TutorSlot.id)
            .join(Tutor, Booking.tutor_id == Tutor.id)
            .filter(
                Booking.student_id == child.id,
                TutorSlot.status.in_(['confirmed', 'live', 'booked']),
                TutorSlot.date >= today,
            )
            .order_by(TutorSlot.date.asc(), TutorSlot.start_time.asc())
            .limit(3)
            .all()
        )
        child_upcoming = []
        for booking, slot, tutor in upcoming:
            child_upcoming.append({
                "booking_id": booking.id,
                "date": slot.date.isoformat(),
                "start_time": slot.start_time.strftime("%H:%M"),
                "subject": slot.subject or tutor.subject,
                "tutor_name": tutor.name,
                "status": slot.status,
            })

        # Pending assignments for this child
        child_assignments_count = Assignment.query.filter_by(
            student_id=child.id, status='assigned'
        ).count()

        children_details.append({
            "id": child.id,
            "name": child.name,
            "grade_level": child.grade_level,
            "avatar_url": None,
            "last_session_date": None,
            "upcoming_sessions": len(child_upcoming),
            "pending_assignments": child_assignments_count,
        })

    # ── Pending approvals ─────────────────────────────────────
    # Bookings for children where guardian_approved is None or False
    pending_approvals_count = 0
    pending_approvals_list = []
    if child_ids:
        pending_rows = (
            db.session.query(Booking, TutorSlot, Tutor, Student)
            .join(TutorSlot, Booking.slot_id == TutorSlot.id)
            .join(Tutor, Booking.tutor_id == Tutor.id)
            .join(Student, Booking.student_id == Student.id)
            .filter(
                Booking.student_id.in_(child_ids),
                Booking.guardian_approved.is_(None),
                Booking.status.notin_(['Cancelled']),
            )
            .order_by(Booking.booked_on.desc())
            .limit(10)
            .all()
        )
        pending_approvals_count = len(pending_rows)
        for booking, slot, tutor, student in pending_rows:
            pending_approvals_list.append({
                "id": len(pending_approvals_list) + 1,
                "booking_id": booking.id,
                "child_name": student.name,
                "date": slot.date.isoformat(),
                "start_time": slot.start_time.strftime("%H:%M"),
                "subject": slot.subject or tutor.subject,
                "tutor_name": tutor.name,
                "amount": float(slot.price) if slot.price else 0.0,
            })

    # ── This month spending ───────────────────────────────────
    this_month_spending = 0.0
    if child_ids:
        first_of_month = today.replace(day=1)
        spending = (
            db.session.query(func.coalesce(func.sum(Payment.amount), 0))
            .filter(
                Payment.student_id.in_(child_ids),
                Payment.status == 'completed',
                Payment.completed_at >= datetime.combine(first_of_month, datetime.min.time()),
            )
            .scalar()
        )
        this_month_spending = float(spending)

    # ── Recent activity ───────────────────────────────────────
    recent_activity = []
    if child_ids:
        recent_rows = (
            db.session.query(Booking, TutorSlot, Tutor, Student)
            .join(TutorSlot, Booking.slot_id == TutorSlot.id)
            .join(Tutor, Booking.tutor_id == Tutor.id)
            .join(Student, Booking.student_id == Student.id)
            .filter(Booking.student_id.in_(child_ids))
            .order_by(Booking.booked_on.desc())
            .limit(10)
            .all()
        )
        for booking, slot, tutor, student in recent_rows:
            # Determine activity type based on slot status
            if slot.status == 'completed':
                activity_type = 'session'
                desc = f"Completed session with {tutor.name} — {slot.subject or tutor.subject}"
            elif booking.status == 'Cancelled':
                activity_type = 'booking'
                desc = f"Booking with {tutor.name} was cancelled"
            else:
                activity_type = 'booking'
                desc = f"Booked a session with {tutor.name} — {slot.subject or tutor.subject}"
            recent_activity.append({
                "type": activity_type,
                "child_name": student.name,
                "description": desc,
                "date": (booking.booked_on.isoformat() if booking.booked_on
                         else slot.date.isoformat()),
                "amount": float(slot.price) if slot.price else None,
            })

    data = {
        "stats": {
            "linked_children": linked_children_count,
            "pending_approvals": pending_approvals_count,
            "this_month_spending": this_month_spending,
            "monthly_limit": float(current_user.monthly_spending_limit) if current_user.monthly_spending_limit else None,
        },
        "children": children_details,
        "pending_approvals": pending_approvals_list,
        "recent_activity": recent_activity,
    }

    _cache_set(cache_key, data, 120)
    return _ok(data)


# ═══════════════════════════════════════════════════════════════════════
# POST /api/v1/guardian/bookings/<booking_id>/approve
# ═══════════════════════════════════════════════════════════════════════

@api_dashboard_bp.route('/guardian/bookings/<int:booking_id>/approve', methods=['POST'])
@_role_required('guardian')
def guardian_approve_booking(booking_id):
    from models.booking import Booking
    from models.student import Student

    booking = Booking.query.get(booking_id)
    if not booking:
        return _err("Booking not found", 404)

    # Verify the booking belongs to one of the guardian's children
    child = Student.query.filter_by(
        id=booking.student_id, guardian_id=current_user.id
    ).first()
    if not child:
        return _err("Access denied", 403)

    if booking.guardian_approved is True:
        return _err("Booking already approved", 400)

    booking.guardian_approved = True
    booking.guardian_approved_on = datetime.utcnow()

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Guardian approve booking error: {e}")
        return _err("Failed to approve booking", 500)

    # Invalidate guardian dashboard cache
    _cache_delete(f"dashboard:guardian:{current_user.id}")

    return _ok({
        "booking_id": booking.id,
        "guardian_approved": True,
        "message": "Booking approved successfully",
    })


# ═══════════════════════════════════════════════════════════════════════
# POST /api/v1/guardian/bookings/<booking_id>/reject
# ═══════════════════════════════════════════════════════════════════════

@api_dashboard_bp.route('/guardian/bookings/<int:booking_id>/reject', methods=['POST'])
@_role_required('guardian')
def guardian_reject_booking(booking_id):
    from models.booking import Booking
    from models.student import Student

    booking = Booking.query.get(booking_id)
    if not booking:
        return _err("Booking not found", 404)

    # Verify the booking belongs to one of the guardian's children
    child = Student.query.filter_by(
        id=booking.student_id, guardian_id=current_user.id
    ).first()
    if not child:
        return _err("Access denied", 403)

    body = request.get_json(silent=True)
    reason = (body.get("reason", "") if body else "").strip()
    if not reason:
        return _err("Reason is required", 400, field="reason")

    booking.guardian_approved = False
    booking.status = 'Cancelled'
    booking.cancelled_by = 'guardian'
    booking.cancelled_on = datetime.utcnow()
    booking.cancellation_reason = reason[:255]  # Respect column max length

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Guardian reject booking error: {e}")
        return _err("Failed to reject booking", 500)

    # Invalidate guardian dashboard cache
    _cache_delete(f"dashboard:guardian:{current_user.id}")

    return _ok({
        "booking_id": booking.id,
        "status": "Cancelled",
        "message": "Booking rejected successfully",
    })


# ═══════════════════════════════════════════════════════════════════════
# POST /api/v1/tutor/reviews/<review_id>/respond
# ═══════════════════════════════════════════════════════════════════════

@api_dashboard_bp.route('/tutor/reviews/<int:review_id>/respond', methods=['POST'])
@_role_required('tutor')
def tutor_respond_to_review(review_id):
    from models.review import Review

    review = Review.query.get(review_id)
    if not review:
        return _err("Review not found", 404)

    if review.tutor_id != current_user.id:
        return _err("Access denied", 403)

    if review.tutor_response is not None:
        return _err("You have already responded to this review", 400)

    body = request.get_json(silent=True)
    if not body:
        return _err("Request body must be JSON", 400)

    response_text = (body.get("response") or "").strip()
    if not response_text:
        return _err("Response text is required", 400, field="response")
    if len(response_text) > 500:
        return _err("Response must be 500 characters or fewer", 400, field="response")

    review.tutor_response = response_text
    review.tutor_response_at = datetime.utcnow()

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Tutor review response error: {e}")
        return _err("Failed to save response", 500)

    # Invalidate tutor dashboard cache
    _cache_delete(f"dashboard:tutor:{current_user.id}")

    return _ok({
        "review_id": review.id,
        "tutor_response": review.tutor_response,
        "responded_at": review.tutor_response_at.isoformat(),
        "message": "Response saved successfully",
    })
