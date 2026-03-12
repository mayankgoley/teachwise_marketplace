"""
Internal API Endpoints for Core Service

These endpoints are called by other microservices (search, chat, learning,
notification) to look up users, tutors, and slots. They are:
- Protected by @internal_only (requires JWT with role='internal')
- Blocked from external access by nginx (location /api/internal/)
- Short-lived responses (no caching — callers cache as needed)

Usage from other services:
    from shared.service_client import get_service_client
    client = get_service_client()
    user = client.get_user('student_5')
"""

from flask import Blueprint, jsonify, request
from database import db
from models.student import Student
from models.tutor import Tutor
from models.admin import Admin
from models.guardian import Guardian
from models.slots import TutorSlot
from models.booking import Booking
from shared.jwt_auth import internal_only, jwt_required

internal_bp = Blueprint('internal_bp', __name__, url_prefix='/api/internal')


@internal_bp.route('/user/<uid>')
@internal_only
def get_user(jwt_payload, uid):
    """
    Get basic user info by unified ID (e.g., 'student_5', 'tutor_12').
    Returns: {uid, role, name, email, photo_url}
    """
    user = _load_user(uid)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    return jsonify({
        'uid': uid,
        'role': user.user_type,
        'name': user.name,
        'email': user.email,
        'photo_url': _get_photo_url(user),
    })


@internal_bp.route('/users/batch', methods=['POST'])
@internal_only
def get_users_batch(jwt_payload):
    """
    Get multiple users by UIDs.
    Body: {"uids": ["student_5", "tutor_12", ...]}
    Returns: {"users": [{uid, role, name, email, photo_url}, ...]}
    """
    data = request.get_json(silent=True) or {}
    uids = data.get('uids', [])
    if not uids or len(uids) > 100:
        return jsonify({'error': 'Provide 1-100 UIDs'}), 400

    results = []
    for uid in uids:
        user = _load_user(uid)
        if user:
            results.append({
                'uid': uid,
                'role': user.user_type,
                'name': user.name,
                'email': user.email,
                'photo_url': _get_photo_url(user),
            })

    return jsonify({'users': results})


@internal_bp.route('/tutor/<int:tutor_id>')
@internal_only
def get_tutor(jwt_payload, tutor_id):
    """
    Get tutor profile for search/display.
    Returns: Full tutor info (name, subject, rating, location, etc.)
    """
    tutor = Tutor.query.get(tutor_id)
    if not tutor:
        return jsonify({'error': 'Tutor not found'}), 404

    return jsonify(_serialize_tutor(tutor))


@internal_bp.route('/tutors')
@internal_only
def get_tutors_batch(jwt_payload):
    """
    Get multiple tutors by IDs.
    Query: ?ids=1,2,3
    Returns: {"tutors": [{...}, ...]}
    """
    ids_str = request.args.get('ids', '')
    if not ids_str:
        return jsonify({'error': 'Provide ?ids=1,2,3'}), 400

    try:
        ids = [int(i) for i in ids_str.split(',') if i.strip()]
    except ValueError:
        return jsonify({'error': 'Invalid IDs'}), 400

    if len(ids) > 200:
        return jsonify({'error': 'Max 200 IDs'}), 400

    tutors = Tutor.query.filter(Tutor.id.in_(ids)).all()
    return jsonify({
        'tutors': [_serialize_tutor(t) for t in tutors]
    })


@internal_bp.route('/tutors/verified')
@internal_only
def get_verified_tutors(jwt_payload):
    """
    Get all verified tutors (for search service index refresh).
    Returns: {"tutors": [{...}, ...], "count": N}
    """
    tutors = Tutor.query.filter(
        Tutor.verification_status == 'verified'
    ).all()
    return jsonify({
        'tutors': [_serialize_tutor(t) for t in tutors],
        'count': len(tutors)
    })


@internal_bp.route('/slot/<int:slot_id>')
@internal_only
def get_slot(jwt_payload, slot_id):
    """
    Get slot details (for learning service — session notes, whiteboard).
    Returns: Slot info with tutor and student names.
    """
    slot = TutorSlot.query.get(slot_id)
    if not slot:
        return jsonify({'error': 'Slot not found'}), 404

    tutor = Tutor.query.get(slot.tutor_id)
    student = Student.query.get(slot.student_id) if slot.student_id else None

    return jsonify({
        'id': slot.id,
        'tutor_id': slot.tutor_id,
        'tutor_name': tutor.name if tutor else None,
        'student_id': slot.student_id,
        'student_name': student.name if student else None,
        'date': slot.date.isoformat() if slot.date else None,
        'start_time': slot.start_time.isoformat() if slot.start_time else None,
        'end_time': slot.end_time.isoformat() if slot.end_time else None,
        'status': slot.status,
        'mode': slot.mode,
        'subject': slot.subject,
        'session_link': slot.session_link,
        'jitsi_room_name': slot.jitsi_room_name,
    })


@internal_bp.route('/booking/<int:booking_id>')
@internal_only
def get_booking(jwt_payload, booking_id):
    """
    Get booking details (for notification/learning services).
    """
    booking = Booking.query.get(booking_id)
    if not booking:
        return jsonify({'error': 'Booking not found'}), 404

    return jsonify({
        'id': booking.id,
        'student_id': booking.student_id,
        'tutor_id': booking.tutor_id,
        'slot_id': booking.slot_id,
        'status': booking.status,
        'booked_on': booking.booked_on.isoformat() if booking.booked_on else None,
    })


def _load_user(uid):
    """Load user by unified ID string (e.g., 'student_5')."""
    if '_' not in uid:
        return Student.query.get(int(uid))
    role, pk = uid.split('_', 1)
    pk = int(pk)
    if role == 'student':
        return Student.query.get(pk)
    elif role == 'tutor':
        return Tutor.query.get(pk)
    elif role == 'admin':
        return Admin.query.get(pk)
    elif role == 'guardian':
        return Guardian.query.get(pk)
    return None


def _get_photo_url(user):
    """Get profile photo URL if available."""
    photo = getattr(user, 'profile_photo', None)
    if not photo:
        return None
    if photo.startswith('http') or photo.startswith('/'):
        return photo
    return f'/static/uploads/photos/{photo}'


def _serialize_tutor(tutor):
    """Serialize tutor for API response."""
    return {
        'id': tutor.id,
        'name': tutor.name,
        'email': tutor.email,
        'subject': tutor.subject,
        'subjects_additional': tutor.subjects_additional,
        'experience': tutor.experience,
        'bio': tutor.bio,
        'qualification': tutor.qualification,
        'institution': tutor.institution,
        'teaching_mode': tutor.teaching_mode,
        'hourly_rate': tutor.hourly_rate,
        'profile_photo': _get_photo_url(tutor),
        'rating_avg': tutor.rating_avg,
        'total_reviews': tutor.total_reviews,
        'total_sessions_completed': tutor.total_sessions_completed,
        'verification_status': tutor.verification_status,
        'latitude': tutor.latitude,
        'longitude': tutor.longitude,
        'city': tutor.city,
        'service_radius_km': tutor.service_radius_km,
        'created_at': tutor.created_at.isoformat() if tutor.created_at else None,
    }
