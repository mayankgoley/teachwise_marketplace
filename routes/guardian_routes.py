from flask import Blueprint, redirect, url_for, flash, render_template, request, current_app, jsonify
from flask_login import login_user, logout_user, current_user
from services.encryption_service import generate_token, verify_token
from models.guardian import Guardian
from extensions import limiter
from models.student import Student
from models.booking import Booking
from models.slots import TutorSlot
from models.tutor import Tutor
from models.guardian_message import GuardianMessage
from database import db
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from utils.auth import role_required, is_account_locked, increment_failed_login, reset_failed_login
from utils.validators import validate_password_complexity, get_password_error_message
from utils.sanitizer import sanitize_input_length
from services.booking_service import cancel_booking as do_cancel_booking, reopen_slot

guardian_bp = Blueprint('guardian_bp', __name__)

@guardian_bp.route('/guardian/verify/<token>')
def verify_guardian(token):
    data = verify_token(token, salt='guardian-verify', max_age=172800)
    if not data:
        flash('This link has expired or is invalid.', 'danger')
        return redirect(url_for('main.index'))

    guardian = Guardian.query.get(data.get('guardian_id'))
    if not guardian:
        flash('Guardian not found.', 'danger')
        return redirect(url_for('main.index'))

    if guardian.is_verified:
        flash('Already verified!', 'info')
        return redirect(url_for('main.index'))

    guardian.is_verified = True
    guardian.verified_on = datetime.utcnow()
    db.session.commit()

    if not guardian.password_hash:
        token = generate_token({'guardian_id': guardian.id}, salt='guardian-setpw')
        flash('Verified! Please set a password for your guardian dashboard.', 'success')
        return redirect(url_for('guardian_bp.set_password', token=token))

    flash('Guardian verification complete!', 'success')
    return redirect(url_for('guardian_bp.guardian_login'))

@guardian_bp.route('/guardian/set-password/<token>', methods=['GET', 'POST'])
def set_password(token):
    data = verify_token(token, salt='guardian-setpw', max_age=259200)
    if not data:
        flash('This link has expired or is invalid.', 'danger')
        return redirect(url_for('main.index'))

    guardian = Guardian.query.get(data.get('guardian_id'))
    if not guardian:
        flash('Guardian not found.', 'danger')
        return redirect(url_for('main.index'))

    if request.method == 'POST':
        pw = request.form.get('password', '').strip()
        pw2 = request.form.get('password_confirm', '').strip()
        if not validate_password_complexity(pw):
            flash(get_password_error_message(pw), 'danger')
        elif pw != pw2:
            flash('Passwords do not match.', 'danger')
        else:
            guardian.password_hash = generate_password_hash(pw)
            db.session.commit()
            flash('Password set! You can now log in.', 'success')
            return redirect(url_for('guardian_bp.guardian_login'))

    return render_template('guardian_set_password.html', guardian=guardian)

@guardian_bp.route('/guardian/login', methods=['GET', 'POST'])
@limiter.limit('10 per 15 minutes', methods=['POST'])
def guardian_login():
    if current_user.is_authenticated and current_user.user_type == 'guardian':
        return redirect(url_for('guardian_bp.guardian_dashboard'))

    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')

        guardian = Guardian.query.filter_by(email=email).first()

        if guardian and is_account_locked(guardian):
            flash('Account temporarily locked. Try again in 15 minutes.', 'danger')
            return redirect(url_for('guardian_bp.guardian_login'))

        if not guardian or not guardian.password_hash:
            flash('Invalid email or password.', 'danger')
            return redirect(url_for('guardian_bp.guardian_login'))
        if not check_password_hash(guardian.password_hash, password):
            increment_failed_login(guardian)
            flash('Invalid email or password.', 'danger')
            return redirect(url_for('guardian_bp.guardian_login'))
        if not guardian.is_verified:
            flash('Please verify your email first.', 'warning')
            return redirect(url_for('guardian_bp.guardian_login'))

        reset_failed_login(guardian)
        login_user(guardian)
        guardian.last_login = datetime.utcnow()
        db.session.commit()

        try:
            from shared.jwt_auth import create_jwt_token
            jwt_token = create_jwt_token(
                uid=guardian.get_id(), role='guardian',
                name=guardian.name, email=guardian.email
            )
            resp = redirect(url_for('guardian_bp.guardian_dashboard'))
            resp.set_cookie('tw_jwt', jwt_token, httponly=True,
                          secure=False, samesite='Lax', max_age=86400)
            flash(f'Welcome back, {guardian.name}!', 'success')
            return resp
        except Exception:
            pass

        flash(f'Welcome back, {guardian.name}!', 'success')
        return redirect(url_for('guardian_bp.guardian_dashboard'))

    return render_template('guardian_login.html')


