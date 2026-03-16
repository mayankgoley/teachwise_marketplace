"""
JSON API endpoints for tutor profile management.

Blueprint prefix: /api/v1
All endpoints return the standard envelope:
  {"success": True,  "data": {...}}
  {"success": False, "error": {"message": "...", "code": 400}}
"""

import uuid
from functools import wraps

from flask import Blueprint, jsonify, request, current_app
from flask_login import current_user, login_required

from database import db
from models.tutor import Tutor
from models.audit_log import AuditLog
from services.cache_service import cache_delete, cache_delete_pattern
from services.storage_service import upload_public_file, delete_public_file

api_tutor_profile_bp = Blueprint(
    'api_tutor_profile', __name__, url_prefix='/api/v1'
)


# -- Helpers ----------------------------------------------------------------

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


def _teaching_mode_from_flags(offers_online, offers_in_person):
    """Map boolean flags back to the Tutor.teaching_mode column value."""
    if offers_online and offers_in_person:
        return 'Both'
    if offers_online:
        return 'Online'
    if offers_in_person:
        return 'In-Person'
    return 'Both'  # default when neither is explicitly set


def _flags_from_teaching_mode(mode):
    """Derive offers_online / offers_in_person booleans from teaching_mode."""
    mode = (mode or 'Both').strip()
    if mode == 'Online':
        return True, False
    if mode == 'In-Person':
        return False, True
    return True, True  # 'Both' or any other value


# ===========================================================================
# 1. GET /api/v1/tutor/profile
# ===========================================================================

@api_tutor_profile_bp.route('/tutor/profile', methods=['GET'])
@_role_required('tutor')
def get_tutor_profile():
    """Return the full editable profile for the currently logged-in tutor."""

    tutor = Tutor.query.get(current_user.id)
    if not tutor:
        return _err("Tutor not found", 404)

    offers_online, offers_in_person = _flags_from_teaching_mode(
        tutor.teaching_mode
    )

    profile = {
        "id": tutor.id,
        "name": tutor.name,
        "email": tutor.email,
        "bio": tutor.bio,
        "subject": tutor.subject,
        "subjects_additional": tutor.subjects_additional or [],
        "hourly_rate": float(tutor.hourly_rate or 0),
        "experience_years": tutor.experience,
        "education": tutor.qualification,
        "teaching_mode": tutor.teaching_mode,
        "offers_online": offers_online,
        "offers_in_person": offers_in_person,
        "languages": [],
        "latitude": float(tutor.latitude) if tutor.latitude else None,
        "longitude": float(tutor.longitude) if tutor.longitude else None,
        "service_radius_km": float(tutor.service_radius_km or 25),
        "avatar_url": _photo_url(tutor.profile_photo),
        "verification_status": tutor.verification_status,
        "stripe_account_connected": bool(tutor.stripe_onboarding_complete),
        "notification_prefs": tutor.notification_prefs or {},
    }

    return _ok(profile)


# ===========================================================================
# 2. PUT /api/v1/tutor/profile
# ===========================================================================

@api_tutor_profile_bp.route('/tutor/profile', methods=['PUT'])
@_role_required('tutor')
def update_tutor_profile():
    """Update editable profile fields for the currently logged-in tutor."""

    data = request.get_json(silent=True)
    if not data:
        return _err("Request body must be JSON", 400)

    tutor = Tutor.query.get(current_user.id)
    if not tutor:
        return _err("Tutor not found", 404)

    # -- Validate incoming fields -------------------------------------------

    if 'name' in data:
        name = (data['name'] or '').strip()
        if not name:
            return _err("Name cannot be empty", 400, field="name")
        tutor.name = name

    if 'bio' in data:
        tutor.bio = (data['bio'] or '').strip() or None

    if 'subject' in data:
        tutor.subject = (data['subject'] or '').strip()

    if 'subjects_additional' in data:
        tutor.subjects_additional = data['subjects_additional']

    if 'hourly_rate' in data:
        try:
            hourly_rate = float(data['hourly_rate'])
        except (TypeError, ValueError):
            return _err("Hourly rate must be a number", 400, field="hourly_rate")
        if hourly_rate <= 0:
            return _err("Hourly rate must be greater than zero", 400,
                        field="hourly_rate")
        tutor.hourly_rate = hourly_rate

    if 'experience_years' in data:
        try:
            tutor.experience = int(data['experience_years'])
        except (TypeError, ValueError):
            tutor.experience = 0

    if 'education' in data:
        tutor.qualification = (data['education'] or '').strip() or None

    if 'languages' in data:
        # The Tutor model does not yet have a languages column.
        # Accept silently so front-end can send it without errors.
        pass

    if 'service_radius_km' in data:
        try:
            radius = int(data['service_radius_km'])
        except (TypeError, ValueError):
            return _err("Service radius must be a number", 400,
                        field="service_radius_km")
        if radius < 1 or radius > 200:
            return _err("Service radius must be between 1 and 200 km", 400,
                        field="service_radius_km")
        tutor.service_radius_km = radius

    # Derive teaching_mode from the two boolean flags when provided
    if 'offers_online' in data or 'offers_in_person' in data:
        current_online, current_in_person = _flags_from_teaching_mode(
            tutor.teaching_mode
        )
        offers_online = data.get('offers_online', current_online)
        offers_in_person = data.get('offers_in_person', current_in_person)
        tutor.teaching_mode = _teaching_mode_from_flags(
            offers_online, offers_in_person
        )

    db.session.commit()

    # -- Cache invalidation -------------------------------------------------
    try:
        cache_delete(f'tutor_profile:{current_user.id}')
        cache_delete_pattern('search:*')
    except Exception:
        pass  # Cache invalidation failures are non-critical

    # -- Audit log ----------------------------------------------------------
    audit = AuditLog(
        admin_id=current_user.id,
        admin_name=tutor.name,
        action='tutor_profile_update',
        target_type='tutor',
        target_id=tutor.id,
        details={"updated_fields": list(data.keys())},
        ip_address=request.remote_addr,
    )
    db.session.add(audit)
    db.session.commit()

    return _ok({"message": "Profile updated successfully"})


