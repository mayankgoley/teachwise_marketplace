from flask import (Blueprint, request, redirect, url_for, flash,
                    render_template, current_app, jsonify)
from flask_login import login_user, logout_user, current_user
from database import db
from extensions import limiter
from models.tutor import Tutor
from models.slots import TutorSlot
from models.review import Review
from models.booking import Booking
from models.student import Student
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from utils.sanitizer import sanitize_text, sanitize_input_length
from utils.auth import role_required, is_account_locked, increment_failed_login, reset_failed_login
from utils.validators import validate_password_complexity, get_password_error_message
from services.encryption_service import generate_token, verify_token
from services.booking_service import cancel_booking as do_cancel_booking, create_booking as do_create_booking, send_booking_emails
from datetime import datetime, timedelta
import os
import uuid

tutor_bp = Blueprint('tutor_bp', __name__)
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}


def calc_profile_completion(tutor):
    score = 10  # name always filled
    if tutor.bio and len(tutor.bio) > 0:
        score += 20
    if tutor.qualification:
        score += 15
    if tutor.institution:
        score += 10
    if tutor.hourly_rate and tutor.hourly_rate > 0:
        score += 10
    if tutor.teaching_mode:
        score += 10
    if tutor.subjects_additional and len(tutor.subjects_additional) > 0:
        score += 10
    if tutor.profile_photo:
        score += 15
    return score


PHOTO_MAGIC = {
    b'\xff\xd8\xff': 'jpg',
    b'\x89PNG': 'png',
}


@tutor_bp.route('/tutor/edit-profile', methods=['GET', 'POST'])
@role_required('tutor')
def edit_profile():
    tutor = current_user

    if request.method == 'POST':
        tutor.bio = sanitize_input_length(request.form.get('bio', ''), 500)
        tutor.qualification = sanitize_input_length(request.form.get('qualification', ''), 200)
        tutor.institution = sanitize_input_length(request.form.get('institution', ''), 200)

        rate = request.form.get('hourly_rate', '')
        if rate:
            try:
                tutor.hourly_rate = max(0, float(rate))
            except ValueError:
                pass

        mode = request.form.get('teaching_mode', '')
        if mode in ('online', 'in-person', 'both'):
            tutor.teaching_mode = mode

        subjects_raw = request.form.get('subjects_additional', '')
        if subjects_raw.strip():
            subjects = [s.strip() for s in subjects_raw.split(',') if s.strip()][:10]
            tutor.subjects_additional = subjects
        else:
            tutor.subjects_additional = None

        tz = request.form.get('timezone', '')
        if tz:
            tutor.timezone = tz

        new_address = sanitize_input_length(request.form.get('address', ''), 300)
        if new_address and new_address != (tutor.address or ''):
            tutor.address = new_address
            try:
                from services.geocoding_service import geocode_and_save
                if not geocode_and_save(tutor, new_address):
                    flash('Could not geocode the address, but other changes were saved.', 'warning')
            except Exception:
                flash('Geocoding failed, but other changes were saved.', 'warning')
        elif not new_address:
            tutor.address = None

        db.session.commit()
        flash('Profile updated successfully!', 'success')
        return redirect(url_for('tutor_bp.edit_profile'))

    completion = calc_profile_completion(tutor)
    return render_template('tutor_edit_profile.html', tutor=tutor,
                           profile_completion=completion)


@tutor_bp.route('/tutor/upload-photo', methods=['POST'])
@role_required('tutor')
def upload_photo():
    tutor = current_user

    file = request.files.get('photo')
    if not file or not file.filename:
        return jsonify(success=False, error='No file selected')

    # Validate extension
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in ('jpg', 'jpeg', 'png'):
        return jsonify(success=False, error='Only JPG and PNG allowed')

    file_bytes = file.read()

    # Validate size (2 MB)
    if len(file_bytes) > 2 * 1024 * 1024:
        return jsonify(success=False, error='File too large (max 2 MB)')

    # Validate magic bytes
    valid_magic = False
    for magic, _ in PHOTO_MAGIC.items():
        if file_bytes[:len(magic)] == magic:
            valid_magic = True
            break
    if not valid_magic:
        return jsonify(success=False, error='Invalid file type')

    # Upload to R2 (or local fallback) — public, no encryption
    from services.storage_service import upload_public_file, delete_public_file

    r2_path = f"photos/{tutor.id}/{uuid.uuid4().hex[:8]}.{ext}"
    content_type = 'image/jpeg' if ext in ('jpg', 'jpeg') else 'image/png'

    photo_url = upload_public_file(file_bytes, r2_path, content_type)
    if not photo_url:
        return jsonify(success=False, error='Upload failed. Please try again.')

    # Delete old photo
    if tutor.profile_photo:
        old_path = tutor.profile_photo
        if not old_path.startswith('/') and not old_path.startswith('http'):
            old_path = f"photos/{old_path}"
        elif old_path.startswith('/static/uploads/'):
            old_path = old_path.replace('/static/uploads/', '')
        elif old_path.startswith('http'):
            # Extract R2 key from full URL
            for prefix in [current_app.config.get('R2_PUBLIC_URL', ''), '/']:
                if old_path.startswith(prefix) and prefix:
                    old_path = old_path[len(prefix):].lstrip('/')
                    break
        delete_public_file(old_path)

    tutor.profile_photo = photo_url
    db.session.commit()

    return jsonify(success=True, url=photo_url)


