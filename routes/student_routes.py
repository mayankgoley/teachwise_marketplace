from flask import Blueprint, render_template, request, redirect, url_for, flash, Response, current_app
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import login_user, logout_user, login_required, current_user
from utils.auth import role_required, is_account_locked, increment_failed_login, reset_failed_login
from database import db
from extensions import limiter
from models.student import Student
from models.guardian import Guardian
from models.review import Review
from models.booking import Booking
from models.slots import TutorSlot
from utils.sanitizer import sanitize_input_length
from utils.validators import (
    validate_password_complexity, get_password_error_message,
    validate_email_format, validate_name, validate_phone,
    validate_date_of_birth
)
from services.encryption_service import generate_token, verify_token
from services.booking_service import cancel_booking as do_cancel_booking
from datetime import datetime

student_bp = Blueprint('student_bp', __name__)


@student_bp.route('/student/register', methods=['GET', 'POST'])
@limiter.limit('5 per hour', methods=['POST'])
def register_student():
    if request.method == 'POST':
        # Validate name
        name, name_error = validate_name(request.form.get('name', ''), max_length=100)
        if name_error:
            flash(name_error, 'danger')
            return redirect(url_for('student_bp.register_student'))

        # Validate email
        email = validate_email_format(request.form.get('email', ''))
        if not email:
            flash('Invalid email format.', 'danger')
            return redirect(url_for('student_bp.register_student'))

        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        dob_str = request.form.get('date_of_birth')

        if not all([name, email, password, confirm_password, dob_str]):
            flash('All fields are required.', 'warning')
            return redirect(url_for('student_bp.register_student'))

        if password != confirm_password:
            flash('Passwords do not match.', 'danger')
            return redirect(url_for('student_bp.register_student'))

        if not validate_password_complexity(password):
            flash(get_password_error_message(password), 'danger')
            return redirect(url_for('student_bp.register_student'))

        if Student.query.filter_by(email=email).first():
            flash('An account with this email already exists.', 'danger')
            return redirect(url_for('student_bp.register_student'))

        # Validate date of birth (min_age=0 to allow any age, max_age=120 for sanity check)
        dob, dob_error = validate_date_of_birth(dob_str, min_age=0, max_age=120)
        if dob_error:
            flash(dob_error, 'danger')
            return redirect(url_for('student_bp.register_student'))

        student = Student(
            name=name,
            email=email,
            password=generate_password_hash(password),
            date_of_birth=dob,
            timezone=request.form.get('timezone', 'America/New_York')
        )

        from datetime import date
        today = date.today()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

        if age < 18:
            # Validate guardian name
            guardian_name, g_name_error = validate_name(
                request.form.get('guardian_name', ''), max_length=100)
            if g_name_error:
                flash(f'Guardian: {g_name_error}', 'danger')
                return redirect(url_for('student_bp.register_student'))

            # Validate guardian email
            guardian_email = validate_email_format(request.form.get('guardian_email', ''))
            if not guardian_email:
                flash('Guardian email format is invalid.', 'danger')
                return redirect(url_for('student_bp.register_student'))

            # Validate guardian phone (optional)
            guardian_phone, phone_error = validate_phone(request.form.get('guardian_phone', ''))
            if phone_error:
                flash(f'Guardian phone: {phone_error}', 'danger')
                return redirect(url_for('student_bp.register_student'))

            # Validate relationship
            guardian_rel, rel_error = validate_name(
                request.form.get('guardian_relationship', 'Parent'), max_length=50)
            if rel_error:
                flash(f'Guardian relationship: {rel_error}', 'danger')
                return redirect(url_for('student_bp.register_student'))

            guardian = Guardian(
                name=guardian_name,
                email=guardian_email,
                relationship=guardian_rel
            )
            if guardian_phone:
                guardian.phone = guardian_phone  # Encrypted by the setter

            db.session.add(guardian)
            db.session.flush()  # Get guardian.id
            student.guardian_id = guardian.id

        try:
            db.session.add(student)
            db.session.commit()

            # Send welcome email
            try:
                from services.email_service import send_email, email_welcome_student
                from services.encryption_service import generate_token
                from flask import current_app
                token = generate_token({'student_id': student.id})
                verify_url = current_app.config['APP_URL'] + f'/student/verify/{token}'
                subj, html = email_welcome_student(student.name, verify_url)
                send_email(student.email, subj, html, 'welcome_student', 'student')
            except Exception as e:
                current_app.logger.error(f'Failed to send welcome email to student {student.email}: {e}')
                pass  # Email failure should not block registration

            # Send guardian verification if minor
            if student.is_minor and student.guardian:
                try:
                    from services.email_service import send_email, email_guardian_verification
                    from services.encryption_service import generate_token
                    from flask import current_app
                    g_token = generate_token(
                        {'guardian_id': student.guardian.id},
                        salt='guardian-verify')
                    g_url = current_app.config['APP_URL'] + f'/guardian/verify/{g_token}'
                    subj, html = email_guardian_verification(
                        student.guardian.name, student.name, g_url)
                    send_email(student.guardian.email, subj, html,
                               'guardian_verify', 'guardian')
                except Exception as e:
                    current_app.logger.error(f'Failed to send guardian verification email for student {student.id}: {e}')

            flash('Account created! Please check your email.', 'success')
            return redirect(url_for('student_bp.login_student'))

        except Exception as e:
            db.session.rollback()
            flash(f'Error creating account: {e}', 'danger')

    return render_template('register.html')


