"""
JSON API endpoints for assignments and submissions.

Blueprint prefix: /api/v1
All endpoints return the standard envelope:
  {"success": True,  "data": {...}}
  {"success": False, "error": {"message": "...", "code": 400}}
"""

from datetime import datetime
from functools import wraps

from flask import Blueprint, jsonify, request, current_app
from flask_login import current_user, login_required
from sqlalchemy import func

from database import db
from models.assignment import Assignment, Submission
from models.student import Student
from models.tutor import Tutor
from models.slots import TutorSlot

api_assignments_bp = Blueprint(
    'api_assignments', __name__, url_prefix='/api/v1'
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
    if not photo_value:
        return None
    if photo_value.startswith("http") or photo_value.startswith("/"):
        return photo_value
    return f"/static/uploads/photos/{photo_value}"


def _pagination_meta(paginated):
    return {
        "page": paginated.page,
        "per_page": paginated.per_page,
        "total": paginated.total,
        "pages": paginated.pages,
        "has_next": paginated.has_next,
        "has_prev": paginated.has_prev,
    }


ALLOWED_EXTENSIONS = {'pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'txt', 'zip'}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB


def _allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _upload_files(files, owner_id):
    """Upload files via storage service and return metadata list."""
    from services.storage_service import upload_document
    file_data = []
    for f in files:
        if f and f.filename and _allowed_file(f.filename):
            file_bytes = f.read()
            if len(file_bytes) > MAX_FILE_SIZE:
                continue
            result = upload_document(file_bytes, owner_id, f.filename)
            if result:
                file_data.append({
                    'name': f.filename,
                    'key': result['r2_object_key'],
                    'encryption_key': result['file_encryption_key'],
                })
    return file_data


def _serialize_assignment(a, include_submission=False):
    """Serialize an Assignment model to a dict."""
    tutor = Tutor.query.get(a.tutor_id)
    student = Student.query.get(a.student_id)
    out = {
        "id": a.id,
        "title": a.title,
        "description": a.description,
        "subject": a.subject,
        "due_date": a.due_date.isoformat() if a.due_date else None,
        "status": a.status,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "tutor_id": a.tutor_id,
        "tutor_name": tutor.name if tutor else None,
        "tutor_avatar_url": _photo_url(tutor.profile_photo) if tutor else None,
        "student_id": a.student_id,
        "student_name": student.name if student else None,
        "file_count": len(a.file_urls) if a.file_urls else 0,
        "rubric": a.rubric,
        "allow_late_submission": a.allow_late_submission,
        "grace_period_hours": a.grace_period_hours,
        "late_penalty_percent": a.late_penalty_percent,
        "allow_resubmission": a.allow_resubmission,
        "max_resubmissions": a.max_resubmissions,
    }
    if include_submission and a.submission:
        out["submission"] = _serialize_submission(a.submission)
    return out


def _serialize_submission(s):
    """Serialize a Submission model to a dict."""
    return {
        "id": s.id,
        "assignment_id": s.assignment_id,
        "student_id": s.student_id,
        "text_response": s.text_response,
        "file_count": len(s.file_urls) if s.file_urls else 0,
        "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
        "grade": s.grade,
        "feedback": s.feedback,
        "reviewed_at": s.reviewed_at.isoformat() if s.reviewed_at else None,
        "status": s.status,
        "rubric_scores": s.rubric_scores,
        "is_late": s.is_late,
        "resubmission_count": s.resubmission_count,
    }


# ═══════════════════════════════════════════════════════════════════════
# 1. GET /api/v1/student/assignments
# ═══════════════════════════════════════════════════════════════════════

@api_assignments_bp.route('/student/assignments', methods=['GET'])
@_role_required('student')
def student_assignments():
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 50)
    status_filter = request.args.get('status', '').strip()

    query = Assignment.query.filter_by(student_id=current_user.id)

    if status_filter:
        query = query.filter(func.lower(Assignment.status) == status_filter.lower())

    query = query.order_by(Assignment.due_date.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    assignments = [_serialize_assignment(a, include_submission=True) for a in paginated.items]

    return _ok({
        "assignments": assignments,
        "meta": _pagination_meta(paginated),
    })


# ═══════════════════════════════════════════════════════════════════════
# 2. GET /api/v1/student/assignments/<id>
# ═══════════════════════════════════════════════════════════════════════

@api_assignments_bp.route('/student/assignments/<int:assignment_id>', methods=['GET'])
@_role_required('student')
def student_assignment_detail(assignment_id):
    a = Assignment.query.filter_by(
        id=assignment_id, student_id=current_user.id
    ).first()
    if not a:
        return _err("Assignment not found", 404)

    data = _serialize_assignment(a, include_submission=True)

    # Include file details for download
    data["files"] = a.file_urls or []

    return _ok(data)


# ═══════════════════════════════════════════════════════════════════════
# 3. POST /api/v1/student/assignments/<id>/submit
# ═══════════════════════════════════════════════════════════════════════

@api_assignments_bp.route('/student/assignments/<int:assignment_id>/submit', methods=['POST'])
@_role_required('student')
def submit_assignment(assignment_id):
    a = Assignment.query.filter_by(
        id=assignment_id, student_id=current_user.id
    ).first()
    if not a:
        return _err("Assignment not found", 404)

    # Check resubmission limits
    existing = Submission.query.filter_by(
        assignment_id=a.id, student_id=current_user.id
    ).first()

    if existing and existing.status == 'graded' and not a.allow_resubmission:
        return _err("Resubmission is not allowed for this assignment", 400)

    if existing and existing.resubmission_count >= a.max_resubmissions:
        return _err(f"Maximum resubmissions ({a.max_resubmissions}) reached", 400)

    # Check late submission
    is_late = False
    late_hours = 0
    now = datetime.utcnow()
    if a.due_date and now > a.due_date:
        if not a.allow_late_submission:
            grace_end = a.due_date
            if a.grace_period_hours:
                from datetime import timedelta
                grace_end = a.due_date + timedelta(hours=a.grace_period_hours)
            if now > grace_end:
                return _err("Submission deadline has passed", 400)
        is_late = True
        late_hours = (now - a.due_date).total_seconds() / 3600

    # Get text response
    text_response = request.form.get('text_response', '').strip()
    is_draft = request.form.get('is_draft', 'false').lower() == 'true'

    # Upload files
    uploaded_files = request.files.getlist('files')
    file_data = _upload_files(uploaded_files, current_user.id) if uploaded_files else []

    if existing:
        # Update existing submission
        if file_data:
            existing_files = existing.file_urls or []
            existing.file_urls = existing_files + file_data
        if text_response:
            existing.text_response = text_response
        existing.submitted_at = now
        existing.status = 'draft' if is_draft else 'submitted'
        existing.is_late = is_late
        existing.late_hours = late_hours
        if not is_draft:
            existing.resubmission_count = (existing.resubmission_count or 0) + 1
        db.session.commit()
        submission = existing
    else:
        # Create new submission
        submission = Submission(
            assignment_id=a.id,
            student_id=current_user.id,
            text_response=text_response,
            file_urls=file_data,
            submitted_at=now,
            status='draft' if is_draft else 'submitted',
            is_late=is_late,
            late_hours=late_hours,
        )
        db.session.add(submission)
        db.session.flush()

        # Update assignment status
        if not is_draft:
            a.status = 'submitted'
        db.session.commit()

    # Send notification to tutor
    if not is_draft:
        try:
            from models.in_app_notification import InAppNotification
            notif = InAppNotification(
                user_id=a.tutor_id,
                user_role='tutor',
                title='New Assignment Submission',
                message=f'{current_user.name} submitted "{a.title}"',
                type='assignment',
                url=f'/dashboard/tutor/assignments',
            )
            db.session.add(notif)
            db.session.commit()
        except Exception:
            pass

    return _ok(_serialize_submission(submission), status=201)


# ═══════════════════════════════════════════════════════════════════════
# 4. GET /api/v1/tutor/assignments
# ═══════════════════════════════════════════════════════════════════════

@api_assignments_bp.route('/tutor/assignments', methods=['GET'])
@_role_required('tutor')
def tutor_assignments():
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 50)
    status_filter = request.args.get('status', '').strip()

    query = Assignment.query.filter_by(tutor_id=current_user.id)

    if status_filter:
        query = query.filter(func.lower(Assignment.status) == status_filter.lower())

    query = query.order_by(Assignment.created_at.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    assignments = [_serialize_assignment(a, include_submission=True) for a in paginated.items]

    return _ok({
        "assignments": assignments,
        "meta": _pagination_meta(paginated),
    })


# ═══════════════════════════════════════════════════════════════════════
# 5. POST /api/v1/tutor/assignments
# ═══════════════════════════════════════════════════════════════════════

@api_assignments_bp.route('/tutor/assignments', methods=['POST'])
@_role_required('tutor')
def create_assignment():
    title = request.form.get('title', '').strip()
    if not title:
        return _err("Title is required", 400, field="title")

    student_id = request.form.get('student_id', type=int)
    if not student_id:
        return _err("Student is required", 400, field="student_id")

    # Verify this tutor has had sessions with this student
    student = Student.query.get(student_id)
    if not student:
        return _err("Student not found", 404)

    due_date_str = request.form.get('due_date', '').strip()
    if not due_date_str:
        return _err("Due date is required", 400, field="due_date")

    try:
        due_date = datetime.fromisoformat(due_date_str)
    except (ValueError, TypeError):
        return _err("Invalid due date format. Use ISO format.", 400, field="due_date")

    description = request.form.get('description', '').strip()
    subject = request.form.get('subject', '').strip()

    # Parse rubric if provided (JSON string)
    rubric = None
    rubric_str = request.form.get('rubric', '').strip()
    if rubric_str:
        try:
            import json
            rubric = json.loads(rubric_str)
        except (ValueError, TypeError):
            return _err("Invalid rubric format", 400, field="rubric")

    allow_late = request.form.get('allow_late_submission', 'false').lower() == 'true'
    grace_hours = request.form.get('grace_period_hours', 0, type=int)
    late_penalty = request.form.get('late_penalty_percent', 0, type=int)
    allow_resub = request.form.get('allow_resubmission', 'true').lower() == 'true'
    max_resubs = request.form.get('max_resubmissions', 1, type=int)

    # Upload files
    uploaded_files = request.files.getlist('files')
    file_data = _upload_files(uploaded_files, current_user.id) if uploaded_files else []

    assignment = Assignment(
        tutor_id=current_user.id,
        student_id=student_id,
        title=title,
        description=description,
        subject=subject,
        due_date=due_date,
        file_urls=file_data,
        rubric=rubric,
        allow_late_submission=allow_late,
        grace_period_hours=grace_hours,
        late_penalty_percent=late_penalty,
        allow_resubmission=allow_resub,
        max_resubmissions=max_resubs,
    )
    db.session.add(assignment)
    db.session.commit()

    # Notify student
    try:
        from models.in_app_notification import InAppNotification
        notif = InAppNotification(
            user_id=student_id,
            user_role='student',
            title='New Assignment',
            message=f'{current_user.name} assigned "{title}"',
            type='assignment',
            url=f'/dashboard/student/assignments',
        )
        db.session.add(notif)
        db.session.commit()
    except Exception:
        pass

    return _ok(_serialize_assignment(assignment), status=201)


# ═══════════════════════════════════════════════════════════════════════
# 6. GET /api/v1/tutor/assignments/<id>/submissions
# ═══════════════════════════════════════════════════════════════════════

@api_assignments_bp.route('/tutor/assignments/<int:assignment_id>/submissions', methods=['GET'])
@_role_required('tutor')
def tutor_submissions(assignment_id):
    a = Assignment.query.filter_by(
        id=assignment_id, tutor_id=current_user.id
    ).first()
    if not a:
        return _err("Assignment not found", 404)

    submission = a.submission
    data = _serialize_assignment(a)
    data["submission"] = _serialize_submission(submission) if submission else None

    return _ok(data)


# ═══════════════════════════════════════════════════════════════════════
# 7. POST /api/v1/tutor/assignments/<id>/grade
# ═══════════════════════════════════════════════════════════════════════

@api_assignments_bp.route('/tutor/assignments/<int:assignment_id>/grade', methods=['POST'])
@_role_required('tutor')
def grade_submission(assignment_id):
    a = Assignment.query.filter_by(
        id=assignment_id, tutor_id=current_user.id
    ).first()
    if not a:
        return _err("Assignment not found", 404)

    submission = a.submission
    if not submission:
        return _err("No submission found for this assignment", 404)

    if submission.status not in ('submitted', 'graded'):
        return _err("Submission cannot be graded in its current state", 400)

    body = request.get_json(silent=True)
    if not body:
        return _err("Request body must be JSON", 400)

    grade = body.get('grade', '').strip()
    if not grade:
        return _err("Grade is required", 400, field="grade")

    feedback = body.get('feedback', '').strip()
    rubric_scores = body.get('rubric_scores')

    submission.grade = grade
    submission.feedback = feedback
    submission.rubric_scores = rubric_scores
    submission.reviewed_at = datetime.utcnow()
    submission.status = 'graded'

    a.status = 'reviewed'

    db.session.commit()

    # Notify student
    try:
        from models.in_app_notification import InAppNotification
        notif = InAppNotification(
            user_id=a.student_id,
            user_role='student',
            title='Assignment Graded',
            message=f'Your assignment "{a.title}" has been graded: {grade}',
            type='assignment',
            url=f'/dashboard/student/assignments',
        )
        db.session.add(notif)
        db.session.commit()
    except Exception:
        pass

    return _ok(_serialize_submission(submission))
