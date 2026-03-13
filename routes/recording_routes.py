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

# C1: Quality presets
QUALITY_PRESETS = {
    'low': {'label': 'Low (360p)', 'width': 640, 'height': 360, 'bitrate': 500000},
    'medium': {'label': 'Medium (720p)', 'width': 1280, 'height': 720, 'bitrate': 1500000},
    'high': {'label': 'High (1080p)', 'width': 1920, 'height': 1080, 'bitrate': 3000000},
}


def _check_session_access(slot):
    if not current_user.is_authenticated:
        return False
    if current_user.user_type == 'student' and slot.student_id == current_user.id:
        return True
    if current_user.user_type == 'tutor' and slot.tutor_id == current_user.id:
        return True
    return False


def _get_user_role(slot):
    if not current_user.is_authenticated:
        return None
    if current_user.user_type == 'student' and slot.student_id == current_user.id:
        return 'student'
    if current_user.user_type == 'tutor' and slot.tutor_id == current_user.id:
        return 'tutor'
    return None


def _is_guardian_of(slot):
    """C6: Check if current user is guardian of the student in this slot."""
    if not current_user.is_authenticated or current_user.user_type != 'guardian':
        return False
    student = Student.query.get(slot.student_id)
    return student and student.guardian_id == current_user.id


@recording_bp.route('/session/<int:slot_id>/record/consent', methods=['POST'])
def record_consent(slot_id):
    slot = TutorSlot.query.get_or_404(slot_id)
    role = _get_user_role(slot)
    if not role:
        return jsonify({'error': 'Access denied'}), 403

    data = request.get_json()
    consent = data.get('consent', False)

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


# C2: Get consent status
@recording_bp.route('/session/<int:slot_id>/record/consent-status')
def consent_status(slot_id):
    slot = TutorSlot.query.get_or_404(slot_id)
    if not _check_session_access(slot):
        return jsonify({'error': 'Access denied'}), 403

    booking = Booking.query.filter_by(slot_id=slot_id).first()
    if not booking:
        return jsonify({'student_consent': False, 'tutor_consent': False, 'both': False})

    return jsonify({
        'student_consent': bool(booking.recording_consent_student),
        'tutor_consent': bool(booking.recording_consent_tutor),
        'both': bool(booking.recording_consent_student and booking.recording_consent_tutor)
    })


# C1: Get quality presets
@recording_bp.route('/api/recording/quality-presets')
@login_required
def quality_presets():
    return jsonify(QUALITY_PRESETS)


@recording_bp.route('/session/<int:slot_id>/record/upload', methods=['POST'])
def upload_recording(slot_id):
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
    if len(file_bytes) > 500 * 1024 * 1024:
        return jsonify({'error': 'Recording too large (max 500MB)'}), 400

    quality = request.form.get('quality', 'medium')
    if quality not in QUALITY_PRESETS:
        quality = 'medium'

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
        quality=quality,
        consent_student=True,
        consent_tutor=True,
        expires_at=datetime.utcnow() + timedelta(days=30)
    )
    db.session.add(recording)
    db.session.commit()

    return jsonify({'ok': True, 'recording_id': recording.id})


@recording_bp.route('/session/<int:slot_id>/recording/<int:recording_id>')
def playback_recording(slot_id, recording_id):
    """C4: Streaming playback with range request support."""
    slot = TutorSlot.query.get_or_404(slot_id)
    recording = SessionRecording.query.get_or_404(recording_id)

    if recording.slot_id != slot_id:
        flash('Invalid recording.', 'danger')
        return redirect(url_for('main.index'))

    if not current_user.is_authenticated:
        flash('Access denied.', 'danger')
        return redirect(url_for('main.index'))

    is_student = current_user.user_type == 'student' and slot.student_id == current_user.id
    is_tutor = current_user.user_type == 'tutor' and slot.tutor_id == current_user.id
    is_guardian = _is_guardian_of(slot)

    if not (is_student or is_tutor or is_guardian):
        flash('Access denied.', 'danger')
        return redirect(url_for('main.index'))

    if recording.is_deleted or recording.is_expired:
        flash('This recording has expired or been deleted.', 'info')
        return redirect(url_for('main.index'))

    file_bytes, ext = download_document(recording.r2_object_key, recording.file_encryption_key)
    if not file_bytes:
        flash('Could not retrieve recording.', 'danger')
        return redirect(url_for('main.index'))

    # C4: Support range requests for streaming
    total_size = len(file_bytes)
    range_header = request.headers.get('Range')
    if range_header:
        byte_range = range_header.replace('bytes=', '').split('-')
        start = int(byte_range[0])
        end = int(byte_range[1]) if byte_range[1] else total_size - 1
        end = min(end, total_size - 1)
        chunk = file_bytes[start:end + 1]
        return Response(
            chunk,
            status=206,
            mimetype='video/webm',
            headers={
                'Content-Range': f'bytes {start}-{end}/{total_size}',
                'Accept-Ranges': 'bytes',
                'Content-Length': str(len(chunk)),
                'Content-Disposition': f'inline; filename=recording_{slot_id}.webm'
            }
        )

    return Response(
        file_bytes,
        mimetype='video/webm',
        headers={
            'Content-Disposition': f'inline; filename=recording_{slot_id}.webm',
            'Accept-Ranges': 'bytes',
            'Content-Length': str(total_size)
        }
    )


