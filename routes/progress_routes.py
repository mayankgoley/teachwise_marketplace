from flask import (Blueprint, render_template, request, redirect, url_for,
                   flash, jsonify, make_response)
from flask_login import login_required, current_user
from utils.auth import role_required
from utils.sanitizer import sanitize_input_length
from models.learning_goal import LearningGoal, ProgressEntry
from models.booking import Booking
from models.tutor import Tutor
from models.student import Student
from models.slots import TutorSlot
from database import db
from datetime import datetime

progress_bp = Blueprint('progress_bp', __name__)

# goal templates
GOAL_TEMPLATES = [
    {'title': 'Master Core Concepts', 'description': 'Build a solid foundation in fundamental concepts and theories.'},
    {'title': 'Exam Preparation', 'description': 'Prepare for an upcoming exam with focused study and practice problems.'},
    {'title': 'Improve Problem Solving', 'description': 'Develop stronger analytical and problem-solving skills.'},
    {'title': 'Build a Project', 'description': 'Apply knowledge by building a hands-on project from start to finish.'},
    {'title': 'Catch Up on Coursework', 'description': 'Review and understand missed or challenging material.'},
    {'title': 'Advanced Topics', 'description': 'Explore advanced concepts beyond the standard curriculum.'},
]


@progress_bp.route('/student/progress')
@role_required('student')
def student_progress():
    student_id = current_user.id
    goals = LearningGoal.query.filter_by(student_id=student_id)\
        .order_by(LearningGoal.created_at.desc()).all()

    active_goals = sum(1 for g in goals if g.status == 'active')
    completed_goals = sum(1 for g in goals if g.status == 'completed')
    total_entries = sum(len(g.entries) for g in goals)

    completed_tutor_ids = db.session.query(Booking.tutor_id).filter(
        Booking.student_id == student_id,
        Booking.status == 'Completed'
    ).distinct().all()
    tutor_ids = [t[0] for t in completed_tutor_ids]
    tutors = Tutor.query.filter(Tutor.id.in_(tutor_ids)).all() if tutor_ids else []

    # collect unique skill tags across all goals
    all_tags = set()
    for g in goals:
        if g.skill_tags:
            all_tags.update(g.skill_tags)

    return render_template('student_progress.html',
                           goals=goals, tutors=tutors,
                           active_goals=active_goals,
                           completed_goals=completed_goals,
                           total_entries=total_entries,
                           goal_templates=GOAL_TEMPLATES,
                           all_tags=sorted(all_tags))


@progress_bp.route('/student/goals', methods=['POST'])
@role_required('student')
def create_goal():
    student_id = current_user.id
    tutor_id = request.form.get('tutor_id', type=int)
    title = sanitize_input_length(request.form.get('title', ''), 200)
    description = sanitize_input_length(request.form.get('description', ''), 2000)
    target_date_str = request.form.get('target_date', '')
    skill_tags_str = request.form.get('skill_tags', '')

    if not all([tutor_id, title]):
        flash('Please provide a title and select a tutor.', 'danger')
        return redirect(url_for('progress_bp.student_progress'))

    has_session = Booking.query.filter_by(
        student_id=student_id, tutor_id=tutor_id, status='Completed'
    ).first()
    if not has_session:
        flash('You can only create goals with tutors you\'ve had sessions with.', 'danger')
        return redirect(url_for('progress_bp.student_progress'))

    target_date = None
    if target_date_str:
        try:
            target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
        except ValueError:
            pass

    skill_tags = None
    if skill_tags_str.strip():
        skill_tags = [t.strip() for t in skill_tags_str.split(',') if t.strip()][:10]

    goal = LearningGoal(
        student_id=student_id,
        tutor_id=tutor_id,
        title=title,
        description=description or None,
        target_date=target_date,
        status='active',
        skill_tags=skill_tags
    )
    db.session.add(goal)
    db.session.commit()

    flash(f'Goal "{title}" created!', 'success')
    return redirect(url_for('progress_bp.goal_detail', goal_id=goal.id))


@progress_bp.route('/student/goals/<int:goal_id>')
@login_required
def goal_detail(goal_id):
    goal = LearningGoal.query.get_or_404(goal_id)
    user_type = current_user.user_type
    user_id = current_user.id

    if user_type == 'student' and goal.student_id != user_id:
        flash('Access denied.', 'danger')
        return redirect(url_for('student_bp.dashboard'))
    if user_type == 'tutor' and goal.tutor_id != user_id:
        flash('Access denied.', 'danger')
        return redirect(url_for('tutor_bp.tutor_dashboard'))

    student = Student.query.get(goal.student_id)
    tutor = Tutor.query.get(goal.tutor_id)

    completed_slots = db.session.query(TutorSlot).join(Booking).filter(
        Booking.student_id == goal.student_id,
        Booking.tutor_id == goal.tutor_id,
        Booking.status == 'Completed'
    ).order_by(TutorSlot.date.desc()).limit(20).all()

    entries = ProgressEntry.query.filter_by(goal_id=goal_id)\
        .order_by(ProgressEntry.created_at.desc()).all()

    # chart data — ratings over time
    chart_entries = ProgressEntry.query.filter_by(goal_id=goal_id)\
        .order_by(ProgressEntry.created_at.asc()).all()
    chart_labels = [e.created_at.strftime('%b %d') for e in chart_entries if e.rating]
    chart_ratings = [e.rating for e in chart_entries if e.rating]

    return render_template('goal_detail.html',
                           goal=goal, student=student, tutor=tutor,
                           entries=entries, completed_slots=completed_slots,
                           user_type=user_type,
                           chart_labels=chart_labels,
                           chart_ratings=chart_ratings)


