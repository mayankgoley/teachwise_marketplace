"""
JSON API endpoints for learning goals and progress tracking.

Blueprint prefix: /api/v1
All endpoints return the standard envelope:
  {"success": True,  "data": {...}}
  {"success": False, "error": {"message": "...", "code": 400}}
"""

from datetime import datetime, date
from functools import wraps

from flask import Blueprint, jsonify, request, current_app
from flask_login import current_user, login_required
from sqlalchemy import func, extract

from database import db
from models.learning_goal import LearningGoal, ProgressEntry
from models.student import Student
from models.tutor import Tutor
from models.slots import TutorSlot
from models.booking import Booking

api_progress_bp = Blueprint(
    'api_progress', __name__, url_prefix='/api/v1'
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
    if not photo_value:
        return None
    if photo_value.startswith("http") or photo_value.startswith("/"):
        return photo_value
    return f"/static/uploads/photos/{photo_value}"


def _serialize_goal(g, include_entries=False):
    """Serialize a LearningGoal to dict."""
    tutor = Tutor.query.get(g.tutor_id)
    entry_count = len(g.entries) if g.entries else 0
    latest_rating = None
    if g.entries:
        rated = [e for e in g.entries if e.rating is not None]
        if rated:
            latest_rating = rated[0].rating  # entries ordered desc

    out = {
        "id": g.id,
        "title": g.title,
        "description": g.description,
        "status": g.status,
        "target_date": g.target_date.isoformat() if g.target_date else None,
        "skill_tags": g.skill_tags or [],
        "created_at": g.created_at.isoformat() if g.created_at else None,
        "tutor_id": g.tutor_id,
        "tutor_name": tutor.name if tutor else None,
        "tutor_avatar_url": _photo_url(tutor.profile_photo) if tutor else None,
        "student_id": g.student_id,
        "entry_count": entry_count,
        "latest_rating": latest_rating,
    }
    if include_entries:
        out["entries"] = [_serialize_entry(e) for e in (g.entries or [])]
    return out


def _serialize_entry(e):
    """Serialize a ProgressEntry to dict."""
    return {
        "id": e.id,
        "goal_id": e.goal_id,
        "note": e.note,
        "rating": e.rating,
        "created_by": e.created_by,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "slot_id": e.slot_id,
    }


# ═══════════════════════════════════════════════════════════════════════
# 1. GET /api/v1/student/goals
# ═══════════════════════════════════════════════════════════════════════

@api_progress_bp.route('/student/goals', methods=['GET'])
@_role_required('student')
def student_goals():
    status_filter = request.args.get('status', '').strip()

    query = LearningGoal.query.filter_by(student_id=current_user.id)

    if status_filter:
        query = query.filter(func.lower(LearningGoal.status) == status_filter.lower())

    query = query.order_by(LearningGoal.created_at.desc())
    goals = query.all()

    return _ok({
        "goals": [_serialize_goal(g, include_entries=True) for g in goals],
    })


# ═══════════════════════════════════════════════════════════════════════
# 2. POST /api/v1/student/goals
# ═══════════════════════════════════════════════════════════════════════

@api_progress_bp.route('/student/goals', methods=['POST'])
@_role_required('student')
def create_goal():
    body = request.get_json(silent=True)
    if not body:
        return _err("Request body must be JSON", 400)

    title = body.get('title', '').strip()
    if not title:
        return _err("Title is required", 400, field="title")

    # tutor_id is required by the model (NOT NULL FK)
    tutor_id = body.get('tutor_id')
    if not tutor_id:
        # If no tutor specified, try to find any tutor this student has had sessions with
        recent_booking = (
            Booking.query
            .filter_by(student_id=current_user.id)
            .order_by(Booking.booked_on.desc())
            .first()
        )
        if recent_booking:
            tutor_id = recent_booking.tutor_id
        else:
            return _err("A tutor must be associated with this goal", 400, field="tutor_id")

    tutor = Tutor.query.get(tutor_id)
    if not tutor:
        return _err("Tutor not found", 404)

    description = body.get('description', '').strip()
    target_date = None
    target_date_str = body.get('target_date', '').strip() if body.get('target_date') else ''
    if target_date_str:
        try:
            target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return _err("Invalid target date format. Use YYYY-MM-DD.", 400, field="target_date")

    skill_tags = body.get('skill_tags', [])
    status = body.get('status', 'active').strip()
    if status not in ('active', 'completed', 'paused'):
        status = 'active'

    goal = LearningGoal(
        student_id=current_user.id,
        tutor_id=tutor_id,
        title=title,
        description=description,
        status=status,
        target_date=target_date,
        skill_tags=skill_tags,
    )
    db.session.add(goal)
    db.session.commit()

    return _ok(_serialize_goal(goal), status=201)


# ═══════════════════════════════════════════════════════════════════════
# 3. PATCH /api/v1/student/goals/<id>
# ═══════════════════════════════════════════════════════════════════════

@api_progress_bp.route('/student/goals/<int:goal_id>', methods=['PATCH'])
@_role_required('student')
def update_goal(goal_id):
    goal = LearningGoal.query.filter_by(
        id=goal_id, student_id=current_user.id
    ).first()
    if not goal:
        return _err("Goal not found", 404)

    body = request.get_json(silent=True)
    if not body:
        return _err("Request body must be JSON", 400)

    if 'title' in body:
        title = body['title'].strip()
        if title:
            goal.title = title

    if 'description' in body:
        goal.description = body['description'].strip()

    if 'status' in body:
        new_status = body['status'].strip()
        if new_status in ('active', 'completed', 'paused'):
            goal.status = new_status

    if 'target_date' in body:
        td = body['target_date']
        if td:
            try:
                goal.target_date = datetime.strptime(td, "%Y-%m-%d").date()
            except (ValueError, TypeError):
                return _err("Invalid target date format", 400, field="target_date")
        else:
            goal.target_date = None

    if 'skill_tags' in body:
        goal.skill_tags = body['skill_tags']

    db.session.commit()
    return _ok(_serialize_goal(goal, include_entries=True))


# ═══════════════════════════════════════════════════════════════════════
# 4. DELETE /api/v1/student/goals/<id>
# ═══════════════════════════════════════════════════════════════════════

@api_progress_bp.route('/student/goals/<int:goal_id>', methods=['DELETE'])
@_role_required('student')
def delete_goal(goal_id):
    goal = LearningGoal.query.filter_by(
        id=goal_id, student_id=current_user.id
    ).first()
    if not goal:
        return _err("Goal not found", 404)

    # Delete associated entries first
    ProgressEntry.query.filter_by(goal_id=goal.id).delete()
    db.session.delete(goal)
    db.session.commit()

    return _ok({"deleted": True})


# ═══════════════════════════════════════════════════════════════════════
# 5. POST /api/v1/goals/<id>/entries
# ═══════════════════════════════════════════════════════════════════════

@api_progress_bp.route('/goals/<int:goal_id>/entries', methods=['POST'])
@login_required
def add_entry(goal_id):
    goal = LearningGoal.query.get(goal_id)
    if not goal:
        return _err("Goal not found", 404)

    # Both the student and the tutor associated with this goal can add entries
    user_type = current_user.user_type
    if user_type == 'student' and goal.student_id != current_user.id:
        return _err("Access denied", 403)
    if user_type == 'tutor' and goal.tutor_id != current_user.id:
        return _err("Access denied", 403)
    if user_type not in ('student', 'tutor'):
        return _err("Access denied", 403)

    body = request.get_json(silent=True)
    if not body:
        return _err("Request body must be JSON", 400)

    note = body.get('note', '').strip()
    if not note:
        return _err("Note is required", 400, field="note")

    rating = body.get('rating')
    if rating is not None:
        try:
            rating = int(rating)
            if rating < 1 or rating > 5:
                return _err("Rating must be between 1 and 5", 400, field="rating")
        except (ValueError, TypeError):
            return _err("Rating must be a number", 400, field="rating")

    slot_id = body.get('slot_id')

    entry = ProgressEntry(
        goal_id=goal.id,
        note=note,
        rating=rating,
        created_by=user_type,
        slot_id=slot_id,
    )
    db.session.add(entry)
    db.session.commit()

    return _ok(_serialize_entry(entry), status=201)


# ═══════════════════════════════════════════════════════════════════════
# 6. GET /api/v1/student/progress/chart
# ═══════════════════════════════════════════════════════════════════════

@api_progress_bp.route('/student/progress/chart', methods=['GET'])
@_role_required('student')
def progress_chart():
    goal_id = request.args.get('goal_id', type=int)

    query = (
        db.session.query(ProgressEntry)
        .join(LearningGoal, ProgressEntry.goal_id == LearningGoal.id)
        .filter(LearningGoal.student_id == current_user.id)
    )

    if goal_id:
        query = query.filter(ProgressEntry.goal_id == goal_id)

    entries = query.filter(
        ProgressEntry.rating.isnot(None)
    ).order_by(ProgressEntry.created_at.asc()).all()

    chart_data = []
    for e in entries:
        chart_data.append({
            "date": e.created_at.strftime("%Y-%m-%d") if e.created_at else None,
            "rating": e.rating,
            "goal_id": e.goal_id,
            "note": e.note[:50] if e.note else None,
        })

    return _ok({"chart": chart_data})


# ═══════════════════════════════════════════════════════════════════════
# 7. GET /api/v1/student/progress/report
# ═══════════════════════════════════════════════════════════════════════

@api_progress_bp.route('/student/progress/report', methods=['GET'])
@_role_required('student')
def progress_report():
    """Generate a progress summary report."""
    goals = LearningGoal.query.filter_by(
        student_id=current_user.id
    ).order_by(LearningGoal.created_at.desc()).all()

    total_goals = len(goals)
    completed_goals = sum(1 for g in goals if g.status == 'completed')
    active_goals = sum(1 for g in goals if g.status == 'active')

    # Compute average ratings per goal
    goal_summaries = []
    for g in goals:
        rated_entries = [e for e in g.entries if e.rating is not None]
        avg_rating = None
        if rated_entries:
            avg_rating = round(sum(e.rating for e in rated_entries) / len(rated_entries), 1)

        goal_summaries.append({
            "id": g.id,
            "title": g.title,
            "status": g.status,
            "entry_count": len(g.entries),
            "average_rating": avg_rating,
            "latest_rating": rated_entries[0].rating if rated_entries else None,
            "target_date": g.target_date.isoformat() if g.target_date else None,
            "skill_tags": g.skill_tags or [],
        })

    return _ok({
        "student_name": current_user.name,
        "total_goals": total_goals,
        "completed_goals": completed_goals,
        "active_goals": active_goals,
        "paused_goals": total_goals - completed_goals - active_goals,
        "goals": goal_summaries,
        "generated_at": datetime.utcnow().isoformat(),
    })