@guardian_bp.route('/guardian/logout')
def guardian_logout():
    logout_user()
    flash('Logged out.', 'info')
    return redirect(url_for('main.index'))

@guardian_bp.route('/guardian/dashboard')
@role_required('guardian')
def guardian_dashboard():
    guardian = current_user
    students = Student.query.filter_by(guardian_id=guardian.id).all()

    # per-child stats
    children = []
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    for s in students:
        total_bookings = Booking.query.filter_by(student_id=s.id).count()
        pending_approval = Booking.query.filter_by(
            student_id=s.id, guardian_approved=None
        ).filter(Booking.status == 'Booked').count()

        total_spent = db.session.query(db.func.coalesce(db.func.sum(TutorSlot.price), 0))\
            .join(Booking, Booking.slot_id == TutorSlot.id)\
            .filter(Booking.student_id == s.id, Booking.status != 'Cancelled').scalar()

        completed = Booking.query.filter_by(student_id=s.id, status='Completed').count()
        upcoming = Booking.query.filter_by(student_id=s.id, status='Booked').count()

        spent_this_week = db.session.query(db.func.coalesce(db.func.sum(TutorSlot.price), 0))\
            .join(Booking, Booking.slot_id == TutorSlot.id)\
            .filter(Booking.student_id == s.id, Booking.status != 'Cancelled',
                    Booking.booked_on >= week_ago).scalar()

        spent_this_month = db.session.query(db.func.coalesce(db.func.sum(TutorSlot.price), 0))\
            .join(Booking, Booking.slot_id == TutorSlot.id)\
            .filter(Booking.student_id == s.id, Booking.status != 'Cancelled',
                    Booking.booked_on >= month_ago).scalar()

        children.append({
            'student': s,
            'total_bookings': total_bookings,
            'completed': completed,
            'upcoming': upcoming,
            'pending_approval': pending_approval,
            'total_spent': float(total_spent or 0),
            'spent_this_week': float(spent_this_week or 0),
            'spent_this_month': float(spent_this_month or 0),
        })

    # Pending bookings needing guardian approval
    student_ids = [s.id for s in students]
    pending_bookings = []
    if student_ids:
        pending_bookings = Booking.query.filter(
            Booking.student_id.in_(student_ids),
            Booking.guardian_approved.is_(None),
            Booking.status == 'Booked'
        ).order_by(Booking.booked_on.desc()).all()

    # recent activity feed
    activity_feed = []
    if student_ids:
        recent = Booking.query.filter(
            Booking.student_id.in_(student_ids),
            Booking.booked_on >= week_ago
        ).order_by(Booking.booked_on.desc()).limit(20).all()

        for b in recent:
            student = next((c['student'] for c in children if c['student'].id == b.student_id), None)
            tutor = Tutor.query.get(b.tutor_id)
            slot = TutorSlot.query.get(b.slot_id)
            activity_feed.append({
                'booking': b, 'student': student,
                'tutor': tutor, 'slot': slot,
                'timestamp': b.booked_on
            })

    unread_messages = 0
    if student_ids:
        unread_messages = GuardianMessage.query.filter(
            GuardianMessage.guardian_id == guardian.id,
            GuardianMessage.sender_type == 'tutor',
            GuardianMessage.is_read == False
        ).count()

    # warn when a child is near the weekly/monthly spend limit
    spending_warnings = []
    for c in children:
        if guardian.weekly_spending_limit and c['spent_this_week'] >= guardian.weekly_spending_limit * 0.8:
            pct = int(c['spent_this_week'] / guardian.weekly_spending_limit * 100)
            spending_warnings.append({
                'student': c['student'].name,
                'type': 'weekly',
                'pct': min(pct, 100),
                'spent': c['spent_this_week'],
                'limit': guardian.weekly_spending_limit
            })
        if guardian.monthly_spending_limit and c['spent_this_month'] >= guardian.monthly_spending_limit * 0.8:
            pct = int(c['spent_this_month'] / guardian.monthly_spending_limit * 100)
            spending_warnings.append({
                'student': c['student'].name,
                'type': 'monthly',
                'pct': min(pct, 100),
                'spent': c['spent_this_month'],
                'limit': guardian.monthly_spending_limit
            })

    return render_template('guardian_dashboard.html',
                           guardian=guardian,
                           children=children,
                           pending_bookings=pending_bookings,
                           activity_feed=activity_feed,
                           unread_messages=unread_messages,
                           spending_warnings=spending_warnings)