@student_bp.route('/student/login', methods=['GET', 'POST'])
@limiter.limit('10 per 15 minutes', methods=['POST'])
def login_student():
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password')

        student = Student.query.filter_by(email=email).first()

        if student and is_account_locked(student):
            flash('Account temporarily locked due to too many failed attempts. Try again in 15 minutes.', 'danger')
            return redirect(url_for('student_bp.login_student'))

        if not student or not check_password_hash(student.password, password):
            if student:
                increment_failed_login(student)
            flash('Invalid email or password.', 'danger')
            return redirect(url_for('student_bp.login_student'))

        # Successful login
        reset_failed_login(student)
        login_user(student)

        # Issue JWT token for microservice auth (stored in cookie)
        try:
            from shared.jwt_auth import create_jwt_token
            jwt_token = create_jwt_token(
                uid=student.get_id(),
                role='student',
                name=student.name,
                email=student.email
            )
            resp = redirect(url_for('student_bp.dashboard'))
            resp.set_cookie('tw_jwt', jwt_token, httponly=True,
                          secure=False, samesite='Lax', max_age=86400)
            flash(f'Welcome back, {student.name}!', 'success')
            return resp
        except Exception as e:
            current_app.logger.error(f'Failed to create JWT token for student {student.email}: {e}')
            pass  # JWT failure should not block login

        flash(f'Welcome back, {student.name}!', 'success')
        return redirect(url_for('student_bp.dashboard'))

    return render_template('student_login.html')


@student_bp.route('/student/dashboard')
@role_required('student')
def dashboard():
    from models.favorite import FavoriteTutor
    from models.tutor import Tutor
    from models.payment import Payment
    from sqlalchemy import func

    now = datetime.utcnow()
    upcoming = TutorSlot.query.filter(
        TutorSlot.student_id == current_user.id,
        TutorSlot.status.in_(['booked', 'live']),
        TutorSlot.date >= now.date()
    ).order_by(TutorSlot.date.asc()).all()
    bookings = Booking.query.filter_by(
        student_id=current_user.id).filter(
        Booking.status.in_(['Booked', 'Confirmed'])).all()
    booking_map = {b.slot_id: b for b in bookings}

    # Quick-stats
    total_completed = db.session.query(func.count(Booking.id)).filter(
        Booking.student_id == current_user.id,
        Booking.status == 'Completed'
    ).scalar()
    total_spent = db.session.query(
        func.coalesce(func.sum(Payment.amount), 0)
    ).filter(
        Payment.student_id == current_user.id,
        Payment.status == 'completed'
    ).scalar()
    upcoming_count = len(upcoming)

    # Favorite tutors (up to 4 for dashboard)
    fav_records = FavoriteTutor.query.filter_by(
        student_id=current_user.id).order_by(FavoriteTutor.created_at.desc()).limit(4).all()
    fav_tutors = [Tutor.query.get(f.tutor_id) for f in fav_records]
    fav_tutors = [t for t in fav_tutors if t]

    # Pending assignments count
    from models.assignment import Assignment
    pending_assignments = Assignment.query.filter(
        Assignment.student_id == current_user.id,
        Assignment.status.in_(['assigned', 'overdue'])
    ).count()

    # Pending reschedule requests from tutors
    from models.reschedule import RescheduleRequest
    pending_reschedules = RescheduleRequest.query.join(Booking).filter(
        Booking.student_id == current_user.id,
        RescheduleRequest.status == 'pending',
        RescheduleRequest.requested_by == 'tutor',
        RescheduleRequest.expires_at > now
    ).order_by(RescheduleRequest.created_at.desc()).all()

    return render_template('student_dashboard.html',
                           student=current_user, upcoming_slots=upcoming,
                           booking_map=booking_map, now=now,
                           fav_tutors=fav_tutors,
                           pending_assignments=pending_assignments,
                           pending_reschedules=pending_reschedules,
                           total_completed=total_completed,
                           total_spent=float(total_spent),
                           upcoming_count=upcoming_count)