@tutor_bp.route('/tutor/register', methods=['GET', 'POST'])
@limiter.limit('5 per hour', methods=['POST'])
def register():
    if request.method == 'POST':
        name = sanitize_input_length(request.form.get('name', ''), 100) or ''
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password')
        subject = sanitize_input_length(request.form.get('subject', ''), 100) or ''

        if not all([name, email, password, subject]):
            flash('Name, email, password, and subject are required.', 'warning')
            return redirect(url_for('tutor_bp.register'))

        if not validate_password_complexity(password):
            flash(get_password_error_message(password), 'danger')
            return redirect(url_for('tutor_bp.register'))

        if Tutor.query.filter_by(email=email).first():
            flash('A tutor with this email already exists.', 'danger')
            return redirect(url_for('tutor_bp.register'))

        try:
            tutor = Tutor(
                name=name, email=email,
                password=generate_password_hash(password),
                subject=subject,
                experience=int(request.form.get('experience', 0)),
                address=request.form.get('address', ''),
                timezone=request.form.get('timezone', 'America/New_York'),
                verification_status='pending_documents')
            db.session.add(tutor)
            db.session.commit()

            # Geocode address (if provided)
            if tutor.address:
                try:
                    from services.geocoding_service import geocode_and_save
                    if geocode_and_save(tutor, tutor.address):
                        db.session.commit()
                        current_app.logger.info(
                            f'Geocoded tutor {tutor.id}: {tutor.city} '
                            f'({tutor.latitude}, {tutor.longitude})')
                except Exception as e:
                    current_app.logger.warning(
                        f'Geocoding failed for tutor {tutor.id}: {e}')

            # Welcome email
            try:
                from services.email_service import send_email, email_welcome_tutor
                subj, html = email_welcome_tutor(tutor.name)
                send_email(tutor.email, subj, html, 'welcome_tutor', 'tutor')
            except Exception:
                pass

            flash('Registration successful! Please log in.', 'success')
            return redirect(url_for('tutor_bp.login'))
        except Exception as e:
            db.session.rollback()
            flash(f'Error: {e}', 'danger')

    from utils.categories import get_categories_json
    return render_template('register_tutor.html',
                           categories_json=get_categories_json())


