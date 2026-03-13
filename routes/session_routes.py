from flask import (Blueprint, render_template, redirect, url_for, flash,
                    Response, request, jsonify, send_file)
from flask_login import current_user, login_required
from database import db
from models.slots import TutorSlot
from models.tutor import Tutor
from models.student import Student
from models.booking import Booking
from models.review import Review
from models.session_note import SessionNote
from services.video_service import JITSI_DOMAIN, generate_room_name
from extensions import socketio, limiter
from flask_socketio import emit, join_room, leave_room
from datetime import datetime, timedelta
import io

session_bp = Blueprint('session_bp', __name__)

# Time gates: join from 15 min before to 30 min after start
JOIN_BEFORE_MINUTES = 15
JOIN_AFTER_MINUTES = 30
LATE_THRESHOLD_MINUTES = 5


def _get_user_info():
    """Return (user_type, user_id, user_name) for the current user."""
    if current_user.is_authenticated:
        return current_user.user_type, current_user.id, current_user.name
    return None, None, None


def _user_in_session(slot, user_type, user_id):
    if user_type == 'student' and slot.student_id == user_id:
        return True
    if user_type == 'tutor' and slot.tutor_id == user_id:
        return True
    return False


# ═══════════════════════════════════════════════════════════
# JOIN SESSION
# ═══════════════════════════════════════════════════════════

@session_bp.route('/session/<int:slot_id>/join')
def join_session(slot_id):
    user_type, user_id, user_name = _get_user_info()
    if not user_type:
        flash('Please log in.', 'warning')
        return redirect(url_for('student_bp.login_student'))

    slot = TutorSlot.query.get_or_404(slot_id)

    # Authorization: only the booked student or the tutor can join
    if user_type == 'student' and slot.student_id != user_id:
        flash('You are not authorized to join this session.', 'danger')
        return redirect(url_for('student_bp.dashboard'))
    if user_type == 'tutor' and slot.tutor_id != user_id:
        flash('You are not authorized to join this session.', 'danger')
        return redirect(url_for('tutor_bp.tutor_dashboard'))

    # Only booked or live slots can be joined
    if slot.status not in ('booked', 'live'):
        flash('This session is not available for joining.', 'warning')
        if user_type == 'tutor':
            return redirect(url_for('tutor_bp.tutor_dashboard'))
        return redirect(url_for('student_bp.dashboard'))

    # Time gate check
    now = datetime.utcnow()
    session_start = datetime.combine(slot.date, slot.start_time)
    session_end = datetime.combine(slot.date, slot.end_time)
    earliest_join = session_start - timedelta(minutes=JOIN_BEFORE_MINUTES)
    latest_join = session_start + timedelta(minutes=JOIN_AFTER_MINUTES)

    if now < earliest_join:
        mins_until = int((earliest_join - now).total_seconds() / 60)
        flash(f'Session not open yet. You can join in {mins_until} minutes.', 'info')
        if user_type == 'tutor':
            return redirect(url_for('tutor_bp.tutor_dashboard'))
        return redirect(url_for('student_bp.dashboard'))

    if now > latest_join:
        flash('The join window for this session has passed.', 'warning')
        if user_type == 'tutor':
            return redirect(url_for('tutor_bp.tutor_dashboard'))
        return redirect(url_for('student_bp.dashboard'))

    # Generate room name if not already set
    if not slot.jitsi_room_name:
        slot.jitsi_room_name = generate_room_name(slot.id)
        db.session.commit()

    # Mark slot as live and publish session.started event
    if slot.status == 'booked':
        slot.status = 'live'
        db.session.commit()

        try:
            from shared.event_bus import publish_event
            publish_event('session.started', {
                'slot_id': slot.id,
                'tutor_id': slot.tutor_id,
                'student_id': slot.student_id,
                'date': slot.date.isoformat() if slot.date else '',
                'start_time': slot.start_time.strftime('%I:%M %p') if slot.start_time else '',
                'mode': slot.mode or '',
                'jitsi_room': slot.jitsi_room_name or '',
            })
        except Exception:
            pass

    # Item 5: Late join notification
    minutes_late = 0
    if now > session_start:
        minutes_late = int((now - session_start).total_seconds() / 60)
        if minutes_late >= LATE_THRESHOLD_MINUTES:
            try:
                socketio.emit('late_arrival', {
                    'user_name': user_name,
                    'user_type': user_type,
                    'minutes_late': minutes_late
                }, room=f'session_{slot_id}')
            except Exception:
                pass

    tutor = Tutor.query.get(slot.tutor_id)
    student = Student.query.get(slot.student_id) if slot.student_id else None

    # Determine display name and other party name
    if user_type == 'tutor':
        display_name = tutor.name
        other_name = student.name if student else 'Student'
    else:
        display_name = current_user.name
        other_name = tutor.name

    # Compute session duration in minutes
    start_dt = datetime.combine(slot.date, slot.start_time)
    end_dt = datetime.combine(slot.date, slot.end_time)
    session_duration_minutes = int((end_dt - start_dt).total_seconds() / 60)

    return render_template('session_room.html',
                           slot=slot, tutor=tutor,
                           room_name=slot.jitsi_room_name,
                           jitsi_domain=JITSI_DOMAIN,
                           display_name=display_name,
                           other_name=other_name,
                           user_type=user_type,
                           session_start=session_start,
                           session_end=session_end,
                           session_duration_minutes=session_duration_minutes,
                           minutes_late=minutes_late)