@student_bp.route('/student/cancel-booking/<int:booking_id>', methods=['POST'])
@role_required('student')
def cancel_booking(booking_id):
    try:
        booking = Booking.query.get_or_404(booking_id)
        if booking.student_id != current_user.id:
            flash('Unauthorized.', 'danger')
            return redirect(url_for('student_bp.dashboard'))

        slot = TutorSlot.query.get(booking.slot_id)
        if not slot:
            flash('Associated slot not found.', 'danger')
            return redirect(url_for('student_bp.dashboard'))

        booking.cancellation_reason = request.form.get('cancellation_reason', '')
        db.session.add(booking)
        db.session.flush()

        result = do_cancel_booking(booking, 'student', slot=slot)

        # Flash refund message
        refund_pct = result['refund_pct']
        if refund_pct == 100:
            refund_amount = float(slot.price or 0)
            flash(f'Booking cancelled. Full refund: ${refund_amount:.2f}.', 'success')
        elif refund_pct == 50:
            refund_amount = float(slot.price or 0) * 0.5
            flash(f'Booking cancelled. 50% refund: ${refund_amount:.2f}.', 'info')
        else:
            flash('Booking cancelled. No refund (less than 12 hours before session).', 'warning')

        return redirect(url_for('student_bp.dashboard'))
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error cancelling booking: {e}')
        flash('Error cancelling booking. Please try again.', 'danger')
        return redirect(url_for('student_bp.dashboard'))


@student_bp.route('/student/bookings')
@role_required('student')
def booking_history():
    from models.tutor import Tutor
    from models.payment import Payment
    import io, csv

    page = request.args.get('page', 1, type=int)
    status = request.args.get('status', '')
    subject = request.args.get('subject', '')
    tutor_name = request.args.get('tutor_name', '')
    date_from = request.args.get('date_from', '')
    date_to = request.args.get('date_to', '')

    query = db.session.query(Booking, TutorSlot, Tutor).join(
        TutorSlot, Booking.slot_id == TutorSlot.id
    ).join(
        Tutor, Booking.tutor_id == Tutor.id
    ).filter(Booking.student_id == current_user.id)

    if status:
        query = query.filter(Booking.status == status)
    if subject:
        query = query.filter(TutorSlot.subject.ilike(f'%{subject}%'))
    if tutor_name:
        query = query.filter(Tutor.name.ilike(f'%{tutor_name}%'))
    if date_from:
        try:
            df = datetime.strptime(date_from, '%Y-%m-%d').date()
            query = query.filter(TutorSlot.date >= df)
        except ValueError:
            pass
    if date_to:
        try:
            dt = datetime.strptime(date_to, '%Y-%m-%d').date()
            query = query.filter(TutorSlot.date <= dt)
        except ValueError:
            pass

    query = query.order_by(TutorSlot.date.desc())
    paginated = query.paginate(page=page, per_page=20, error_out=False)

    # Summary stats
    all_bookings = db.session.query(Booking, TutorSlot).join(
        TutorSlot, Booking.slot_id == TutorSlot.id
    ).filter(Booking.student_id == current_user.id).all()

    total_sessions = len(all_bookings)
    total_spent = sum(float(s.price or 0) for _, s in all_bookings
                      if _.status != 'Cancelled')

    # Reviewed booking IDs
    reviewed = {r.booking_id for r in Review.query.filter_by(
        student_id=current_user.id).all() if r.booking_id}

    return render_template('student_bookings.html',
                           results=paginated, total_sessions=total_sessions,
                           total_spent=total_spent, reviewed=reviewed,
                           status=status, subject=subject,
                           tutor_name=tutor_name, date_from=date_from,
                           date_to=date_to)