@guardian_bp.route('/guardian/child/<int:student_id>')
@role_required('guardian')
def child_activity(student_id):
    guardian = current_user
    student = Student.query.get_or_404(student_id)

    if student.guardian_id != guardian.id:
        flash('Access denied.', 'danger')
        return redirect(url_for('guardian_bp.guardian_dashboard'))

    bookings = Booking.query.filter_by(student_id=student.id)\
        .order_by(Booking.booked_on.desc()).all()

    booking_details = []
    for b in bookings:
        slot = TutorSlot.query.get(b.slot_id)
        tutor = Tutor.query.get(b.tutor_id)
        booking_details.append({
            'booking': b, 'slot': slot, 'tutor': tutor
        })

    total_spent = sum(bd['slot'].price for bd in booking_details
                      if bd['slot'] and bd['booking'].status != 'Cancelled')

    child_config = (guardian.child_notification_config or {}).get(str(student_id), {})

    return render_template('guardian_child_activity.html',
                           guardian=guardian,
                           student=student,
                           booking_details=booking_details,
                           total_spent=total_spent,
                           child_config=child_config)


# save per-child notification config
@guardian_bp.route('/guardian/child/<int:student_id>/config', methods=['POST'])
@role_required('guardian')
def save_child_config(student_id):
    guardian = current_user
    student = Student.query.get_or_404(student_id)
    if student.guardian_id != guardian.id:
        flash('Access denied.', 'danger')
        return redirect(url_for('guardian_bp.guardian_dashboard'))

    config = guardian.child_notification_config or {}
    config[str(student_id)] = {
        'booking_alerts': 'booking_alerts' in request.form,
        'session_reminders': 'session_reminders' in request.form,
        'spending_alerts': 'spending_alerts' in request.form,
        'progress_reports': 'progress_reports' in request.form,
    }
    guardian.child_notification_config = config
    db.session.commit()
    flash(f'Notification settings updated for {student.name}.', 'success')
    return redirect(url_for('guardian_bp.child_activity', student_id=student_id))


@guardian_bp.route('/guardian/approve-booking/<int:booking_id>', methods=['POST'])
@role_required('guardian')
def approve_booking(booking_id):
    guardian = current_user
    booking = Booking.query.get_or_404(booking_id)
    student = Student.query.get(booking.student_id)

    if not student or student.guardian_id != guardian.id:
        flash('Access denied.', 'danger')
        return redirect(url_for('guardian_bp.guardian_dashboard'))

    booking.guardian_approved = True
    booking.guardian_approved_on = datetime.utcnow()
    db.session.commit()
    flash(f'Booking #{booking.id} approved.', 'success')
    return redirect(url_for('guardian_bp.guardian_dashboard'))


