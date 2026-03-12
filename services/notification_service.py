from datetime import datetime, timedelta
from database import db
from models.booking import Booking
from models.slots import TutorSlot
from models.tutor_document import TutorDocument
from models.review import Review
from models.tutor import Tutor
from models.student import Student


def _get_event_notifications(user_id, user_type, limit=15):
    try:
        from models.in_app_notification import InAppNotification
        records = (
            InAppNotification.query
            .filter_by(user_id=user_id, user_type=user_type)
            .order_by(InAppNotification.created_at.desc())
            .limit(limit)
            .all()
        )
        return [{
            'id': f'event-{r.id}',
            'type': r.type,
            'icon': r.icon or 'fa-bell',
            'color': r.color or 'blue',
            'title': r.title,
            'message': r.message or '',
            'url': r.url or '',
            'is_read': r.is_read,
            'timestamp': r.created_at.isoformat(),
        } for r in records]
    except Exception:
        return []


def get_student_notifications(student):
    notifs = []
    now = datetime.utcnow()

    cutoff_48h = now + timedelta(hours=48)
    upcoming_slots = (
        TutorSlot.query
        .filter(TutorSlot.student_id == student.id)
        .filter(TutorSlot.status.in_(['booked', 'Booked']))
        .filter(TutorSlot.date >= now.date())
        .all()
    )

    tutor_ids = set()
    for slot in upcoming_slots:
        tutor_ids.add(slot.tutor_id)

    week_ago = now - timedelta(days=7)
    recent_bookings = (
        Booking.query
        .filter(Booking.student_id == student.id)
        .filter(Booking.booked_on >= week_ago)
        .order_by(Booking.booked_on.desc())
        .limit(10)
        .all()
    )
    for booking in recent_bookings:
        tutor_ids.add(booking.tutor_id)

    tutor_map = {}
    if tutor_ids:
        tutors = Tutor.query.filter(Tutor.id.in_(list(tutor_ids))).all()
        tutor_map = {t.id: t for t in tutors}

    for slot in upcoming_slots:
        slot_dt = datetime.combine(slot.date, slot.start_time)
        if now <= slot_dt <= cutoff_48h:
            tutor = tutor_map.get(slot.tutor_id)
            tutor_name = tutor.name if tutor else 'your tutor'
            notifs.append({
                'id': f'session-{slot.id}',
                'type': 'upcoming_session',
                'icon': 'fa-calendar-check',
                'color': 'blue',
                'title': 'Upcoming Session',
                'message': f'Session with {tutor_name} on {slot.date.strftime("%b %d")} at {slot.start_time.strftime("%I:%M %p")}',
                'url': f'/student/dashboard',
                'timestamp': slot_dt.isoformat()
            })

    for booking in recent_bookings:
        tutor = tutor_map.get(booking.tutor_id)
        tutor_name = tutor.name if tutor else 'a tutor'
        notifs.append({
            'id': f'booking-{booking.id}',
            'type': 'booking_confirmed',
            'icon': 'fa-check-circle',
            'color': 'green',
            'title': 'Booking Confirmed',
            'message': f'Your session with {tutor_name} has been booked',
            'url': f'/student/dashboard',
            'timestamp': booking.booked_on.isoformat()
        })

    if student.is_minor and not student.guardian_verified:
        notifs.append({
            'id': 'guardian-verify',
            'type': 'guardian_required',
            'icon': 'fa-shield-alt',
            'color': 'orange',
            'title': 'Guardian Verification Needed',
            'message': 'A verified guardian is required to book sessions',
            'url': f'/student/dashboard',
            'timestamp': now.isoformat()
        })

    event_notifs = _get_event_notifications(student.id, 'student')
    notifs.extend(event_notifs)

    notifs.sort(key=lambda n: n.get('timestamp', ''), reverse=True)
    return notifs


