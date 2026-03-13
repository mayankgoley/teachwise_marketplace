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
from models.audit_log import AuditLog
from models.platform_setting import PlatformSetting
from models.content_report import ContentReport
from utils.sanitizer import sanitize_input_length
from utils.auth import role_required, is_account_locked, increment_failed_login, reset_failed_login
from utils.validators import validate_password_complexity, get_password_error_message
from services.encryption_service import generate_token, verify_token
from datetime import datetime, timedelta
from sqlalchemy import func

admin_bp = Blueprint('admin_bp', __name__)


def _log_action(action, target_type=None, target_id=None, details=None):
    """C7: Create audit log entry."""
    log = AuditLog(
        admin_id=current_user.id if current_user.is_authenticated else None,
        admin_name=current_user.name if current_user.is_authenticated else None,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
        ip_address=request.remote_addr
    )
    db.session.add(log)


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

        try:
            from shared.jwt_auth import create_jwt_token
            jwt_token = create_jwt_token(
                uid=admin.get_id(), role='admin',
                name=admin.name, email=admin.email
            )
            resp = redirect(url_for('admin_bp.dashboard'))
            resp.set_cookie('tw_jwt', jwt_token, httponly=True,
                          secure=False, samesite='Lax', max_age=86400)
            flash(f'Welcome, {admin.name}!', 'success')
            return resp
        except Exception as e:
            current_app.logger.error(f'Failed to create JWT token for admin {admin.email}: {e}')

        flash(f'Welcome, {admin.name}!', 'success')
        return redirect(url_for('admin_bp.dashboard'))
    return render_template('admin_login.html')


@admin_bp.route('/admin/dashboard')
@role_required('admin')
def dashboard():
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

    total_students = Student.query.count()
    total_tutors = Tutor.query.count()
    verified_tutors = Tutor.query.filter_by(verification_status='verified').count()
    pending_verifications = Tutor.query.filter(
        Tutor.verification_status.in_(['pending_documents', 'documents_submitted', 'under_review'])).count()
    total_bookings = Booking.query.count()
    active_sessions = TutorSlot.query.filter(TutorSlot.status.in_(['booked', 'live'])).count()

    try:
        from models.payment import Payment
        revenue_month = db.session.query(func.sum(Payment.amount)).filter(
            Payment.status == 'completed',
            Payment.completed_at >= month_start).scalar() or 0
        revenue_year = db.session.query(func.sum(Payment.amount)).filter(
            Payment.status == 'completed',
            Payment.completed_at >= year_start).scalar() or 0
    except Exception as e:
        current_app.logger.error(f'Failed to calculate dashboard revenue: {e}')
        revenue_month = 0
        revenue_year = 0

    total_emails = EmailNotification.query.count()
    sent_emails = EmailNotification.query.filter_by(status='sent').count()
    email_rate = round((sent_emails / total_emails * 100) if total_emails > 0 else 0, 1)

    # C5: Pending moderation count
    pending_reports = ContentReport.query.filter_by(status='pending').count()
    try:
        from models.review import ReviewReport
        pending_review_reports = ReviewReport.query.filter_by(status='pending').count()
    except Exception as e:
        current_app.logger.error(f'Failed to query pending review reports: {e}')
        pending_review_reports = 0

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
                           pending_reports=pending_reports + pending_review_reports,
                           tutors=tutors)


# C1: Bulk user actions
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


# C1: Bulk action endpoint
@admin_bp.route('/admin/users/bulk', methods=['POST'])
@role_required('admin')
def bulk_user_action():
    action = request.form.get('action')
    user_ids = request.form.getlist('user_ids')
    target_type = request.form.get('target_type', 'tutor')

    if not user_ids or not action:
        flash('No users selected or action specified.', 'warning')
        return redirect(url_for('admin_bp.admin_users'))

    count = 0
    for uid in user_ids:
        uid = int(uid)
        if target_type == 'tutor':
            tutor = Tutor.query.get(uid)
            if not tutor:
                continue
            if action == 'verify':
                tutor.verification_status = 'verified'
                tutor.verified_on = datetime.utcnow()
                tutor.is_profile_complete = True
            elif action == 'suspend':
                tutor.verification_status = 'rejected'
            elif action == 'reset_password':
                tutor.failed_login_attempts = 0
                tutor.locked_until = None
            count += 1
        elif target_type == 'student':
            student = Student.query.get(uid)
            if not student:
                continue
            if action == 'reset_password':
                student.failed_login_attempts = 0
                student.locked_until = None
            count += 1

    _log_action(f'bulk_{action}', target_type, None,
                {'user_ids': user_ids, 'count': count})
    db.session.commit()
    flash(f'Bulk action "{action}" applied to {count} user(s).', 'success')
    return redirect(url_for('admin_bp.admin_users'))


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


