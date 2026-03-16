"""
JSON API endpoints for student features (wallet, notifications, bookings, reviews).

Blueprint prefix: /api/v1
All endpoints return the standard envelope:
  {"success": True,  "data": {...}}
  {"success": False, "error": {"message": "...", "code": 400}}
"""

from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from functools import wraps

from flask import Blueprint, jsonify, request, current_app
from flask_login import current_user, login_required
from sqlalchemy import func

from database import db

api_student_features_bp = Blueprint(
    'api_student_features', __name__, url_prefix='/api/v1'
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
    """Decorator that wraps @login_required and checks current_user.user_type."""
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


def _get_or_create_wallet(student_id):
    """Get existing wallet or create a new one for the student."""
    from models.wallet import Wallet

    wallet = Wallet.query.filter_by(student_id=student_id).first()
    if not wallet:
        wallet = Wallet(student_id=student_id, balance=Decimal('0.00'))
        db.session.add(wallet)
        db.session.commit()
    return wallet


def _pagination_meta(paginated):
    """Build a standard pagination meta dict from a Flask-SQLAlchemy pagination object."""
    return {
        "page": paginated.page,
        "per_page": paginated.per_page,
        "total": paginated.total,
        "pages": paginated.pages,
        "has_next": paginated.has_next,
        "has_prev": paginated.has_prev,
    }


# ═══════════════════════════════════════════════════════════════════════
# 1. GET /api/v1/student/wallet
# ═══════════════════════════════════════════════════════════════════════

@api_student_features_bp.route('/student/wallet', methods=['GET'])
@_role_required('student')
def student_wallet():
    from models.wallet_transaction import WalletTransaction

    page = request.args.get('page', 1, type=int)

    wallet = _get_or_create_wallet(current_user.id)

    txn_query = WalletTransaction.query.filter_by(
        wallet_id=wallet.id
    ).order_by(WalletTransaction.created_at.desc())

    paginated = txn_query.paginate(page=page, per_page=20, error_out=False)

    transactions = []
    for txn in paginated.items:
        transactions.append({
            "id": txn.id,
            "amount": float(txn.amount),
            "type": txn.type,
            "description": txn.description,
            "reference_id": txn.reference_id,
            "balance_after": float(txn.balance_after),
            "created_at": txn.created_at.isoformat() if txn.created_at else None,
        })

    return _ok({
        "balance": float(wallet.balance),
        "currency": wallet.currency,
        "transactions": transactions,
        "meta": _pagination_meta(paginated),
    })


# ═══════════════════════════════════════════════════════════════════════
# 2. POST /api/v1/student/wallet/topup
# ═══════════════════════════════════════════════════════════════════════

@api_student_features_bp.route('/student/wallet/topup', methods=['POST'])
@_role_required('student')
def student_wallet_topup():
    body = request.get_json(silent=True)
    if not body:
        return _err("Request body must be JSON", 400)

    raw_amount = body.get('amount')
    if raw_amount is None:
        return _err("amount is required", 400, field="amount")

    try:
        amount = float(raw_amount)
    except (TypeError, ValueError):
        return _err("amount must be a number", 400, field="amount")

    if amount < 5.0 or amount > 500.0:
        return _err("amount must be between 5.00 and 500.00", 400, field="amount")

    try:
        import stripe
    except ImportError:
        return _err("Payment service is not configured", 503)

    if not current_app.config.get('STRIPE_SECRET_KEY'):
        return _err("Payment service is not configured", 503)

    try:
        amount_cents = int(round(amount * 100))

        success_url = current_app.config.get(
            'FRONTEND_URL',
            current_app.config.get('APP_URL', request.host_url.rstrip('/'))
        ) + '/student/wallet?topup=success'
        cancel_url = current_app.config.get(
            'FRONTEND_URL',
            current_app.config.get('APP_URL', request.host_url.rstrip('/'))
        ) + '/student/wallet?topup=cancelled'

        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'unit_amount': amount_cents,
                    'product_data': {
                        'name': 'Wallet Top-Up',
                        'description': f'Add ${amount:.2f} to your TeachWise wallet',
                    },
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=success_url,
            cancel_url=cancel_url,
            customer_email=current_user.email,
            metadata={
                'type': 'wallet_topup',
                'student_id': str(current_user.id),
                'amount': str(amount),
            },
        )

        return _ok({"checkout_url": session.url})

    except Exception as e:
        current_app.logger.error(f'Wallet topup Stripe error: {e}')
        return _err("Payment service unavailable. Please try later.", 503)


# ═══════════════════════════════════════════════════════════════════════
# 3. GET /api/v1/student/notifications
# ═══════════════════════════════════════════════════════════════════════

