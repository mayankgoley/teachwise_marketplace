from flask import (Blueprint, render_template, redirect, url_for, flash,
                    request, jsonify, current_app)
from flask_login import login_user, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from database import db
from extensions import limiter
from models.tutor import Tutor
from models.student import Student
from models.admin import Admin
from models.booking import Booking
from models.slots import TutorSlot
from models.review import Review
from models.email_notification import EmailNotification
from utils.sanitizer import sanitize_input_length
from utils.auth import role_required, is_account_locked, increment_failed_login, reset_failed_login
from utils.validators import validate_password_complexity, get_password_error_message
from services.encryption_service import generate_token, verify_token
from datetime import datetime, timedelta
from sqlalchemy import func

admin_bp = Blueprint('admin_bp', __name__)


@admin_bp.route('/admin/login', methods=['GET', 'POST'])
@limiter.limit('10 per 15 minutes', methods=['POST'])
def admin_login():
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password')
        admin = Admin.query.filter_by(email=email).first()

        if admin and is_account_locked(admin):
            flash('Account temporarily locked. Try again in 15 minutes.', 'danger')
            return redirect(url_for('admin_bp.admin_login'))

        if not admin or not check_password_hash(admin.password, password):
            if admin:
                increment_failed_login(admin)
            flash('Invalid credentials.', 'danger')
            return redirect(url_for('admin_bp.admin_login'))

        reset_failed_login(admin)
        login_user(admin)

        # Issue JWT token for microservice auth (stored in cookie)
        try:
            from shared.jwt_auth import create_jwt_token
            jwt_token = create_jwt_token(
                uid=admin.get_id(),
                role='admin',
                name=admin.name,
                email=admin.email
            )
            resp = redirect(url_for('admin_bp.dashboard'))
            resp.set_cookie('tw_jwt', jwt_token, httponly=True,
                          secure=False, samesite='Lax', max_age=86400)
            flash(f'Welcome, {admin.name}!', 'success')
            return resp
        except Exception:
            pass  # JWT failure should not block login

        flash(f'Welcome, {admin.name}!', 'success')
        return redirect(url_for('admin_bp.dashboard'))
    return render_template('admin_login.html')


@admin_bp.route('/admin/dashboard')
@role_required('admin')
def dashboard():
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

    # Core stats
    total_students = Student.query.count()
    total_tutors = Tutor.query.count()
    verified_tutors = Tutor.query.filter_by(verification_status='verified').count()
    pending_verifications = Tutor.query.filter(
        Tutor.verification_status.in_(['pending_documents', 'documents_submitted', 'under_review'])).count()
    total_bookings = Booking.query.count()
    active_sessions = TutorSlot.query.filter(TutorSlot.status.in_(['booked', 'live'])).count()

    # Revenue
    try:
        from models.payment import Payment
        revenue_month = db.session.query(func.sum(Payment.amount)).filter(
            Payment.status == 'completed',
            Payment.completed_at >= month_start).scalar() or 0
        revenue_year = db.session.query(func.sum(Payment.amount)).filter(
            Payment.status == 'completed',
            Payment.completed_at >= year_start).scalar() or 0
    except Exception:
        revenue_month = 0
        revenue_year = 0

    # Email delivery rate
    total_emails = EmailNotification.query.count()
    sent_emails = EmailNotification.query.filter_by(status='sent').count()
    email_rate = round((sent_emails / total_emails * 100) if total_emails > 0 else 0, 1)

    # Recent tutors for verification table
    tutors = Tutor.query.order_by(Tutor.id.desc()).limit(50).all()

    return render_template('admin_dashboard.html',
                           total_students=total_students,
                           total_tutors=total_tutors,
                           verified_tutors=verified_tutors,
                           pending_verifications=pending_verifications,
                           total_bookings=total_bookings,
                           active_sessions=active_sessions,
                           revenue_month=float(revenue_month),
                           revenue_year=float(revenue_year),
                           email_rate=email_rate,
                           tutors=tutors)