@recording_bp.route('/recording/<int:recording_id>/view')
def view_recording(recording_id):
    recording = SessionRecording.query.get_or_404(recording_id)
    slot = TutorSlot.query.get(recording.slot_id)
    if not slot:
        flash('Session not found.', 'danger')
        return redirect(url_for('main.index'))

    if not current_user.is_authenticated:
        flash('Access denied.', 'danger')
        return redirect(url_for('main.index'))

    is_student = current_user.user_type == 'student' and slot.student_id == current_user.id
    is_tutor = current_user.user_type == 'tutor' and slot.tutor_id == current_user.id
    is_guardian = _is_guardian_of(slot)

    if not (is_student or is_tutor or is_guardian):
        flash('Access denied.', 'danger')
        return redirect(url_for('main.index'))

    tutor = Tutor.query.get(slot.tutor_id)
    student = Student.query.get(slot.student_id) if slot.student_id else None

    # C5: Expiry warning
    days_until_expiry = None
    if recording.expires_at:
        delta = recording.expires_at - datetime.utcnow()
        days_until_expiry = max(0, delta.days)

    return render_template('view_recording.html',
                           recording=recording, slot=slot,
                           tutor=tutor, student=student,
                           days_until_expiry=days_until_expiry,
                           quality_label=QUALITY_PRESETS.get(recording.quality, {}).get('label', ''))


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

    # C5: Flag recordings expiring within 3 days
    expiring_soon = []
    for rec in recordings:
        if rec.expires_at:
            delta = rec.expires_at - datetime.utcnow()
            if 0 < delta.days <= 3 and not rec.is_expired:
                expiring_soon.append(rec.id)

    return render_template('recordings_list.html',
                           recordings=recordings, role='student',
                           expiring_soon=expiring_soon,
                           quality_presets=QUALITY_PRESETS)


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

    expiring_soon = []
    for rec in recordings:
        if rec.expires_at:
            delta = rec.expires_at - datetime.utcnow()
            if 0 < delta.days <= 3 and not rec.is_expired:
                expiring_soon.append(rec.id)

    return render_template('recordings_list.html',
                           recordings=recordings, role='tutor',
                           expiring_soon=expiring_soon,
                           quality_presets=QUALITY_PRESETS)


# C6: Guardian recordings list
@recording_bp.route('/guardian/recordings')
@login_required
def guardian_recordings():
    if current_user.user_type != 'guardian':
        flash('Access denied.', 'danger')
        return redirect(url_for('main.index'))

    # Find all students under this guardian
    students = Student.query.filter_by(guardian_id=current_user.id).all()
    student_ids = [s.id for s in students]
    if not student_ids:
        return render_template('recordings_list.html',
                               recordings=[], role='guardian',
                               expiring_soon=[], quality_presets=QUALITY_PRESETS)

    slots = TutorSlot.query.filter(TutorSlot.student_id.in_(student_ids)).all()
    slot_ids = [s.id for s in slots]
    recordings = []
    if slot_ids:
        recordings = SessionRecording.query.filter(
            SessionRecording.slot_id.in_(slot_ids),
            SessionRecording.is_deleted == False
        ).order_by(SessionRecording.created_at.desc()).all()

    return render_template('recordings_list.html',
                           recordings=recordings, role='guardian',
                           expiring_soon=[], quality_presets=QUALITY_PRESETS)