@student_bp.route('/student/bookings/export')
@role_required('student')
def booking_export():
    from models.tutor import Tutor
    import io, csv

    export_format = request.args.get('format', 'csv')
    date_from = request.args.get('date_from', '')
    date_to = request.args.get('date_to', '')

    query = db.session.query(Booking, TutorSlot, Tutor).join(
        TutorSlot, Booking.slot_id == TutorSlot.id
    ).join(
        Tutor, Booking.tutor_id == Tutor.id
    ).filter(Booking.student_id == current_user.id)

    if date_from:
        try:
            df = datetime.strptime(date_from, '%Y-%m-%d').date()
            query = query.filter(TutorSlot.date >= df)
        except ValueError:
            pass
    if date_to:
        try:
            dt = datetime.strptime(date_to, '%Y-%m-%d').date()
            query = query.filter(TutorSlot.date <= dt)
        except ValueError:
            pass

    rows = query.order_by(TutorSlot.date.desc()).all()

    if export_format == 'pdf':
        from fpdf import FPDF

        pdf = FPDF()
        pdf.add_page()
        pdf.set_font('Helvetica', 'B', 16)
        pdf.cell(0, 10, 'TeachWise - Session History', ln=True, align='C')
        pdf.set_font('Helvetica', '', 10)
        pdf.cell(0, 8, f'{current_user.name} | Generated {datetime.utcnow().strftime("%B %d, %Y")}', ln=True, align='C')
        pdf.ln(5)

        # Table header
        pdf.set_font('Helvetica', 'B', 9)
        col_widths = [25, 30, 35, 30, 20, 20, 25]
        headers = ['Date', 'Time', 'Tutor', 'Subject', 'Mode', 'Price', 'Status']
        for i, h in enumerate(headers):
            pdf.cell(col_widths[i], 8, h, border=1, align='C')
        pdf.ln()

        # Table rows
        pdf.set_font('Helvetica', '', 8)
        for booking, slot, tutor in rows:
            vals = [
                slot.date.strftime('%Y-%m-%d'),
                f"{slot.start_time.strftime('%I:%M %p')}",
                tutor.name[:18],
                (slot.subject or tutor.subject)[:16],
                slot.mode,
                f"${float(slot.price or 0):.2f}",
                booking.status
            ]
            for i, v in enumerate(vals):
                pdf.cell(col_widths[i], 7, v, border=1, align='C')
            pdf.ln()

        pdf.ln(10)
        pdf.set_font('Helvetica', 'I', 8)
        pdf.cell(0, 8, 'TeachWise - Online Tutoring Marketplace', align='C')

        pdf_bytes = pdf.output()
        return Response(
            pdf_bytes,
            mimetype='application/pdf',
            headers={'Content-Disposition': f'attachment; filename=session_history_{datetime.utcnow().strftime("%Y-%m-%d")}.pdf'}
        )

    # Default: CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Date', 'Time', 'Tutor', 'Subject', 'Mode', 'Price', 'Status'])
    for booking, slot, tutor in rows:
        writer.writerow([
            slot.date.strftime('%Y-%m-%d'),
            f"{slot.start_time.strftime('%I:%M %p')} - {slot.end_time.strftime('%I:%M %p')}",
            tutor.name, slot.subject or tutor.subject,
            slot.mode, f"${float(slot.price or 0):.2f}", booking.status
        ])

    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename=session_history_{datetime.utcnow().strftime("%Y-%m-%d")}.csv'}
    )


