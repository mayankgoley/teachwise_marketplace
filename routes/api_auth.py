"""
JSON API endpoints for Next.js frontend auth flows.

Blueprint prefix: /api/v1
All endpoints return the standard envelope:
  {"success": True,  "data": {...}}
  {"success": False, "error": {"message": "...", "code": 400, "field": "email"}}
"""

from flask import Blueprint, request, jsonify, current_app
from flask_login import login_user, logout_user, current_user, login_required
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, date
from database import db

api_auth_bp = Blueprint('api_auth', __name__, url_prefix='/api/v1')


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


def _photo_url(photo_value):
    if not photo_value:
        return None
    if photo_value.startswith("http") or photo_value.startswith("/"):
        return photo_value
    return f"/static/uploads/photos/{photo_value}"


def _user_payload(user):
    """Build the standard user dict for /auth/me and login responses."""
    data = {
        "id": user.id,
        "user_type": user.user_type,
        "name": user.name,
        "email": user.email,
        "avatar_url": _photo_url(getattr(user, "profile_photo", None)),
        "is_verified": True,
    }
    if user.user_type == "student":
        data["is_verified"] = getattr(user, "email_verified", True)
        data["requires_guardian_approval"] = user.is_minor and not user.guardian_verified
        data["guardian_id"] = user.guardian_id
    elif user.user_type == "tutor":
        data["verification_status"] = getattr(user, "verification_status", "pending_documents")
        data["is_verified"] = user.is_verified
    elif user.user_type == "guardian":
        data["is_verified"] = getattr(user, "is_verified", False)
    elif user.user_type == "admin":
        data["is_verified"] = True
        data["role"] = getattr(user, "role", "admin")
    return data


def _lockout_check(user):
    """Returns (is_locked, minutes_remaining). Uses existing auth utils."""
    from utils.auth import is_account_locked, LOCKOUT_DURATION_MINUTES
    if is_account_locked(user):
        if user.locked_until:
            remaining = max(1, int((user.locked_until - datetime.utcnow()).total_seconds() / 60))
        else:
            remaining = LOCKOUT_DURATION_MINUTES
        return True, remaining
    return False, 0


def _validate_password_strength(password):
    from utils.validators import validate_password_complexity, get_password_error_message
    if not validate_password_complexity(password):
        return False, get_password_error_message(password)
    return True, None


def _validate_email(email_str):
    from utils.validators import validate_email_format
    return validate_email_format(email_str)


def _check_duplicate_email(email):
    """Check email across Student, Tutor, Guardian tables."""
    from models.student import Student
    from models.tutor import Tutor
    from models.guardian import Guardian
    if Student.query.filter_by(email=email).first():
        return True
    if Tutor.query.filter_by(email=email).first():
        return True
    if Guardian.query.filter_by(email=email).first():
        return True
    return False


# ── GET /api/v1/auth/me ─────────────────────────────────────────────

@api_auth_bp.route('/auth/me', methods=['GET'])
def auth_me():
    if not current_user.is_authenticated:
        return _err("Unauthorized", 401)

    # Try Redis cache first
    cache_key = f"auth_me:{current_user.user_type}_{current_user.id}"
    r = _get_cache()
    if r:
        try:
            import json
            cached = r.get(cache_key)
            if cached:
                return jsonify({"success": True, "data": json.loads(cached)}), 200
        except Exception:
            pass

    data = _user_payload(current_user)

    # Cache for 60s
    if r:
        try:
            import json
            r.setex(cache_key, 60, json.dumps(data))
        except Exception:
            pass

    return _ok(data)


# ── POST /api/v1/auth/logout ────────────────────────────────────────

@api_auth_bp.route('/auth/logout', methods=['POST'])
def auth_logout():
    if current_user.is_authenticated:
        user_type = current_user.user_type
        user_id = current_user.id
        cache_key = f"auth_me:{user_type}_{user_id}"

        logout_user()

        # Invalidate cache
        r = _get_cache()
        if r:
            try:
                r.delete(cache_key)
            except Exception:
                pass

    return _ok({"message": "Logged out successfully"})


# ── Login helpers ────────────────────────────────────────────────────