@guardian_bp.route('/guardian/reject-booking/<int:booking_id>', methods=['POST'])
@role_required('guardian')
def reject_booking(booking_id):
    guardian = current_user
    booking = Booking.query.get_or_404(booking_id)
    student = Student.query.get(booking.student_id)

    if not student or student.guardian_id != guardian.id:
        flash('Access denied.', 'danger')
        return redirect(url_for('guardian_bp.guardian_dashboard'))

    booking.guardian_approved = False
    booking.guardian_approved_on = datetime.utcnow()

    result = do_cancel_booking(booking, 'guardian', refund_pct=100)

    flash(f'Booking #{booking.id} rejected. Slot released.', 'info')
    return redirect(url_for('guardian_bp.guardian_dashboard'))

@guardian_bp.route('/guardian/emergency-cancel/<int:booking_id>', methods=['POST'])
@role_required('guardian')
def emergency_cancel(booking_id):
    guardian = current_user
    booking = Booking.query.get_or_404(booking_id)
    student = Student.query.get(booking.student_id)

    if not student or student.guardian_id != guardian.id:
        flash('Access denied.', 'danger')
        return redirect(url_for('guardian_bp.guardian_dashboard'))

    if booking.status == 'Cancelled':
        flash('This booking is already cancelled.', 'warning')
        return redirect(url_for('guardian_bp.guardian_dashboard'))

    slot = TutorSlot.query.get(booking.slot_id)
    result = do_cancel_booking(booking, 'guardian', refund_pct=100)
    refund_amount = slot.price if slot else 0

    flash(f'Emergency cancellation complete. Full refund of ${refund_amount:.2f} will be processed.', 'success')
    return redirect(url_for('guardian_bp.guardian_dashboard'))


# guardian <-> tutor messaging
@guardian_bp.route('/guardian/messages')
@role_required('guardian')
def guardian_messages():
    guardian = current_user
    students = Student.query.filter_by(guardian_id=guardian.id).all()
    student_ids = [s.id for s in students]

    # Get unique tutor conversations
    conversations = db.session.query(
        GuardianMessage.tutor_id,
        GuardianMessage.student_id,
        db.func.max(GuardianMessage.created_at).label('last_msg'),
        db.func.sum(db.case(
            (db.and_(GuardianMessage.sender_type == 'tutor',
                     GuardianMessage.is_read == False), 1),
            else_=0
        )).label('unread')
    ).filter(
        GuardianMessage.guardian_id == guardian.id
    ).group_by(
        GuardianMessage.tutor_id, GuardianMessage.student_id
    ).order_by(db.desc('last_msg')).all()

    conv_list = []
    for conv in conversations:
        tutor = Tutor.query.get(conv.tutor_id)
        student = Student.query.get(conv.student_id)
        conv_list.append({
            'tutor': tutor,
            'student': student,
            'last_msg': conv.last_msg,
            'unread': int(conv.unread or 0)
        })

    return render_template('guardian_messages.html',
                           guardian=guardian,
                           conversations=conv_list,
                           students=students)


@guardian_bp.route('/guardian/messages/<int:tutor_id>/<int:student_id>', methods=['GET', 'POST'])
@role_required('guardian')
def guardian_message_thread(tutor_id, student_id):
    guardian = current_user
    student = Student.query.get_or_404(student_id)
    if student.guardian_id != guardian.id:
        flash('Access denied.', 'danger')
        return redirect(url_for('guardian_bp.guardian_messages'))

    tutor = Tutor.query.get_or_404(tutor_id)

    if request.method == 'POST':
        content = sanitize_input_length(request.form.get('content', '').strip(), 1000)
        if content:
            msg = GuardianMessage(
                guardian_id=guardian.id,
                tutor_id=tutor_id,
                student_id=student_id,
                sender_type='guardian',
                content=content
            )
            db.session.add(msg)
            db.session.commit()
        return redirect(url_for('guardian_bp.guardian_message_thread',
                                tutor_id=tutor_id, student_id=student_id))

    # Mark messages as read
    GuardianMessage.query.filter_by(
        guardian_id=guardian.id, tutor_id=tutor_id,
        student_id=student_id, sender_type='tutor', is_read=False
    ).update({'is_read': True})
    db.session.commit()

    messages = GuardianMessage.query.filter_by(
        guardian_id=guardian.id, tutor_id=tutor_id, student_id=student_id
    ).order_by(GuardianMessage.created_at.asc()).all()

    return render_template('guardian_message_thread.html',
                           guardian=guardian, tutor=tutor,
                           student=student, messages=messages)


