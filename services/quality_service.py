"""Tutor quality score.

Composite 0-100 score on a rolling 90-day window.
Weights: rating 40, completion 20, response_time 15, repeat_rate 15, profile 10.
Tutors with fewer than 5 completed sessions are marked provisional (score=None).
Snapshots are written weekly for the trend chart.
"""
from datetime import datetime, timedelta

from flask import current_app
from sqlalchemy import and_, func

from database import db
from models.booking import Booking
from models.review import Review
from models.slots import TutorSlot
from models.tutor import Tutor
from models.tutor_quality_score import (
    TutorQualityScore, TutorQualityScoreSnapshot,
)


WINDOW_DAYS = 90
PROVISIONAL_THRESHOLD = 5
WEIGHTS = {
    'rating': 0.40,
    'completion': 0.20,
    'response_time': 0.15,
    'repeat_rate': 0.15,
    'profile_completeness': 0.10,
}
PROFILE_FIELDS = [
    'bio_min120',
    'profile_photo',
    'qualification_and_institution',
    'weekly_availability_template',
    'subjects_additional',
]


def _window_start():
    return datetime.utcnow() - timedelta(days=WINDOW_DAYS)


def _completed_sessions_in_window(tutor_id):
    cutoff = _window_start()
    return db.session.query(TutorSlot).filter(
        TutorSlot.tutor_id == tutor_id,
        TutorSlot.status == 'completed',
        TutorSlot.date >= cutoff.date(),
    ).count()


def _rating_score(tutor_id):
    """0-100 from avg rating over the 90-day window. None if fewer than 5 reviews."""
    cutoff = _window_start()
    rows = (
        db.session.query(func.count(Review.id), func.avg(Review.rating))
        .filter(Review.tutor_id == tutor_id, Review.created_at >= cutoff)
        .one()
    )
    count, avg = rows
    if not count or count < 5 or avg is None:
        return None
    # 1->0, 5->100
    return max(0.0, min(100.0, (float(avg) - 1.0) * 25.0))


def _completion_rate(tutor_id):
    """0-100: completed / (completed + cancellations that count against the tutor).
    Late-notice student cancels (under 24h) are excluded from the denominator.
    """
    cutoff = _window_start()

    rows = (
        db.session.query(Booking, TutorSlot)
        .join(TutorSlot, Booking.slot_id == TutorSlot.id)
        .filter(
            Booking.tutor_id == tutor_id,
            TutorSlot.date >= cutoff.date(),
        )
        .all()
    )

    completed = 0
    counted_against = 0
    for booking, slot in rows:
        if slot.status == 'completed':
            completed += 1
            continue
        if booking.status == 'Cancelled':
            session_start = datetime.combine(slot.date, slot.start_time)
            if (booking.cancelled_by == 'student'
                    and booking.cancelled_on
                    and (session_start - booking.cancelled_on) > timedelta(hours=24)):
                # late-notice cancel: exclude from denominator
                continue
            counted_against += 1

    denom = completed + counted_against
    if denom == 0:
        return None
    return round(100.0 * completed / denom, 2)


def _response_time_score(tutor):
    """0-100: 60 min or less scores 100, 24h or more scores 0, linear between."""
    minutes = tutor.response_time_avg
    if minutes is None:
        return None
    if minutes <= 60:
        return 100.0
    if minutes >= 24 * 60:
        return 0.0
    # linear between 60 and 1440
    return round(100.0 * (1440 - minutes) / (1440 - 60), 2)


def _repeat_rate(tutor_id):
    """0-100: share of students who booked a second session within 60 days of their first."""
    cutoff = _window_start()
    rows = (
        db.session.query(Booking.student_id, Booking.booked_on)
        .filter(
            Booking.tutor_id == tutor_id,
            Booking.booked_on.isnot(None),
            Booking.booked_on >= cutoff,
        )
        .order_by(Booking.student_id, Booking.booked_on)
        .all()
    )
    if not rows:
        return None

    by_student = {}
    for sid, ts in rows:
        by_student.setdefault(sid, []).append(ts)

    if len(by_student) < 3:
        # not enough distinct students for a meaningful rate
        return None

    repeat_count = 0
    for sid, stamps in by_student.items():
        if len(stamps) < 2:
            continue
        first = stamps[0]
        if any(s - first <= timedelta(days=60) and s != first for s in stamps[1:]):
            repeat_count += 1

    return round(100.0 * repeat_count / len(by_student), 2)


def _profile_completeness(tutor):
    """0-100: equal-weight checklist across PROFILE_FIELDS."""
    checks = {
        'bio_min120': bool(tutor.bio and len(tutor.bio.strip()) >= 120),
        'profile_photo': bool(tutor.profile_photo),
        'qualification_and_institution': bool(
            tutor.qualification and tutor.institution),
        'weekly_availability_template': bool(tutor.weekly_availability_template),
        'subjects_additional': bool(
            tutor.subjects_additional
            and isinstance(tutor.subjects_additional, list)
            and len(tutor.subjects_additional) >= 1
        ),
    }
    hit = sum(1 for v in checks.values() if v)
    return round(100.0 * hit / len(checks), 2), checks


def _weighted_composite(components):
    """Weighted sum of non-None components, renormalized by weights used."""
    total, weight_used = 0.0, 0.0
    for key, value in components.items():
        if value is None:
            continue
        w = WEIGHTS.get(key, 0)
        total += value * w
        weight_used += w
    if weight_used == 0:
        return None
    return round(total / weight_used, 2)


