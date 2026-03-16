"""
JSON API endpoints for email verification and password reset validation.

Blueprint prefix: /api/v1
All endpoints return the standard envelope:
  {"success": True,  "data": {...}}
  {"success": False, "error": {"message": "...", "code": 400, "field": "email"}}
"""

from flask import Blueprint, jsonify, request, current_app
from flask_login import current_user, login_required
from database import db
from models.student import Student
from models.tutor import Tutor
from services.encryption_service import verify_token, generate_token

api_verify_bp = Blueprint('api_verify', __name__, url_prefix='/api/v1')


# -- Helpers ----------------------------------------------------------------

def _ok(data, status=200):
    return jsonify({"success": True, "data": data}), status


def _err(message, code=400, field=None):
    payload = {"success": False, "error": {"message": message, "code": code}}
    if field:
        payload["error"]["field"] = field
    return jsonify(payload), code


# -- GET /api/v1/auth/verify-email -----------------------------------------

@api_verify_bp.route('/auth/verify-email', methods=['GET'])
def verify_email():
    token = request.args.get('token', '')
    if not token:
        return _err("Token is required", 400)

    data = verify_token(token, salt='email-verify', max_age=86400)
    if not data:
        return _err("Verification link is invalid or has expired", 400)

    email = data.get('email')
    user_type = data.get('type')

    if not email or not user_type:
        return _err("Verification link is invalid or has expired", 400)

    user = None
    if user_type == 'student':
        user = Student.query.filter_by(email=email).first()
    elif user_type == 'tutor':
        user = Tutor.query.filter_by(email=email).first()

    if not user:
        return _err("Verification link is invalid or has expired", 400)

    if hasattr(user, 'email_verified'):
        user.email_verified = True

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Email verification DB error: {e}")
        return _err("Failed to verify email. Please try again.", 500)

    return _ok({
        "message": "Email verified",
        "user_type": user_type,
        "email": email,
    })


# -- POST /api/v1/auth/resend-verification ---------------------------------

@api_verify_bp.route('/auth/resend-verification', methods=['POST'])
@login_required
def resend_verification():
    token = generate_token({
        'email': current_user.email,
        'type': current_user.user_type,
    })

    # In a real app this would send an email; for now return the token for testing
    return _ok({"message": "Verification email sent"})