@progress_bp.route('/student/goals/<int:goal_id>/entry', methods=['POST'])
@login_required
def add_entry(goal_id):
    goal = LearningGoal.query.get_or_404(goal_id)
    user_type = current_user.user_type
    user_id = current_user.id

    if user_type == 'student' and goal.student_id != user_id:
        flash('Access denied.', 'danger')
        return redirect(url_for('student_bp.dashboard'))
    if user_type == 'tutor' and goal.tutor_id != user_id:
        flash('Access denied.', 'danger')
        return redirect(url_for('tutor_bp.tutor_dashboard'))

    note = sanitize_input_length(request.form.get('note', ''), 2000)
    rating = request.form.get('rating', type=int)
    slot_id = request.form.get('slot_id', type=int) or None

    if not note or not note.strip():
        flash('Please provide a note.', 'danger')
        return redirect(url_for('progress_bp.goal_detail', goal_id=goal_id))

    if rating and (rating < 1 or rating > 5):
        rating = None

    entry = ProgressEntry(
        goal_id=goal_id,
        slot_id=slot_id,
        note=note.strip(),
        rating=rating,
        created_by=user_type
    )
    db.session.add(entry)
    db.session.commit()

    # celebrate if the goal is already done
    if goal.status == 'completed':
        flash('__CELEBRATION__', 'celebration')
    else:
        flash('Progress entry added!', 'success')
    return redirect(url_for('progress_bp.goal_detail', goal_id=goal_id))


@progress_bp.route('/student/goals/<int:goal_id>/status', methods=['POST'])
@login_required
def update_goal_status(goal_id):
    goal = LearningGoal.query.get_or_404(goal_id)
    user_type = current_user.user_type
    user_id = current_user.id

    if user_type == 'student' and goal.student_id != user_id:
        flash('Access denied.', 'danger')
        return redirect(url_for('student_bp.dashboard'))
    if user_type == 'tutor' and goal.tutor_id != user_id:
        flash('Access denied.', 'danger')
        return redirect(url_for('tutor_bp.tutor_dashboard'))

    new_status = request.form.get('status', '')
    if new_status in ('active', 'completed', 'paused'):
        goal.status = new_status
        db.session.commit()
        if new_status == 'completed':
            flash('__CELEBRATION__', 'celebration')
        else:
            flash(f'Goal marked as {new_status}!', 'success')

    return redirect(url_for('progress_bp.goal_detail', goal_id=goal_id))


@progress_bp.route('/student/goals/<int:goal_id>/tags', methods=['POST'])
@login_required
def update_skill_tags(goal_id):
    """Update skill tags for a goal."""
    goal = LearningGoal.query.get_or_404(goal_id)
    user_type = current_user.user_type
    user_id = current_user.id

    if user_type == 'student' and goal.student_id != user_id:
        return jsonify({'error': 'Access denied'}), 403
    if user_type == 'tutor' and goal.tutor_id != user_id:
        return jsonify({'error': 'Access denied'}), 403

    data = request.get_json(silent=True) or {}
    tags = data.get('tags', [])
    goal.skill_tags = [t.strip() for t in tags if t.strip()][:10]
    db.session.commit()
    return jsonify({'ok': True, 'tags': goal.skill_tags})


@progress_bp.route('/tutor/student/<int:student_id>/progress')
@role_required('tutor')
def tutor_view_student_progress(student_id):
    tutor_id = current_user.id

    has_session = Booking.query.filter_by(
        tutor_id=tutor_id, student_id=student_id, status='Completed'
    ).first()
    if not has_session:
        flash('You haven\'t had sessions with this student.', 'danger')
        return redirect(url_for('tutor_bp.tutor_dashboard'))

    student = Student.query.get_or_404(student_id)
    goals = LearningGoal.query.filter_by(
        student_id=student_id, tutor_id=tutor_id
    ).order_by(LearningGoal.created_at.desc()).all()

    return render_template('tutor_student_progress.html',
                           student=student, goals=goals,
                           goal_templates=GOAL_TEMPLATES)


