"""
JSON API endpoints for guardian features (children, activity,
approvals, spending, messages).

Blueprint prefix: /api/v1
All endpoints return the standard envelope:
  {"success": True,  "data": {...}}
  {"success": False, "error": {"message": "...", "code": 400}}
"""

from datetime import datetime, timedelta
from functools import wraps

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import func, desc

from database import db
from models.guardian import Guardian
from models.student import Student
from models.booking import Booking
from models.slots import TutorSlot
from models.tutor import Tutor
from models.payment import Payment
from models.guardian_message import GuardianMessage

api_guardian_features_bp = Blueprint(
    'api_guardian_features', __name__, url_prefix='/api/v1'
)


# ── Helpers ──────────────────────────────────────────────────────────

def _ok(data, status=200):
    return jsonify({"success": True, "data": data}), status


def _err(message, code=400, field=None):
    payload = {"success": False, "error": {"message": message, "code": code}}
    if field:
        payload["error"]["field"] = field
    return jsonify(payload), code


def _guardian_required(f):
    """Decorator that wraps @login_required and checks guardian role."""
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if current_user.user_type != 'guardian':
            return _err("Access denied", 403)
        return f(*args, **kwargs)
    return decorated


def _photo_url(photo_value):
    if not photo_value:
        return None
    if photo_value.startswith("http") or photo_value.startswith("/"):
        return photo_value
    return f"/static/uploads/photos/{photo_value}"


# ── 1. GET /guardian/children ─────────────────────────────────────────

@api_guardian_features_bp.route('/guardian/children', methods=['GET'])
@_guardian_required
def guardian_children():
    children = Student.query.filter_by(guardian_id=current_user.id).all()

    results = []
    for child in children:
        # Count recent bookings
        booking_count = Booking.query.filter_by(student_id=child.id).count()
        # Total spend
        total_spent = db.session.query(
            func.coalesce(func.sum(Payment.amount), 0)
        ).filter(
            Payment.student_id == child.id,
            Payment.status == 'completed'
        ).scalar()

        results.append({
            'id': child.id,
            'name': child.name,
            'email': child.email,
            'date_of_birth': child.date_of_birth.isoformat() if child.date_of_birth else None,
            'is_minor': child.is_minor,
            'grade_level': child.grade_level,
            'major': child.major,
            'created_at': child.created_at.isoformat() if child.created_at else None,
            'booking_count': booking_count,
            'total_spent': float(total_spent),
        })

    return _ok({'children': results})


# ── 2. GET /guardian/children/<id>/activity ───────────────────────────

@api_guardian_features_bp.route('/guardian/children/<int:child_id>/activity', methods=['GET'])
@_guardian_required
def guardian_child_activity(child_id):
    child = Student.query.get(child_id)
    if not child or child.guardian_id != current_user.id:
        return _err("Child not found", 404)

    # Recent bookings with tutor/slot info
    rows = db.session.query(Booking, TutorSlot, Tutor).join(
        TutorSlot, Booking.slot_id == TutorSlot.id
    ).join(
        Tutor, Booking.tutor_id == Tutor.id
    ).filter(
        Booking.student_id == child_id
    ).order_by(TutorSlot.date.desc()).limit(50).all()

    bookings = []
    for booking, slot, tutor in rows:
        bookings.append({
            'id': booking.id,
            'tutor': {
                'id': tutor.id,
                'name': tutor.name,
                'avatar_url': _photo_url(tutor.profile_photo),
            },
            'subject': slot.subject,
            'date': slot.date.isoformat() if slot.date else None,
            'start_time': slot.start_time.isoformat() if slot.start_time else None,
            'end_time': slot.end_time.isoformat() if slot.end_time else None,
            'status': slot.status,
            'mode': slot.mode,
            'price': slot.price,
            'booked_on': booking.booked_on.isoformat() if booking.booked_on else None,
        })

    # Recent payments
    payments = Payment.query.filter_by(student_id=child_id) \
        .order_by(Payment.created_at.desc()).limit(20).all()
    payment_list = [{
        'id': p.id,
        'amount': float(p.amount),
        'status': p.status,
        'created_at': p.created_at.isoformat() if p.created_at else None,
    } for p in payments]

    return _ok({
        'child': {
            'id': child.id,
            'name': child.name,
        },
        'bookings': bookings,
        'payments': payment_list,
    })


