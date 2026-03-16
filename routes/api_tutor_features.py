"""
JSON API endpoints for tutor-specific features.

Blueprint prefix: /api/v1
All endpoints return the standard envelope:
  {"success": True,  "data": {...}}
  {"success": False, "error": {"message": "...", "code": 400}}
"""

from datetime import date, datetime, timedelta, time
from functools import wraps

from flask import Blueprint, jsonify, request, current_app
from flask_login import current_user, login_required
from sqlalchemy import func, extract, distinct

from database import db
from models.slots import TutorSlot
from models.booking import Booking
from models.student import Student
from models.tutor import Tutor
from models.payment import Payment
from services.cache_service import cache_delete_pattern

api_tutor_features_bp = Blueprint(
    'api_tutor_features', __name__, url_prefix='/api/v1'
)


# ── Helpers ──────────────────────────────────────────────────────────

def _ok(data, status=200):
    return jsonify({"success": True, "data": data}), status


def _err(message, code=400, field=None):
    payload = {"success": False, "error": {"message": message, "code": code}}
    if field:
        payload["error"]["field"] = field
    return jsonify(payload), code


def _role_required(role):
    """Decorator that enforces login *and* a specific user_type."""
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


def _parse_date(value, default=None):
    """Parse an ISO date string (YYYY-MM-DD).  Returns *default* on failure."""
    if not value:
        return default
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return default


def _parse_time(value):
    """Parse an HH:MM (or HH:MM:SS) time string.  Returns None on failure."""
    if not value:
        return None
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(value, fmt).time()
        except (ValueError, TypeError):
            continue
    return None


def _slot_dict(slot, booking_info=None):
    """Serialize a TutorSlot to a plain dict."""
    d = {
        "id": slot.id,
        "tutor_id": slot.tutor_id,
        "date": slot.date.isoformat(),
        "start_time": slot.start_time.strftime("%H:%M"),
        "end_time": slot.end_time.strftime("%H:%M"),
        "subject": slot.subject,
        "price": float(slot.price) if slot.price else 0.0,
        "mode": slot.mode,
        "status": slot.status,
        "max_students": slot.max_students,
        "current_students": slot.current_students,
        "jitsi_room_name": slot.jitsi_room_name,
        "created_at": slot.created_at.isoformat() if slot.created_at else None,
    }
    if booking_info is not None:
        d["booking"] = booking_info
    return d


# ═════════════════════════════════════════════════════════════════════
# 1. GET /api/v1/tutor/slots
# ═════════════════════════════════════════════════════════════════════

@api_tutor_features_bp.route('/tutor/slots', methods=['GET'])
@_role_required('tutor')
def get_tutor_slots():
    """Return all slots for the current tutor within the requested date range."""

    today = date.today()
    from_date = _parse_date(request.args.get('from_date'), default=today)
    to_date = _parse_date(
        request.args.get('to_date'), default=today + timedelta(days=30)
    )

    if to_date < from_date:
        return _err("to_date must be on or after from_date", 400)

    # Fetch slots in range
    slots = (
        TutorSlot.query
        .filter(
            TutorSlot.tutor_id == current_user.id,
            TutorSlot.date >= from_date,
            TutorSlot.date <= to_date,
        )
        .order_by(TutorSlot.date, TutorSlot.start_time)
        .all()
    )

    # Pre-load confirmed bookings for these slots in a single query
    slot_ids = [s.id for s in slots]
    bookings = []
    if slot_ids:
        bookings = (
            db.session.query(Booking, Student)
            .join(Student, Booking.student_id == Student.id)
            .filter(
                Booking.slot_id.in_(slot_ids),
                Booking.status != 'Cancelled',
            )
            .all()
        )

    # Index bookings by slot_id (one slot may have multiple bookings for groups)
    bookings_by_slot = {}
    for bk, stu in bookings:
        bookings_by_slot.setdefault(bk.slot_id, []).append({
            "booking_id": bk.id,
            "student_id": stu.id,
            "student_name": stu.name,
            "student_avatar": _photo_url(getattr(stu, 'profile_photo', None)),
            "booking_status": bk.status,
            "booked_on": bk.booked_on.isoformat() if bk.booked_on else None,
        })

    result = []
    for slot in slots:
        booking_info = bookings_by_slot.get(slot.id)
        result.append(_slot_dict(slot, booking_info=booking_info))

    return _ok({"slots": result})