@api_student_features_bp.route('/student/notifications', methods=['GET'])
@_role_required('student')
def student_notifications():
    from models.in_app_notification import InAppNotification

    page = request.args.get('page', 1, type=int)
    unread_only = request.args.get('unread_only', 'false').lower() in ('true', '1', 'yes')

    query = InAppNotification.query.filter_by(
        user_id=current_user.id, user_type='student'
    )

    if unread_only:
        query = query.filter(InAppNotification.is_read == False)  # noqa: E712

    query = query.order_by(InAppNotification.created_at.desc())
    paginated = query.paginate(page=page, per_page=20, error_out=False)

    # Total unread count (regardless of current page / filter)
    unread_count = InAppNotification.query.filter_by(
        user_id=current_user.id, user_type='student', is_read=False
    ).count()

    return _ok({
        "notifications": [n.to_dict() for n in paginated.items],
        "unread_count": unread_count,
        "meta": _pagination_meta(paginated),
    })


# ═══════════════════════════════════════════════════════════════════════
# 4. POST /api/v1/student/notifications/<id>/read
# ═══════════════════════════════════════════════════════════════════════

@api_student_features_bp.route(
    '/student/notifications/<int:notification_id>/read', methods=['POST']
)
@_role_required('student')
def mark_notification_read(notification_id):
    from models.in_app_notification import InAppNotification

    notification = InAppNotification.query.get(notification_id)
    if not notification:
        return _err("Notification not found", 404)

    if notification.user_id != current_user.id or notification.user_type != 'student':
        return _err("Access denied", 403)

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.utcnow()
        db.session.commit()

    return _ok({"notification_id": notification.id, "is_read": True})


# ═══════════════════════════════════════════════════════════════════════
# 5. POST /api/v1/student/notifications/read-all
# ═══════════════════════════════════════════════════════════════════════

@api_student_features_bp.route('/student/notifications/read-all', methods=['POST'])
@_role_required('student')
def mark_all_notifications_read():
    from models.in_app_notification import InAppNotification

    now = datetime.utcnow()
    marked_count = InAppNotification.query.filter_by(
        user_id=current_user.id, user_type='student', is_read=False
    ).update({
        InAppNotification.is_read: True,
        InAppNotification.read_at: now,
    })
    db.session.commit()

    return _ok({"marked_count": marked_count})


# ═══════════════════════════════════════════════════════════════════════
# 6. GET /api/v1/student/bookings
# ═══════════════════════════════════════════════════════════════════════