# ═══════════════════════════════════════════════════════════
# END SESSION (redirects to summary instead of dashboard)
# ═══════════════════════════════════════════════════════════

@session_bp.route('/session/<int:slot_id>/end', methods=['POST'])
def end_session(slot_id):
    user_type, user_id, _ = _get_user_info()
    if not user_type:
        flash('Please log in.', 'warning')
        return redirect(url_for('student_bp.login_student'))

    slot = TutorSlot.query.get_or_404(slot_id)

    if user_type == 'tutor' and slot.tutor_id != user_id:
        flash('Unauthorized.', 'danger')
        return redirect(url_for('tutor_bp.tutor_dashboard'))
    if user_type == 'student' and slot.student_id != user_id:
        flash('Unauthorized.', 'danger')
        return redirect(url_for('student_bp.dashboard'))

    if slot.status in ('booked', 'live'):
        slot.status = 'completed'
        db.session.commit()

        booking = Booking.query.filter_by(
            slot_id=slot_id, student_id=slot.student_id
        ).first()
        if booking and booking.status not in ('Cancelled',):
            booking.status = 'Completed'
            db.session.commit()

        try:
            from shared.event_bus import publish_event
            publish_event('session.ended', {
                'slot_id': slot.id,
                'tutor_id': slot.tutor_id,
                'student_id': slot.student_id,
                'booking_id': booking.id if booking else None,
                'date': slot.date.isoformat() if slot.date else '',
                'ended_by': user_type,
            })
        except Exception:
            pass

    # Redirect to session summary page (Items 3 + 10)
    booking = Booking.query.filter_by(
        slot_id=slot_id, student_id=slot.student_id
    ).first()
    if booking:
        return redirect(url_for('session_bp.session_summary',
                                slot_id=slot_id, booking_id=booking.id))

    flash('Session ended. Thank you!', 'success')
    if user_type == 'tutor':
        return redirect(url_for('tutor_bp.tutor_dashboard'))
    return redirect(url_for('student_bp.dashboard'))


# ═══════════════════════════════════════════════════════════
# ITEM 3 + 10: SESSION SUMMARY & FEEDBACK
# ═══════════════════════════════════════════════════════════