# ── 3. GET /guardian/approvals ────────────────────────────────────────

@api_guardian_features_bp.route('/guardian/approvals', methods=['GET'])
@_guardian_required
def guardian_approvals():
    # Get all children of this guardian
    child_ids = [s.id for s in Student.query.filter_by(guardian_id=current_user.id).all()]
    if not child_ids:
        return _ok({'approvals': []})

    status = request.args.get('status', 'pending')

    q = db.session.query(Booking, TutorSlot, Student, Tutor).join(
        TutorSlot, Booking.slot_id == TutorSlot.id
    ).join(
        Student, Booking.student_id == Student.id
    ).join(
        Tutor, Booking.tutor_id == Tutor.id
    ).filter(
        Booking.student_id.in_(child_ids)
    )

    if status == 'pending':
        q = q.filter(Booking.guardian_approved.is_(None))
    elif status == 'approved':
        q = q.filter(Booking.guardian_approved.is_(True))
    elif status == 'rejected':
        q = q.filter(Booking.guardian_approved.is_(False))

    rows = q.order_by(Booking.booked_on.desc()).all()

    results = []
    for booking, slot, student, tutor in rows:
        results.append({
            'id': booking.id,
            'child': {
                'id': student.id,
                'name': student.name,
            },
            'tutor': {
                'id': tutor.id,
                'name': tutor.name,
                'avatar_url': _photo_url(tutor.profile_photo),
                'verification_status': tutor.verification_status,
            },
            'subject': slot.subject,
            'date': slot.date.isoformat() if slot.date else None,
            'start_time': slot.start_time.isoformat() if slot.start_time else None,
            'end_time': slot.end_time.isoformat() if slot.end_time else None,
            'mode': slot.mode,
            'price': slot.price,
            'guardian_approved': booking.guardian_approved,
            'booked_on': booking.booked_on.isoformat() if booking.booked_on else None,
        })

    return _ok({'approvals': results})


# ── 4. POST /guardian/approvals/<id>/approve ──────────────────────────

@api_guardian_features_bp.route('/guardian/approvals/<int:booking_id>/approve', methods=['POST'])
@_guardian_required
def guardian_approve_booking(booking_id):
    booking = Booking.query.get(booking_id)
    if not booking:
        return _err("Booking not found", 404)

    # Verify this booking belongs to a child of this guardian
    child = Student.query.get(booking.student_id)
    if not child or child.guardian_id != current_user.id:
        return _err("Access denied", 403)

    booking.guardian_approved = True
    booking.guardian_approved_on = datetime.utcnow()
    db.session.commit()

    return _ok({'message': 'Booking approved'})


# ── 5. POST /guardian/approvals/<id>/reject ───────────────────────────

@api_guardian_features_bp.route('/guardian/approvals/<int:booking_id>/reject', methods=['POST'])
@_guardian_required
def guardian_reject_booking(booking_id):
    booking = Booking.query.get(booking_id)
    if not booking:
        return _err("Booking not found", 404)

    child = Student.query.get(booking.student_id)
    if not child or child.guardian_id != current_user.id:
        return _err("Access denied", 403)

    body = request.get_json(silent=True) or {}

    booking.guardian_approved = False
    booking.guardian_approved_on = datetime.utcnow()
    booking.cancellation_reason = body.get('reason', 'Guardian rejected')
    db.session.commit()

    return _ok({'message': 'Booking rejected'})


# ── 6. GET /guardian/spending ─────────────────────────────────────────