# C2: Verification checklist
@admin_bp.route('/admin/verification/<int:tutor_id>')
@role_required('admin')
def verification_checklist(tutor_id):
    tutor = Tutor.query.get_or_404(tutor_id)
    checklist = tutor.verification_checklist or {}

    default_items = [
        ('identity_verified', 'Identity document verified'),
        ('background_check', 'Background check completed'),
        ('qualifications_verified', 'Qualifications/certifications verified'),
        ('references_checked', 'References checked'),
        ('profile_complete', 'Profile is complete and professional'),
        ('trial_session', 'Trial session completed (if applicable)'),
    ]

    try:
        from models.tutor_document import TutorDocument
        documents = TutorDocument.query.filter_by(tutor_id=tutor_id).order_by(
            TutorDocument.uploaded_at.desc()).all()
    except Exception as e:
        current_app.logger.error(f'Failed to load tutor documents for tutor {tutor_id}: {e}')
        documents = []

    return render_template('admin_verification_checklist.html',
                           tutor=tutor, checklist=checklist,
                           default_items=default_items,
                           documents=documents)


@admin_bp.route('/admin/verification/<int:tutor_id>/save', methods=['POST'])
@role_required('admin')
def save_verification_checklist(tutor_id):
    tutor = Tutor.query.get_or_404(tutor_id)
    checklist = {}
    for key in request.form:
        if key.startswith('check_'):
            item_key = key[6:]
            checklist[item_key] = True

    tutor.verification_checklist = checklist
    _log_action('update_verification_checklist', 'tutor', tutor_id,
                {'checklist': checklist})
    db.session.commit()
    flash(f'Verification checklist updated for {tutor.name}.', 'success')
    return redirect(url_for('admin_bp.verification_checklist', tutor_id=tutor_id))


# C3: Booking analytics
@admin_bp.route('/admin/analytics/bookings')
@role_required('admin')
def booking_analytics():
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total = Booking.query.count()
    this_month = Booking.query.filter(Booking.booked_on >= month_start).count()
    completed = Booking.query.filter_by(status='Completed').count()
    cancelled = Booking.query.filter_by(status='Cancelled').count()
    completion_rate = round((completed / total * 100) if total > 0 else 0, 1)
    cancellation_rate = round((cancelled / total * 100) if total > 0 else 0, 1)

    # Popular subjects
    popular_subjects = db.session.query(
        TutorSlot.subject, func.count(Booking.id).label('cnt')
    ).join(Booking, Booking.slot_id == TutorSlot.id
    ).group_by(TutorSlot.subject
    ).order_by(func.count(Booking.id).desc()
    ).limit(10).all()

    # Popular tutors
    popular_tutors = db.session.query(
        Tutor.name, func.count(Booking.id).label('cnt')
    ).join(Booking, Booking.tutor_id == Tutor.id
    ).group_by(Tutor.name
    ).order_by(func.count(Booking.id).desc()
    ).limit(10).all()

    # Bookings by day of week
    dow_stats = db.session.query(
        func.extract('dow', Booking.booked_on).label('dow'),
        func.count(Booking.id)
    ).group_by('dow').order_by('dow').all()

    return render_template('admin_booking_analytics.html',
                           total=total, this_month=this_month,
                           completed=completed, cancelled=cancelled,
                           completion_rate=completion_rate,
                           cancellation_rate=cancellation_rate,
                           popular_subjects=popular_subjects,
                           popular_tutors=popular_tutors,
                           dow_stats=dow_stats)


