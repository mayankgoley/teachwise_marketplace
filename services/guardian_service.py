"""Helpers for the guardian dashboard.

Spending caps and session windows are stored in GuardianChildSettings (per-child)
and fall back to Guardian-level limits. Booking enforcement and approval expiry live here.
"""
from datetime import datetime, time, timedelta

from flask import current_app
from sqlalchemy import func

from database import db
from models.booking import Booking
from models.guardian import Guardian
from models.guardian_child_settings import GuardianChildSettings
from models.payment import Payment
from models.student import Student


APPROVAL_WINDOW = timedelta(hours=48)


def get_child_settings(guardian_id, student_id):
    return GuardianChildSettings.query.filter_by(
        guardian_id=guardian_id, student_id=student_id
    ).first()


def get_or_create_child_settings(guardian_id, student_id):
    row = get_child_settings(guardian_id, student_id)
    if row:
        return row
    student = Student.query.get(student_id)
    row = GuardianChildSettings(
        guardian_id=guardian_id,
        student_id=student_id,
        requires_approval_for_booking=bool(student and student.is_minor),
    )
    db.session.add(row)
    db.session.commit()
    return row


def _month_spent_cents(student_id, ref=None):
    ref = ref or datetime.utcnow()
    month_ago = ref - timedelta(days=30)
    total = db.session.query(
        func.coalesce(func.sum(Payment.amount), 0)
    ).filter(
        Payment.student_id == student_id,
        Payment.status == 'completed',
        Payment.completed_at >= month_ago,
    ).scalar()
    return float(total or 0)


def enforce_spending_cap(student, price):
    """Return error message if booking would exceed any active monthly cap.

    Checks per-child cap first, falls back to guardian-wide monthly limit.
    """
    if not student.guardian_id:
        return None

    guardian = Guardian.query.get(student.guardian_id)
    if not guardian:
        return None

    settings = get_child_settings(guardian.id, student.id)
    per_child_cap = settings.monthly_spending_cap if settings else None
    fallback_cap = guardian.monthly_spending_limit

    if per_child_cap is None and fallback_cap is None:
        return None

    spent = _month_spent_cents(student.id)
    projected = spent + float(price or 0)

    if per_child_cap is not None and projected > per_child_cap:
        return (
            f'Booking exceeds {student.name}\'s monthly cap of '
            f'${per_child_cap:.2f}. Spent so far: ${spent:.2f}.'
        )
    if per_child_cap is None and fallback_cap is not None and projected > fallback_cap:
        return (
            f'Booking exceeds the guardian monthly limit of '
            f'${fallback_cap:.2f}. Spent so far: ${spent:.2f}.'
        )
    return None


def enforce_session_window(student, slot_start_time):
    """Return error message if slot start is outside the allowed window."""
    if not student.guardian_id or slot_start_time is None:
        return None

    settings = get_child_settings(student.guardian_id, student.id)
    if not settings:
        return None
    start = settings.session_window_start
    end = settings.session_window_end
    if start is None and end is None:
        return None

    slot_t = slot_start_time if isinstance(slot_start_time, time) \
        else slot_start_time.time()

    if start is not None and end is not None:
        if start <= end:
            in_window = start <= slot_t <= end
        else:  # overnight window, e.g., 20:00 -> 06:00
            in_window = slot_t >= start or slot_t <= end
        if not in_window:
            return (
                f'Session start {slot_t.strftime("%I:%M %p")} is outside '
                f'the allowed window '
                f'{start.strftime("%I:%M %p")} to {end.strftime("%I:%M %p")}.'
            )
    elif start is not None and slot_t < start:
        return (
            f'Session must start no earlier than {start.strftime("%I:%M %p")}.'
        )
    elif end is not None and slot_t > end:
        return (
            f'Session must start no later than {end.strftime("%I:%M %p")}.'
        )
    return None


def should_require_approval(student):
    """Whether a booking for this student needs guardian sign-off."""
    if not student.guardian_id:
        return False
    if student.is_minor:
        return True
    settings = get_child_settings(student.guardian_id, student.id)
    if settings and settings.requires_approval_for_booking:
        return True
    return False


def mark_booking_pending_approval(booking, expires_in=APPROVAL_WINDOW):
    """Set the booking to pending-guardian state. Caller commits."""
    booking.requires_guardian_approval = True
    booking.guardian_approved = None
    booking.guardian_approval_expires_at = datetime.utcnow() + expires_in
    booking.status = 'PendingGuardianApproval'


def expire_stale_approvals():
    """Cancel bookings whose 48h approval window has elapsed.

    Called from APScheduler. Idempotent.
    """
    now = datetime.utcnow()
    stale = Booking.query.filter(
        Booking.requires_guardian_approval.is_(True),
        Booking.guardian_approved.is_(None),
        Booking.guardian_approval_expires_at.isnot(None),
        Booking.guardian_approval_expires_at < now,
    ).all()

    cancelled = 0
    for booking in stale:
        try:
            from services.booking_service import cancel_booking
            cancel_booking(booking, cancelled_by='system', refund_pct=100)
            booking.cancellation_reason = 'Guardian approval expired'
            cancelled += 1
        except Exception as exc:
            current_app.logger.error(
                f'expire_stale_approvals: booking={booking.id} err={exc}'
            )

    if cancelled:
        db.session.commit()
        current_app.logger.info(
            f'expire_stale_approvals: cancelled {cancelled} stale booking(s)'
        )
    return cancelled


def monthly_spending_buckets(student_ids, months=6):
    """Return [{month: 'YYYY-MM', total: float}] oldest first."""
    if not student_ids:
        return []
    now = datetime.utcnow()
    start = (now.replace(day=1) - timedelta(days=32 * (months - 1))).replace(day=1)

    rows = db.session.query(
        func.date_trunc('month', Payment.completed_at).label('m'),
        func.coalesce(func.sum(Payment.amount), 0).label('total'),
    ).filter(
        Payment.student_id.in_(student_ids),
        Payment.status == 'completed',
        Payment.completed_at >= start,
    ).group_by('m').order_by('m').all()

    by_month = {r.m.strftime('%Y-%m'): float(r.total) for r in rows if r.m}

    out = []
    cursor = start
    for _ in range(months):
        key = cursor.strftime('%Y-%m')
        out.append({'month': key, 'total': by_month.get(key, 0.0)})
        if cursor.month == 12:
            cursor = cursor.replace(year=cursor.year + 1, month=1)
        else:
            cursor = cursor.replace(month=cursor.month + 1)
    return out
