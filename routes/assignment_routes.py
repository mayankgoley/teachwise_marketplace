from flask import Blueprint, render_template, request, redirect, url_for, flash, send_file
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
from datetime import datetime
import io

assignment_bp = Blueprint('assignment_bp', __name__)

ALLOWED_EXTENSIONS = {'pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


def _allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@assignment_bp.route('/tutor/assignments')
@role_required('tutor')
def tutor_assignments():
    tutor_id = current_user.id
    assignments = Assignment.query.filter_by(tutor_id=tutor_id)\
        .order_by(Assignment.created_at.desc()).all()

    # Get students who had completed sessions with this tutor
    completed_student_ids = db.session.query(Booking.student_id).filter(
        Booking.tutor_id == tutor_id,
        Booking.status == 'Completed'
    ).distinct().all()
    student_ids = [s[0] for s in completed_student_ids]
    eligible_students = Student.query.filter(Student.id.in_(student_ids)).all() if student_ids else []

    return render_template('tutor_assignments.html',
                           assignments=assignments,
                           eligible_students=eligible_students)


@assignment_bp.route('/tutor/assignments/create', methods=['POST'])
@role_required('tutor')
def create_assignment():
    tutor_id = current_user.id
    student_id = request.form.get('student_id', type=int)
    title = sanitize_input_length(request.form.get('title', ''), 200)
    description = sanitize_input_length(request.form.get('description', ''), 2000)
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

    file_data = []
    files = request.files.getlist('files')
    for f in files:
        if f and f.filename and _allowed_file(f.filename):
            file_bytes = f.read()
            if len(file_bytes) > MAX_FILE_SIZE:
                flash(f'File {f.filename} exceeds 5MB limit.', 'danger')
                continue
            result = upload_document(file_bytes, tutor_id, f.filename)
            if result:
                file_data.append({
                    'name': f.filename,
                    'key': result['r2_object_key'],
                    'encryption_key': result['file_encryption_key']
                })

    assignment = Assignment(
        tutor_id=tutor_id,
        student_id=student_id,
        title=title,
        description=description,
        due_date=due_date,
        file_urls=file_data
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
        grade = sanitize_input_length(request.form.get('grade', ''), 50)
        feedback = sanitize_input_length(request.form.get('feedback', ''), 2000)

        assignment.submission.grade = grade
        assignment.submission.feedback = feedback
        assignment.submission.reviewed_at = datetime.utcnow()
        assignment.status = 'reviewed'
        db.session.commit()

        flash('Review submitted!', 'success')
        return redirect(url_for('assignment_bp.tutor_assignments'))

    return render_template('review_submission.html', assignment=assignment)


@assignment_bp.route('/student/assignments')
@login_required
def student_assignments():
    assignments = Assignment.query.filter_by(student_id=current_user.id)\
        .order_by(Assignment.due_date.asc()).all()
    return render_template('student_assignments.html', assignments=assignments)


@assignment_bp.route('/student/assignments/<int:assignment_id>/submit', methods=['GET', 'POST'])
@login_required
def submit_assignment(assignment_id):
    assignment = Assignment.query.get_or_404(assignment_id)

    if assignment.student_id != current_user.id:
        flash('Access denied.', 'danger')
        return redirect(url_for('assignment_bp.student_assignments'))

    if assignment.submission:
        flash('You already submitted this assignment.', 'info')
        return redirect(url_for('assignment_bp.student_assignments'))

    if request.method == 'POST':
        text_response = sanitize_input_length(request.form.get('text_response', ''), 5000)

        file_data = []
        files = request.files.getlist('files')
        for f in files:
            if f and f.filename and _allowed_file(f.filename):
                file_bytes = f.read()
                if len(file_bytes) > MAX_FILE_SIZE:
                    flash(f'File {f.filename} exceeds 5MB limit.', 'danger')
                    continue
                result = upload_document(file_bytes, current_user.id, f.filename)
                if result:
                    file_data.append({
                        'name': f.filename,
                        'key': result['r2_object_key'],
                        'encryption_key': result['file_encryption_key']
                    })

        if not text_response and not file_data:
            flash('Please provide a text response or upload files.', 'danger')
            return render_template('submit_assignment.html', assignment=assignment)

        submission = Submission(
            assignment_id=assignment.id,
            student_id=current_user.id,
            text_response=text_response or None,
            file_urls=file_data
        )
        db.session.add(submission)
        assignment.status = 'submitted'
        db.session.commit()

        flash('Assignment submitted!', 'success')
        return redirect(url_for('assignment_bp.student_assignments'))

    return render_template('submit_assignment.html', assignment=assignment)


@assignment_bp.route('/assignment/download-file')
def download_assignment_file():
    """Download an encrypted assignment/submission file."""
    # Auth: must be logged-in student or tutor
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