# ═════════════════════════════════════════════════════════════════════
# 2. POST /api/v1/tutor/slots
# ═════════════════════════════════════════════════════════════════════

@api_tutor_features_bp.route('/tutor/slots', methods=['POST'])
@_role_required('tutor')
def create_tutor_slot():
    """Create a new availability slot for the current tutor."""

    data = request.get_json(silent=True)
    if not data:
        return _err("Request body must be JSON", 400)

    # --- Parse & validate fields ---
    slot_date = _parse_date(data.get('date'))
    if slot_date is None:
        return _err("Valid date is required (YYYY-MM-DD)", 400, field="date")
    if slot_date < date.today():
        return _err("Date must be today or in the future", 400, field="date")

    start_time = _parse_time(data.get('start_time'))
    end_time = _parse_time(data.get('end_time'))
    if start_time is None or end_time is None:
        return _err(
            "Valid start_time and end_time required (HH:MM)", 400,
            field="start_time" if start_time is None else "end_time",
        )
    if end_time <= start_time:
        return _err("end_time must be after start_time", 400, field="end_time")

    subject = (data.get('subject') or '').strip()
    if not subject:
        return _err("Subject is required", 400, field="subject")

    try:
        price = float(data.get('price', 0))
    except (TypeError, ValueError):
        price = 0.0
    if price <= 0:
        return _err("Price must be greater than zero", 400, field="price")

    mode = (data.get('mode') or 'online').strip().lower()
    if mode not in ('online', 'in-person', 'both'):
        return _err(
            "Mode must be 'online', 'in-person', or 'both'", 400, field="mode"
        )

    try:
        max_students = int(data.get('max_students', 1))
    except (TypeError, ValueError):
        max_students = 1
    if max_students < 1 or max_students > 10:
        return _err("max_students must be between 1 and 10", 400,
                     field="max_students")

    # --- Check for overlapping slots ---
    overlap = (
        TutorSlot.query
        .filter(
            TutorSlot.tutor_id == current_user.id,
            TutorSlot.date == slot_date,
            TutorSlot.status != 'cancelled',
            TutorSlot.start_time < end_time,
            TutorSlot.end_time > start_time,
        )
        .first()
    )
    if overlap:
        return _err(
            f"This slot overlaps with an existing slot "
            f"({overlap.start_time.strftime('%H:%M')}"
            f"-{overlap.end_time.strftime('%H:%M')})",
            409,
        )

    # --- Create ---
    new_slot = TutorSlot(
        tutor_id=current_user.id,
        date=slot_date,
        start_time=start_time,
        end_time=end_time,
        subject=subject,
        price=price,
        mode=mode,
        max_students=max_students,
        is_group=max_students > 1,
        current_students=0,
        status='pending',
    )
    db.session.add(new_slot)
    db.session.commit()

    # Invalidate search caches so the new slot appears in results
    try:
        cache_delete_pattern("search:*")
        cache_delete_pattern("tutor_slots:*")
    except Exception:
        pass  # Cache invalidation failures are non-critical

    return _ok({"slot": _slot_dict(new_slot)}, status=201)


# ═════════════════════════════════════════════════════════════════════
# 3. DELETE /api/v1/tutor/slots/<slot_id>
# ═════════════════════════════════════════════════════════════════════

@api_tutor_features_bp.route('/tutor/slots/<int:slot_id>', methods=['DELETE'])
@_role_required('tutor')
def delete_tutor_slot(slot_id):
    """Delete a slot that has no confirmed bookings."""

    slot = TutorSlot.query.get(slot_id)
    if not slot:
        return _err("Slot not found", 404)
    if slot.tutor_id != current_user.id:
        return _err("Access denied", 403)

    # Block deletion if any non-cancelled booking exists
    has_booking = (
        Booking.query
        .filter(
            Booking.slot_id == slot_id,
            Booking.status != 'Cancelled',
        )
        .first()
    )
    if has_booking:
        return _err(
            "Cannot delete a slot with confirmed bookings. "
            "Cancel the booking first.",
            409,
        )

    db.session.delete(slot)
    db.session.commit()

    return _ok({"message": "Slot deleted"})