def _do_login(model_class, user_type, skip_email_verify=False):
    """Generic login handler for all roles."""
    from utils.auth import increment_failed_login, reset_failed_login

    body = request.get_json(silent=True)
    if not body:
        return _err("Request body must be JSON", 400)

    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not email or not password:
        return _err("Email and password are required", 400)

    # Guardian stores password in password_hash column
    is_guardian = (user_type == "guardian")

    user = model_class.query.filter_by(email=email).first()

    # Check lockout
    if user:
        locked, minutes = _lockout_check(user)
        if locked:
            return _err(
                f"Account locked. Try again in {minutes} minutes", 423
            )

    # Verify credentials
    pw_field = user.password_hash if (is_guardian and user) else (user.password if user else None)
    if not user or not pw_field or not check_password_hash(pw_field, password):
        if user:
            increment_failed_login(user)
        return _err("Invalid email or password", 401)

    # Email verification check (skip for admin)
    if not skip_email_verify:
        if user_type == "student" and not getattr(user, "email_verified", True):
            return _err(
                "Please verify your email before logging in", 403, field="email"
            )
        if user_type == "guardian" and not getattr(user, "is_verified", False):
            return _err(
                "Please verify your email before logging in", 403, field="email"
            )

    # Success
    reset_failed_login(user)
    login_user(user, remember=True)

    data = _user_payload(user)

    # Cache the user payload
    r = _get_cache()
    if r:
        try:
            import json
            r.setex(f"auth_me:{user_type}_{user.id}", 60, json.dumps(data))
        except Exception:
            pass

    return _ok(data)


@api_auth_bp.route('/student/login', methods=['POST'])
def student_login():
    from models.student import Student
    return _do_login(Student, "student")


@api_auth_bp.route('/tutor/login', methods=['POST'])
def tutor_login():
    from models.tutor import Tutor
    return _do_login(Tutor, "tutor")


@api_auth_bp.route('/admin/login', methods=['POST'])
def admin_login():
    from models.admin import Admin
    return _do_login(Admin, "admin", skip_email_verify=True)


@api_auth_bp.route('/guardian/login', methods=['POST'])
def guardian_login():
    from models.guardian import Guardian
    return _do_login(Guardian, "guardian")


# ── POST /api/v1/student/register ───────────────────────────────────

@api_auth_bp.route('/student/register', methods=['POST'])
def student_register():
    from models.student import Student
    from utils.validators import validate_name, validate_date_of_birth

    body = request.get_json(silent=True)
    if not body:
        return _err("Request body must be JSON", 400)

    # Validate name
    name, name_err = validate_name(body.get("name", ""), max_length=100)
    if name_err:
        return _err(name_err, 400, field="name")

    # Validate email
    email = _validate_email(body.get("email", ""))
    if not email:
        return _err("Invalid email format", 400, field="email")

    # Validate password
    password = body.get("password", "")
    pw_ok, pw_err = _validate_password_strength(password)
    if not pw_ok:
        return _err(pw_err, 400, field="password")

    # Check duplicate email across all tables
    if _check_duplicate_email(email):
        return _err("An account with this email already exists", 409, field="email")

    # Validate date of birth
    dob_str = body.get("date_of_birth", "")
    dob, dob_err = validate_date_of_birth(dob_str, min_age=0, max_age=120)
    if dob_err:
        return _err(dob_err, 400, field="date_of_birth")

    # Calculate age
    today = date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

    if age < 13:
        return _err(
            "You must be at least 13 years old to register", 400,
            field="date_of_birth"
        )

    requires_guardian = age < 16

    student = Student(
        name=name,
        email=email,
        password=generate_password_hash(password),
        date_of_birth=dob,
    )

    try:
        db.session.add(student)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Student registration DB error: {e}")
        return _err("Failed to create account. Please try again.", 500)

    # Send verification email (non-blocking)
    try:
        from services.email_service import send_email, email_welcome_student
        from services.encryption_service import generate_token
        token = generate_token({"student_id": student.id})
        verify_url = current_app.config.get("APP_URL", "http://localhost:3000") + f"/student/verify/{token}"
        subj, html = email_welcome_student(student.name, verify_url)
        send_email(student.email, subj, html, "welcome_student", "student")
    except Exception as e:
        current_app.logger.error(f"Failed to send verification email to {student.email}: {e}")

    return _ok({
        "id": student.id,
        "email": student.email,
        "requires_guardian_approval": requires_guardian,
    }, 201)


# ── POST /api/v1/tutor/register ─────────────────────────────────────