@guardian_bp.route('/guardian/spending-limits', methods=['GET', 'POST'])
@role_required('guardian')
def spending_limits():
    guardian = current_user
    if request.method == 'POST':
        weekly = request.form.get('weekly_limit', '').strip()
        monthly = request.form.get('monthly_limit', '').strip()
        guardian.weekly_spending_limit = float(weekly) if weekly else None
        guardian.monthly_spending_limit = float(monthly) if monthly else None
        db.session.commit()
        flash('Spending limits updated.', 'success')
        return redirect(url_for('guardian_bp.guardian_dashboard'))

    return render_template('guardian_spending_limits.html', guardian=guardian)


@guardian_bp.route('/guardian/forgot-password', methods=['GET', 'POST'])
@limiter.limit('3 per hour', methods=['POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        flash('If an account with that email exists, we have sent a password reset link.', 'info')

        guardian = Guardian.query.filter_by(email=email).first()
        if guardian and guardian.is_verified:
            try:
                from services.email_service import send_email, email_password_reset
                token = generate_token({'guardian_id': guardian.id}, salt='guardian-reset-pw')
                reset_url = current_app.config['APP_URL'] + f'/guardian/reset-password/{token}'
                subj, html = email_password_reset(guardian.name, reset_url)
                send_email(guardian.email, subj, html, 'password_reset', 'guardian')
            except Exception:
                pass

        return redirect(url_for('guardian_bp.guardian_login'))

    return render_template('forgot_password.html',
                           action_url=url_for('guardian_bp.forgot_password'),
                           login_url=url_for('guardian_bp.guardian_login'),
                           user_type='Guardian')


@guardian_bp.route('/guardian/reset-password/<token>', methods=['GET', 'POST'])
@limiter.limit('3 per hour', methods=['POST'])
def guardian_reset_password(token):
    data = verify_token(token, salt='guardian-reset-pw', max_age=3600)
    if not data:
        flash('This reset link has expired or is invalid.', 'danger')
        return redirect(url_for('guardian_bp.forgot_password'))

    guardian = Guardian.query.get(data.get('guardian_id'))
    if not guardian:
        flash('Account not found.', 'danger')
        return redirect(url_for('guardian_bp.forgot_password'))

    if request.method == 'POST':
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')

        if not validate_password_complexity(password):
            flash(get_password_error_message(password), 'danger')
            return render_template('reset_password.html', token=token, user_type='Guardian')

        if password != confirm_password:
            flash('Passwords do not match.', 'danger')
            return render_template('reset_password.html', token=token, user_type='Guardian')

        guardian.password_hash = generate_password_hash(password)
        guardian.failed_login_attempts = 0
        guardian.locked_until = None
        db.session.commit()

        flash('Password reset successfully!', 'success')
        return redirect(url_for('guardian_bp.guardian_login'))

    return render_template('reset_password.html', token=token, user_type='Guardian')

@guardian_bp.route('/guardian/notification-settings', methods=['GET', 'POST'])
@role_required('guardian')
def guardian_notification_settings():
    guardian = current_user

    if request.method == 'POST':
        guardian.notification_prefs = {
            'booking_notifications': 'booking_notifications' in request.form,
            'session_reminders': 'session_reminders' in request.form,
            'spending_alerts': 'spending_alerts' in request.form,
        }
        db.session.commit()
        flash('Notification preferences saved.', 'success')
        return redirect(url_for('guardian_bp.guardian_dashboard'))

    return render_template('guardian_notification_settings.html', guardian=guardian)