@student_bp.route('/student/bookings/calendar-data')
@role_required('student')
def booking_calendar_data():
    from models.tutor import Tutor
    from flask import jsonify

    rows = db.session.query(Booking, TutorSlot, Tutor).join(
        TutorSlot, Booking.slot_id == TutorSlot.id
    ).join(
        Tutor, Booking.tutor_id == Tutor.id
    ).filter(Booking.student_id == current_user.id).all()

    status_colors = {
        'Booked': '#3B82F6', 'Confirmed': '#3B82F6',
        'Completed': '#10B981', 'Cancelled': '#EF4444',
        'Pending Payment': '#F59E0B'
    }
    events = []
    for booking, slot, tutor in rows:
        start_dt = datetime.combine(slot.date, slot.start_time)
        end_dt = datetime.combine(slot.date, slot.end_time)
        events.append({
            'id': booking.id,
            'title': f"{slot.subject or tutor.subject} with {tutor.name}",
            'start': start_dt.isoformat(),
            'end': end_dt.isoformat(),
            'color': status_colors.get(booking.status, '#6B7280'),
            'extendedProps': {
                'status': booking.status,
                'tutor_name': tutor.name,
                'mode': slot.mode
            }
        })
    return jsonify(events)


@student_bp.route('/student/favorite/<int:tutor_id>', methods=['POST'])
@role_required('student')
def toggle_favorite(tutor_id):
    from models.favorite import FavoriteTutor
    from flask import jsonify

    existing = FavoriteTutor.query.filter_by(
        student_id=current_user.id, tutor_id=tutor_id).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify(is_favorited=False)
    else:
        fav = FavoriteTutor(student_id=current_user.id, tutor_id=tutor_id)
        db.session.add(fav)
        db.session.commit()
        return jsonify(is_favorited=True)


@student_bp.route('/student/favorites')
@role_required('student')
def favorites_page():
    from models.favorite import FavoriteTutor
    from models.tutor import Tutor

    sort = request.args.get('sort', 'recently_added')
    category = request.args.get('category', '')

    query = db.session.query(Tutor).join(
        FavoriteTutor, FavoriteTutor.tutor_id == Tutor.id
    ).filter(FavoriteTutor.student_id == current_user.id)

    # Category filter
    if category:
        query = query.filter(Tutor.subject == category)

    # Sorting
    if sort == 'name_asc':
        query = query.order_by(Tutor.name.asc())
    elif sort == 'name_desc':
        query = query.order_by(Tutor.name.desc())
    elif sort == 'rating_desc':
        query = query.order_by(Tutor.rating_avg.desc())
    elif sort == 'price_asc':
        query = query.order_by(Tutor.hourly_rate.asc())
    elif sort == 'price_desc':
        query = query.order_by(Tutor.hourly_rate.desc())
    else:
        sort = 'recently_added'
        query = query.order_by(FavoriteTutor.created_at.desc())

    tutors = query.all()

    # Get unique categories from all favorited tutors (unfiltered)
    categories = db.session.query(Tutor.subject).join(
        FavoriteTutor, FavoriteTutor.tutor_id == Tutor.id
    ).filter(
        FavoriteTutor.student_id == current_user.id
    ).distinct().order_by(Tutor.subject.asc()).all()
    categories = [c[0] for c in categories if c[0]]

    return render_template('student_favorites.html', tutors=tutors,
                           categories=categories, current_sort=sort,
                           current_category=category)


@student_bp.route('/student/notification-settings', methods=['GET', 'POST'])
@role_required('student')
def notification_settings():
    pref_options = [
        ('booking_notifications', 'Booking Confirmations', 'Emails when a session is booked or cancelled'),
        ('session_reminders', 'Session Reminders', 'Reminders before your upcoming sessions'),
        ('review_alerts', 'Review Alerts', 'Notifications about reviews and feedback'),
        ('marketing_emails', 'Marketing & Updates', 'Platform news, tips, and promotional offers'),
        ('email_digest', 'Daily Email Digest', 'Receive a daily summary instead of individual emails'),
    ]
    prefs = current_user.notification_prefs or {}

    if request.method == 'POST':
        new_prefs = {}
        for key, _, _ in pref_options:
            new_prefs[key] = key in request.form
        current_user.notification_prefs = new_prefs
        db.session.commit()
        flash('Notification preferences saved!', 'success')
        return redirect(url_for('student_bp.notification_settings'))

    return render_template('notification_settings.html',
                           pref_options=pref_options, prefs=prefs,
                           back_url=url_for('student_bp.dashboard'))


@student_bp.route('/student/onboarding/complete', methods=['POST'])
@role_required('student')
def complete_onboarding():
    from flask import jsonify
    current_user.has_seen_tour = True
    db.session.commit()
    return jsonify(success=True)