@api_auth_bp.route('/tutor/register', methods=['POST'])
def tutor_register():
    from models.tutor import Tutor
    from utils.validators import validate_name, validate_date_of_birth

    body = request.get_json(silent=True)
    if not body:
        return _err("Request body must be JSON", 400)

    name, name_err = validate_name(body.get("name", ""), max_length=100)
    if name_err:
        return _err(name_err, 400, field="name")

    email = _validate_email(body.get("email", ""))
    if not email:
        return _err("Invalid email format", 400, field="email")

    password = body.get("password", "")
    pw_ok, pw_err = _validate_password_strength(password)
    if not pw_ok:
        return _err(pw_err, 400, field="password")

    if _check_duplicate_email(email):
        return _err("An account with this email already exists", 409, field="email")

    dob_str = body.get("date_of_birth", "")
    dob, dob_err = validate_date_of_birth(dob_str, min_age=0, max_age=120)
    if dob_err:
        return _err(dob_err, 400, field="date_of_birth")

    today = date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    if age < 18:
        return _err("Tutors must be at least 18 years old", 400, field="date_of_birth")

    tutor = Tutor(
        name=name,
        email=email,
        password=generate_password_hash(password),
        subject="",
        verification_status="pending_documents",
    )

    try:
        db.session.add(tutor)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Tutor registration DB error: {e}")
        return _err("Failed to create account. Please try again.", 500)

    # Send welcome email
    try:
        from services.email_service import send_email, email_welcome_tutor
        subj, html = email_welcome_tutor(tutor.name)
        send_email(tutor.email, subj, html, "welcome_tutor", "tutor")
    except Exception as e:
        current_app.logger.error(f"Failed to send welcome email to tutor {tutor.email}: {e}")

    return _ok({
        "id": tutor.id,
        "email": tutor.email,
        "verification_status": "pending_documents",
    }, 201)


# ── POST /api/v1/guardian/invite ─────────────────────────────────────

@api_auth_bp.route('/guardian/invite', methods=['POST'])
def guardian_invite():
    from models.guardian import Guardian
    from models.student import Student

    body = request.get_json(silent=True)
    if not body:
        return _err("Request body must be JSON", 400)

    guardian_email = _validate_email(body.get("guardian_email", ""))
    if not guardian_email:
        return _err("Invalid guardian email format", 400, field="guardian_email")

    student_name = body.get("student_name", "").strip()
    student_id = body.get("student_id")

    if not student_name or not student_id:
        return _err("student_name and student_id are required", 400)

    # Check if guardian already exists
    existing = Guardian.query.filter_by(email=guardian_email).first()
    if existing and existing.is_verified:
        return _err("A guardian account with this email already exists", 409)

    student = Student.query.get(student_id)
    if not student:
        return _err("Student not found", 404)

    # Create or update guardian
    if existing:
        guardian = existing
    else:
        guardian = Guardian(
            name="Guardian",
            email=guardian_email,
            relationship="Parent",
        )
        db.session.add(guardian)
        db.session.flush()

    student.guardian_id = guardian.id

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Guardian invite DB error: {e}")
        return _err("Failed to send invitation", 500)

    # Send verification email
    try:
        from services.email_service import send_email, email_guardian_verification
        from services.encryption_service import generate_token
        g_token = generate_token({"guardian_id": guardian.id}, salt="guardian-verify")
        g_url = current_app.config.get("APP_URL", "http://localhost:3000") + f"/guardian/verify/{g_token}"
        subj, html = email_guardian_verification(guardian.name, student_name, g_url)
        send_email(guardian.email, subj, html, "guardian_verify", "guardian")
    except Exception as e:
        current_app.logger.error(f"Failed to send guardian invite email: {e}")

    return _ok({"message": "Invitation sent to guardian"})


# ── POST /api/v1/auth/forgot-password ────────────────────────────────

@api_auth_bp.route('/auth/forgot-password', methods=['POST'])
def auth_forgot_password():
    from models.student import Student
    from models.tutor import Tutor

    body = request.get_json(silent=True)
    if not body:
        return _err("Request body must be JSON", 400)

    email = (body.get("email") or "").strip().lower()

    # Always return 200 regardless of whether email exists
    if email:
        # Check student
        student = Student.query.filter_by(email=email).first()
        if student:
            try:
                from services.email_service import send_email, email_password_reset
                from services.encryption_service import generate_token
                token = generate_token({"student_id": student.id}, salt="student-reset-pw")
                reset_url = current_app.config.get("APP_URL", "http://localhost:3000") + f"/reset-password?token={token}"
                subj, html = email_password_reset(student.name, reset_url)
                send_email(student.email, subj, html, "password_reset", "student")
            except Exception as e:
                current_app.logger.error(f"Failed to send reset email: {e}")

        # Check tutor
        tutor = Tutor.query.filter_by(email=email).first()
        if tutor:
            try:
                from services.email_service import send_email, email_password_reset
                from services.encryption_service import generate_token
                token = generate_token({"tutor_id": tutor.id}, salt="tutor-reset-pw")
                reset_url = current_app.config.get("APP_URL", "http://localhost:3000") + f"/reset-password?token={token}"
                subj, html = email_password_reset(tutor.name, reset_url)
                send_email(tutor.email, subj, html, "password_reset", "tutor")
            except Exception as e:
                current_app.logger.error(f"Failed to send reset email: {e}")

    return _ok({"message": "If that email exists, a reset link has been sent"})