# C4: System analytics
@admin_bp.route('/admin/analytics/system')
@role_required('admin')
def system_analytics():
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)

    total_students = Student.query.count()
    total_tutors = Tutor.query.count()
    new_students_week = Student.query.filter(Student.created_at >= week_ago).count()
    new_tutors_week = Tutor.query.filter(Tutor.created_at >= week_ago).count()

    total_reviews = Review.query.count()
    avg_rating = db.session.query(func.avg(Review.rating)).scalar() or 0

    total_emails = EmailNotification.query.count()
    sent_emails = EmailNotification.query.filter_by(status='sent').count()
    failed_emails = EmailNotification.query.filter_by(status='failed').count()

    try:
        from models.chatbot import ChatbotConversation
        total_chats = ChatbotConversation.query.count()
        escalated_chats = ChatbotConversation.query.filter_by(status='escalated').count()
    except Exception as e:
        current_app.logger.error(f'Failed to query chatbot conversation stats: {e}')
        total_chats = 0
        escalated_chats = 0

    return render_template('admin_system_analytics.html',
                           total_students=total_students,
                           total_tutors=total_tutors,
                           new_students_week=new_students_week,
                           new_tutors_week=new_tutors_week,
                           total_reviews=total_reviews,
                           avg_rating=round(float(avg_rating), 1),
                           total_emails=total_emails,
                           sent_emails=sent_emails,
                           failed_emails=failed_emails,
                           total_chats=total_chats,
                           escalated_chats=escalated_chats)


# C5: Moderation queue
@admin_bp.route('/admin/moderation')
@role_required('admin')
def moderation_queue():
    status_filter = request.args.get('status', 'pending')

    content_reports = ContentReport.query.filter_by(
        status=status_filter
    ).order_by(ContentReport.created_at.desc()).all()

    try:
        from models.review import ReviewReport
        review_reports = ReviewReport.query.filter_by(
            status=status_filter
        ).order_by(ReviewReport.created_at.desc()).all()
    except Exception as e:
        current_app.logger.error(f'Failed to load review reports for moderation queue: {e}')
        review_reports = []

    return render_template('admin_moderation.html',
                           content_reports=content_reports,
                           review_reports=review_reports,
                           status_filter=status_filter)


@admin_bp.route('/admin/moderation/content/<int:report_id>/action', methods=['POST'])
@role_required('admin')
def moderate_content(report_id):
    report = ContentReport.query.get_or_404(report_id)
    action = request.form.get('action')  # dismiss, remove

    report.status = 'reviewed' if action == 'dismiss' else 'removed'
    report.reviewed_by = current_user.name
    report.reviewed_at = datetime.utcnow()

    _log_action(f'moderate_content_{action}', 'content_report', report_id,
                {'content_type': report.content_type, 'content_id': report.content_id})
    db.session.commit()
    flash(f'Report #{report_id} {action}ed.', 'success')
    return redirect(url_for('admin_bp.moderation_queue'))


@admin_bp.route('/admin/moderation/review/<int:report_id>/action', methods=['POST'])
@role_required('admin')
def moderate_review_report(report_id):
    try:
        from models.review import ReviewReport
        report = ReviewReport.query.get_or_404(report_id)
    except Exception as e:
        current_app.logger.error(f'Failed to load review report {report_id}: {e}')
        flash('Report not found.', 'danger')
        return redirect(url_for('admin_bp.moderation_queue'))

    action = request.form.get('action')
    report.status = 'reviewed' if action == 'dismiss' else 'removed'

    _log_action(f'moderate_review_{action}', 'review_report', report_id,
                {'review_id': report.review_id})
    db.session.commit()
    flash(f'Review report #{report_id} {action}ed.', 'success')
    return redirect(url_for('admin_bp.moderation_queue'))