@student_bp.route('/student/review/<int:booking_id>', methods=['GET', 'POST'])
@role_required('student')
def submit_review(booking_id):
    from models.tutor import Tutor

    booking = Booking.query.get_or_404(booking_id)
    if booking.student_id != current_user.id:
        flash('Unauthorized.', 'danger')
        return redirect(url_for('student_bp.dashboard'))

    if booking.status != 'Completed':
        flash('You can only review completed sessions.', 'warning')
        return redirect(url_for('student_bp.dashboard'))

    if booking.booked_on:
        slot = TutorSlot.query.get(booking.slot_id)
        if slot:
            session_date = datetime.combine(slot.date, slot.end_time)
            days_since = (datetime.utcnow() - session_date).days
            if days_since > 30:
                flash('The 30-day review window has passed.', 'warning')
                return redirect(url_for('student_bp.dashboard'))

    existing = Review.query.filter_by(
        student_id=current_user.id, booking_id=booking_id).first()
    if existing:
        flash('You have already reviewed this session.', 'info')
        return redirect(url_for('tutor_bp.view_tutor_profile', tutor_id=booking.tutor_id))

    tutor = Tutor.query.get(booking.tutor_id)
    slot = TutorSlot.query.get(booking.slot_id)

    if request.method == 'POST':
        # Dimension ratings
        r_know = request.form.get('rating_knowledge', type=int)
        r_comm = request.form.get('rating_communication', type=int)
        r_punc = request.form.get('rating_punctuality', type=int)
        r_val = request.form.get('rating_value', type=int)

        dims = [r_know, r_comm, r_punc, r_val]
        if all(d and 1 <= d <= 5 for d in dims):
            rating = round(sum(dims) / 4)
        else:
            rating = request.form.get('rating', type=int)

        comment = sanitize_input_length(request.form.get('comment', ''), 1000)

        if not rating or rating < 1 or rating > 5:
            flash('Please provide ratings for all dimensions.', 'warning')
            return redirect(url_for('student_bp.submit_review', booking_id=booking_id))

        # require a real comment, not one-word reviews
        if comment and len(comment.strip()) < 20:
            flash('Please write at least 20 characters in your comment.', 'warning')
            return redirect(url_for('student_bp.submit_review', booking_id=booking_id))

        review = Review(
            student_id=current_user.id,
            tutor_id=booking.tutor_id,
            booking_id=booking_id,
            rating=rating,
            rating_knowledge=r_know,
            rating_communication=r_comm,
            rating_punctuality=r_punc,
            rating_value=r_val,
            comment=comment,
            is_verified=True
        )
        db.session.add(review)
        db.session.commit()

        try:
            from services.search_service import invalidate_search_cache
            invalidate_search_cache()
        except Exception as e:
            current_app.logger.error(f'Failed to invalidate search cache after review: {e}')

        # Publish review.created event for search-service & notification-service
        try:
            from shared.event_bus import publish_event
            publish_event('review.created', {
                'review_id': review.id,
                'student_id': current_user.id,
                'tutor_id': booking.tutor_id,
                'rating': rating,
                'student_name': current_user.name,
                'booking_id': booking_id,
            })
        except Exception as e:
            current_app.logger.error(f'Failed to publish review.created event for review {review.id}: {e}')
            pass  # Event failure must not block review submission

        flash('Review submitted! Thank you for your feedback.', 'success')
        return redirect(url_for('tutor_bp.view_tutor_profile', tutor_id=booking.tutor_id))

    return render_template('submit_review.html', booking=booking, tutor=tutor, slot=slot)


@student_bp.route('/student/locations')
@role_required('student')
def saved_locations():
    from models.student_saved_location import StudentSavedLocation
    locations = StudentSavedLocation.query.filter_by(
        student_id=current_user.id
    ).order_by(StudentSavedLocation.created_at.asc()).all()
    return render_template('student_saved_locations.html', locations=locations)