@api_guardian_features_bp.route('/guardian/spending', methods=['GET'])
@_guardian_required
def guardian_spending():
    child_ids = [s.id for s in Student.query.filter_by(guardian_id=current_user.id).all()]
    if not child_ids:
        return _ok({
            'total_spent': 0,
            'weekly_spent': 0,
            'monthly_spent': 0,
            'weekly_limit': current_user.weekly_spending_limit,
            'monthly_limit': current_user.monthly_spending_limit,
            'by_child': [],
        })

    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    total_spent = float(db.session.query(
        func.coalesce(func.sum(Payment.amount), 0)
    ).filter(
        Payment.student_id.in_(child_ids),
        Payment.status == 'completed'
    ).scalar())

    weekly_spent = float(db.session.query(
        func.coalesce(func.sum(Payment.amount), 0)
    ).filter(
        Payment.student_id.in_(child_ids),
        Payment.status == 'completed',
        Payment.completed_at >= week_ago
    ).scalar())

    monthly_spent = float(db.session.query(
        func.coalesce(func.sum(Payment.amount), 0)
    ).filter(
        Payment.student_id.in_(child_ids),
        Payment.status == 'completed',
        Payment.completed_at >= month_ago
    ).scalar())

    # Per-child breakdown
    by_child = []
    for cid in child_ids:
        child = Student.query.get(cid)
        child_total = float(db.session.query(
            func.coalesce(func.sum(Payment.amount), 0)
        ).filter(
            Payment.student_id == cid,
            Payment.status == 'completed'
        ).scalar())
        child_monthly = float(db.session.query(
            func.coalesce(func.sum(Payment.amount), 0)
        ).filter(
            Payment.student_id == cid,
            Payment.status == 'completed',
            Payment.completed_at >= month_ago
        ).scalar())
        by_child.append({
            'id': child.id,
            'name': child.name,
            'total_spent': child_total,
            'monthly_spent': child_monthly,
        })

    return _ok({
        'total_spent': total_spent,
        'weekly_spent': weekly_spent,
        'monthly_spent': monthly_spent,
        'weekly_limit': current_user.weekly_spending_limit,
        'monthly_limit': current_user.monthly_spending_limit,
        'by_child': by_child,
    })


# ── 7. PUT /guardian/spending/limits ──────────────────────────────────

@api_guardian_features_bp.route('/guardian/spending/limits', methods=['PUT'])
@_guardian_required
def guardian_update_limits():
    body = request.get_json(silent=True) or {}

    weekly = body.get('weekly_limit')
    monthly = body.get('monthly_limit')

    if weekly is not None:
        current_user.weekly_spending_limit = float(weekly) if weekly else None
    if monthly is not None:
        current_user.monthly_spending_limit = float(monthly) if monthly else None

    db.session.commit()

    return _ok({
        'weekly_limit': current_user.weekly_spending_limit,
        'monthly_limit': current_user.monthly_spending_limit,
    })


# ── 8. GET /guardian/messages ─────────────────────────────────────────

@api_guardian_features_bp.route('/guardian/messages', methods=['GET'])
@_guardian_required
def guardian_messages():
    child_id = request.args.get('child_id', type=int)

    q = GuardianMessage.query.filter_by(guardian_id=current_user.id)
    if child_id:
        q = q.filter_by(student_id=child_id)

    messages = q.order_by(GuardianMessage.created_at.desc()).all()

    # Group by tutor+student thread
    threads = {}
    for msg in messages:
        key = f'{msg.tutor_id}_{msg.student_id}'
        if key not in threads:
            tutor = Tutor.query.get(msg.tutor_id)
            student = Student.query.get(msg.student_id)
            threads[key] = {
                'tutor': {
                    'id': msg.tutor_id,
                    'name': tutor.name if tutor else 'Unknown',
                    'avatar_url': _photo_url(tutor.profile_photo) if tutor else None,
                },
                'child': {
                    'id': msg.student_id,
                    'name': student.name if student else 'Unknown',
                },
                'messages': [],
                'unread_count': 0,
            }
        threads[key]['messages'].append(msg.to_dict())
        if not msg.is_read and msg.sender_type != 'guardian':
            threads[key]['unread_count'] += 1

    return _ok({'threads': list(threads.values())})


# ── 9. POST /guardian/messages ────────────────────────────────────────

@api_guardian_features_bp.route('/guardian/messages', methods=['POST'])
@_guardian_required
def guardian_send_message():
    body = request.get_json(silent=True) or {}
    tutor_id = body.get('tutor_id')
    student_id = body.get('student_id')
    content = (body.get('content') or '').strip()

    if not tutor_id or not student_id or not content:
        return _err("tutor_id, student_id, and content are required", 400)

    # Verify the student belongs to this guardian
    child = Student.query.get(student_id)
    if not child or child.guardian_id != current_user.id:
        return _err("Access denied", 403)

    # Verify tutor exists
    tutor = Tutor.query.get(tutor_id)
    if not tutor:
        return _err("Tutor not found", 404)

    msg = GuardianMessage(
        guardian_id=current_user.id,
        tutor_id=tutor_id,
        student_id=student_id,
        sender_type='guardian',
        content=content,
    )
    db.session.add(msg)
    db.session.commit()

    return _ok({'message': msg.to_dict()}, 201)