# ═════════════════════════════════════════════════════════════════════
# 4. GET /api/v1/tutor/earnings
# ═════════════════════════════════════════════════════════════════════

@api_tutor_features_bp.route('/tutor/earnings', methods=['GET'])
@_role_required('tutor')
def get_tutor_earnings():
    """
    Return earnings summary, paginated history, Stripe Connect status,
    and a 6-month chart breakdown.
    """

    tutor = Tutor.query.get(current_user.id)
    page = request.args.get('page', 1, type=int)
    per_page = 20

    # ── Summary ──────────────────────────────────────────────────────
    today = date.today()
    first_of_month = today.replace(day=1)
    if today.month == 1:
        first_of_last_month = today.replace(year=today.year - 1, month=12, day=1)
    else:
        first_of_last_month = today.replace(month=today.month - 1, day=1)

    total_earned = (
        db.session.query(func.coalesce(func.sum(Payment.tutor_payout), 0))
        .filter(Payment.tutor_id == current_user.id, Payment.status == 'completed')
        .scalar()
    )

    this_month = (
        db.session.query(func.coalesce(func.sum(Payment.tutor_payout), 0))
        .filter(
            Payment.tutor_id == current_user.id,
            Payment.status == 'completed',
            Payment.completed_at >= first_of_month,
        )
        .scalar()
    )

    last_month = (
        db.session.query(func.coalesce(func.sum(Payment.tutor_payout), 0))
        .filter(
            Payment.tutor_id == current_user.id,
            Payment.status == 'completed',
            Payment.completed_at >= first_of_last_month,
            Payment.completed_at < first_of_month,
        )
        .scalar()
    )

    summary = {
        "total_earned": float(total_earned),
        "pending_payout": 0,
        "this_month": float(this_month),
        "last_month": float(last_month),
    }

    # ── Stripe Connect status ────────────────────────────────────────
    stripe_info = {"connected": False, "onboarding_url": None}
    if tutor.stripe_account_id and tutor.stripe_onboarding_complete:
        stripe_info["connected"] = True
    else:
        try:
            from services.payment_service import create_connect_account_link
            stripe_info["onboarding_url"] = create_connect_account_link(tutor)
        except Exception as e:
            current_app.logger.warning(
                f"Stripe Connect link generation failed: {e}"
            )
            stripe_info["onboarding_url"] = None

    # ── Paginated earnings list ──────────────────────────────────────
    earnings_query = (
        db.session.query(Payment, Booking, TutorSlot, Student)
        .join(Booking, Payment.booking_id == Booking.id)
        .join(TutorSlot, Booking.slot_id == TutorSlot.id)
        .join(Student, Payment.student_id == Student.id)
        .filter(
            Payment.tutor_id == current_user.id,
            Payment.status == 'completed',
        )
        .order_by(Payment.completed_at.desc())
    )

    total_records = earnings_query.count()
    total_pages = max(1, (total_records + per_page - 1) // per_page)
    page = min(page, total_pages)

    rows = (
        earnings_query
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    earnings_list = []
    for payment, booking, slot, student in rows:
        earnings_list.append({
            "payment_id": payment.id,
            "booking_id": booking.id,
            "student_name": student.name,
            "subject": slot.subject,
            "session_date": slot.date.isoformat() if slot.date else None,
            "amount": float(payment.amount),
            "platform_fee": float(payment.platform_fee),
            "tutor_payout": float(payment.tutor_payout),
            "completed_at": (
                payment.completed_at.isoformat()
                if payment.completed_at else None
            ),
        })

    # ── Monthly chart (last 6 months) ────────────────────────────────
    six_months_ago = first_of_month - timedelta(days=180)
    # Normalize to 1st of that month
    six_months_ago = six_months_ago.replace(day=1)

    month_rows = (
        db.session.query(
            extract('year', Payment.completed_at).label('yr'),
            extract('month', Payment.completed_at).label('mo'),
            func.sum(Payment.amount).label('gross'),
            func.sum(Payment.platform_fee).label('fee'),
            func.sum(Payment.tutor_payout).label('payout'),
        )
        .filter(
            Payment.tutor_id == current_user.id,
            Payment.status == 'completed',
            Payment.completed_at >= six_months_ago,
        )
        .group_by('yr', 'mo')
        .order_by('yr', 'mo')
        .all()
    )

    # Build a full 6-month series so months with zero earnings still appear
    month_labels = []
    chart_index = {}
    cursor = six_months_ago
    while cursor <= first_of_month:
        label = cursor.strftime("%b %Y")
        month_labels.append(label)
        chart_index[(cursor.year, cursor.month)] = {
            "month": label,
            "gross": 0.0,
            "fee": 0.0,
            "payout": 0.0,
        }
        if cursor.month == 12:
            cursor = cursor.replace(year=cursor.year + 1, month=1)
        else:
            cursor = cursor.replace(month=cursor.month + 1)

    for row in month_rows:
        key = (int(row.yr), int(row.mo))
        if key in chart_index:
            chart_index[key]["gross"] = float(row.gross or 0)
            chart_index[key]["fee"] = float(row.fee or 0)
            chart_index[key]["payout"] = float(row.payout or 0)

    monthly_chart = [chart_index[k] for k in sorted(chart_index.keys())]

    return _ok({
        "summary": summary,
        "stripe": stripe_info,
        "earnings": earnings_list,
        "monthly_chart": monthly_chart,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total_records,
            "total_pages": total_pages,
        },
    })


# ═════════════════════════════════════════════════════════════════════
# 5. GET /api/v1/tutor/students
# ═════════════════════════════════════════════════════════════════════

@api_tutor_features_bp.route('/tutor/students', methods=['GET'])
@_role_required('tutor')
def get_tutor_students():
    """
    Return distinct students who have completed bookings with this tutor,
    along with session count, last session date, subjects, and total spent.
    """

    # Subquery: distinct student IDs with completed bookings
    completed_bookings = (
        db.session.query(Booking.student_id)
        .join(TutorSlot, Booking.slot_id == TutorSlot.id)
        .filter(
            Booking.tutor_id == current_user.id,
            TutorSlot.status == 'completed',
        )
        .distinct()
        .subquery()
    )

    students = (
        Student.query
        .filter(Student.id.in_(db.session.query(completed_bookings.c.student_id)))
        .all()
    )

    result = []
    for student in students:
        # Session count & last session date
        stats = (
            db.session.query(
                func.count(Booking.id).label('session_count'),
                func.max(TutorSlot.date).label('last_session'),
            )
            .join(TutorSlot, Booking.slot_id == TutorSlot.id)
            .filter(
                Booking.tutor_id == current_user.id,
                Booking.student_id == student.id,
                TutorSlot.status == 'completed',
            )
            .first()
        )

        # Subjects taught
        subjects_rows = (
            db.session.query(distinct(TutorSlot.subject))
            .join(Booking, Booking.slot_id == TutorSlot.id)
            .filter(
                Booking.tutor_id == current_user.id,
                Booking.student_id == student.id,
                TutorSlot.status == 'completed',
                TutorSlot.subject.isnot(None),
            )
            .all()
        )
        subjects = [row[0] for row in subjects_rows if row[0]]

        # Total spent (from completed payments)
        total_spent = (
            db.session.query(func.coalesce(func.sum(Payment.amount), 0))
            .filter(
                Payment.tutor_id == current_user.id,
                Payment.student_id == student.id,
                Payment.status == 'completed',
            )
            .scalar()
        )

        result.append({
            "id": student.id,
            "name": student.name,
            "avatar": _photo_url(getattr(student, 'profile_photo', None)),
            "session_count": stats.session_count if stats else 0,
            "last_session": (
                stats.last_session.isoformat()
                if stats and stats.last_session else None
            ),
            "subjects": subjects,
            "total_spent": float(total_spent),
        })

    # Sort by most recent session descending
    result.sort(
        key=lambda s: s["last_session"] or "", reverse=True
    )

    return _ok({
        "students": result,
        "meta": {"total": len(result)},
    })