def get_tutor_notifications(tutor_id):
    notifs = []
    now = datetime.utcnow()
    tutor = Tutor.query.get(tutor_id)
    if not tutor:
        return notifs

    if tutor.verification_status == 'pending_documents':
        notifs.append({
            'id': 'verify-docs',
            'type': 'action_required',
            'icon': 'fa-upload',
            'color': 'orange',
            'title': 'Documents Required',
            'message': 'Upload your verification documents to start tutoring',
            'url': '/tutor/documents',
            'timestamp': now.isoformat()
        })
    elif tutor.verification_status == 'documents_submitted':
        notifs.append({
            'id': 'verify-pending',
            'type': 'info',
            'icon': 'fa-hourglass-half',
            'color': 'blue',
            'title': 'Review In Progress',
            'message': 'Your documents are being reviewed by our team',
            'url': '/tutor/documents',
            'timestamp': now.isoformat()
        })
    elif tutor.verification_status == 'under_review':
        notifs.append({
            'id': 'verify-review',
            'type': 'info',
            'icon': 'fa-search',
            'color': 'blue',
            'title': 'Under Review',
            'message': 'Your profile is currently under admin review',
            'url': '/tutor/documents',
            'timestamp': now.isoformat()
        })
    elif tutor.verification_status == 'rejected':
        notifs.append({
            'id': 'verify-rejected',
            'type': 'alert',
            'icon': 'fa-times-circle',
            'color': 'red',
            'title': 'Verification Rejected',
            'message': tutor.admin_feedback or 'Your verification was not approved',
            'url': '/tutor/documents',
            'timestamp': now.isoformat()
        })
    elif tutor.verification_status == 'revision_required':
        notifs.append({
            'id': 'verify-revision',
            'type': 'action_required',
            'icon': 'fa-exclamation-triangle',
            'color': 'orange',
            'title': 'Revision Required',
            'message': tutor.admin_feedback or 'Please update your documents',
            'url': '/tutor/documents',
            'timestamp': now.isoformat()
        })
    elif tutor.verification_status == 'verified':
        notifs.append({
            'id': 'verify-ok',
            'type': 'success',
            'icon': 'fa-check-circle',
            'color': 'green',
            'title': 'Verified',
            'message': 'Your profile is verified and visible to students',
            'url': '/tutor/dashboard',
            'timestamp': (tutor.verified_on or tutor.created_at).isoformat()
        })

    rejected_docs = (
        TutorDocument.query
        .filter_by(tutor_id=tutor_id, status='rejected')
        .order_by(TutorDocument.reviewed_on.desc())
        .limit(5)
        .all()
    )
    for doc in rejected_docs:
        notifs.append({
            'id': f'doc-rej-{doc.id}',
            'type': 'alert',
            'icon': 'fa-file-excel',
            'color': 'red',
            'title': f'{doc.document_type.replace("_", " ").title()} Rejected',
            'message': doc.admin_notes or 'Please re-upload this document',
            'url': '/tutor/documents',
            'timestamp': (doc.reviewed_on or doc.uploaded_at).isoformat()
        })

    week_ago = now - timedelta(days=7)
    recent_bookings = (
        Booking.query
        .filter(Booking.tutor_id == tutor_id)
        .filter(Booking.booked_on >= week_ago)
        .order_by(Booking.booked_on.desc())
        .limit(10)
        .all()
    )

    cutoff_48h = now + timedelta(hours=48)
    upcoming_slots = (
        TutorSlot.query
        .filter(TutorSlot.tutor_id == tutor_id)
        .filter(TutorSlot.status.in_(['booked', 'Booked']))
        .filter(TutorSlot.date >= now.date())
        .all()
    )

    student_ids = set()
    for booking in recent_bookings:
        student_ids.add(booking.student_id)
    for slot in upcoming_slots:
        if slot.student_id:
            student_ids.add(slot.student_id)

    student_map = {}
    if student_ids:
        students = Student.query.filter(Student.id.in_(list(student_ids))).all()
        student_map = {s.id: s for s in students}

    for booking in recent_bookings:
        student = student_map.get(booking.student_id)
        student_name = student.name if student else 'A student'
        notifs.append({
            'id': f'booking-{booking.id}',
            'type': 'new_booking',
            'icon': 'fa-calendar-plus',
            'color': 'green',
            'title': 'New Booking',
            'message': f'{student_name} booked a session with you',
            'url': '/tutor/dashboard',
            'timestamp': booking.booked_on.isoformat()
        })

    month_ago = now - timedelta(days=30)
    recent_reviews = (
        Review.query
        .filter(Review.tutor_id == tutor_id)
        .filter(Review.created_at >= month_ago)
        .order_by(Review.created_at.desc())
        .limit(10)
        .all()
    )
    for review in recent_reviews:
        stars = review.rating
        notifs.append({
            'id': f'review-{review.id}',
            'type': 'new_review',
            'icon': 'fa-star',
            'color': 'yellow',
            'title': f'New {stars}-Star Review',
            'message': review.comment[:80] + '...' if review.comment and len(review.comment) > 80 else (review.comment or 'No comment'),
            'url': f'/tutor/{tutor_id}',
            'timestamp': review.created_at.isoformat()
        })

    for slot in upcoming_slots:
        slot_dt = datetime.combine(slot.date, slot.start_time)
        if now <= slot_dt <= cutoff_48h:
            student = student_map.get(slot.student_id) if slot.student_id else None
            student_name = student.name if student else 'a student'
            notifs.append({
                'id': f'session-{slot.id}',
                'type': 'upcoming_session',
                'icon': 'fa-calendar-check',
                'color': 'blue',
                'title': 'Upcoming Session',
                'message': f'Session with {student_name} on {slot.date.strftime("%b %d")} at {slot.start_time.strftime("%I:%M %p")}',
                'url': '/tutor/dashboard',
                'timestamp': slot_dt.isoformat()
            })

    event_notifs = _get_event_notifications(tutor_id, 'tutor')
    notifs.extend(event_notifs)

    notifs.sort(key=lambda n: n.get('timestamp', ''), reverse=True)
    return notifs