@admin_bp.route('/admin/users')
@role_required('admin')
def admin_users():
    user_type = request.args.get('type', 'all')
    search = request.args.get('q', '')
    page = request.args.get('page', 1, type=int)

    students = []
    tutors = []

    if user_type in ('all', 'student'):
        sq = Student.query
        if search:
            sq = sq.filter(Student.name.ilike(f'%{search}%') | Student.email.ilike(f'%{search}%'))
        students = sq.order_by(Student.id.desc()).all()

    if user_type in ('all', 'tutor'):
        tq = Tutor.query
        if search:
            tq = tq.filter(Tutor.name.ilike(f'%{search}%') | Tutor.email.ilike(f'%{search}%'))
        tutors = tq.order_by(Tutor.id.desc()).all()

    return render_template('admin_users.html',
                           students=students, tutors=tutors,
                           user_type=user_type, search=search)


@admin_bp.route('/admin/bookings')
@role_required('admin')
def admin_bookings():
    status = request.args.get('status', '')
    page = request.args.get('page', 1, type=int)

    query = db.session.query(Booking, TutorSlot, Tutor, Student).join(
        TutorSlot, Booking.slot_id == TutorSlot.id
    ).join(
        Tutor, Booking.tutor_id == Tutor.id
    ).join(
        Student, Booking.student_id == Student.id
    )

    if status:
        query = query.filter(Booking.status == status)

    paginated = query.order_by(Booking.booked_on.desc()).paginate(
        page=page, per_page=30, error_out=False)

    return render_template('admin_bookings.html', results=paginated, status=status)


@admin_bp.route('/admin/emails')
@role_required('admin')
def admin_emails():

    page = request.args.get('page', 1, type=int)
    status_filter = request.args.get('status', '')

    query = EmailNotification.query
    if status_filter:
        query = query.filter_by(status=status_filter)

    paginated = query.order_by(EmailNotification.id.desc()).paginate(
        page=page, per_page=30, error_out=False)

    return render_template('admin_emails.html', results=paginated, status=status_filter)


@admin_bp.route('/admin/api/stats/registrations')
@role_required('admin')
def api_stats_registrations():

    now = datetime.utcnow()
    months = []
    for i in range(11, -1, -1):
        m = now.month - i
        y = now.year
        while m <= 0:
            m += 12
            y -= 1
        month_start = datetime(y, m, 1)
        if m == 12:
            month_end = datetime(y + 1, 1, 1)
        else:
            month_end = datetime(y, m + 1, 1)

        s_count = Student.query.filter(
            Student.created_at >= month_start, Student.created_at < month_end).count()
        t_count = Tutor.query.filter(
            Tutor.created_at >= month_start, Tutor.created_at < month_end).count()
        months.append({
            'month': month_start.strftime('%b %Y'),
            'students': s_count, 'tutors': t_count
        })
    return jsonify(months)


@admin_bp.route('/admin/api/stats/bookings')
@role_required('admin')
def api_stats_bookings():

    now = datetime.utcnow()
    weeks = []
    for i in range(7, -1, -1):
        week_start = now - timedelta(weeks=i, days=now.weekday())
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        week_end = week_start + timedelta(days=7)
        count = Booking.query.filter(
            Booking.booked_on >= week_start, Booking.booked_on < week_end).count()
        weeks.append({'week': week_start.strftime('%b %d'), 'count': count})
    return jsonify(weeks)


@admin_bp.route('/admin/api/stats/revenue')
@role_required('admin')
def api_stats_revenue():

    try:
        from models.payment import Payment
    except ImportError:
        return jsonify([])

    now = datetime.utcnow()
    months = []
    for i in range(11, -1, -1):
        m = now.month - i
        y = now.year
        while m <= 0:
            m += 12
            y -= 1
        total = db.session.query(func.sum(Payment.amount)).filter(
            Payment.status == 'completed',
            func.extract('month', Payment.completed_at) == m,
            func.extract('year', Payment.completed_at) == y
        ).scalar() or 0
        months.append({
            'month': datetime(y, m, 1).strftime('%b %Y'),
            'amount': round(float(total), 2)
        })
    return jsonify(months)