@session_bp.route('/session/<int:slot_id>/summary/<int:booking_id>')
def session_summary(slot_id, booking_id):
    user_type, user_id, _ = _get_user_info()
    if not user_type:
        flash('Please log in.', 'warning')
        return redirect(url_for('student_bp.login_student'))

    slot = TutorSlot.query.get_or_404(slot_id)
    booking = Booking.query.get_or_404(booking_id)

    if not _user_in_session(slot, user_type, user_id):
        flash('Unauthorized.', 'danger')
        return redirect(url_for('main.index'))

    tutor = Tutor.query.get(slot.tutor_id)
    student = Student.query.get(slot.student_id) if slot.student_id else None

    # Calculate session duration
    start_dt = datetime.combine(slot.date, slot.start_time)
    end_dt = datetime.combine(slot.date, slot.end_time)
    duration_minutes = int((end_dt - start_dt).total_seconds() / 60)

    # Get session notes
    notes = SessionNote.query.filter_by(slot_id=slot_id).all()

    # Check if already reviewed
    existing_review = None
    if user_type == 'student':
        existing_review = Review.query.filter_by(
            student_id=user_id, booking_id=booking_id).first()

    other_name = tutor.name if user_type == 'student' else (student.name if student else 'Student')

    return render_template('session_summary.html',
                           slot=slot, booking=booking,
                           tutor=tutor, student=student,
                           duration_minutes=duration_minutes,
                           notes=notes, user_type=user_type,
                           other_name=other_name,
                           existing_review=existing_review)


@session_bp.route('/session/<int:slot_id>/quick-feedback', methods=['POST'])
@login_required
@limiter.limit('10 per minute')
def quick_feedback(slot_id):
    user_type, user_id, _ = _get_user_info()
    slot = TutorSlot.query.get_or_404(slot_id)

    if not _user_in_session(slot, user_type, user_id):
        return jsonify(error='Unauthorized'), 403

    data = request.get_json() or request.form
    rating = int(data.get('rating', 0))
    comment = str(data.get('comment', ''))[:1000]

    if rating < 1 or rating > 5:
        return jsonify(error='Rating must be 1-5'), 400

    booking = Booking.query.filter_by(
        slot_id=slot_id, student_id=slot.student_id
    ).first()

    if user_type == 'student' and booking:
        # Check if already reviewed
        existing = Review.query.filter_by(
            student_id=user_id, booking_id=booking.id).first()
        if existing:
            if request.is_json:
                return jsonify(error='Already reviewed'), 400
            flash('You have already reviewed this session.', 'info')
            return redirect(url_for('student_bp.dashboard'))

        review = Review(
            student_id=user_id,
            tutor_id=slot.tutor_id,
            booking_id=booking.id,
            rating=rating,
            rating_knowledge=rating,
            rating_communication=rating,
            rating_punctuality=rating,
            rating_value=rating,
            comment=comment if comment else None,
            is_verified=True
        )
        db.session.add(review)
        db.session.commit()

        try:
            from shared.event_bus import publish_event
            publish_event('review.created', {
                'review_id': review.id,
                'student_id': user_id,
                'tutor_id': slot.tutor_id,
                'rating': rating,
                'booking_id': booking.id,
            })
        except Exception:
            pass

        try:
            from services.search_service import invalidate_search_cache
            invalidate_search_cache()
        except Exception:
            pass

    if request.is_json:
        return jsonify(success=True)

    flash('Thank you for your feedback!', 'success')
    if user_type == 'student':
        return redirect(url_for('student_bp.dashboard'))
    return redirect(url_for('tutor_bp.tutor_dashboard'))


# ═══════════════════════════════════════════════════════════
# ITEM 4: DOWNLOADABLE PDF RECEIPT
# ═══════════════════════════════════════════════════════════

@session_bp.route('/session/<int:booking_id>/receipt/pdf')
@login_required
def download_receipt_pdf(booking_id):
    booking = Booking.query.get_or_404(booking_id)

    allowed = False
    if current_user.user_type == 'student' and booking.student_id == current_user.id:
        allowed = True
    elif current_user.user_type == 'tutor' and booking.tutor_id == current_user.id:
        allowed = True
    elif current_user.user_type == 'admin':
        allowed = True

    if not allowed:
        flash('Access denied.', 'danger')
        return redirect(url_for('main.index'))

    slot = TutorSlot.query.get(booking.slot_id)
    student = Student.query.get(booking.student_id)
    tutor = Tutor.query.get(booking.tutor_id)

    from models.payment import Payment
    payment = Payment.query.filter_by(booking_id=booking.id).first()

    pdf_output = _generate_receipt_pdf(booking, slot, student, tutor, payment)

    # fpdf2 returns str, older fpdf returns str — ensure bytes
    if isinstance(pdf_output, str):
        pdf_bytes = pdf_output.encode('latin-1')
    else:
        pdf_bytes = pdf_output

    invoice_number = f'TW-{booking.id:06d}'
    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f'TeachWise_Receipt_{invoice_number}.pdf'
    )