def get_admin_notifications():
    notifs = []
    now = datetime.utcnow()

    pending_docs_count = TutorDocument.query.filter_by(status='pending').count()
    if pending_docs_count > 0:
        notifs.append({
            'id': 'admin-pending-docs',
            'type': 'action_required',
            'icon': 'fa-file-alt',
            'color': 'orange',
            'title': 'Pending Documents',
            'message': f'{pending_docs_count} document{"s" if pending_docs_count != 1 else ""} awaiting review',
            'url': '/admin/documents',
            'timestamp': now.isoformat()
        })

    week_ago = now - timedelta(days=7)
    new_tutor_count = (
        Tutor.query
        .filter(Tutor.created_at >= week_ago)
        .count()
    )
    if new_tutor_count:
        notifs.append({
            'id': 'admin-new-tutors',
            'type': 'info',
            'icon': 'fa-user-plus',
            'color': 'blue',
            'title': 'New Registrations',
            'message': f'{new_tutor_count} new tutor{"s" if new_tutor_count != 1 else ""} registered this week',
            'url': '/admin/dashboard',
            'timestamp': now.isoformat()
        })

    awaiting = Tutor.query.filter(
        Tutor.verification_status.in_(['documents_submitted', 'under_review'])
    ).count()
    if awaiting > 0:
        notifs.append({
            'id': 'admin-awaiting-verify',
            'type': 'action_required',
            'icon': 'fa-user-clock',
            'color': 'orange',
            'title': 'Awaiting Verification',
            'message': f'{awaiting} tutor{"s" if awaiting != 1 else ""} waiting for verification',
            'url': '/admin/dashboard',
            'timestamp': now.isoformat()
        })

    event_notifs = _get_event_notifications(0, 'admin')
    notifs.extend(event_notifs)

    notifs.sort(key=lambda n: n.get('timestamp', ''), reverse=True)
    return notifs