@student_bp.route('/student/locations', methods=['POST'])
@role_required('student')
def add_saved_location():
    from models.student_saved_location import StudentSavedLocation

    count = StudentSavedLocation.query.filter_by(student_id=current_user.id).count()
    if count >= 5:
        flash('You can save up to 5 locations. Delete one to add a new one.', 'warning')
        return redirect(url_for('student_bp.saved_locations'))

    lat = request.form.get('latitude', type=float)
    lng = request.form.get('longitude', type=float)
    if lat is None or lng is None:
        flash('Please select a location on the map.', 'warning')
        return redirect(url_for('student_bp.saved_locations'))

    label = sanitize_input_length(request.form.get('label', ''), 100)
    address = sanitize_input_length(request.form.get('address', ''), 255)
    location_type = request.form.get('location_type', 'other')
    valid_types = ['home', 'library', 'cafe', 'school', 'park', 'community_center', 'other']
    if location_type not in valid_types:
        location_type = 'other'

    if not label:
        flash('Please provide a label for this location.', 'warning')
        return redirect(url_for('student_bp.saved_locations'))

    # First location is auto-primary
    is_first = count == 0

    loc = StudentSavedLocation(
        student_id=current_user.id,
        label=label,
        address=address or '',
        latitude=lat,
        longitude=lng,
        location_type=location_type,
        is_primary=is_first
    )
    db.session.add(loc)
    db.session.commit()
    flash('Location saved!', 'success')
    return redirect(url_for('student_bp.saved_locations'))


@student_bp.route('/student/locations/<int:loc_id>/edit', methods=['POST'])
@role_required('student')
def edit_saved_location(loc_id):
    from models.student_saved_location import StudentSavedLocation

    loc = StudentSavedLocation.query.get_or_404(loc_id)
    if loc.student_id != current_user.id:
        flash('Unauthorized.', 'danger')
        return redirect(url_for('student_bp.saved_locations'))

    loc.label = sanitize_input_length(request.form.get('label', loc.label), 100)
    loc.address = sanitize_input_length(request.form.get('address', loc.address), 255)
    location_type = request.form.get('location_type', loc.location_type)
    valid_types = ['home', 'library', 'cafe', 'school', 'park', 'community_center', 'other']
    loc.location_type = location_type if location_type in valid_types else loc.location_type

    lat = request.form.get('latitude', type=float)
    lng = request.form.get('longitude', type=float)
    if lat is not None and lng is not None:
        loc.latitude = lat
        loc.longitude = lng

    db.session.commit()
    flash('Location updated!', 'success')
    return redirect(url_for('student_bp.saved_locations'))


@student_bp.route('/student/locations/<int:loc_id>/delete', methods=['POST'])
@role_required('student')
def delete_saved_location(loc_id):
    from models.student_saved_location import StudentSavedLocation

    loc = StudentSavedLocation.query.get_or_404(loc_id)
    if loc.student_id != current_user.id:
        flash('Unauthorized.', 'danger')
        return redirect(url_for('student_bp.saved_locations'))

    was_primary = loc.is_primary
    db.session.delete(loc)
    db.session.commit()

    # Auto-promote if deleted was primary
    if was_primary:
        next_loc = StudentSavedLocation.query.filter_by(
            student_id=current_user.id).order_by(
            StudentSavedLocation.created_at.asc()).first()
        if next_loc:
            next_loc.is_primary = True
            db.session.commit()

    flash('Location deleted.', 'success')
    return redirect(url_for('student_bp.saved_locations'))


@student_bp.route('/student/locations/<int:loc_id>/set-primary', methods=['POST'])
@role_required('student')
def set_primary_location(loc_id):
    from models.student_saved_location import StudentSavedLocation

    loc = StudentSavedLocation.query.get_or_404(loc_id)
    if loc.student_id != current_user.id:
        flash('Unauthorized.', 'danger')
        return redirect(url_for('student_bp.saved_locations'))

    # Unset all primary
    StudentSavedLocation.query.filter_by(
        student_id=current_user.id
    ).update({'is_primary': False})
    loc.is_primary = True
    db.session.commit()
    flash(f'{loc.label} set as primary.', 'success')
    return redirect(url_for('student_bp.saved_locations'))


@student_bp.route('/api/student/saved-locations')
@role_required('student')
def api_saved_locations():
    from models.student_saved_location import StudentSavedLocation
    from flask import jsonify

    locations = StudentSavedLocation.query.filter_by(
        student_id=current_user.id
    ).order_by(StudentSavedLocation.created_at.asc()).all()

    return jsonify([{
        'id': loc.id,
        'label': loc.label,
        'address': loc.address,
        'latitude': loc.latitude,
        'longitude': loc.longitude,
        'location_type': loc.location_type,
        'is_primary': loc.is_primary
    } for loc in locations])