@tutor_bp.route('/tutor/login', methods=['GET', 'POST'])
@limiter.limit('10 per 15 minutes', methods=['POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password')
        tutor = Tutor.query.filter_by(email=email).first()

        if tutor and is_account_locked(tutor):
            flash('Account temporarily locked due to too many failed attempts. Try again in 15 minutes.', 'danger')
            return redirect(url_for('tutor_bp.login'))

        if not tutor or not check_password_hash(tutor.password, password):
            if tutor:
                increment_failed_login(tutor)
            flash('Invalid email or password.', 'danger')
            return redirect(url_for('tutor_bp.login'))

        reset_failed_login(tutor)
        login_user(tutor)

        # Issue JWT token for microservice auth (stored in cookie)
        try:
            from shared.jwt_auth import create_jwt_token
            jwt_token = create_jwt_token(
                uid=tutor.get_id(),
                role='tutor',
                name=tutor.name,
                email=tutor.email
            )
            resp = redirect(url_for('tutor_bp.tutor_dashboard'))
            resp.set_cookie('tw_jwt', jwt_token, httponly=True,
                          secure=False, samesite='Lax', max_age=86400)
            flash(f'Welcome back, {tutor.name}!', 'success')
            return resp
        except Exception:
            pass  # JWT failure should not block login

        flash(f'Welcome back, {tutor.name}!', 'success')
        return redirect(url_for('tutor_bp.tutor_dashboard'))
    return render_template('tutor_login.html')


@tutor_bp.route('/tutor/dashboard')
@role_required('tutor')
def tutor_dashboard():
    from models.booking import Booking
    tutor = current_user
    slots = TutorSlot.query.filter(
        TutorSlot.tutor_id == tutor.id,
        TutorSlot.status != 'cancelled'
    ).order_by(TutorSlot.date.asc(), TutorSlot.start_time.asc()).all()
    reviews = Review.query.filter_by(tutor_id=tutor.id).order_by(
        Review.created_at.desc()).all()
    bookings = Booking.query.filter_by(
        tutor_id=tutor.id, status='Booked').all()
    booking_map = {b.slot_id: b for b in bookings}

    # Pending submissions to review
    from models.assignment import Assignment
    pending_reviews = Assignment.query.filter_by(
        tutor_id=tutor.id, status='submitted').count()

    # Count offline slots with no location
    offline_slots_no_location = TutorSlot.query.filter(
        TutorSlot.tutor_id == tutor.id,
        TutorSlot.mode.in_(['in-person', 'both']),
        TutorSlot.status == 'pending',
        TutorSlot.date >= datetime.utcnow().date(),
        TutorSlot.location_latitude.is_(None)
    ).count() if not (tutor.latitude and tutor.longitude) else 0

    return render_template('tutor_dashboard.html',
                           tutor=tutor, slots=slots, reviews=reviews,
                           booking_map=booking_map,
                           pending_reviews=pending_reviews,
                           offline_slots_no_location=offline_slots_no_location)


@tutor_bp.route('/tutor/student/<int:student_id>')
@role_required('tutor')
def view_student_profile(student_id):
    tutor = current_user
    student = Student.query.get_or_404(student_id)
    # Get bookings between this tutor and student
    bookings = Booking.query.filter_by(
        tutor_id=tutor.id, student_id=student.id
    ).order_by(Booking.booked_on.desc()).all()
    # Get reviews this student left for this tutor
    reviews = Review.query.filter_by(
        tutor_id=tutor.id, student_id=student.id
    ).order_by(Review.created_at.desc()).all()
    return render_template('tutor_view_student.html',
                           student=student, bookings=bookings,
                           reviews=reviews, tutor=tutor)


@tutor_bp.route('/tutor/cancel-booking/<int:booking_id>', methods=['POST'])
@role_required('tutor')
def cancel_booking(booking_id):
    from models.booking import Booking
    tutor = current_user

    booking = Booking.query.get_or_404(booking_id)
    slot = TutorSlot.query.get(booking.slot_id)

    if not slot or slot.tutor_id != tutor.id:
        flash('Unauthorized.', 'danger')
        return redirect(url_for('tutor_bp.tutor_dashboard'))

    result = do_cancel_booking(booking, 'tutor', refund_pct=100, slot=slot)
    flash('Booking cancelled. Student will receive a full refund.', 'success')
    return redirect(url_for('tutor_bp.tutor_dashboard'))


@tutor_bp.route('/tutor/add-slot', methods=['POST'])
@role_required('tutor')
def add_slot():
    tutor = current_user
    try:
        is_group = request.form.get('is_group') == 'on'
        max_students = int(request.form.get('max_students', 1)) if is_group else 1
        max_students = min(max(max_students, 2), 5) if is_group else 1

        mode = request.form.get('mode', 'online')
        slot = TutorSlot(
            tutor_id=tutor.id,
            date=datetime.strptime(request.form['date'], '%Y-%m-%d').date(),
            start_time=datetime.strptime(request.form['start_time'], '%H:%M').time(),
            end_time=datetime.strptime(request.form['end_time'], '%H:%M').time(),
            mode=mode,
            subject=sanitize_input_length(request.form.get('subject', ''), 100) or tutor.subject,
            price=float(request.form.get('price', 0)),
            is_group=is_group,
            max_students=max_students)

        # Per-slot location (offline/both modes)
        if mode in ('in-person', 'both'):
            loc_is_default = request.form.get('location_is_default', 'true') == 'true'
            if loc_is_default:
                slot.location_latitude = tutor.latitude
                slot.location_longitude = tutor.longitude
                slot.location_address = tutor.address
                slot.location_label = tutor.default_location_label
                slot.radius_miles = tutor.default_radius_miles or 10.0
                slot.location_is_default = True
                slot.radius_is_default = True
            else:
                slot.location_latitude = request.form.get('slot_latitude', type=float)
                slot.location_longitude = request.form.get('slot_longitude', type=float)
                slot.location_address = sanitize_input_length(request.form.get('slot_address', ''), 255)
                slot.location_label = sanitize_input_length(request.form.get('slot_location_label', ''), 100)
                slot.radius_miles = float(request.form.get('radius_miles', 10))
                slot.radius_miles = min(max(slot.radius_miles, 1), 50)
                slot.location_is_default = False
                slot.radius_is_default = request.form.get('radius_is_default', 'true') == 'true'

        db.session.add(slot)
        db.session.commit()
        flash('Slot added!', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Error: {e}', 'danger')
    return redirect(url_for('tutor_bp.tutor_dashboard'))


@tutor_bp.route('/tutor/edit-slot/<int:slot_id>', methods=['GET', 'POST'])
@role_required('tutor')
def edit_slot(slot_id):
    """Edit a pending (unbooked) slot — direct change, no approval needed."""
    tutor = current_user

    slot = TutorSlot.query.get_or_404(slot_id)
    if slot.tutor_id != tutor.id:
        flash('Unauthorized.', 'danger')
        return redirect(url_for('tutor_bp.tutor_dashboard'))

    if slot.status != 'pending':
        flash('Only unbooked slots can be edited directly. Use Reschedule for booked slots.', 'warning')
        return redirect(url_for('tutor_bp.tutor_dashboard'))

    if request.method == 'POST':
        try:
            slot.date = datetime.strptime(request.form['date'], '%Y-%m-%d').date()
            slot.start_time = datetime.strptime(request.form['start_time'], '%H:%M').time()
            slot.end_time = datetime.strptime(request.form['end_time'], '%H:%M').time()
            slot.mode = request.form.get('mode', 'online')
            slot.subject = sanitize_input_length(request.form.get('subject', ''), 100) or tutor.subject
            slot.price = float(request.form.get('price', 0))

            # Update location for offline/both
            if slot.mode in ('in-person', 'both'):
                loc_is_default = request.form.get('location_is_default', 'true') == 'true'
                if loc_is_default:
                    slot.location_latitude = tutor.latitude
                    slot.location_longitude = tutor.longitude
                    slot.location_address = tutor.address
                    slot.location_label = tutor.default_location_label
                    slot.radius_miles = tutor.default_radius_miles or 10.0
                    slot.location_is_default = True
                    slot.radius_is_default = True
                else:
                    slot.location_latitude = request.form.get('slot_latitude', type=float)
                    slot.location_longitude = request.form.get('slot_longitude', type=float)
                    slot.location_address = sanitize_input_length(request.form.get('slot_address', ''), 255)
                    slot.location_label = sanitize_input_length(request.form.get('slot_location_label', ''), 100)
                    slot.radius_miles = float(request.form.get('radius_miles', 10))
                    slot.radius_miles = min(max(slot.radius_miles, 1), 50)
                    slot.location_is_default = False
                    slot.radius_is_default = request.form.get('radius_is_default', 'true') == 'true'

            db.session.commit()
            flash('Slot updated!', 'success')
        except Exception as e:
            db.session.rollback()
            flash(f'Error: {e}', 'danger')
        return redirect(url_for('tutor_bp.tutor_dashboard'))

    return render_template('tutor_edit_slot.html', slot=slot, tutor=tutor)


@tutor_bp.route('/tutor/reschedule-slot/<int:slot_id>', methods=['GET', 'POST'])
@role_required('tutor')
def reschedule_slot(slot_id):
    """Reschedule a booked slot — tutor picks a new available slot, student gets notified."""
    tutor = current_user

    slot = TutorSlot.query.get_or_404(slot_id)
    if slot.tutor_id != tutor.id:
        flash('Unauthorized.', 'danger')
        return redirect(url_for('tutor_bp.tutor_dashboard'))

    if slot.status != 'booked':
        flash('Only booked slots can be rescheduled.', 'warning')
        return redirect(url_for('tutor_bp.tutor_dashboard'))

    booking = Booking.query.filter_by(slot_id=slot.id, status='Booked').first()
    if not booking:
        flash('No active booking found for this slot.', 'warning')
        return redirect(url_for('tutor_bp.tutor_dashboard'))

    # Get tutor's available pending slots (exclude current)
    available = TutorSlot.query.filter(
        TutorSlot.tutor_id == tutor.id,
        TutorSlot.status == 'pending',
        TutorSlot.date >= datetime.utcnow().date(),
        TutorSlot.id != slot.id
    ).order_by(TutorSlot.date.asc()).all()

    if request.method == 'POST':
        reason = sanitize_input_length(request.form.get('reason', ''), 500)
        proposed_slot_id = request.form.get('proposed_slot_id', type=int)

        # Option A: tutor picked an existing pending slot
        if proposed_slot_id:
            proposed = TutorSlot.query.get(proposed_slot_id)
            if not proposed or proposed.status != 'pending' or proposed.tutor_id != tutor.id:
                flash('Selected slot is not available.', 'danger')
                return redirect(url_for('tutor_bp.reschedule_slot', slot_id=slot_id))
        else:
            # Option B: tutor entered a new date/time — create a new pending slot
            new_date = request.form.get('new_date', '')
            new_start = request.form.get('new_start_time', '')
            new_end = request.form.get('new_end_time', '')
            if not all([new_date, new_start, new_end]):
                flash('Please select an existing slot or enter a new date and time.', 'danger')
                return redirect(url_for('tutor_bp.reschedule_slot', slot_id=slot_id))
            try:
                proposed = TutorSlot(
                    tutor_id=tutor.id,
                    date=datetime.strptime(new_date, '%Y-%m-%d').date(),
                    start_time=datetime.strptime(new_start, '%H:%M').time(),
                    end_time=datetime.strptime(new_end, '%H:%M').time(),
                    mode=slot.mode,
                    subject=slot.subject,
                    price=slot.price
                )
                db.session.add(proposed)
                db.session.flush()  # get proposed.id
            except Exception as e:
                flash(f'Invalid date/time: {e}', 'danger')
                return redirect(url_for('tutor_bp.reschedule_slot', slot_id=slot_id))

        from models.reschedule import RescheduleRequest
        rr = RescheduleRequest(
            booking_id=booking.id,
            original_slot_id=slot.id,
            proposed_slot_id=proposed.id,
            requested_by='tutor',
            reason=reason,
            expires_at=datetime.utcnow() + timedelta(hours=48)
        )
        db.session.add(rr)
        db.session.commit()

        # Notify student
        try:
            from services.email_service import send_email
            stu = Student.query.get(booking.student_id)
            subject = f'Reschedule Request from {tutor.name}'
            html = (
                f'<p>{tutor.name} would like to reschedule your session '
                f'on {slot.date.strftime("%B %d, %Y")} at {slot.start_time.strftime("%I:%M %p")} '
                f'to {proposed.date.strftime("%B %d, %Y")} at '
                f'{proposed.start_time.strftime("%I:%M %p")}.</p>'
                f'<p>Please log in to approve or reject.</p>'
            )
            if reason:
                html += f'<p>Reason: {reason}</p>'
            send_email(stu.email, subject, html, 'reschedule_request', 'student')
        except Exception:
            pass

        flash('Reschedule request sent to the student. They have 48 hours to respond.', 'success')
        return redirect(url_for('tutor_bp.tutor_dashboard'))

    student = Student.query.get(booking.student_id) if booking else None
    return render_template('tutor_reschedule_slot.html',
                           slot=slot, tutor=tutor, booking=booking,
                           student=student, available_slots=available)


@tutor_bp.route('/tutor/<int:tutor_id>')
def view_tutor_profile(tutor_id):
    tutor = Tutor.query.get_or_404(tutor_id)
    if not tutor.is_verified:
        flash('This tutor profile is not available.', 'warning')
        return redirect(url_for('main.index'))
    now = datetime.utcnow()
    available_slots = TutorSlot.query.filter(
        TutorSlot.tutor_id == tutor_id,
        TutorSlot.date >= now.date(),
        db.or_(
            TutorSlot.status == 'pending',
            db.and_(TutorSlot.is_group == True,
                    TutorSlot.current_students < TutorSlot.max_students)
        )
    ).order_by(TutorSlot.date.asc()).all()
    reviews = Review.query.filter_by(tutor_id=tutor_id).order_by(
        Review.created_at.desc()).all()

    is_favorited = False
    if current_user and current_user.is_authenticated:
        from models.favorite import FavoriteTutor
        is_favorited = FavoriteTutor.query.filter_by(
            student_id=current_user.id, tutor_id=tutor_id).first() is not None

    # Compute dimension averages
    dim_reviews = [r for r in reviews if r.rating_knowledge is not None]
    dim_avgs = {}
    if dim_reviews:
        dim_avgs = {
            'knowledge': round(sum(r.rating_knowledge for r in dim_reviews) / len(dim_reviews), 1),
            'communication': round(sum(r.rating_communication for r in dim_reviews) / len(dim_reviews), 1),
            'punctuality': round(sum(r.rating_punctuality for r in dim_reviews) / len(dim_reviews), 1),
            'value': round(sum(r.rating_value for r in dim_reviews) / len(dim_reviews), 1),
        }

    return render_template('tutor_public_profile.html',
                           tutor=tutor, available_slots=available_slots,
                           reviews=reviews, is_favorited=is_favorited,
                           dim_avgs=dim_avgs)


@tutor_bp.route('/book/<int:slot_id>', methods=['POST'])
@limiter.limit('20 per hour', methods=['POST'])
def book_session(slot_id):
    from models.booking import Booking

    slot = TutorSlot.query.get_or_404(slot_id)

    # Determine who is booking
    if not current_user.is_authenticated:
        flash('Please log in to book.', 'warning')
        return redirect(url_for('student_bp.login_student'))

    is_tutor = current_user.user_type == 'tutor'
    is_student = current_user.user_type == 'student'

    # Tutors cannot book their own slots
    if is_tutor and slot.tutor_id == current_user.id:
        flash('You cannot book your own slot.', 'warning')
        return redirect(url_for('tutor_bp.view_tutor_profile', tutor_id=slot.tutor_id))

    # Email verification check for students
    if is_student:
        if not getattr(current_user, 'email_verified', True):
            flash('Please verify your email before booking a session.', 'warning')
            return redirect(url_for('student_bp.dashboard'))

    # Guardian check for student minors
    if is_student:
        if current_user.is_minor and not current_user.guardian_verified:
            flash('Your guardian must verify your account before booking.', 'warning')
            return redirect(url_for('student_bp.dashboard'))

    if slot.is_group:
        if slot.current_students >= slot.max_students:
            flash('This group session is full.', 'warning')
            return redirect(url_for('tutor_bp.view_tutor_profile', tutor_id=slot.tutor_id))
    elif slot.status != 'pending':
        flash('This slot has already been booked by another student.', 'warning')
        return redirect(url_for('tutor_bp.view_tutor_profile', tutor_id=slot.tutor_id))

    # Resolve booker identity
    booker_id = current_user.id
    booker_name = current_user.name
    booker_email = current_user.email

    try:
        # Lock the row and re-check availability to prevent race conditions
        locked_slot = TutorSlot.query.with_for_update().get(slot_id)
        if not locked_slot:
            db.session.rollback()
            flash('Slot not found.', 'danger')
            return redirect(url_for('main.index'))

        if locked_slot.is_group:
            if locked_slot.current_students >= locked_slot.max_students:
                db.session.rollback()
                flash('This group session is now full.', 'warning')
                return redirect(url_for('tutor_bp.view_tutor_profile', tutor_id=slot.tutor_id))
            locked_slot.current_students += 1
            # Only mark as 'booked' (full) when capacity reached
            if locked_slot.current_students >= locked_slot.max_students:
                locked_slot.status = 'booked'
            locked_slot.student_id = booker_id  # last booker shown
        else:
            if locked_slot.status != 'pending':
                db.session.rollback()
                flash('This slot has already been booked.', 'warning')
                return redirect(url_for('tutor_bp.view_tutor_profile', tutor_id=slot.tutor_id))
            locked_slot.student_id = booker_id
            locked_slot.status = 'booked'

        # Invalidate search/recommendation cache
        try:
            from services.cache_service import cache_delete_pattern
            cache_delete_pattern('search:*')
            cache_delete_pattern('rec:*')
        except Exception:
            pass

        # Generate Jitsi room name for online sessions
        if locked_slot.mode in ('online', 'both') and not locked_slot.jitsi_room_name:
            from services.video_service import generate_room_name
            locked_slot.jitsi_room_name = generate_room_name(slot.id)

        db.session.commit()

        booking, error = do_create_booking(booker_id, slot.tutor_id, slot_id)
        if error:
            flash(error, 'warning')
            return redirect(url_for('tutor_bp.view_tutor_profile', tutor_id=slot.tutor_id))

        # Meeting location for offline slots
        if locked_slot.mode in ('in-person', 'both'):
            meet_lat = request.form.get('meeting_latitude', type=float)
            meet_lng = request.form.get('meeting_longitude', type=float)
            if meet_lat is not None and meet_lng is not None:
                # Validate within radius
                if locked_slot.location_latitude and locked_slot.location_longitude and locked_slot.radius_miles:
                    from utils.distance import haversine_distance
                    dist_km = haversine_distance(
                        locked_slot.location_latitude, locked_slot.location_longitude,
                        meet_lat, meet_lng)
                    dist_miles = dist_km / 1.60934
                    if dist_miles > locked_slot.radius_miles:
                        flash(f'Meeting location is {dist_miles:.1f} miles away, outside the {locked_slot.radius_miles:.0f} mile radius.', 'warning')
                        return redirect(url_for('tutor_bp.view_tutor_profile', tutor_id=slot.tutor_id))

                booking.meeting_latitude = meet_lat
                booking.meeting_longitude = meet_lng
                booking.meeting_location_type = request.form.get('meeting_location_type', '')
                booking.meeting_location_label = sanitize_input_length(
                    request.form.get('meeting_location_label', ''), 100)

                # Encrypt home addresses
                meet_address = sanitize_input_length(request.form.get('meeting_address', ''), 255)
                if booking.meeting_location_type == 'home' and meet_address:
                    from services.encryption_service import encrypt_field
                    booking.meeting_address_encrypted = encrypt_field(meet_address).encode()
                    booking.meeting_address = None
                else:
                    booking.meeting_address = meet_address

                db.session.commit()

                # Save location if requested
                if request.form.get('save_location') and is_student:
                    from models.student_saved_location import StudentSavedLocation
                    loc_count = StudentSavedLocation.query.filter_by(
                        student_id=booker_id).count()
                    if loc_count < 5:
                        new_loc = StudentSavedLocation(
                            student_id=booker_id,
                            label=booking.meeting_location_label or 'Saved Location',
                            address=meet_address or '',
                            latitude=meet_lat,
                            longitude=meet_lng,
                            location_type=booking.meeting_location_type or 'other',
                            is_primary=loc_count == 0
                        )
                        db.session.add(new_loc)
                        db.session.commit()

        # If slot has a price > 0 and booker is a student, redirect to Stripe
        if float(slot.price or 0) > 0 and is_student:
            try:
                from services.payment_service import create_checkout_session
                from models.student import Student
                tutor_obj = Tutor.query.get(slot.tutor_id)
                student_obj = Student.query.get(booker_id)
                booking.status = 'Pending Payment'
                db.session.commit()
                checkout_url = create_checkout_session(
                    booking, slot, student_obj, tutor_obj)
                return redirect(checkout_url)
            except Exception as pay_err:
                db.session.rollback()
                current_app.logger.error(f'Stripe checkout error: {pay_err}')
                booking.status = 'Booked'
                db.session.commit()

        # Free session or Stripe unavailable — send emails
        send_booking_emails(
            booking, slot, booker_name, booker_email,
            is_minor=(is_student and current_user.is_minor),
            guardian=getattr(current_user, 'guardian', None) if is_student else None
        )

        flash('Session booked!', 'success')
        if is_tutor:
            return redirect(url_for('tutor_bp.tutor_dashboard'))
        return redirect(url_for('student_bp.dashboard'))
    except Exception as e:
        db.session.rollback()
        flash(f'Error: {e}', 'danger')
        return redirect(url_for('tutor_bp.view_tutor_profile', tutor_id=slot.tutor_id))


@tutor_bp.route('/category/<subject>')
def category(subject):
    from utils.categories import get_category_by_id
    cat = get_category_by_id(subject)

    if cat:
        # Collect all topics in this category for matching
        all_topics = []
        for sub in cat.get('subcategories', []):
            all_topics.extend(sub.get('topics', []))

        # Match tutors whose subject is any topic in this category
        if all_topics:
            tutors = Tutor.query.filter(
                Tutor.verification_status == 'verified',
                Tutor.subject.in_(all_topics)
            ).all()
        else:
            tutors = []

        return render_template('category.html', tutors=tutors,
                               subject=cat['name'], category=cat)
    else:
        # Fallback: treat subject as a text search
        tutors = Tutor.query.filter(
            Tutor.verification_status == 'verified',
            Tutor.subject.ilike(f'%{subject}%')
        ).all()
        return render_template('category.html', tutors=tutors,
                               subject=subject, category=None)


@tutor_bp.route('/tutor/earnings')
@role_required('tutor')
def tutor_earnings():
    from models.payment import Payment
    from models.booking import Booking
    from sqlalchemy import func, extract

    tutor = current_user

    # All completed payments
    payments = Payment.query.filter_by(
        tutor_id=tutor.id, status='completed').all()

    now = datetime.utcnow()
    total_all = sum(float(p.tutor_payout) for p in payments)
    total_month = sum(float(p.tutor_payout) for p in payments
                      if p.completed_at and p.completed_at.month == now.month
                      and p.completed_at.year == now.year)
    total_year = sum(float(p.tutor_payout) for p in payments
                     if p.completed_at and p.completed_at.year == now.year)
    avg_per_session = total_all / len(payments) if payments else 0

    # By-subject breakdown
    subject_data = {}
    for p in payments:
        booking = Booking.query.get(p.booking_id)
        if booking:
            slot = TutorSlot.query.get(booking.slot_id)
            subj = (slot.subject if slot else None) or tutor.subject
            subject_data[subj] = subject_data.get(subj, 0) + float(p.tutor_payout)

    return render_template('tutor_earnings.html', tutor=tutor,
                           payments=payments, total_all=total_all,
                           total_month=total_month, total_year=total_year,
                           avg_per_session=avg_per_session,
                           subject_data=subject_data)


@tutor_bp.route('/api/tutor/earnings/chart')
@role_required('tutor')
def earnings_chart_data():
    from models.payment import Payment

    tutor = current_user

    payments = Payment.query.filter_by(
        tutor_id=tutor.id, status='completed').all()

    now = datetime.utcnow()
    months = []
    for i in range(11, -1, -1):
        m = now.month - i
        y = now.year
        while m <= 0:
            m += 12
            y -= 1
        label = datetime(y, m, 1).strftime('%b %Y')
        total = sum(float(p.tutor_payout) for p in payments
                    if p.completed_at and p.completed_at.month == m
                    and p.completed_at.year == y)
        months.append({'month': label, 'amount': round(total, 2)})

    return jsonify(months=months)


@tutor_bp.route('/tutor/earnings/export')
@role_required('tutor')
def earnings_export():
    from models.payment import Payment
    from models.booking import Booking
    from models.student import Student
    import io, csv

    tutor = current_user

    payments = Payment.query.filter_by(
        tutor_id=tutor.id, status='completed'
    ).order_by(Payment.completed_at.desc()).all()

    from flask import Response
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Date', 'Student', 'Subject', 'Gross', 'Fee', 'Net', 'Status'])
    for p in payments:
        booking = Booking.query.get(p.booking_id)
        student = Student.query.get(p.student_id)
        slot = TutorSlot.query.get(booking.slot_id) if booking else None
        writer.writerow([
            p.completed_at.strftime('%Y-%m-%d') if p.completed_at else '',
            student.name if student else '',
            (slot.subject if slot else '') or tutor.subject,
            f"${float(p.amount):.2f}",
            f"${float(p.platform_fee):.2f}",
            f"${float(p.tutor_payout):.2f}",
            p.status
        ])

    return Response(
        output.getvalue(), mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename=earnings.csv'})


@tutor_bp.route('/tutor/notification-settings', methods=['GET', 'POST'])
@role_required('tutor')
def tutor_notification_settings():
    tutor = current_user

    pref_options = [
        ('booking_notifications', 'Booking Notifications', 'Emails when students book or cancel sessions'),
        ('session_reminders', 'Session Reminders', 'Reminders before your upcoming sessions'),
        ('review_alerts', 'Review Alerts', 'Notifications when students leave reviews'),
        ('marketing_emails', 'Marketing & Updates', 'Platform news, tips, and promotional offers'),
        ('email_digest', 'Daily Email Digest', 'Receive a daily summary instead of individual emails'),
    ]
    prefs = tutor.notification_prefs or {}

    if request.method == 'POST':
        new_prefs = {}
        for key, _, _ in pref_options:
            new_prefs[key] = key in request.form
        tutor.notification_prefs = new_prefs
        db.session.commit()
        flash('Notification preferences saved!', 'success')
        return redirect(url_for('tutor_bp.tutor_notification_settings'))

    return render_template('notification_settings.html',
                           pref_options=pref_options, prefs=prefs,
                           back_url=url_for('tutor_bp.tutor_dashboard'))


@tutor_bp.route('/tutor/availability')
@role_required('tutor')
def tutor_availability():
    tutor = current_user
    template = tutor.weekly_availability_template or {}
    return render_template('tutor_availability.html', tutor=tutor, template=template)


@tutor_bp.route('/tutor/availability/template', methods=['POST'])
@role_required('tutor')
def save_availability_template():
    import json
    tutor = current_user

    try:
        template_data = json.loads(request.form.get('template_json', '{}'))
        valid_days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        cleaned = {}
        for day in valid_days:
            blocks = template_data.get(day, [])
            cleaned_blocks = []
            for block in blocks[:10]:  # Max 10 blocks per day
                cleaned_blocks.append({
                    'start': str(block.get('start', '09:00'))[:5],
                    'end': str(block.get('end', '10:00'))[:5],
                    'mode': block.get('mode', 'online'),
                    'subject': sanitize_input_length(block.get('subject', ''), 100) or tutor.subject,
                    'price': min(max(float(block.get('price', 0)), 0), 9999)
                })
            if cleaned_blocks:
                cleaned[day] = cleaned_blocks
        tutor.weekly_availability_template = cleaned
        db.session.commit()
        flash('Availability template saved!', 'success')
    except (json.JSONDecodeError, ValueError) as e:
        flash(f'Invalid template data: {e}', 'danger')

    return redirect(url_for('tutor_bp.tutor_availability'))


@tutor_bp.route('/tutor/availability/generate', methods=['POST'])
@role_required('tutor')
def generate_slots_from_template():
    from datetime import timedelta, date as date_type
    tutor = current_user

    template = tutor.weekly_availability_template
    if not template:
        flash('No availability template saved. Please set one first.', 'warning')
        return redirect(url_for('tutor_bp.tutor_availability'))

    weeks = min(max(int(request.form.get('weeks', 1)), 1), 8)
    day_map = {'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3,
               'friday': 4, 'saturday': 5, 'sunday': 6}

    today = date_type.today()
    created_count = 0

    for day_name, blocks in template.items():
        day_num = day_map.get(day_name)
        if day_num is None:
            continue
        for week_offset in range(weeks):
            # Calculate the date for this day in this week
            days_ahead = day_num - today.weekday()
            if days_ahead < 0 and week_offset == 0:
                days_ahead += 7
            target_date = today + timedelta(days=days_ahead + (week_offset * 7))

            if target_date <= today:
                continue

            for block in blocks:
                start_t = datetime.strptime(block['start'], '%H:%M').time()
                end_t = datetime.strptime(block['end'], '%H:%M').time()

                existing = TutorSlot.query.filter_by(
                    tutor_id=tutor.id, date=target_date,
                    start_time=start_t, end_time=end_t
                ).first()
                if existing:
                    continue

                block_mode = block.get('mode', 'online')
                slot = TutorSlot(
                    tutor_id=tutor.id, date=target_date,
                    start_time=start_t, end_time=end_t,
                    mode=block_mode,
                    subject=block.get('subject', tutor.subject),
                    price=float(block.get('price', 0))
                )
                # Apply default location for offline slots
                if block_mode in ('in-person', 'both') and tutor.latitude and tutor.longitude:
                    slot.location_latitude = tutor.latitude
                    slot.location_longitude = tutor.longitude
                    slot.location_address = tutor.address
                    slot.location_label = tutor.default_location_label
                    slot.radius_miles = tutor.default_radius_miles or 10.0
                    slot.location_is_default = True
                    slot.radius_is_default = True
                db.session.add(slot)
                created_count += 1

    db.session.commit()
    flash(f'{created_count} slots generated for the next {weeks} week(s)!', 'success')
    return redirect(url_for('tutor_bp.tutor_availability'))


@tutor_bp.route('/tutor/slots/bulk-delete', methods=['POST'])
@role_required('tutor')
def bulk_delete_slots():
    import json
    tutor = current_user

    slot_ids = request.form.getlist('slot_ids')
    if not slot_ids:
        try:
            data = request.get_json(force=True)
            slot_ids = data.get('slot_ids', [])
        except Exception:
            pass

    if not slot_ids:
        flash('No slots selected.', 'warning')
        return redirect(url_for('tutor_bp.tutor_availability'))

    deleted = 0
    for sid in slot_ids:
        slot = TutorSlot.query.get(int(sid))
        if slot and slot.tutor_id == tutor.id and slot.status == 'pending':
            db.session.delete(slot)
            deleted += 1

    db.session.commit()
    flash(f'{deleted} pending slot(s) deleted.', 'success')
    return redirect(url_for('tutor_bp.tutor_availability'))


@tutor_bp.route('/tutor/slots/bulk-update-location', methods=['POST'])
@role_required('tutor')
def bulk_update_location():
    tutor = current_user
    slot_ids = request.form.getlist('slot_ids[]')
    if not slot_ids:
        flash('No slots selected.', 'warning')
        return redirect(url_for('tutor_bp.tutor_availability'))

    lat = request.form.get('latitude', type=float)
    lng = request.form.get('longitude', type=float)
    if lat is None or lng is None:
        flash('Please select a location.', 'warning')
        return redirect(url_for('tutor_bp.tutor_availability'))

    address = sanitize_input_length(request.form.get('address', ''), 255)
    label = sanitize_input_length(request.form.get('label', ''), 100)
    radius = float(request.form.get('radius_miles', 10))
    radius = min(max(radius, 1), 50)

    updated = 0
    now = datetime.utcnow()
    for sid in slot_ids:
        slot = TutorSlot.query.get(int(sid))
        if (slot and slot.tutor_id == tutor.id and slot.status == 'pending'
                and slot.mode in ('in-person', 'both')
                and slot.date >= now.date()):
            slot.location_latitude = lat
            slot.location_longitude = lng
            slot.location_address = address
            slot.location_label = label
            slot.radius_miles = radius
            slot.location_is_default = False
            slot.radius_is_default = False
            updated += 1

    db.session.commit()

    try:
        from services.cache_service import cache_delete_pattern
        cache_delete_pattern('search:*')
    except Exception:
        pass

    flash(f'Location updated for {updated} slot(s).', 'success')
    return redirect(url_for('tutor_bp.tutor_availability'))


@tutor_bp.route('/api/tutor/slots')
@role_required('tutor')
def api_tutor_slots():
    tutor = current_user

    start = request.args.get('start', '')
    end = request.args.get('end', '')

    query = TutorSlot.query.filter_by(tutor_id=tutor.id)
    if start:
        try:
            query = query.filter(TutorSlot.date >= datetime.strptime(start[:10], '%Y-%m-%d').date())
        except ValueError:
            pass
    if end:
        try:
            query = query.filter(TutorSlot.date <= datetime.strptime(end[:10], '%Y-%m-%d').date())
        except ValueError:
            pass

    slots = query.order_by(TutorSlot.date.asc()).all()
    color_map = {
        'pending': '#22c55e',   # green (default location)
        'pending_online': '#3b82f6',  # blue for online
        'pending_custom': '#f97316',  # orange for custom location
        'booked': '#3b82f6',    # blue
        'live': '#8b5cf6',      # purple
        'completed': '#6b7280', # gray
        'cancelled': '#ef4444'  # red
    }

    events = []
    for s in slots:
        events.append({
            'id': s.id,
            'title': f"{s.subject or tutor.subject} (${s.price:.0f})",
            'start': f"{s.date.isoformat()}T{s.start_time.strftime('%H:%M:%S')}",
            'end': f"{s.date.isoformat()}T{s.end_time.strftime('%H:%M:%S')}",
            'color': (color_map.get('pending_online' if s.mode == 'online' else ('pending_custom' if not getattr(s, 'location_is_default', True) else 'pending'), '#22c55e')
                      if s.status == 'pending' else color_map.get(s.status, '#6b7280')),
            'extendedProps': {
                'status': s.status,
                'mode': s.mode,
                'student': s.student.name if s.student else None,
                'price': float(s.price),
                'slot_id': s.id,
                'location_label': getattr(s, 'location_label', None),
                'location_is_default': getattr(s, 'location_is_default', True)
            }
        })
    return jsonify(events)


@tutor_bp.route('/tutor/location-settings', methods=['GET', 'POST'])
@role_required('tutor')
def location_settings():
    tutor = current_user
    if request.method == 'POST':
        lat = request.form.get('lat', type=float)
        lng = request.form.get('lng', type=float)
        if lat is None or lng is None:
            flash('Please select a location on the map.', 'warning')
            return redirect(url_for('tutor_bp.location_settings'))

        radius = request.form.get('radius_miles', type=float) or 10.0
        radius = min(max(radius, 1), 50)

        tutor.latitude = lat
        tutor.longitude = lng
        tutor.address = sanitize_input_length(request.form.get('address', ''), 255)
        tutor.default_location_label = sanitize_input_length(request.form.get('label', ''), 100)
        tutor.default_radius_miles = radius

        # Extract city from address
        addr_parts = (tutor.address or '').split(',')
        if len(addr_parts) >= 3:
            tutor.city = addr_parts[-3].strip()
        elif len(addr_parts) >= 2:
            tutor.city = addr_parts[-2].strip()

        db.session.commit()
        flash('Default location updated!', 'success')
        return redirect(url_for('tutor_bp.location_settings'))

    return render_template('tutor_location_settings.html', tutor=tutor)


@tutor_bp.route('/tutor/forgot-password', methods=['GET', 'POST'])
@limiter.limit('3 per hour', methods=['POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        flash('If an account with that email exists, we have sent a password reset link.', 'info')

        tutor = Tutor.query.filter_by(email=email).first()
        if tutor:
            try:
                from services.email_service import send_email, email_password_reset
                token = generate_token({'tutor_id': tutor.id}, salt='tutor-reset-pw')
                reset_url = current_app.config['APP_URL'] + f'/tutor/reset-password/{token}'
                subj, html = email_password_reset(tutor.name, reset_url)
                send_email(tutor.email, subj, html, 'password_reset', 'tutor')
            except Exception:
                pass

        return redirect(url_for('tutor_bp.login'))

    return render_template('forgot_password.html',
                           action_url=url_for('tutor_bp.forgot_password'),
                           login_url=url_for('tutor_bp.login'),
                           user_type='Tutor')


@tutor_bp.route('/tutor/reset-password/<token>', methods=['GET', 'POST'])
@limiter.limit('3 per hour', methods=['POST'])
def reset_password(token):
    data = verify_token(token, salt='tutor-reset-pw', max_age=3600)
    if not data:
        flash('This reset link has expired or is invalid. Please request a new one.', 'danger')
        return redirect(url_for('tutor_bp.forgot_password'))

    tutor = Tutor.query.get(data.get('tutor_id'))
    if not tutor:
        flash('Account not found.', 'danger')
        return redirect(url_for('tutor_bp.forgot_password'))

    if request.method == 'POST':
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')

        if not validate_password_complexity(password):
            flash(get_password_error_message(password), 'danger')
            return render_template('reset_password.html', token=token, user_type='Tutor')

        if password != confirm_password:
            flash('Passwords do not match.', 'danger')
            return render_template('reset_password.html', token=token, user_type='Tutor')

        tutor.password = generate_password_hash(password)
        tutor.failed_login_attempts = 0
        tutor.locked_until = None
        db.session.commit()

        flash('Password reset successfully! Please log in with your new password.', 'success')
        return redirect(url_for('tutor_bp.login'))

    return render_template('reset_password.html', token=token, user_type='Tutor')


@tutor_bp.route('/tutor/logout')
def logout():
    logout_user()
    flash('Logged out.', 'info')
    return redirect(url_for('main.index'))
