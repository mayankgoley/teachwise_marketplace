from flask import (Blueprint, render_template, request, jsonify,
                   flash, redirect, url_for, Response)
from flask_login import login_required, current_user
from models.recording import SessionRecording
from models.booking import Booking
from models.slots import TutorSlot
from models.tutor import Tutor
from models.student import Student
from services.storage_service import upload_document, download_document
from database import db
from datetime import datetime, timedelta

recording_bp = Blueprint('recording_bp', __name__)


def _check_session_access(slot):
    """Verify current user is the booked student or the tutor for this slot."""
    if not current_user.is_authenticated:
        return False
    if current_user.user_type == 'student' and slot.student_id == current_user.id:
        return True
    if current_user.user_type == 'tutor' and slot.tutor_id == current_user.id:
        return True
    return False


def _get_user_role(slot):
    """Return 'student', 'tutor', or None."""
    if not current_user.is_authenticated:
        return None
    if current_user.user_type == 'student' and slot.student_id == current_user.id:
        return 'student'
    if current_user.user_type == 'tutor' and slot.tutor_id == current_user.id:
        return 'tutor'
    return None


@recording_bp.route('/session/<int:slot_id>/record/consent', methods=['POST'])
def record_consent(slot_id):
    """User gives or withdraws recording consent."""
    slot = TutorSlot.query.get_or_404(slot_id)
    role = _get_user_role(slot)
    if not role:
        return jsonify({'error': 'Access denied'}), 403

    data = request.get_json()
    consent = data.get('consent', False)

    # Find the booking for this slot
    booking = Booking.query.filter_by(
        slot_id=slot_id, status='Booked'
    ).first() or Booking.query.filter_by(slot_id=slot_id).first()

    if not booking:
        return jsonify({'error': 'No booking found'}), 404

    if role == 'student':
        booking.recording_consent_student = consent
    else:
        booking.recording_consent_tutor = consent

    db.session.commit()

    both_consented = booking.recording_consent_student and booking.recording_consent_tutor
    return jsonify({
        'ok': True,
        'both_consented': both_consented,
        'student_consent': booking.recording_consent_student,
        'tutor_consent': booking.recording_consent_tutor
    })


@recording_bp.route('/session/<int:slot_id>/record/upload', methods=['POST'])
def upload_recording(slot_id):
    """Upload a recorded session (browser MediaRecorder WebM)."""
    slot = TutorSlot.query.get_or_404(slot_id)
    if not _check_session_access(slot):
        return jsonify({'error': 'Access denied'}), 403

    booking = Booking.query.filter_by(slot_id=slot_id).first()
    if not booking:
        return jsonify({'error': 'No booking found'}), 404

    if not (booking.recording_consent_student and booking.recording_consent_tutor):
        return jsonify({'error': 'Both parties must consent to recording'}), 403

    file = request.files.get('recording')
    if not file:
        return jsonify({'error': 'No file provided'}), 400

    file_bytes = file.read()
    if len(file_bytes) > 500 * 1024 * 1024:  # 500MB limit
        return jsonify({'error': 'Recording too large (max 500MB)'}), 400

    filename = f'recording_{slot_id}_{datetime.utcnow().strftime("%Y%m%d%H%M%S")}.webm'
    result = upload_document(file_bytes, slot.tutor_id, filename)

    if not result:
        return jsonify({'error': 'Upload failed'}), 500

    duration = request.form.get('duration', 0, type=int)

    recording = SessionRecording(
        slot_id=slot_id,
        booking_id=booking.id,
        r2_object_key=result['r2_object_key'],
        file_encryption_key=result['file_encryption_key'],
        duration_seconds=duration,
        file_size_bytes=result['file_size_bytes'],
        consent_student=True,
        consent_tutor=True,
        expires_at=datetime.utcnow() + timedelta(days=30)
    )
    db.session.add(recording)
    db.session.commit()

    return jsonify({'ok': True, 'recording_id': recording.id})