@student_bp.route('/student/verify/<token>')
def verify_email(token):
    """Student clicks the verification link from their welcome email."""
    data = verify_token(token, salt='email-verify', max_age=86400)
    if not data:
        flash('This verification link has expired or is invalid.', 'danger')
        return redirect(url_for('student_bp.login_student'))

    student = Student.query.get(data.get('student_id'))
    if not student:
        flash('Account not found.', 'danger')
        return redirect(url_for('student_bp.register_student'))

    if student.email_verified:
        flash('Your email is already verified!', 'info')
        return redirect(url_for('student_bp.login_student'))

    student.email_verified = True
    db.session.commit()

    flash('Email verified successfully! You can now log in and book sessions.', 'success')
    return redirect(url_for('student_bp.login_student'))


@student_bp.route('/student/resend-verify', methods=['POST'])
@limiter.limit('3 per hour')
@login_required
def resend_verification():
    """Resend the email verification link."""
    if current_user.email_verified:
        flash('Your email is already verified.', 'info')
        return redirect(url_for('student_bp.dashboard'))

    try:
        from services.email_service import send_email, email_welcome_student
        token = generate_token({'student_id': current_user.id})
        verify_url = current_app.config['APP_URL'] + f'/student/verify/{token}'
        subj, html = email_welcome_student(current_user.name, verify_url)
        send_email(current_user.email, subj, html, 'welcome_student', 'student')
        flash('Verification email resent! Please check your inbox.', 'success')
    except Exception as e:
        current_app.logger.error(f'Failed to resend verification email to {current_user.email}: {e}')
        flash('Could not send verification email. Please try again later.', 'danger')

    return redirect(url_for('student_bp.dashboard'))


@student_bp.route('/student/forgot-password', methods=['GET', 'POST'])
@limiter.limit('3 per hour', methods=['POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()

        # Always show success to prevent email enumeration
        flash('If an account with that email exists, we have sent a password reset link.', 'info')

        student = Student.query.filter_by(email=email).first()
        if student:
            try:
                from services.email_service import send_email, email_password_reset
                token = generate_token({'student_id': student.id}, salt='student-reset-pw')
                reset_url = current_app.config['APP_URL'] + f'/student/reset-password/{token}'
                subj, html = email_password_reset(student.name, reset_url)
                send_email(student.email, subj, html, 'password_reset', 'student')
            except Exception as e:
                current_app.logger.error(f'Failed to send password reset email to student {student.email}: {e}')

        return redirect(url_for('student_bp.login_student'))

    return render_template('forgot_password.html',
                           action_url=url_for('student_bp.forgot_password'),
                           login_url=url_for('student_bp.login_student'),
                           user_type='Student')


@student_bp.route('/student/reset-password/<token>', methods=['GET', 'POST'])
@limiter.limit('3 per hour', methods=['POST'])
def reset_password(token):
    data = verify_token(token, salt='student-reset-pw', max_age=3600)
    if not data:
        flash('This reset link has expired or is invalid. Please request a new one.', 'danger')
        return redirect(url_for('student_bp.forgot_password'))

    student = Student.query.get(data.get('student_id'))
    if not student:
        flash('Account not found.', 'danger')
        return redirect(url_for('student_bp.forgot_password'))

    if request.method == 'POST':
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')

        if not validate_password_complexity(password):
            flash(get_password_error_message(password), 'danger')
            return render_template('reset_password.html', token=token,
                                   user_type='Student')

        if password != confirm_password:
            flash('Passwords do not match.', 'danger')
            return render_template('reset_password.html', token=token,
                                   user_type='Student')

        student.password = generate_password_hash(password)
        # Reset any lockout
        student.failed_login_attempts = 0
        student.locked_until = None
        db.session.commit()

        flash('Password reset successfully! Please log in with your new password.', 'success')
        return redirect(url_for('student_bp.login_student'))

    return render_template('reset_password.html', token=token,
                           user_type='Student')


@student_bp.route('/student/logout')
@login_required
def logout_student():
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('student_bp.login_student'))
