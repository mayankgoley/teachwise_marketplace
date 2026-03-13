from flask import Blueprint, render_template, request, redirect, url_for, flash, send_file, jsonify
from flask_login import login_required, current_user
from utils.auth import role_required
from utils.sanitizer import sanitize_text, sanitize_input_length
from models.assignment import Assignment, Submission
from models.booking import Booking
from models.tutor import Tutor
from models.student import Student
from models.slots import TutorSlot
from services.storage_service import upload_document, download_document
from database import db
from datetime import datetime, timedelta
import bleach
import io
import json

assignment_bp = Blueprint('assignment_bp', __name__)

# Item 2: File type restrictions
ALLOWED_EXTENSIONS = {'pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'txt', 'zip'}
ALLOWED_EXTENSIONS_DISPLAY = 'PDF, DOC, DOCX, JPG, PNG, TXT, ZIP'
ALLOWED_ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.zip'
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB

# Item 1: Bleach allowed tags for rich text
ALLOWED_TAGS = ['h1', 'h2', 'h3', 'p', 'br', 'strong', 'em', 'u', 's',
                'ol', 'ul', 'li', 'blockquote', 'pre', 'code', 'a']
ALLOWED_ATTRS = {'a': ['href']}


def _allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _upload_files(files, owner_id):
    """Upload files and return file data list."""
    file_data = []
    for f in files:
        if f and f.filename and _allowed_file(f.filename):
            file_bytes = f.read()
            if len(file_bytes) > MAX_FILE_SIZE:
                flash(f'File {f.filename} exceeds 25MB limit.', 'danger')
                continue
            result = upload_document(file_bytes, owner_id, f.filename)
            if result:
                file_data.append({
                    'name': f.filename,
                    'key': result['r2_object_key'],
                    'encryption_key': result['file_encryption_key']
                })
        elif f and f.filename:
            flash(f'File type not allowed: {f.filename}', 'warning')
    return file_data


# ═══════════════════════════════════════════════════════════
# Tutor Routes
# ═══════════════════════════════════════════════════════════

@assignment_bp.route('/tutor/assignments')
@role_required('tutor')
def tutor_assignments():
    tutor_id = current_user.id

    # Item 7: Filter by subject and status
    filter_subject = request.args.get('subject', '')
    filter_status = request.args.get('status', '')

    query = Assignment.query.filter_by(tutor_id=tutor_id)
    if filter_subject:
        query = query.filter(Assignment.subject == filter_subject)
    if filter_status:
        if filter_status == 'overdue':
            query = query.filter(
                Assignment.due_date < datetime.utcnow(),
                Assignment.status.in_(['assigned'])
            )
        else:
            query = query.filter(Assignment.status == filter_status)

    sort_by = request.args.get('sort', 'created')
    if sort_by == 'due_soonest':
        query = query.order_by(Assignment.due_date.asc())
    elif sort_by == 'due_latest':
        query = query.order_by(Assignment.due_date.desc())
    else:
        query = query.order_by(Assignment.created_at.desc())

    assignments = query.all()

    # Get unique subjects for filter dropdown
    subjects = db.session.query(Assignment.subject).filter(
        Assignment.tutor_id == tutor_id,
        Assignment.subject.isnot(None)
    ).distinct().all()
    subjects = [s[0] for s in subjects if s[0]]

    # Get students who had completed sessions with this tutor
    completed_student_ids = db.session.query(Booking.student_id).filter(
        Booking.tutor_id == tutor_id,
        Booking.status == 'Completed'
    ).distinct().all()
    student_ids = [s[0] for s in completed_student_ids]
    eligible_students = Student.query.filter(Student.id.in_(student_ids)).all() if student_ids else []

    return render_template('tutor_assignments.html',
                           assignments=assignments,
                           eligible_students=eligible_students,
                           subjects=subjects,
                           filter_subject=filter_subject,
                           filter_status=filter_status,
                           sort_by=sort_by,
                           now=datetime.utcnow(),
                           allowed_ext=ALLOWED_EXTENSIONS_DISPLAY,
                           allowed_accept=ALLOWED_ACCEPT,
                           max_file_mb=MAX_FILE_SIZE // (1024 * 1024))


@assignment_bp.route('/tutor/assignments/create', methods=['POST'])
@role_required('tutor')
def create_assignment():
    tutor_id = current_user.id
    student_id = request.form.get('student_id', type=int)
    title = sanitize_input_length(request.form.get('title', ''), 200)
    description_raw = request.form.get('description', '')
    subject = sanitize_input_length(request.form.get('subject', ''), 100)
    due_date_str = request.form.get('due_date', '')

    if not all([student_id, title, due_date_str]):
        flash('Please fill in all required fields.', 'danger')
        return redirect(url_for('assignment_bp.tutor_assignments'))

    # Verify student had a completed session
    has_session = Booking.query.filter_by(
        tutor_id=tutor_id, student_id=student_id, status='Completed'
    ).first()
    if not has_session:
        flash('You can only assign homework to students who completed a session with you.', 'danger')
        return redirect(url_for('assignment_bp.tutor_assignments'))

    try:
        due_date = datetime.strptime(due_date_str, '%Y-%m-%dT%H:%M')
    except ValueError:
        flash('Invalid due date format.', 'danger')
        return redirect(url_for('assignment_bp.tutor_assignments'))

    # Item 1: Sanitize rich text description
    description = bleach.clean(description_raw, tags=ALLOWED_TAGS,
                               attributes=ALLOWED_ATTRS, strip=True)

    # Item 4: Parse rubric JSON
    rubric = None
    rubric_json = request.form.get('rubric_json', '')
    if rubric_json:
        try:
            rubric = json.loads(rubric_json)
        except (json.JSONDecodeError, ValueError):
            pass

    # Item 8: Late submission policy
    allow_late = request.form.get('allow_late_submission') == 'on'
    grace_hours = request.form.get('grace_period_hours', 0, type=int)
    late_penalty = request.form.get('late_penalty_percent', 0, type=int)

    # Item 9: Resubmission
    allow_resub = request.form.get('allow_resubmission') == 'on'
    max_resubs = request.form.get('max_resubmissions', 1, type=int)

    file_data = _upload_files(request.files.getlist('files'), tutor_id)

    assignment = Assignment(
        tutor_id=tutor_id,
        student_id=student_id,
        title=title,
        description=description,
        subject=subject or None,
        due_date=due_date,
        file_urls=file_data,
        rubric=rubric,
        allow_late_submission=allow_late,
        grace_period_hours=grace_hours if allow_late else 0,
        late_penalty_percent=late_penalty if allow_late else 0,
        allow_resubmission=allow_resub,
        max_resubmissions=max_resubs if allow_resub else 0,
    )
    db.session.add(assignment)
    db.session.commit()

    flash(f'Assignment "{title}" created successfully!', 'success')
    return redirect(url_for('assignment_bp.tutor_assignments'))


@assignment_bp.route('/tutor/assignments/<int:assignment_id>/review', methods=['GET', 'POST'])
@role_required('tutor')
def review_submission(assignment_id):
    tutor_id = current_user.id
    assignment = Assignment.query.get_or_404(assignment_id)

    if assignment.tutor_id != tutor_id:
        flash('Access denied.', 'danger')
        return redirect(url_for('assignment_bp.tutor_assignments'))

    if not assignment.submission:
        flash('No submission to review yet.', 'info')
        return redirect(url_for('assignment_bp.tutor_assignments'))

    if request.method == 'POST':
        action = request.form.get('action', 'grade')

        if action == 'return_resubmission':
            # Item 9: Return for resubmission
            feedback = sanitize_input_length(request.form.get('feedback', ''), 2000)
            assignment.submission.feedback = feedback
            assignment.submission.reviewed_at = datetime.utcnow()
            assignment.submission.resubmission_allowed = True
            assignment.submission.status = 'returned'
            assignment.status = 'returned'
            db.session.commit()
            flash('Assignment returned for resubmission with feedback.', 'success')
            return redirect(url_for('assignment_bp.tutor_assignments'))

        # Normal grading
        feedback = sanitize_input_length(request.form.get('feedback', ''), 2000)

        # Item 4: Rubric scoring
        rubric_scores = None
        if assignment.rubric:
            scores = []
            total = 0
            for i, criterion in enumerate(assignment.rubric):
                score_val = request.form.get(f'criterion_score_{i}', 0, type=int)
                max_pts = criterion.get('max_points', 0)
                score_val = min(score_val, max_pts)
                scores.append({
                    'criterion': criterion.get('criterion', ''),
                    'score': score_val,
                    'max_points': max_pts,
                })
                total += score_val
            rubric_scores = scores
            grade = str(total)
        else:
            grade = sanitize_input_length(request.form.get('grade', ''), 50)

        assignment.submission.grade = grade
        assignment.submission.feedback = feedback
        assignment.submission.reviewed_at = datetime.utcnow()
        assignment.submission.rubric_scores = rubric_scores
        assignment.submission.status = 'graded'
        assignment.status = 'reviewed'
        db.session.commit()

        flash('Review submitted!', 'success')
        return redirect(url_for('assignment_bp.tutor_assignments'))

    return render_template('review_submission.html', assignment=assignment,
                           now=datetime.utcnow())


# ═══════════════════════════════════════════════════════════
# Student Routes
# ═══════════════════════════════════════════════════════════

@assignment_bp.route('/student/assignments')
@login_required
def student_assignments():
    # Item 7: Filters
    filter_subject = request.args.get('subject', '')
    filter_status = request.args.get('status', '')

    query = Assignment.query.filter_by(student_id=current_user.id)
    if filter_subject:
        query = query.filter(Assignment.subject == filter_subject)
    if filter_status:
        if filter_status == 'overdue':
            query = query.filter(
                Assignment.due_date < datetime.utcnow(),
                Assignment.status.in_(['assigned'])
            )
        elif filter_status == 'draft':
            # Find assignments with draft submissions
            draft_assignment_ids = db.session.query(Submission.assignment_id).filter(
                Submission.student_id == current_user.id,
                Submission.status == 'draft'
            ).subquery()
            query = query.filter(Assignment.id.in_(
                db.session.query(draft_assignment_ids)))
        else:
            query = query.filter(Assignment.status == filter_status)

    sort_by = request.args.get('sort', 'due_soonest')
    if sort_by == 'due_latest':
        query = query.order_by(Assignment.due_date.desc())
    elif sort_by == 'created':
        query = query.order_by(Assignment.created_at.desc())
    else:
        query = query.order_by(Assignment.due_date.asc())

    assignments = query.all()

    # Get unique subjects for filter dropdown
    subjects = db.session.query(Assignment.subject).filter(
        Assignment.student_id == current_user.id,
        Assignment.subject.isnot(None)
    ).distinct().all()
    subjects = [s[0] for s in subjects if s[0]]

    # Get draft submission IDs for badge display
    draft_ids = set()
    drafts = Submission.query.filter_by(
        student_id=current_user.id, status='draft').all()
    for d in drafts:
        draft_ids.add(d.assignment_id)

    return render_template('student_assignments.html',
                           assignments=assignments,
                           subjects=subjects,
                           filter_subject=filter_subject,
                           filter_status=filter_status,
                           sort_by=sort_by,
                           draft_ids=draft_ids,
                           now=datetime.utcnow())


@assignment_bp.route('/student/assignments/<int:assignment_id>/submit', methods=['GET', 'POST'])
@login_required
def submit_assignment(assignment_id):
    assignment = Assignment.query.get_or_404(assignment_id)

    if assignment.student_id != current_user.id:
        flash('Access denied.', 'danger')
        return redirect(url_for('assignment_bp.student_assignments'))

    # Check for existing submission (not draft)
    existing = assignment.submission
    if existing and existing.status == 'submitted':
        flash('You already submitted this assignment.', 'info')
        return redirect(url_for('assignment_bp.student_assignments'))

    # Item 3: Load existing draft
    draft = Submission.query.filter_by(
        assignment_id=assignment_id,
        student_id=current_user.id,
        status='draft'
    ).first()

    # Item 8: Check late submission policy
    is_overdue = datetime.utcnow() > assignment.due_date
    late_blocked = False
    late_hours = 0
    if is_overdue:
        late_hours = (datetime.utcnow() - assignment.due_date).total_seconds() / 3600
        if not assignment.allow_late_submission:
            late_blocked = True
        elif assignment.grace_period_hours > 0:
            grace_deadline = assignment.due_date + timedelta(hours=assignment.grace_period_hours)
            if datetime.utcnow() > grace_deadline:
                late_blocked = True

    if request.method == 'POST':
        save_as_draft = request.form.get('save_as_draft') == '1'

        if late_blocked and not save_as_draft:
            flash('This assignment no longer accepts submissions.', 'danger')
            return redirect(url_for('assignment_bp.student_assignments'))

        text_response = sanitize_input_length(request.form.get('text_response', ''), 5000)
        file_data = _upload_files(request.files.getlist('files'), current_user.id)

        if not save_as_draft and not text_response and not file_data and not (draft and draft.file_urls):
            flash('Please provide a text response or upload files.', 'danger')
            return render_template('submit_assignment.html', assignment=assignment,
                                   draft=draft, is_overdue=is_overdue,
                                   late_blocked=late_blocked, late_hours=late_hours,
                                   allowed_ext=ALLOWED_EXTENSIONS_DISPLAY,
                                   allowed_accept=ALLOWED_ACCEPT,
                                   max_file_mb=MAX_FILE_SIZE // (1024 * 1024))

        if draft:
            # Update existing draft
            draft.text_response = text_response or draft.text_response
            if file_data:
                existing_files = draft.file_urls or []
                draft.file_urls = existing_files + file_data
            if save_as_draft:
                draft.status = 'draft'
            else:
                draft.status = 'submitted'
                draft.submitted_at = datetime.utcnow()
                if is_overdue:
                    draft.is_late = True
                    draft.late_hours = round(late_hours, 2)
                assignment.status = 'submitted'
            db.session.commit()
        else:
            submission = Submission(
                assignment_id=assignment.id,
                student_id=current_user.id,
                text_response=text_response or None,
                file_urls=file_data,
                status='draft' if save_as_draft else 'submitted',
            )
            if not save_as_draft:
                if is_overdue:
                    submission.is_late = True
                    submission.late_hours = round(late_hours, 2)
                assignment.status = 'submitted'
            db.session.add(submission)
            db.session.commit()

        if save_as_draft:
            flash('Draft saved!', 'success')
        else:
            flash('Assignment submitted!', 'success')
        return redirect(url_for('assignment_bp.student_assignments'))

    return render_template('submit_assignment.html', assignment=assignment,
                           draft=draft, is_overdue=is_overdue,
                           late_blocked=late_blocked, late_hours=late_hours,
                           allowed_ext=ALLOWED_EXTENSIONS_DISPLAY,
                           allowed_accept=ALLOWED_ACCEPT,
                           max_file_mb=MAX_FILE_SIZE // (1024 * 1024))


# Item 3: Auto-save draft via AJAX
@assignment_bp.route('/student/assignments/<int:assignment_id>/auto-save', methods=['POST'])
@login_required
def auto_save_draft(assignment_id):
    assignment = Assignment.query.get_or_404(assignment_id)
    if assignment.student_id != current_user.id:
        return jsonify({'error': 'Access denied'}), 403

    data = request.get_json()
    text_response = data.get('text_response', '')

    draft = Submission.query.filter_by(
        assignment_id=assignment_id,
        student_id=current_user.id,
        status='draft'
    ).first()

    if draft:
        draft.text_response = text_response
        draft.submitted_at = datetime.utcnow()
    else:
        draft = Submission(
            assignment_id=assignment_id,
            student_id=current_user.id,
            text_response=text_response,
            status='draft',
        )
        db.session.add(draft)

    db.session.commit()
    return jsonify({'ok': True, 'saved_at': datetime.utcnow().strftime('%I:%M %p')})


# Item 9: Resubmit assignment
@assignment_bp.route('/student/assignments/<int:assignment_id>/resubmit', methods=['GET', 'POST'])
@login_required
def resubmit_assignment(assignment_id):
    assignment = Assignment.query.get_or_404(assignment_id)

    if assignment.student_id != current_user.id:
        flash('Access denied.', 'danger')
        return redirect(url_for('assignment_bp.student_assignments'))

    if not assignment.allow_resubmission:
        flash('Resubmission is not allowed for this assignment.', 'warning')
        return redirect(url_for('assignment_bp.student_assignments'))

    old_submission = assignment.submission
    if not old_submission or not old_submission.resubmission_allowed:
        flash('Resubmission has not been requested for this assignment.', 'warning')
        return redirect(url_for('assignment_bp.student_assignments'))

    if old_submission.resubmission_count >= assignment.max_resubmissions:
        flash('Maximum resubmissions reached.', 'warning')
        return redirect(url_for('assignment_bp.student_assignments'))

    if request.method == 'POST':
        text_response = sanitize_input_length(request.form.get('text_response', ''), 5000)
        file_data = _upload_files(request.files.getlist('files'), current_user.id)

        if not text_response and not file_data:
            flash('Please provide a text response or upload files.', 'danger')
            return render_template('submit_assignment.html', assignment=assignment,
                                   is_resubmission=True, old_submission=old_submission,
                                   allowed_ext=ALLOWED_EXTENSIONS_DISPLAY,
                                   allowed_accept=ALLOWED_ACCEPT,
                                   max_file_mb=MAX_FILE_SIZE // (1024 * 1024))

        # Update the existing submission for resubmission
        old_submission.text_response = text_response or old_submission.text_response
        if file_data:
            old_submission.file_urls = file_data
        old_submission.submitted_at = datetime.utcnow()
        old_submission.status = 'submitted'
        old_submission.resubmission_allowed = False
        old_submission.resubmission_count += 1
        old_submission.grade = None
        old_submission.rubric_scores = None
        old_submission.reviewed_at = None
        assignment.status = 'submitted'
        db.session.commit()

        flash('Assignment resubmitted!', 'success')
        return redirect(url_for('assignment_bp.student_assignments'))

    return render_template('submit_assignment.html', assignment=assignment,
                           is_resubmission=True, old_submission=old_submission,
                           allowed_ext=ALLOWED_EXTENSIONS_DISPLAY,
                           allowed_accept=ALLOWED_ACCEPT,
                           max_file_mb=MAX_FILE_SIZE // (1024 * 1024))


@assignment_bp.route('/assignment/download-file')
def download_assignment_file():
    """Download an encrypted assignment/submission file."""
    if not current_user.is_authenticated:
        flash('Access denied.', 'danger')
        return redirect(url_for('main.index'))

    key = request.args.get('key', '')
    enc_key = request.args.get('enc_key', '')
    filename = request.args.get('name', 'file')

    if not key or not enc_key:
        flash('Invalid file reference.', 'danger')
        return redirect(url_for('main.index'))

    file_bytes, ext = download_document(key, enc_key)
    if not file_bytes:
        flash('Could not retrieve file.', 'danger')
        return redirect(url_for('main.index'))

    return send_file(
        io.BytesIO(file_bytes),
        download_name=filename,
        as_attachment=True
    )
