"""tutor quality score endpoints."""
from functools import wraps

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from models.tutor import Tutor
from services.quality_service import (
    get_tutor_score, get_tutor_score_diagnostic, get_tutor_score_history,
)


api_quality_bp = Blueprint('api_quality', __name__, url_prefix='/api/v1')


def _ok(data, status=200):
    return jsonify({"success": True, "data": data}), status


def _err(message, code=400):
    return jsonify({"success": False, "error": {
        "message": message, "code": code
    }}), code


def _tutor_required(f):
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if getattr(current_user, 'user_type', None) != 'tutor':
            return _err("Access denied", 403)
        return f(*args, **kwargs)
    return decorated


@api_quality_bp.route('/tutors/<int:tutor_id>/quality', methods=['GET'])
def public_tutor_quality(tutor_id):
    """Public: score + components, no diagnostic suggestions."""
    if not Tutor.query.get(tutor_id):
        return _err("Tutor not found", 404)
    row = get_tutor_score(tutor_id)
    if row is None:
        return _ok({'is_provisional': True, 'score': None,
                    'sessions_in_window': 0})
    return _ok(row.to_dict())


@api_quality_bp.route('/tutor/me/quality', methods=['GET'])
@_tutor_required
def my_quality():
    """Private: full breakdown + actionable suggestions."""
    data = get_tutor_score_diagnostic(current_user.id)
    if data is None:
        return _err("Tutor not found", 404)
    return _ok(data)


@api_quality_bp.route('/tutor/me/quality/history', methods=['GET'])
@_tutor_required
def my_quality_history():
    weeks = max(1, min(int(request.args.get('weeks', 12) or 12), 52))
    return _ok({'history': get_tutor_score_history(current_user.id, weeks)})