# C6: Revenue dashboard
@admin_bp.route('/admin/analytics/revenue')
@role_required('admin')
def revenue_dashboard():
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

    try:
        from models.payment import Payment
        revenue_today = db.session.query(func.sum(Payment.amount)).filter(
            Payment.status == 'completed',
            Payment.completed_at >= now.replace(hour=0, minute=0, second=0, microsecond=0)
        ).scalar() or 0

        revenue_month = db.session.query(func.sum(Payment.amount)).filter(
            Payment.status == 'completed',
            Payment.completed_at >= month_start).scalar() or 0

        revenue_year = db.session.query(func.sum(Payment.amount)).filter(
            Payment.status == 'completed',
            Payment.completed_at >= year_start).scalar() or 0

        total_revenue = db.session.query(func.sum(Payment.amount)).filter(
            Payment.status == 'completed').scalar() or 0

        total_transactions = Payment.query.filter_by(status='completed').count()
        avg_transaction = (total_revenue / total_transactions) if total_transactions > 0 else 0

        platform_fee_pct = current_app.config.get('PLATFORM_FEE_PERCENT', 15)
        platform_revenue = float(total_revenue) * platform_fee_pct / 100
    except Exception as e:
        current_app.logger.error(f'Failed to calculate revenue dashboard data: {e}')
        revenue_today = revenue_month = revenue_year = total_revenue = 0
        total_transactions = 0
        avg_transaction = 0
        platform_fee_pct = 15
        platform_revenue = 0

    return render_template('admin_revenue_dashboard.html',
                           revenue_today=float(revenue_today),
                           revenue_month=float(revenue_month),
                           revenue_year=float(revenue_year),
                           total_revenue=float(total_revenue),
                           total_transactions=total_transactions,
                           avg_transaction=float(avg_transaction),
                           platform_fee_pct=platform_fee_pct,
                           platform_revenue=float(platform_revenue))


# C7: Audit log
@admin_bp.route('/admin/audit-log')
@role_required('admin')
def audit_log():
    page = request.args.get('page', 1, type=int)
    action_filter = request.args.get('action', '')

    query = AuditLog.query
    if action_filter:
        query = query.filter(AuditLog.action.ilike(f'%{action_filter}%'))

    paginated = query.order_by(AuditLog.created_at.desc()).paginate(
        page=page, per_page=50, error_out=False)

    return render_template('admin_audit_log.html',
                           results=paginated, action_filter=action_filter)


# C8: Platform settings
@admin_bp.route('/admin/settings', methods=['GET', 'POST'])
@role_required('admin')
def platform_settings():
    if current_user.role not in ['superadmin', 'admin']:
        flash('Permission denied.', 'danger')
        return redirect(url_for('admin_bp.dashboard'))

    if request.method == 'POST':
        settings_to_save = [
            ('platform_name', 'Platform Name', 'general'),
            ('platform_fee_percent', 'Platform Fee %', 'payments'),
            ('max_booking_advance_days', 'Max Booking Advance (days)', 'bookings'),
            ('min_session_price', 'Min Session Price ($)', 'payments'),
            ('max_session_price', 'Max Session Price ($)', 'payments'),
            ('support_email', 'Support Email', 'general'),
            ('maintenance_mode', 'Maintenance Mode', 'system'),
            ('new_registrations_enabled', 'New Registrations', 'system'),
        ]
        for key, desc, cat in settings_to_save:
            val = request.form.get(key, '').strip()
            if val:
                PlatformSetting.set(key, val, description=desc,
                                    category=cat, updated_by=current_user.name)

        _log_action('update_platform_settings', 'settings', None,
                    {'updated_keys': [k for k, _, _ in settings_to_save if request.form.get(k)]})
        db.session.commit()
        flash('Platform settings saved.', 'success')
        return redirect(url_for('admin_bp.platform_settings'))

    settings = PlatformSetting.query.order_by(PlatformSetting.category, PlatformSetting.key).all()
    settings_dict = {s.key: s.value for s in settings}

    return render_template('admin_platform_settings.html',
                           settings=settings, settings_dict=settings_dict)


# --- Stats APIs ---
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

    _log_action(f'tutor_{action}', 'tutor', tutor_id,
                {'tutor_name': tutor.name, 'feedback': tutor.admin_feedback})
    db.session.commit()

    if action == 'approve':
        try:
            from shared.event_bus import publish_event
            publish_event('tutor.verified', {
                'tutor_id': tutor.id, 'tutor_name': tutor.name,
                'subjects': tutor.subjects if hasattr(tutor, 'subjects') else '',
                'verified_by': current_user.name,
            })
        except Exception as e:
            current_app.logger.error(f'Failed to publish tutor.verified event for tutor {tutor.id}: {e}')

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
            except Exception as e:
                current_app.logger.error(f'Failed to send password reset email to admin {admin.email}: {e}')

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