def _generate_receipt_pdf(booking, slot, student, tutor, payment=None):
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=20)

    invoice_number = f'TW-{booking.id:06d}'
    date_str = slot.date.strftime('%B %d, %Y') if slot and slot.date else 'N/A'
    time_str = (f'{slot.start_time.strftime("%I:%M %p")} - {slot.end_time.strftime("%I:%M %p")}'
                if slot and slot.start_time else 'N/A')
    price = float(slot.price or 0) if slot else 0
    subject = (slot.subject or 'General') if slot else 'General'
    mode = (slot.mode or 'online').title() if slot else 'Online'

    # Calculate duration
    if slot and slot.start_time and slot.end_time:
        start_dt = datetime.combine(slot.date, slot.start_time)
        end_dt = datetime.combine(slot.date, slot.end_time)
        duration_min = int((end_dt - start_dt).total_seconds() / 60)
    else:
        duration_min = 0

    payment_status = 'Paid'
    paid_on = ''
    if payment:
        payment_status = payment.status.replace('_', ' ').title()
        if payment.completed_at:
            paid_on = payment.completed_at.strftime('%B %d, %Y')
    elif price == 0:
        payment_status = 'Free Session'

    issued_date = datetime.utcnow().strftime('%B %d, %Y')

    # Header
    pdf.set_font('Helvetica', 'B', 24)
    pdf.set_text_color(37, 99, 235)
    pdf.cell(0, 12, 'TeachWise', ln=True)
    pdf.set_font('Helvetica', '', 16)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 10, 'Session Receipt', ln=True)

    pdf.ln(4)
    pdf.set_draw_color(37, 99, 235)
    pdf.set_line_width(0.8)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(8)

    # Receipt info
    pdf.set_font('Helvetica', '', 11)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(40, 7, 'Receipt #:', 0)
    pdf.set_text_color(51, 51, 51)
    pdf.set_font('Helvetica', 'B', 11)
    pdf.cell(0, 7, invoice_number, ln=True)

    pdf.set_font('Helvetica', '', 11)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(40, 7, 'Date Issued:', 0)
    pdf.set_text_color(51, 51, 51)
    pdf.cell(0, 7, issued_date, ln=True)

    pdf.set_text_color(100, 100, 100)
    pdf.cell(40, 7, 'Status:', 0)
    pdf.set_text_color(6, 95, 70)
    pdf.set_font('Helvetica', 'B', 11)
    pdf.cell(0, 7, payment_status, ln=True)
    pdf.ln(8)

    # Session Details section
    pdf.set_font('Helvetica', 'B', 13)
    pdf.set_text_color(37, 99, 235)
    pdf.cell(0, 8, 'SESSION DETAILS', ln=True)
    pdf.set_draw_color(229, 231, 235)
    pdf.set_line_width(0.3)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(4)

    details = [
        ('Student', student.name if student else 'N/A'),
        ('Tutor', tutor.name if tutor else 'N/A'),
        ('Subject', subject),
        ('Session Date', date_str),
        ('Time', time_str),
        ('Duration', f'{duration_min} minutes'),
        ('Mode', mode),
    ]
    for label, value in details:
        pdf.set_font('Helvetica', '', 10)
        pdf.set_text_color(136, 136, 136)
        pdf.cell(45, 7, label, 0)
        pdf.set_font('Helvetica', '', 11)
        pdf.set_text_color(51, 51, 51)
        pdf.cell(0, 7, value, ln=True)

    pdf.ln(8)

    # Payment Summary section
    pdf.set_font('Helvetica', 'B', 13)
    pdf.set_text_color(37, 99, 235)
    pdf.cell(0, 8, 'PAYMENT SUMMARY', ln=True)
    pdf.set_draw_color(229, 231, 235)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(4)

    # Table header
    pdf.set_fill_color(243, 244, 246)
    pdf.set_font('Helvetica', 'B', 10)
    pdf.set_text_color(85, 85, 85)
    pdf.cell(130, 8, 'Description', 1, 0, 'L', True)
    pdf.cell(50, 8, 'Amount', 1, 1, 'R', True)

    # Table row
    pdf.set_font('Helvetica', '', 11)
    pdf.set_text_color(51, 51, 51)
    pdf.cell(130, 8, f'{subject} Session ({mode})', 1, 0, 'L')
    pdf.cell(50, 8, f'${price:.2f}', 1, 1, 'R')

    # Total row
    pdf.set_font('Helvetica', 'B', 12)
    pdf.set_draw_color(51, 51, 51)
    pdf.cell(130, 9, 'Total', 'TB', 0, 'L')
    pdf.cell(50, 9, f'${price:.2f}', 'TB', 1, 'R')

    if paid_on:
        pdf.ln(3)
        pdf.set_font('Helvetica', '', 10)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(0, 6, f'Paid on: {paid_on}', ln=True)

    # Footer
    pdf.ln(20)
    pdf.set_draw_color(229, 231, 235)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(6)
    pdf.set_font('Helvetica', '', 10)
    pdf.set_text_color(153, 153, 153)
    pdf.cell(0, 6, 'Thank you for using TeachWise!', 0, 1, 'C')
    pdf.cell(0, 6, f'Booking #{booking.id}  |  Generated {issued_date}', 0, 1, 'C')

    return pdf.output(dest='S')