@progress_bp.route('/tutor/student/<int:student_id>/goals', methods=['POST'])
@role_required('tutor')
def tutor_create_goal(student_id):
    tutor_id = current_user.id

    has_session = Booking.query.filter_by(
        tutor_id=tutor_id, student_id=student_id, status='Completed'
    ).first()
    if not has_session:
        flash('Access denied.', 'danger')
        return redirect(url_for('tutor_bp.tutor_dashboard'))

    title = sanitize_input_length(request.form.get('title', ''), 200)
    description = sanitize_input_length(request.form.get('description', ''), 2000)
    target_date_str = request.form.get('target_date', '')
    skill_tags_str = request.form.get('skill_tags', '')

    if not title:
        flash('Please provide a title.', 'danger')
        return redirect(url_for('progress_bp.tutor_view_student_progress',
                                student_id=student_id))

    target_date = None
    if target_date_str:
        try:
            target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
        except ValueError:
            pass

    skill_tags = None
    if skill_tags_str.strip():
        skill_tags = [t.strip() for t in skill_tags_str.split(',') if t.strip()][:10]

    goal = LearningGoal(
        student_id=student_id,
        tutor_id=tutor_id,
        title=title,
        description=description or None,
        target_date=target_date,
        status='active',
        skill_tags=skill_tags
    )
    db.session.add(goal)
    db.session.commit()

    flash(f'Goal "{title}" created for {Student.query.get(student_id).name}!', 'success')
    return redirect(url_for('progress_bp.goal_detail', goal_id=goal.id))


# after a session ends, surface active goals to prompt for a progress entry
@progress_bp.route('/api/progress/prompt/<int:slot_id>')
@login_required
def progress_prompt(slot_id):
    """After a session completes, check if there are active goals to prompt progress entry."""
    slot = TutorSlot.query.get_or_404(slot_id)
    user_type = current_user.user_type
    user_id = current_user.id

    if user_type == 'student' and slot.student_id != user_id:
        return jsonify({'goals': []})
    if user_type == 'tutor' and slot.tutor_id != user_id:
        return jsonify({'goals': []})

    student_id = slot.student_id
    tutor_id = slot.tutor_id

    goals = LearningGoal.query.filter_by(
        student_id=student_id, tutor_id=tutor_id, status='active'
    ).all()

    return jsonify({
        'goals': [{
            'id': g.id,
            'title': g.title,
            'url': url_for('progress_bp.goal_detail', goal_id=g.id)
        } for g in goals]
    })


# pdf progress report
@progress_bp.route('/student/goals/<int:goal_id>/report')
@login_required
def goal_report_pdf(goal_id):
    goal = LearningGoal.query.get_or_404(goal_id)
    user_type = current_user.user_type
    user_id = current_user.id

    if user_type == 'student' and goal.student_id != user_id:
        flash('Access denied.', 'danger')
        return redirect(url_for('student_bp.dashboard'))
    if user_type == 'tutor' and goal.tutor_id != user_id:
        flash('Access denied.', 'danger')
        return redirect(url_for('tutor_bp.tutor_dashboard'))

    from fpdf import FPDF
    student = Student.query.get(goal.student_id)
    tutor = Tutor.query.get(goal.tutor_id)
    entries = ProgressEntry.query.filter_by(goal_id=goal_id)\
        .order_by(ProgressEntry.created_at.asc()).all()

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font('Arial', 'B', 16)
    pdf.cell(0, 10, 'TeachWise Progress Report', ln=True, align='C')
    pdf.ln(5)

    pdf.set_font('Arial', 'B', 12)
    pdf.cell(0, 8, goal.title, ln=True)
    pdf.set_font('Arial', '', 10)
    pdf.cell(0, 6, f'Student: {student.name}  |  Tutor: {tutor.name}', ln=True)
    pdf.cell(0, 6, f'Status: {goal.status.capitalize()}  |  Created: {goal.created_at.strftime("%b %d, %Y")}', ln=True)
    if goal.target_date:
        pdf.cell(0, 6, f'Target Date: {goal.target_date.strftime("%b %d, %Y")}', ln=True)
    if goal.skill_tags:
        pdf.cell(0, 6, f'Skills: {", ".join(goal.skill_tags)}', ln=True)
    if goal.description:
        pdf.ln(3)
        pdf.multi_cell(0, 5, goal.description)

    pdf.ln(5)
    pdf.set_font('Arial', 'B', 12)
    pdf.cell(0, 8, f'Progress Entries ({len(entries)})', ln=True)
    pdf.set_font('Arial', '', 10)

    for entry in entries:
        pdf.ln(3)
        rating_str = f'  [Rating: {entry.rating}/5]' if entry.rating else ''
        pdf.set_font('Arial', 'B', 10)
        date_str = entry.created_at.strftime('%b %d, %Y %I:%M %p')
        pdf.cell(0, 6, f'{date_str} - {entry.created_by.capitalize()}{rating_str}', ln=True)
        pdf.set_font('Arial', '', 10)
        # Encode to latin-1 safe
        safe_note = entry.note.encode('latin-1', 'replace').decode('latin-1')
        pdf.multi_cell(0, 5, safe_note)

    # Average rating
    rated = [e.rating for e in entries if e.rating]
    if rated:
        pdf.ln(5)
        avg = sum(rated) / len(rated)
        pdf.set_font('Arial', 'B', 10)
        pdf.cell(0, 6, f'Average Session Rating: {avg:.1f} / 5.0', ln=True)

    pdf_bytes = pdf.output(dest='S').encode('latin-1')
    response = make_response(pdf_bytes)
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = f'attachment; filename=progress_report_{goal_id}.pdf'
    return response