# ===========================================================================
# 3. POST /api/v1/tutor/profile/avatar
# ===========================================================================

ALLOWED_AVATAR_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp'}
MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5 MB


@api_tutor_profile_bp.route('/tutor/profile/avatar', methods=['POST'])
@_role_required('tutor')
def upload_avatar():
    """Upload or replace the tutor's profile avatar."""

    if 'avatar' not in request.files:
        return _err("No avatar file provided", 400, field="avatar")

    file = request.files['avatar']
    if not file or not file.filename:
        return _err("No avatar file provided", 400, field="avatar")

    # -- Extension check ----------------------------------------------------
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in ALLOWED_AVATAR_EXTENSIONS:
        return _err(
            f"File type not allowed. Accepted: {', '.join(sorted(ALLOWED_AVATAR_EXTENSIONS))}",
            400, field="avatar",
        )

    # -- Size check ---------------------------------------------------------
    file_data = file.read()
    if len(file_data) > MAX_AVATAR_SIZE:
        return _err("Avatar file must be 5 MB or smaller", 400, field="avatar")

    # -- MIME validation via python-magic (optional) ------------------------
    try:
        import magic
        mime = magic.from_buffer(file_data, mime=True)
        if mime not in ('image/jpeg', 'image/png', 'image/webp'):
            return _err(
                "File content does not match an allowed image type", 400,
                field="avatar",
            )
    except ImportError:
        pass  # python-magic not installed; skip content-type validation

    # -- Upload -------------------------------------------------------------
    tutor = Tutor.query.get(current_user.id)
    if not tutor:
        return _err("Tutor not found", 404)

    content_type = file.content_type or f'image/{ext}'
    upload_path = f'avatars/tutors/{tutor.id}/{uuid.uuid4().hex}.{ext}'

    url = upload_public_file(file_data, upload_path, content_type)
    if not url:
        return _err("Failed to upload avatar", 500)

    # -- Delete old avatar if it was an uploaded file -----------------------
    old_photo = tutor.profile_photo
    if old_photo and not old_photo.startswith('http'):
        # Strip leading /static/uploads/ to get the storage path
        old_path = old_photo.lstrip('/')
        if old_path.startswith('static/uploads/'):
            old_path = old_path[len('static/uploads/'):]
        try:
            delete_public_file(old_path)
        except Exception:
            pass  # Failing to delete the old file is non-critical

    tutor.profile_photo = url
    db.session.commit()

    return _ok({"avatar_url": url})


# ===========================================================================
# 4. PUT /api/v1/tutor/profile/location
# ===========================================================================

@api_tutor_profile_bp.route('/tutor/profile/location', methods=['PUT'])
@_role_required('tutor')
def update_location():
    """Update the tutor's geographic location."""

    data = request.get_json(silent=True)
    if not data:
        return _err("Request body must be JSON", 400)

    tutor = Tutor.query.get(current_user.id)
    if not tutor:
        return _err("Tutor not found", 404)

    if 'latitude' in data:
        try:
            tutor.latitude = float(data['latitude'])
        except (TypeError, ValueError):
            return _err("Latitude must be a number", 400, field="latitude")

    if 'longitude' in data:
        try:
            tutor.longitude = float(data['longitude'])
        except (TypeError, ValueError):
            return _err("Longitude must be a number", 400, field="longitude")

    if 'address' in data:
        tutor.address = (data['address'] or '').strip() or None

    db.session.commit()

    # -- Cache invalidation -------------------------------------------------
    try:
        cache_delete(f'tutor_profile:{current_user.id}')
        cache_delete_pattern('search:*')
    except Exception:
        pass

    return _ok({"message": "Location updated successfully"})


# ===========================================================================
# 5. PUT /api/v1/tutor/profile/notifications
# ===========================================================================

@api_tutor_profile_bp.route('/tutor/profile/notifications', methods=['PUT'])
@_role_required('tutor')
def update_notification_prefs():
    """Update the tutor's notification preferences (merge with existing)."""

    data = request.get_json(silent=True)
    if not data:
        return _err("Request body must be JSON", 400)

    tutor = Tutor.query.get(current_user.id)
    if not tutor:
        return _err("Tutor not found", 404)

    # Merge incoming keys into existing prefs
    existing = tutor.notification_prefs or {}
    existing.update(data)
    tutor.notification_prefs = existing

    db.session.commit()

    return _ok({"message": "Notification preferences updated successfully"})
