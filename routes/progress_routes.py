from flask import (Blueprint, render_template, request, redirect, url_for,
                   flash, jsonify)
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

@progress_bp.route('/student/progress')
@role_required('student')
def student_progress():
    student_id = current_user.id
    goals = LearningGoal.query.filter_by(student_id=student_id)\
        .order_by(LearningGoal.created_at.desc()).all()

    # Gather stats
    active_goals = sum(1 for g in goals if g.status == 'active')
    completed_goals = sum(1 for g in goals if g.status == 'completed')
    total_entries = sum(len(g.entries) for g in goals)

    # Get tutors the student has worked with (for creating new goals)
    completed_tutor_ids = db.session.query(Booking.tutor_id).filter(
        Booking.student_id == student_id,
        Booking.status == 'Completed'
    ).distinct().all()
    tutor_ids = [t[0] for t in completed_tutor_ids]
    tutors = Tutor.query.filter(Tutor.id.in_(tutor_ids)).all() if tutor_ids else []

    return render_template('student_progress.html',
                           goals=goals, tutors=tutors,
                           active_goals=active_goals,
                           completed_goals=completed_goals,
                           total_entries=total_entries)

@progress_bp.route('/student/goals', methods=['POST'])
@role_required('student')
def create_goal():
    student_id = current_user.id
    tutor_id = request.form.get('tutor_id', type=int)
    title = sanitize_input_length(request.form.get('title', ''), 200)
    description = sanitize_input_length(request.form.get('description', ''), 2000)
    target_date_str = request.form.get('target_date', '')

    if not all([tutor_id, title]):
        flash('Please provide a title and select a tutor.', 'danger')
        return redirect(url_for('progress_bp.student_progress'))

    # Verify student has completed a session with this tutor
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

    goal = LearningGoal(
        student_id=student_id,
        tutor_id=tutor_id,
        title=title,
        description=description or None,
        target_date=target_date,
        status='active'
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

    # Access: student who owns the goal or the tutor assigned to it
    if user_type == 'student' and goal.student_id != user_id:
        flash('Access denied.', 'danger')
        return redirect(url_for('student_bp.dashboard'))
    if user_type == 'tutor' and goal.tutor_id != user_id:
        flash('Access denied.', 'danger')
        return redirect(url_for('tutor_bp.tutor_dashboard'))

    student = Student.query.get(goal.student_id)
    tutor = Tutor.query.get(goal.tutor_id)

    # Get completed sessions between student and tutor (for linking entries)
    completed_slots = db.session.query(TutorSlot).join(Booking).filter(
        Booking.student_id == goal.student_id,
        Booking.tutor_id == goal.tutor_id,
        Booking.status == 'Completed'
    ).order_by(TutorSlot.date.desc()).limit(20).all()

    entries = ProgressEntry.query.filter_by(goal_id=goal_id)\
        .order_by(ProgressEntry.created_at.desc()).all()

    return render_template('goal_detail.html',
                           goal=goal, student=student, tutor=tutor,
                           entries=entries, completed_slots=completed_slots,
                           user_type=user_type)

@progress_bp.route('/student/goals/<int:goal_id>/entry', methods=['POST'])
@login_required
def add_entry(goal_id):
    goal = LearningGoal.query.get_or_404(goal_id)
    user_type = current_user.user_type
    user_id = current_user.id

    # Access: student or tutor
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

    flash('Progress entry added!', 'success')
    return redirect(url_for('progress_bp.goal_detail', goal_id=goal_id))

@progress_bp.route('/student/goals/<int:goal_id>/status', methods=['POST'])
@login_required
def update_goal_status(goal_id):
    goal = LearningGoal.query.get_or_404(goal_id)
    user_type = current_user.user_type
    user_id = current_user.id

    # Access: student or tutor
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
        flash(f'Goal marked as {new_status}!', 'success')

    return redirect(url_for('progress_bp.goal_detail', goal_id=goal_id))

@progress_bp.route('/tutor/student/<int:student_id>/progress')
@role_required('tutor')
def tutor_view_student_progress(student_id):
    tutor_id = current_user.id

    # Verify tutor has sessions with this student
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
                           student=student, goals=goals)

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

    goal = LearningGoal(
        student_id=student_id,
        tutor_id=tutor_id,
        title=title,
        description=description or None,
        target_date=target_date,
        status='active'
    )
    db.session.add(goal)
    db.session.commit()

    flash(f'Goal "{title}" created for {Student.query.get(student_id).name}!', 'success')
    return redirect(url_for('progress_bp.goal_detail', goal_id=goal.id))