# ── POST /api/v1/auth/reset-password ────────────────────────────────

@api_auth_bp.route('/auth/reset-password', methods=['POST'])
def auth_reset_password():
    from models.student import Student
    from models.tutor import Tutor
    from services.encryption_service import verify_token

    body = request.get_json(silent=True)
    if not body:
        return _err("Request body must be JSON", 400)

    token = body.get("token", "")
    new_password = body.get("new_password", "")

    if not token:
        return _err("Reset token is required", 400)

    pw_ok, pw_err = _validate_password_strength(new_password)
    if not pw_ok:
        return _err(pw_err, 400, field="new_password")

    # Try student token
    data = verify_token(token, salt="student-reset-pw", max_age=3600)
    if data and data.get("student_id"):
        student = Student.query.get(data["student_id"])
        if student:
            student.password = generate_password_hash(new_password)
            student.failed_login_attempts = 0
            student.locked_until = None
            db.session.commit()
            return _ok({"message": "Password updated successfully"})

    # Try tutor token
    data = verify_token(token, salt="tutor-reset-pw", max_age=3600)
    if data and data.get("tutor_id"):
        tutor = Tutor.query.get(data["tutor_id"])
        if tutor:
            tutor.password = generate_password_hash(new_password)
            tutor.failed_login_attempts = 0
            tutor.locked_until = None
            db.session.commit()
            return _ok({"message": "Password updated successfully"})

    return _err("Reset link is invalid or has expired", 400)


# ── GET /api/v1/auth/reset-password/validate ─────────────────────────

@api_auth_bp.route('/auth/reset-password/validate', methods=['GET'])
def auth_reset_password_validate():
    from services.encryption_service import verify_token

    token = request.args.get("token", "")
    if not token:
        return _err("Token is required", 400)

    # Try student token
    data = verify_token(token, salt="student-reset-pw", max_age=3600)
    if data and data.get("student_id"):
        return _ok({"token_valid": True})

    # Try tutor token
    data = verify_token(token, salt="tutor-reset-pw", max_age=3600)
    if data and data.get("tutor_id"):
        return _ok({"token_valid": True})

    return _err("Reset link is invalid or has expired", 400)


# ── GET /api/v1/guardian/accept ──────────────────────────────────────

@api_auth_bp.route('/guardian/accept', methods=['GET'])
def guardian_accept_get():
    from models.guardian import Guardian
    from services.encryption_service import verify_token

    token = request.args.get("token", "")
    if not token:
        return _err("Token is required", 400)

    data = verify_token(token, salt="guardian-verify", max_age=172800)
    if not data:
        return _err("Invitation link is invalid or has expired", 400)

    guardian = Guardian.query.get(data.get("guardian_id"))
    if not guardian:
        return _err("Guardian not found", 404)

    # Find linked student
    from models.student import Student
    student = Student.query.filter_by(guardian_id=guardian.id).first()
    student_name = student.name if student else "a student"

    return _ok({
        "student_name": student_name,
        "guardian_email": guardian.email,
        "token_valid": True,
    })


# ── POST /api/v1/guardian/accept ─────────────────────────────────────

@api_auth_bp.route('/guardian/accept', methods=['POST'])
def guardian_accept_post():
    from models.guardian import Guardian
    from services.encryption_service import verify_token

    body = request.get_json(silent=True)
    if not body:
        return _err("Request body must be JSON", 400)

    token = body.get("token", "")
    name = (body.get("name") or "").strip()
    password = body.get("password", "")

    if not token:
        return _err("Token is required", 400)
    if not name:
        return _err("Name is required", 400, field="name")

    pw_ok, pw_err = _validate_password_strength(password)
    if not pw_ok:
        return _err(pw_err, 400, field="password")

    data = verify_token(token, salt="guardian-verify", max_age=172800)
    if not data:
        return _err("Invitation link is invalid or has expired", 400)

    guardian = Guardian.query.get(data.get("guardian_id"))
    if not guardian:
        return _err("Guardian not found", 404)

    guardian.name = name
    guardian.password_hash = generate_password_hash(password)
    guardian.is_verified = True
    guardian.verified_on = datetime.utcnow()

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Guardian accept DB error: {e}")
        return _err("Failed to create guardian account", 500)

    return _ok({
        "user_type": "guardian",
        "id": guardian.id,
        "name": guardian.name,
        "email": guardian.email,
    })