# ═══════════════════════════════════════════════════════════
# EXISTING RECEIPT (HTML)
# ═══════════════════════════════════════════════════════════

@session_bp.route('/receipt/<int:booking_id>')
def view_receipt(booking_id):
    if not current_user.is_authenticated:
        flash('Please log in.', 'warning')
        return redirect(url_for('student_bp.login_student'))

    booking = Booking.query.get_or_404(booking_id)

    allowed = False
    if current_user.user_type == 'student' and booking.student_id == current_user.id:
        allowed = True
    elif current_user.user_type == 'tutor' and booking.tutor_id == current_user.id:
        allowed = True
    elif current_user.user_type == 'admin':
        allowed = True

    if not allowed:
        flash('Access denied.', 'danger')
        return redirect(url_for('main.index'))

    slot = TutorSlot.query.get(booking.slot_id)
    student = Student.query.get(booking.student_id)
    tutor = Tutor.query.get(booking.tutor_id)

    from models.payment import Payment
    payment = Payment.query.filter_by(booking_id=booking.id).first()

    from services.invoice_service import generate_invoice_html
    html = generate_invoice_html(booking, slot, student, tutor, payment)

    return Response(html, content_type='text/html')


# ═══════════════════════════════════════════════════════════
# SOCKET.IO SESSION EVENTS (Items 5, 9)
# ═══════════════════════════════════════════════════════════

@socketio.on('join_session')
def handle_join_session(data):
    slot_id = data.get('slot_id')
    if slot_id:
        join_room(f'session_{slot_id}')


@socketio.on('leave_session')
def handle_leave_session(data):
    slot_id = data.get('slot_id')
    if slot_id:
        leave_room(f'session_{slot_id}')


@socketio.on('session_pause')
def handle_session_pause(data):
    slot_id = data.get('slot_id')
    user_name = data.get('user_name', '')
    user_type = data.get('user_type', '')
    if slot_id:
        emit('session_paused', {
            'paused_by': user_name,
            'paused_by_type': user_type,
            'paused_at': datetime.utcnow().isoformat()
        }, room=f'session_{slot_id}')


@socketio.on('session_resume')
def handle_session_resume(data):
    slot_id = data.get('slot_id')
    user_name = data.get('user_name', '')
    if slot_id:
        emit('session_resumed', {
            'resumed_by': user_name
        }, room=f'session_{slot_id}')


@socketio.on('session_note_saved')
def handle_note_saved(data):
    """Notify other participant when a note is saved."""
    slot_id = data.get('slot_id')
    if slot_id:
        emit('note_updated', {
            'user_name': data.get('user_name', ''),
        }, room=f'session_{slot_id}', include_self=False)