@api_student_features_bp.route('/student/bookings', methods=['GET'])
@_role_required('student')
def student_bookings():
    from models.booking import Booking
    from models.slots import TutorSlot
    from models.tutor import Tutor
    from models.review import Review

    status_filter = request.args.get('status', '').strip()
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    per_page = min(max(per_page, 1), 50)  # clamp between 1 and 50

    query = (
        db.session.query(Booking, TutorSlot, Tutor)
        .join(TutorSlot, Booking.slot_id == TutorSlot.id)
        .join(Tutor, Booking.tutor_id == Tutor.id)
        .filter(Booking.student_id == current_user.id)
    )

    if status_filter:
        query = query.filter(func.lower(Booking.status) == status_filter.lower())

    query = query.order_by(TutorSlot.date.desc(), TutorSlot.start_time.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    # Pre-fetch reviewed booking IDs for this student to avoid N+1
    reviewed_booking_ids = set(
        r.booking_id for r in Review.query.filter_by(
            student_id=current_user.id
        ).with_entities(Review.booking_id).all()
        if r.booking_id
    )

    now = datetime.utcnow()
    bookings = []
    for booking, slot, tutor in paginated.items:
        # Determine can_cancel
        can_cancel = booking.status in ('Booked', 'Confirmed')

        # Determine can_reschedule
        can_reschedule = False
        if booking.status in ('Booked', 'Confirmed'):
            session_start = datetime.combine(slot.date, slot.start_time)
            if session_start > now + timedelta(hours=6):
                can_reschedule = True

        # Determine can_review
        can_review = (
            slot.status == 'completed'
            and booking.id not in reviewed_booking_ids
        )

        bookings.append({
            "id": booking.id,
            "tutor_name": tutor.name,
            "tutor_avatar_url": _photo_url(tutor.profile_photo),
            "subject": slot.subject or tutor.subject,
            "date": slot.date.isoformat(),
            "start_time": slot.start_time.strftime("%H:%M"),
            "end_time": slot.end_time.strftime("%H:%M"),
            "mode": slot.mode,
            "status": booking.status,
            "amount": float(slot.price or 0),
            "jitsi_room_name": slot.jitsi_room_name,
            "can_reschedule": can_reschedule,
            "can_cancel": can_cancel,
            "can_review": can_review,
            "guardian_approved": booking.guardian_approved,
        })

    return _ok({
        "bookings": bookings,
        "meta": _pagination_meta(paginated),
    })


# ═══════════════════════════════════════════════════════════════════════
# 7. POST /api/v1/bookings/create
# ═══════════════════════════════════════════════════════════════════════

@api_student_features_bp.route('/bookings/create', methods=['POST'])
@_role_required('student')
def create_booking():
    from models.slots import TutorSlot
    from models.tutor import Tutor
    from models.guardian import Guardian
    from services.booking_service import create_booking as do_create_booking
    from services.payment_service import create_checkout_session

    body = request.get_json(silent=True)
    if not body:
        return _err("Request body must be JSON", 400)

    slot_id = body.get('slot_id')
    if not slot_id:
        return _err("slot_id is required", 400, field="slot_id")

    try:
        slot_id = int(slot_id)
    except (TypeError, ValueError):
        return _err("slot_id must be an integer", 400, field="slot_id")

    slot = TutorSlot.query.get(slot_id)
    if not slot:
        return _err("Slot not found", 404)

    tutor = Tutor.query.get(slot.tutor_id)
    if not tutor:
        return _err("Tutor not found", 404)

    # Check guardian approval requirement
    requires_guardian_approval = (
        current_user.is_minor or current_user.guardian_id is not None
    )
    guardian = None
    if current_user.guardian_id:
        guardian = Guardian.query.get(current_user.guardian_id)

    # Create booking via service
    booking, error = do_create_booking(
        student_id=current_user.id,
        tutor_id=tutor.id,
        slot_id=slot_id,
        student_name=current_user.name,
        student_email=current_user.email,
        is_minor=current_user.is_minor,
        guardian=guardian,
    )

    if error:
        return _err(error, 400)

    # Create Stripe checkout session
    checkout_url = None
    try:
        checkout_url = create_checkout_session(booking, slot, current_user, tutor)
    except Exception as e:
        current_app.logger.error(f'Checkout session error for booking {booking.id}: {e}')
        # Booking was created but payment session failed; return booking info
        # so the frontend can retry payment later.

    return _ok({
        "booking_id": booking.id,
        "checkout_url": checkout_url,
        "requires_guardian_approval": requires_guardian_approval,
    }, 201)


# ═══════════════════════════════════════════════════════════════════════
# 8. POST /api/v1/bookings/<booking_id>/cancel
# ═══════════════════════════════════════════════════════════════════════

@api_student_features_bp.route('/bookings/<int:booking_id>/cancel', methods=['POST'])
@_role_required('student')
def cancel_booking(booking_id):
    from models.booking import Booking
    from models.slots import TutorSlot
    from services.booking_service import cancel_booking as do_cancel_booking

    booking = Booking.query.get(booking_id)
    if not booking:
        return _err("Booking not found", 404)

    if booking.student_id != current_user.id:
        return _err("Access denied", 403)

    if booking.status not in ('Booked', 'Confirmed'):
        return _err("This booking cannot be cancelled", 400)

    slot = TutorSlot.query.get(booking.slot_id)
    if not slot:
        return _err("Associated slot not found", 404)

    # Accept optional cancellation reason from body
    body = request.get_json(silent=True)
    if body and body.get('reason'):
        booking.cancellation_reason = str(body['reason'])[:255]
        db.session.add(booking)
        db.session.flush()

    try:
        result = do_cancel_booking(booking, 'student', slot=slot)
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Cancel booking error: {e}')
        return _err("Failed to cancel booking", 500)

    refund_pct = result.get('refund_pct', 0)
    refund_amount = float(slot.price or 0) * refund_pct / 100

    if refund_pct == 100:
        message = f"Booking cancelled. Full refund: ${refund_amount:.2f}."
    elif refund_pct == 50:
        message = f"Booking cancelled. 50% refund: ${refund_amount:.2f}."
    else:
        message = "Booking cancelled. No refund (less than 12 hours before session)."

    return _ok({
        "booking_id": booking.id,
        "refund_amount": round(refund_amount, 2),
        "refund_pct": refund_pct,
        "message": message,
    })


# ═══════════════════════════════════════════════════════════════════════
# 9. POST /api/v1/bookings/<booking_id>/review
# ═══════════════════════════════════════════════════════════════════════

@api_student_features_bp.route('/bookings/<int:booking_id>/review', methods=['POST'])
@_role_required('student')
def submit_review(booking_id):
    from models.booking import Booking
    from models.slots import TutorSlot
    from models.tutor import Tutor
    from models.review import Review
    from services.cache_service import cache_delete

    booking = Booking.query.get(booking_id)
    if not booking:
        return _err("Booking not found", 404)

    if booking.student_id != current_user.id:
        return _err("Access denied", 403)

    slot = TutorSlot.query.get(booking.slot_id)
    if not slot:
        return _err("Associated slot not found", 404)

    if slot.status != 'completed':
        return _err("You can only review completed sessions", 400)

    existing = Review.query.filter_by(
        student_id=current_user.id, booking_id=booking_id
    ).first()
    if existing:
        return _err("You have already reviewed this session", 400)

    # Parse and validate request body
    body = request.get_json(silent=True)
    if not body:
        return _err("Request body must be JSON", 400)

    rating = body.get('rating')
    comment = body.get('comment', '')
    rating_knowledge = body.get('rating_knowledge')
    rating_communication = body.get('rating_communication')
    rating_punctuality = body.get('rating_punctuality')
    rating_value = body.get('rating_value')

    # Validate overall rating
    if rating is None:
        return _err("rating is required", 400, field="rating")
    try:
        rating = int(rating)
    except (TypeError, ValueError):
        return _err("rating must be an integer", 400, field="rating")
    if rating < 1 or rating > 5:
        return _err("rating must be between 1 and 5", 400, field="rating")

    # Validate dimension ratings
    dimension_fields = {
        'rating_knowledge': rating_knowledge,
        'rating_communication': rating_communication,
        'rating_punctuality': rating_punctuality,
        'rating_value': rating_value,
    }
    validated_dims = {}
    for field_name, val in dimension_fields.items():
        if val is not None:
            try:
                val = int(val)
            except (TypeError, ValueError):
                return _err(f"{field_name} must be an integer", 400, field=field_name)
            if val < 1 or val > 5:
                return _err(f"{field_name} must be between 1 and 5", 400, field=field_name)
            validated_dims[field_name] = val
        else:
            validated_dims[field_name] = None

    # Validate comment
    if comment:
        comment = str(comment).strip()
        if len(comment) > 1000:
            return _err("comment must be 1000 characters or fewer", 400, field="comment")

    # Create the review
    review = Review(
        student_id=current_user.id,
        tutor_id=booking.tutor_id,
        booking_id=booking_id,
        rating=rating,
        rating_knowledge=validated_dims['rating_knowledge'],
        rating_communication=validated_dims['rating_communication'],
        rating_punctuality=validated_dims['rating_punctuality'],
        rating_value=validated_dims['rating_value'],
        comment=comment or None,
        is_verified=True,
    )
    db.session.add(review)
    db.session.flush()

    # Recalculate tutor rating_avg and total_reviews
    tutor = Tutor.query.get(booking.tutor_id)
    if tutor:
        stats = db.session.query(
            func.avg(Review.rating).label('avg_rating'),
            func.count(Review.id).label('total'),
        ).filter(Review.tutor_id == tutor.id).first()

        tutor.rating_avg = round(float(stats.avg_rating or 0), 2)
        tutor.total_reviews = stats.total or 0

    db.session.commit()

    # Invalidate caches
    try:
        cache_delete(f'tutor_profile:{booking.tutor_id}')
        cache_delete(f'dashboard:tutor:{booking.tutor_id}')
    except Exception:
        pass  # Cache invalidation failure is not critical

    return _ok({"review_id": review.id}, 201)


# ═══════════════════════════════════════════════════════════════════════
# 10. GET/PUT /api/v1/student/profile
# ═══════════════════════════════════════════════════════════════════════

@api_student_features_bp.route('/student/profile', methods=['GET', 'PUT'])
@_role_required('student')
def student_profile():
    from models.student import Student

    student = Student.query.get(current_user.id)
    if not student:
        return _err("Student not found", 404)

    if request.method == 'GET':
        return _ok({
            "id": student.id,
            "name": student.name,
            "email": student.email,
            "bio": student.bio,
            "grade_level": student.grade_level,
            "avatar_url": _photo_url(getattr(student, 'profile_photo', None)),
            "is_verified": student.email_verified,
            "notification_prefs": student.notification_prefs or {},
        })

    data = request.get_json(silent=True)
    if not data:
        return _err("Request body must be JSON", 400)

    if 'name' in data:
        name = str(data['name']).strip()
        if not name:
            return _err("Name cannot be empty", 400, field="name")
        student.name = name
    if 'bio' in data:
        student.bio = str(data['bio']).strip()[:500] if data['bio'] else None
    if 'grade_level' in data:
        student.grade_level = str(data['grade_level']).strip() if data['grade_level'] else None

    db.session.commit()
    return _ok({"message": "Profile updated"})


# ═══════════════════════════════════════════════════════════════════════
# 11. PUT /api/v1/student/profile/notifications
# ═══════════════════════════════════════════════════════════════════════

@api_student_features_bp.route('/student/profile/notifications', methods=['PUT'])
@_role_required('student')
def update_student_notification_prefs():
    from models.student import Student

    student = Student.query.get(current_user.id)
    if not student:
        return _err("Student not found", 404)

    data = request.get_json(silent=True)
    if not data:
        return _err("Request body must be JSON", 400)

    student.notification_prefs = data
    db.session.commit()
    return _ok({"message": "Preferences updated"})