@admin_bp.route('/admin/process/<int:tutor_id>', methods=['POST'])
@role_required('admin')
def process_tutor(tutor_id):
    if current_user.role not in ['superadmin', 'admin']:
        flash('Permission denied.', 'danger')
        return redirect(url_for('admin_bp.dashboard'))
    tutor = Tutor.query.get_or_404(tutor_id)
    action = request.form.get('action')
    tutor.admin_feedback = sanitize_input_length(request.form.get('admin_feedback', ''), 500)
    tutor.reviewed_by = current_user.name
    tutor.reviewed_on = datetime.utcnow()
    if action == 'approve':
        tutor.verification_status = 'verified'
        tutor.verified_on = datetime.utcnow()
        tutor.is_profile_complete = True
        flash(f'{tutor.name} has been verified.', 'success')
    elif action == 'reject':
        tutor.verification_status = 'rejected'
        flash(f'{tutor.name} has been rejected.', 'danger')
    elif action == 'revision':
        tutor.verification_status = 'revision_required'
        flash(f'{tutor.name} marked for revision.', 'warning')
    db.session.commit()

    # Publish tutor.verified event for search-service & notification-service
    if action == 'approve':
        try:
            from shared.event_bus import publish_event
            publish_event('tutor.verified', {
                'tutor_id': tutor.id,
                'tutor_name': tutor.name,
                'subjects': tutor.subjects if hasattr(tutor, 'subjects') else '',
                'verified_by': current_user.name,
            })
        except Exception:
            pass  # Event failure must not block admin flow

    return redirect(url_for('admin_bp.dashboard'))

@admin_bp.route('/admin/forgot-password', methods=['GET', 'POST'])
@limiter.limit('3 per hour', methods=['POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        flash('If an account with that email exists, we have sent a password reset link.', 'info')

        admin = Admin.query.filter_by(email=email).first()
        if admin:
            try:
                from services.email_service import send_email, email_password_reset
                token = generate_token({'admin_id': admin.id}, salt='admin-reset-pw')
                reset_url = current_app.config['APP_URL'] + f'/admin/reset-password/{token}'
                subj, html = email_password_reset(admin.name, reset_url)
                send_email(admin.email, subj, html, 'password_reset', 'admin')
            except Exception:
                pass

        return redirect(url_for('admin_bp.admin_login'))

    return render_template('forgot_password.html',
                           action_url=url_for('admin_bp.forgot_password'),
                           login_url=url_for('admin_bp.admin_login'),
                           user_type='Admin')


@admin_bp.route('/admin/reset-password/<token>', methods=['GET', 'POST'])
@limiter.limit('3 per hour', methods=['POST'])
def reset_password(token):
    data = verify_token(token, salt='admin-reset-pw', max_age=3600)
    if not data:
        flash('This reset link has expired or is invalid.', 'danger')
        return redirect(url_for('admin_bp.forgot_password'))

    admin = Admin.query.get(data.get('admin_id'))
    if not admin:
        flash('Account not found.', 'danger')
        return redirect(url_for('admin_bp.forgot_password'))

    if request.method == 'POST':
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')

        if not validate_password_complexity(password):
            flash(get_password_error_message(password), 'danger')
            return render_template('reset_password.html', token=token, user_type='Admin')

        if password != confirm_password:
            flash('Passwords do not match.', 'danger')
            return render_template('reset_password.html', token=token, user_type='Admin')

        admin.password = generate_password_hash(password)
        admin.failed_login_attempts = 0
        admin.locked_until = None
        db.session.commit()

        flash('Password reset successfully!', 'success')
        return redirect(url_for('admin_bp.admin_login'))

    return render_template('reset_password.html', token=token, user_type='Admin')


@admin_bp.route('/admin/logout')
def admin_logout():
    logout_user()
    flash('Logged out.', 'info')
    return redirect(url_for('main.index'))