@recording_bp.route('/session/<int:slot_id>/recording/<int:recording_id>')
def playback_recording(slot_id, recording_id):
    """Stream decrypted recording for authorized users."""
    slot = TutorSlot.query.get_or_404(slot_id)
    recording = SessionRecording.query.get_or_404(recording_id)

    if recording.slot_id != slot_id:
        flash('Invalid recording.', 'danger')
        return redirect(url_for('main.index'))

    # Auth: student, tutor, or guardian of minor student
    if not current_user.is_authenticated:
        flash('Access denied.', 'danger')
        return redirect(url_for('main.index'))

    is_student = current_user.user_type == 'student' and slot.student_id == current_user.id
    is_tutor = current_user.user_type == 'tutor' and slot.tutor_id == current_user.id
    is_guardian = False
    if current_user.user_type == 'guardian':
        student = Student.query.get(slot.student_id)
        if student and student.guardian_id == current_user.id:
            is_guardian = True

    if not (is_student or is_tutor or is_guardian):
        flash('Access denied.', 'danger')
        return redirect(url_for('main.index'))

    if recording.is_deleted or recording.is_expired:
        flash('This recording has expired or been deleted.', 'info')
        return redirect(url_for('main.index'))

    # Decrypt and stream
    file_bytes, ext = download_document(recording.r2_object_key, recording.file_encryption_key)
    if not file_bytes:
        flash('Could not retrieve recording.', 'danger')
        return redirect(url_for('main.index'))

    return Response(
        file_bytes,
        mimetype='video/webm',
        headers={'Content-Disposition': f'inline; filename=recording_{slot_id}.webm'}
    )


@recording_bp.route('/recording/<int:recording_id>/view')
def view_recording(recording_id):
    recording = SessionRecording.query.get_or_404(recording_id)
    slot = TutorSlot.query.get(recording.slot_id)
    if not slot:
        flash('Session not found.', 'danger')
        return redirect(url_for('main.index'))

    # Auth check (same as playback)
    if not current_user.is_authenticated:
        flash('Access denied.', 'danger')
        return redirect(url_for('main.index'))

    is_student = current_user.user_type == 'student' and slot.student_id == current_user.id
    is_tutor = current_user.user_type == 'tutor' and slot.tutor_id == current_user.id
    is_guardian = False
    if current_user.user_type == 'guardian':
        student = Student.query.get(slot.student_id)
        if student and student.guardian_id == current_user.id:
            is_guardian = True

    if not (is_student or is_tutor or is_guardian):
        flash('Access denied.', 'danger')
        return redirect(url_for('main.index'))

    tutor = Tutor.query.get(slot.tutor_id)
    student = Student.query.get(slot.student_id) if slot.student_id else None

    return render_template('view_recording.html',
                           recording=recording, slot=slot,
                           tutor=tutor, student=student)


@recording_bp.route('/student/recordings')
@login_required
def student_recordings():
    slots = TutorSlot.query.filter_by(student_id=current_user.id).all()
    slot_ids = [s.id for s in slots]
    recordings = []
    if slot_ids:
        recordings = SessionRecording.query.filter(
            SessionRecording.slot_id.in_(slot_ids),
            SessionRecording.is_deleted == False
        ).order_by(SessionRecording.created_at.desc()).all()

    return render_template('recordings_list.html',
                           recordings=recordings, role='student')


@recording_bp.route('/tutor/recordings')
def tutor_recordings():
    if not current_user.is_authenticated or current_user.user_type != 'tutor':
        flash('Access denied.', 'danger')
        return redirect(url_for('main.index'))

    tutor_id = current_user.id
    slots = TutorSlot.query.filter_by(tutor_id=tutor_id).all()
    slot_ids = [s.id for s in slots]
    recordings = []
    if slot_ids:
        recordings = SessionRecording.query.filter(
            SessionRecording.slot_id.in_(slot_ids),
            SessionRecording.is_deleted == False
        ).order_by(SessionRecording.created_at.desc()).all()

    return render_template('recordings_list.html',
                           recordings=recordings, role='tutor')
