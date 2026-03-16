"""
JSON API endpoints for admin tools (users, verification, analytics,
moderation, audit log, bookings, settings).

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
from models.admin import Admin
from models.student import Student
from models.tutor import Tutor
from models.booking import Booking
from models.slots import TutorSlot
from models.payment import Payment
from models.review import Review
from models.tutor_document import TutorDocument
from models.content_report import ContentReport
from models.audit_log import AuditLog
from models.platform_setting import PlatformSetting

api_admin_bp = Blueprint(
    'api_admin', __name__, url_prefix='/api/v1'
)


# ── Helpers ──────────────────────────────────────────────────────────

def _ok(data, status=200):
    return jsonify({"success": True, "data": data}), status


def _err(message, code=400, field=None):
    payload = {"success": False, "error": {"message": message, "code": code}}
    if field:
        payload["error"]["field"] = field
    return jsonify(payload), code


def _admin_required(f):
    """Decorator that wraps @login_required and checks admin role."""
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if current_user.user_type != 'admin':
            return _err("Access denied", 403)
        return f(*args, **kwargs)
    return decorated


def _photo_url(photo_value):
    if not photo_value:
        return None
    if photo_value.startswith("http") or photo_value.startswith("/"):
        return photo_value
    return f"/static/uploads/photos/{photo_value}"


def _log_action(action, target_type=None, target_id=None, details=None):
    log = AuditLog(
        admin_id=current_user.id if current_user.is_authenticated else None,
        admin_name=current_user.name if current_user.is_authenticated else None,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
        ip_address=request.remote_addr
    )
    db.session.add(log)


def _serialize_user(user):
    base = {
        'id': user.id,
        'name': user.name,
        'email': user.email,
        'user_type': user.user_type,
        'created_at': user.created_at.isoformat() if user.created_at else None,
    }
    if user.user_type == 'student':
        base['email_verified'] = user.email_verified
        base['guardian_id'] = user.guardian_id
        base['is_minor'] = user.is_minor
        base['is_suspended'] = bool(user.locked_until and user.locked_until > datetime.utcnow())
    elif user.user_type == 'tutor':
        base['verification_status'] = user.verification_status
        base['avatar_url'] = _photo_url(user.profile_photo)
        base['rating_avg'] = user.rating_avg
        base['total_sessions_completed'] = user.total_sessions_completed
        base['subject'] = user.subject
        base['is_suspended'] = bool(user.locked_until and user.locked_until > datetime.utcnow())
    return base


# ── 1. GET /admin/users ──────────────────────────────────────────────

@api_admin_bp.route('/admin/users', methods=['GET'])
@_admin_required
def admin_list_users():
    user_type = request.args.get('type', 'all')
    search = request.args.get('search', '').strip()
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    users = []

    if user_type in ('all', 'student'):
        q = Student.query
        if search:
            q = q.filter(
                db.or_(
                    Student.name.ilike(f'%{search}%'),
                    Student.email.ilike(f'%{search}%')
                )
            )
        for s in q.order_by(Student.created_at.desc()).all():
            users.append(_serialize_user(s))

    if user_type in ('all', 'tutor'):
        q = Tutor.query
        if search:
            q = q.filter(
                db.or_(
                    Tutor.name.ilike(f'%{search}%'),
                    Tutor.email.ilike(f'%{search}%')
                )
            )
        for t in q.order_by(Tutor.created_at.desc()).all():
            users.append(_serialize_user(t))

    # Sort merged list by created_at desc
    users.sort(key=lambda u: u.get('created_at') or '', reverse=True)

    # Paginate
    total = len(users)
    start = (page - 1) * per_page
    end = start + per_page
    page_users = users[start:end]

    return _ok({
        'users': page_users,
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': (total + per_page - 1) // per_page,
    })


# ── 2. GET /admin/users/<type>/<id> ─────────────────────────────────

@api_admin_bp.route('/admin/users/<user_type>/<int:user_id>', methods=['GET'])
@_admin_required
def admin_user_detail(user_type, user_id):
    if user_type == 'student':
        user = Student.query.get(user_id)
    elif user_type == 'tutor':
        user = Tutor.query.get(user_id)
    else:
        return _err("Invalid user type", 400)

    if not user:
        return _err("User not found", 404)

    data = _serialize_user(user)

    # Add booking/session stats
    booking_count = Booking.query.filter_by(
        **{f'{user_type}_id': user_id}
    ).count()
    data['booking_count'] = booking_count

    if user_type == 'tutor':
        data['documents'] = []
        for doc in TutorDocument.query.filter_by(tutor_id=user_id).all():
            data['documents'].append({
                'id': doc.id,
                'document_type': doc.document_type,
                'original_filename': doc.original_filename,
                'status': doc.status,
                'uploaded_at': doc.uploaded_at.isoformat() if doc.uploaded_at else None,
                'expiry_date': doc.expiry_date.isoformat() if doc.expiry_date else None,
            })
        data['bio'] = user.bio
        data['qualification'] = user.qualification
        data['institution'] = user.institution
        data['hourly_rate'] = user.hourly_rate

    return _ok({'user': data})


# ── 3. POST /admin/users/<type>/<id>/suspend ────────────────────────

@api_admin_bp.route('/admin/users/<user_type>/<int:user_id>/suspend', methods=['POST'])
@_admin_required
def admin_suspend_user(user_type, user_id):
    if user_type == 'student':
        user = Student.query.get(user_id)
    elif user_type == 'tutor':
        user = Tutor.query.get(user_id)
    else:
        return _err("Invalid user type", 400)

    if not user:
        return _err("User not found", 404)

    body = request.get_json(silent=True) or {}
    days = body.get('days', 30)

    user.locked_until = datetime.utcnow() + timedelta(days=days)
    _log_action('suspend_user', target_type=user_type, target_id=user_id,
                details={'days': days, 'reason': body.get('reason', '')})
    db.session.commit()

    return _ok({'message': f'{user_type.title()} suspended for {days} days'})


# ── 4. POST /admin/users/<type>/<id>/unsuspend ──────────────────────

@api_admin_bp.route('/admin/users/<user_type>/<int:user_id>/unsuspend', methods=['POST'])
@_admin_required
def admin_unsuspend_user(user_type, user_id):
    if user_type == 'student':
        user = Student.query.get(user_id)
    elif user_type == 'tutor':
        user = Tutor.query.get(user_id)
    else:
        return _err("Invalid user type", 400)

    if not user:
        return _err("User not found", 404)

    user.locked_until = None
    user.failed_login_attempts = 0
    _log_action('unsuspend_user', target_type=user_type, target_id=user_id)
    db.session.commit()

    return _ok({'message': f'{user_type.title()} unsuspended'})


# ── 5. POST /admin/users/<type>/<id>/verify-email ───────────────────

@api_admin_bp.route('/admin/users/<user_type>/<int:user_id>/verify-email', methods=['POST'])
@_admin_required
def admin_verify_email(user_type, user_id):
    if user_type == 'student':
        user = Student.query.get(user_id)
        if not user:
            return _err("User not found", 404)
        user.email_verified = True
    elif user_type == 'tutor':
        # Tutors don't have email_verified column in the same way
        return _err("Email verification not applicable for tutors", 400)
    else:
        return _err("Invalid user type", 400)

    _log_action('verify_email', target_type=user_type, target_id=user_id)
    db.session.commit()

    return _ok({'message': 'Email marked as verified'})


# ── 6. GET /admin/verification ───────────────────────────────────────

@api_admin_bp.route('/admin/verification', methods=['GET'])
@_admin_required
def admin_verification_queue():
    status = request.args.get('status', 'all')

    q = Tutor.query
    if status != 'all':
        q = q.filter(Tutor.verification_status == status)
    else:
        q = q.filter(Tutor.verification_status.in_([
            'documents_submitted', 'under_review', 'revision_required'
        ]))

    tutors = q.order_by(Tutor.created_at.asc()).all()

    results = []
    for t in tutors:
        docs = TutorDocument.query.filter_by(tutor_id=t.id).all()
        results.append({
            'id': t.id,
            'name': t.name,
            'email': t.email,
            'avatar_url': _photo_url(t.profile_photo),
            'subject': t.subject,
            'qualification': t.qualification,
            'institution': t.institution,
            'verification_status': t.verification_status,
            'admin_feedback': t.admin_feedback,
            'created_at': t.created_at.isoformat() if t.created_at else None,
            'documents': [{
                'id': d.id,
                'document_type': d.document_type,
                'original_filename': d.original_filename,
                'status': d.status,
                'admin_notes': d.admin_notes,
                'uploaded_at': d.uploaded_at.isoformat() if d.uploaded_at else None,
                'expiry_date': d.expiry_date.isoformat() if d.expiry_date else None,
            } for d in docs],
        })

    return _ok({'tutors': results})


# ── 7. POST /admin/verification/<id>/approve ─────────────────────────

@api_admin_bp.route('/admin/verification/<int:tutor_id>/approve', methods=['POST'])
@_admin_required
def admin_approve_tutor(tutor_id):
    tutor = Tutor.query.get(tutor_id)
    if not tutor:
        return _err("Tutor not found", 404)

    body = request.get_json(silent=True) or {}

    tutor.verification_status = 'verified'
    tutor.verified_on = datetime.utcnow()
    tutor.reviewed_by = current_user.name
    tutor.reviewed_on = datetime.utcnow()
    tutor.admin_feedback = body.get('feedback', '')

    # Approve all pending documents
    for doc in TutorDocument.query.filter_by(tutor_id=tutor_id, status='pending').all():
        doc.status = 'approved'
        doc.reviewed_by = current_user.name
        doc.reviewed_on = datetime.utcnow()

    _log_action('approve_tutor', target_type='tutor', target_id=tutor_id)
    db.session.commit()

    return _ok({'message': f'{tutor.name} has been verified'})


# ── 8. POST /admin/verification/<id>/reject ──────────────────────────

@api_admin_bp.route('/admin/verification/<int:tutor_id>/reject', methods=['POST'])
@_admin_required
def admin_reject_tutor(tutor_id):
    tutor = Tutor.query.get(tutor_id)
    if not tutor:
        return _err("Tutor not found", 404)

    body = request.get_json(silent=True) or {}
    feedback = body.get('feedback', '')
    if not feedback:
        return _err("Feedback is required when rejecting", 400)

    tutor.verification_status = 'rejected'
    tutor.reviewed_by = current_user.name
    tutor.reviewed_on = datetime.utcnow()
    tutor.admin_feedback = feedback

    _log_action('reject_tutor', target_type='tutor', target_id=tutor_id,
                details={'feedback': feedback})
    db.session.commit()

    return _ok({'message': f'{tutor.name} has been rejected'})


# ── 9. POST /admin/verification/<id>/request-revision ────────────────

@api_admin_bp.route('/admin/verification/<int:tutor_id>/request-revision', methods=['POST'])
@_admin_required
def admin_request_revision(tutor_id):
    tutor = Tutor.query.get(tutor_id)
    if not tutor:
        return _err("Tutor not found", 404)

    body = request.get_json(silent=True) or {}
    feedback = body.get('feedback', '')
    if not feedback:
        return _err("Feedback is required", 400)

    tutor.verification_status = 'revision_required'
    tutor.reviewed_by = current_user.name
    tutor.reviewed_on = datetime.utcnow()
    tutor.admin_feedback = feedback

    # Mark specific documents if provided
    doc_ids = body.get('document_ids', [])
    if doc_ids:
        for doc in TutorDocument.query.filter(
            TutorDocument.id.in_(doc_ids),
            TutorDocument.tutor_id == tutor_id
        ).all():
            doc.status = 'revision_required'
            doc.admin_notes = body.get('document_notes', feedback)

    _log_action('request_revision', target_type='tutor', target_id=tutor_id,
                details={'feedback': feedback})
    db.session.commit()

    return _ok({'message': f'Revision requested from {tutor.name}'})


# ── 10. GET /admin/analytics ─────────────────────────────────────────

@api_admin_bp.route('/admin/analytics', methods=['GET'])
@_admin_required
def admin_analytics():
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago = now - timedelta(days=7)

    # User counts
    total_students = Student.query.count()
    total_tutors = Tutor.query.count()
    new_students_30d = Student.query.filter(Student.created_at >= thirty_days_ago).count()
    new_tutors_30d = Tutor.query.filter(Tutor.created_at >= thirty_days_ago).count()
    verified_tutors = Tutor.query.filter(Tutor.verification_status == 'verified').count()

    # Booking stats
    total_bookings = Booking.query.count()
    bookings_30d = Booking.query.filter(Booking.booked_on >= thirty_days_ago).count()
    completed_slots = TutorSlot.query.filter(TutorSlot.status == 'completed').count()

    # Revenue
    total_revenue = db.session.query(
        func.coalesce(func.sum(Payment.amount), 0)
    ).filter(Payment.status == 'completed').scalar()
    revenue_30d = db.session.query(
        func.coalesce(func.sum(Payment.amount), 0)
    ).filter(
        Payment.status == 'completed',
        Payment.completed_at >= thirty_days_ago
    ).scalar()
    total_platform_fees = db.session.query(
        func.coalesce(func.sum(Payment.platform_fee), 0)
    ).filter(Payment.status == 'completed').scalar()

    # Daily signups for chart (last 30 days)
    daily_signups = []
    for i in range(30):
        day = (now - timedelta(days=29 - i)).date()
        day_start = datetime.combine(day, datetime.min.time())
        day_end = datetime.combine(day, datetime.max.time())
        students = Student.query.filter(
            Student.created_at.between(day_start, day_end)
        ).count()
        tutors = Tutor.query.filter(
            Tutor.created_at.between(day_start, day_end)
        ).count()
        daily_signups.append({
            'date': day.isoformat(),
            'students': students,
            'tutors': tutors,
        })

    # Daily revenue for chart (last 30 days)
    daily_revenue = []
    for i in range(30):
        day = (now - timedelta(days=29 - i)).date()
        day_start = datetime.combine(day, datetime.min.time())
        day_end = datetime.combine(day, datetime.max.time())
        rev = db.session.query(
            func.coalesce(func.sum(Payment.amount), 0)
        ).filter(
            Payment.status == 'completed',
            Payment.completed_at.between(day_start, day_end)
        ).scalar()
        daily_revenue.append({
            'date': day.isoformat(),
            'revenue': float(rev),
        })

    # Review stats
    avg_rating = db.session.query(
        func.coalesce(func.avg(Review.rating), 0)
    ).scalar()
    total_reviews = Review.query.count()

    return _ok({
        'users': {
            'total_students': total_students,
            'total_tutors': total_tutors,
            'new_students_30d': new_students_30d,
            'new_tutors_30d': new_tutors_30d,
            'verified_tutors': verified_tutors,
        },
        'bookings': {
            'total': total_bookings,
            'last_30_days': bookings_30d,
            'completed_sessions': completed_slots,
        },
        'revenue': {
            'total': float(total_revenue),
            'last_30_days': float(revenue_30d),
            'platform_fees': float(total_platform_fees),
        },
        'reviews': {
            'total': total_reviews,
            'average_rating': round(float(avg_rating), 1),
        },
        'charts': {
            'daily_signups': daily_signups,
            'daily_revenue': daily_revenue,
        },
    })


# ── 11. GET /admin/moderation ────────────────────────────────────────

@api_admin_bp.route('/admin/moderation', methods=['GET'])
@_admin_required
def admin_moderation():
    status = request.args.get('status', 'pending')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    q = ContentReport.query
    if status != 'all':
        q = q.filter(ContentReport.status == status)

    total = q.count()
    reports = q.order_by(ContentReport.created_at.desc()) \
               .offset((page - 1) * per_page) \
               .limit(per_page) \
               .all()

    results = []
    for r in reports:
        data = r.to_dict()

        # Look up reporter name
        if r.reporter_type == 'student':
            reporter = Student.query.get(r.reporter_id)
        elif r.reporter_type == 'tutor':
            reporter = Tutor.query.get(r.reporter_id)
        else:
            reporter = None
        data['reporter_name'] = reporter.name if reporter else 'Unknown'

        results.append(data)

    return _ok({
        'reports': results,
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': (total + per_page - 1) // per_page,
    })


# ── 12. POST /admin/moderation/<id>/resolve ──────────────────────────

@api_admin_bp.route('/admin/moderation/<int:report_id>/resolve', methods=['POST'])
@_admin_required
def admin_resolve_report(report_id):
    report = ContentReport.query.get(report_id)
    if not report:
        return _err("Report not found", 404)

    body = request.get_json(silent=True) or {}
    action = body.get('action', 'dismiss')  # dismiss or reviewed

    report.status = 'reviewed' if action == 'reviewed' else 'dismissed'
    report.reviewed_by = current_user.name
    report.reviewed_at = datetime.utcnow()

    _log_action('resolve_report', target_type='content_report', target_id=report_id,
                details={'action': action, 'notes': body.get('notes', '')})
    db.session.commit()

    return _ok({'message': f'Report {report.status}'})


# ── 13. GET /admin/audit-log ─────────────────────────────────────────

@api_admin_bp.route('/admin/audit-log', methods=['GET'])
@_admin_required
def admin_audit_log():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 30, type=int)
    action_filter = request.args.get('action', '')

    q = AuditLog.query
    if action_filter:
        q = q.filter(AuditLog.action.ilike(f'%{action_filter}%'))

    total = q.count()
    logs = q.order_by(AuditLog.created_at.desc()) \
             .offset((page - 1) * per_page) \
             .limit(per_page) \
             .all()

    return _ok({
        'logs': [log.to_dict() for log in logs],
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': (total + per_page - 1) // per_page,
    })


# ── 14. GET /admin/bookings ──────────────────────────────────────────

@api_admin_bp.route('/admin/bookings', methods=['GET'])
@_admin_required
def admin_bookings():
    status = request.args.get('status', 'all')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    q = db.session.query(Booking, TutorSlot, Student, Tutor).join(
        TutorSlot, Booking.slot_id == TutorSlot.id
    ).join(
        Student, Booking.student_id == Student.id
    ).join(
        Tutor, Booking.tutor_id == Tutor.id
    )

    if status != 'all':
        q = q.filter(TutorSlot.status == status)

    total = q.count()
    rows = q.order_by(TutorSlot.date.desc(), TutorSlot.start_time.desc()) \
             .offset((page - 1) * per_page) \
             .limit(per_page) \
             .all()

    results = []
    for booking, slot, student, tutor in rows:
        results.append({
            'id': booking.id,
            'student': {
                'id': student.id,
                'name': student.name,
            },
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
            'cancelled_by': booking.cancelled_by,
            'cancellation_reason': booking.cancellation_reason,
        })

    return _ok({
        'bookings': results,
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': (total + per_page - 1) // per_page,
    })


# ── 15a. GET /admin/settings ─────────────────────────────────────────

@api_admin_bp.route('/admin/settings', methods=['GET'])
@_admin_required
def admin_get_settings():
    settings = PlatformSetting.query.order_by(PlatformSetting.category, PlatformSetting.key).all()
    return _ok({
        'settings': [s.to_dict() for s in settings],
    })


# ── 15b. PUT /admin/settings ─────────────────────────────────────────

@api_admin_bp.route('/admin/settings', methods=['PUT'])
@_admin_required
def admin_update_settings():
    body = request.get_json(silent=True) or {}
    settings_list = body.get('settings', [])

    if not settings_list:
        return _err("No settings provided", 400)

    updated = []
    for item in settings_list:
        key = item.get('key')
        value = item.get('value')
        if not key or value is None:
            continue

        PlatformSetting.set(
            key=key,
            value=value,
            description=item.get('description'),
            category=item.get('category', 'general'),
            updated_by=current_user.name
        )
        updated.append(key)

    _log_action('update_settings', details={'keys': updated})
    db.session.commit()

    return _ok({'message': f'{len(updated)} settings updated', 'updated_keys': updated})