def compute_tutor_score(tutor_id, save_snapshot=False):
    """Compute and persist the tutor quality record. Returns the row."""
    tutor = Tutor.query.get(tutor_id)
    if not tutor:
        return None

    sessions = _completed_sessions_in_window(tutor_id)
    rating = _rating_score(tutor_id)
    completion = _completion_rate(tutor_id)
    response = _response_time_score(tutor)
    repeat = _repeat_rate(tutor_id)
    profile, _profile_checks = _profile_completeness(tutor)

    is_provisional = sessions < PROVISIONAL_THRESHOLD
    composite = None
    if not is_provisional:
        composite = _weighted_composite({
            'rating': rating,
            'completion': completion,
            'response_time': response,
            'repeat_rate': repeat,
            'profile_completeness': profile,
        })

    row = TutorQualityScore.query.filter_by(tutor_id=tutor_id).first()
    if not row:
        row = TutorQualityScore(tutor_id=tutor_id)
        db.session.add(row)

    row.score = composite
    row.is_provisional = is_provisional
    row.rating_score = rating
    row.completion_rate = completion
    row.response_time_score = response
    row.repeat_rate = repeat
    row.profile_completeness = profile
    row.sessions_in_window = sessions
    row.computed_at = datetime.utcnow()

    if save_snapshot:
        db.session.add(TutorQualityScoreSnapshot(
            tutor_id=tutor_id, score=composite,
            is_provisional=is_provisional,
        ))

    db.session.commit()
    return row


def recompute_all_active_tutors():
    """Nightly job. Scores every tutor with a booking in the window.
    Writes a snapshot once per week per tutor.
    """
    cutoff = _window_start()
    active_ids = [
        r[0] for r in db.session.query(Booking.tutor_id).filter(
            Booking.booked_on >= cutoff
        ).distinct().all()
    ]

    # also include verified tutors with no recent bookings so they get a provisional row
    verified_ids = [
        r[0] for r in db.session.query(Tutor.id).filter(
            Tutor.verification_status == 'verified'
        ).all()
    ]
    all_ids = sorted(set(active_ids) | set(verified_ids))

    week_ago = datetime.utcnow() - timedelta(days=6, hours=12)

    count = 0
    for tid in all_ids:
        try:
            last_snap = (
                TutorQualityScoreSnapshot.query
                .filter_by(tutor_id=tid)
                .order_by(TutorQualityScoreSnapshot.saved_at.desc())
                .first()
            )
            snapshot = last_snap is None or last_snap.saved_at < week_ago
            compute_tutor_score(tid, save_snapshot=snapshot)
            count += 1
        except Exception as exc:
            current_app.logger.error(
                f'quality.recompute tutor={tid} err={exc}'
            )
            db.session.rollback()
    current_app.logger.info(f'quality.recompute: scored {count} tutor(s)')
    return count


def get_tutor_score(tutor_id, recompute_if_missing=True):
    row = TutorQualityScore.query.filter_by(tutor_id=tutor_id).first()
    if row is None and recompute_if_missing:
        row = compute_tutor_score(tutor_id)
    return row


def get_tutor_score_diagnostic(tutor_id):
    """Return score, per-component values, and improvement suggestions for the tutor."""
    tutor = Tutor.query.get(tutor_id)
    if not tutor:
        return None
    row = get_tutor_score(tutor_id)
    profile_pct, checks = _profile_completeness(tutor)

    suggestions = []
    if row and row.response_time_score is not None and row.response_time_score < 75:
        suggestions.append({
            'component': 'response_time',
            'message': (
                f'Your average reply time is '
                f'{tutor.response_time_avg or "unknown"} min. '
                f'Tutors who reply within 60 min score 100 here.'
            ),
        })
    if row and row.completion_rate is not None and row.completion_rate < 90:
        suggestions.append({
            'component': 'completion',
            'message': (
                'Your session completion rate is below 90%. '
                'Cancellations and no-shows hurt this score.'
            ),
        })
    if row and row.repeat_rate is not None and row.repeat_rate < 30:
        suggestions.append({
            'component': 'repeat_rate',
            'message': (
                'Few students are coming back for a second session. '
                'Strong follow-up assignments and goal tracking lift this.'
            ),
        })
    missing = [k for k, v in checks.items() if not v]
    if missing:
        suggestions.append({
            'component': 'profile_completeness',
            'missing': missing,
            'message': (
                'Profile missing: ' + ', '.join(
                    m.replace('_', ' ') for m in missing
                )
            ),
        })

    out = row.to_dict() if row else {}
    out['profile_checks'] = checks
    out['suggestions'] = suggestions
    return out


def get_tutor_score_history(tutor_id, weeks=12):
    cutoff = datetime.utcnow() - timedelta(weeks=weeks)
    snaps = (
        TutorQualityScoreSnapshot.query
        .filter(
            TutorQualityScoreSnapshot.tutor_id == tutor_id,
            TutorQualityScoreSnapshot.saved_at >= cutoff,
        )
        .order_by(TutorQualityScoreSnapshot.saved_at.asc())
        .all()
    )
    return [s.to_dict() for s in snaps]


def invalidate_for_profile_edit(tutor_id):
    """Recompute score after a profile edit so completeness reflects the update."""
    try:
        compute_tutor_score(tutor_id)
    except Exception as exc:
        current_app.logger.warning(
            f'quality.invalidate tutor={tutor_id} err={exc}'
        )
