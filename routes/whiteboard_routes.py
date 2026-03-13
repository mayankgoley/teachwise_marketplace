from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for
from flask_login import current_user
from models.whiteboard import WhiteboardSession
from models.slots import TutorSlot
from models.tutor import Tutor
from models.booking import Booking
from services.storage_service import upload_document
from extensions import socketio
from flask_socketio import emit, join_room, leave_room
from database import db
from datetime import datetime
import base64

whiteboard_bp = Blueprint('whiteboard_bp', __name__)


def _check_session_access(slot):
    """Verify current user is the booked student or the tutor for this slot."""
    if not current_user.is_authenticated:
        return False
    if current_user.user_type == 'student' and slot.student_id == current_user.id:
        return True
    if current_user.user_type == 'tutor' and slot.tutor_id == current_user.id:
        return True
    return False


@whiteboard_bp.route('/session/<int:slot_id>/whiteboard')
def session_whiteboard(slot_id):
    """Standalone whiteboard page for a session."""
    slot = TutorSlot.query.get_or_404(slot_id)

    if not _check_session_access(slot):
        flash('Access denied.', 'danger')
        return redirect(url_for('main.index'))

    tutor = Tutor.query.get(slot.tutor_id)

    # Get or create whiteboard session
    wb = WhiteboardSession.query.filter_by(slot_id=slot_id).first()
    if not wb:
        wb = WhiteboardSession(slot_id=slot_id)
        db.session.add(wb)
        db.session.commit()

    # Load previous whiteboards for this student-tutor pair
    previous = []
    if slot.student_id and slot.tutor_id:
        prev_slots = TutorSlot.query.filter(
            TutorSlot.tutor_id == slot.tutor_id,
            TutorSlot.student_id == slot.student_id,
            TutorSlot.id != slot_id
        ).all()
        prev_slot_ids = [s.id for s in prev_slots]
        if prev_slot_ids:
            previous = WhiteboardSession.query.filter(
                WhiteboardSession.slot_id.in_(prev_slot_ids),
                WhiteboardSession.json_state.isnot(None)
            ).order_by(WhiteboardSession.updated_at.desc()).limit(10).all()

    return render_template('session_whiteboard.html',
                           slot=slot, tutor=tutor, wb=wb, previous=previous)


@whiteboard_bp.route('/api/whiteboard/<int:slot_id>/save', methods=['POST'])
def save_whiteboard(slot_id):
    """Auto-save whiteboard state (called periodically via AJAX)."""
    slot = TutorSlot.query.get_or_404(slot_id)

    if not _check_session_access(slot):
        return jsonify({'error': 'Access denied'}), 403

    wb = WhiteboardSession.query.filter_by(slot_id=slot_id).first()
    if not wb:
        wb = WhiteboardSession(slot_id=slot_id)
        db.session.add(wb)

    data = request.get_json()
    wb.json_state = data.get('state', '')
    wb.updated_at = datetime.utcnow()

    # Item 3: Save thumbnail if provided
    thumbnail = data.get('thumbnail')
    if thumbnail and thumbnail.startswith('data:image/'):
        wb.thumbnail = thumbnail

    db.session.commit()

    return jsonify({'ok': True})


@whiteboard_bp.route('/api/whiteboard/<int:slot_id>/load')
def load_whiteboard(slot_id):
    """Load whiteboard state."""
    slot = TutorSlot.query.get_or_404(slot_id)

    if not _check_session_access(slot):
        return jsonify({'error': 'Access denied'}), 403

    wb = WhiteboardSession.query.filter_by(slot_id=slot_id).first()
    return jsonify({
        'state': wb.json_state if wb else None,
        'snapshots': wb.snapshots if wb else []
    })


@whiteboard_bp.route('/api/whiteboard/<int:slot_id>/snapshot', methods=['POST'])
def save_snapshot(slot_id):
    """Export canvas as PNG and save to storage."""
    slot = TutorSlot.query.get_or_404(slot_id)

    if not _check_session_access(slot):
        return jsonify({'error': 'Access denied'}), 403

    data = request.get_json()
    image_data = data.get('image', '')

    if not image_data or not image_data.startswith('data:image/png;base64,'):
        return jsonify({'error': 'Invalid image data'}), 400

    raw = image_data.split(',', 1)[1]
    png_bytes = base64.b64decode(raw)

    if len(png_bytes) > 10 * 1024 * 1024:
        return jsonify({'error': 'Snapshot too large'}), 400

    filename = f'whiteboard_{slot_id}_{datetime.utcnow().strftime("%Y%m%d%H%M%S")}.png'
    result = upload_document(png_bytes, slot.tutor_id, filename)

    if not result:
        return jsonify({'error': 'Failed to save snapshot'}), 500

    wb = WhiteboardSession.query.filter_by(slot_id=slot_id).first()
    if not wb:
        wb = WhiteboardSession(slot_id=slot_id)
        db.session.add(wb)

    snapshots = wb.snapshots or []
    snapshots.append({
        'key': result['r2_object_key'],
        'encryption_key': result['file_encryption_key'],
        'name': filename,
        'created_at': datetime.utcnow().isoformat()
    })
    wb.snapshots = snapshots
    db.session.commit()

    return jsonify({'ok': True, 'count': len(snapshots)})


@whiteboard_bp.route('/api/whiteboard/load-previous/<int:wb_id>')
def load_previous_whiteboard(wb_id):
    """Load a previous whiteboard session's state."""
    wb = WhiteboardSession.query.get_or_404(wb_id)
    slot = TutorSlot.query.get(wb.slot_id)

    if not slot or not _check_session_access(slot):
        return jsonify({'error': 'Access denied'}), 403

    return jsonify({'state': wb.json_state})


# ═══════════════════════════════════════════════════════════
# Item 4: Socket.IO Events for Real-Time Collaboration
# ═══════════════════════════════════════════════════════════

@socketio.on('join_whiteboard')
def handle_join_whiteboard(data):
    slot_id = data.get('slot_id')
    if slot_id:
        room = f'whiteboard_{slot_id}'
        join_room(room)
        # Send current state to newly joined user
        wb = WhiteboardSession.query.filter_by(slot_id=slot_id).first()
        if wb and wb.json_state:
            emit('whiteboard_full_state', {'canvas_json': wb.json_state})


@socketio.on('leave_whiteboard')
def handle_leave_whiteboard(data):
    slot_id = data.get('slot_id')
    if slot_id:
        leave_room(f'whiteboard_{slot_id}')


@socketio.on('whiteboard_draw')
def handle_whiteboard_draw(data):
    """Relay drawing events to other participants."""
    slot_id = data.get('slot_id')
    if slot_id:
        emit('whiteboard_draw', data, room=f'whiteboard_{slot_id}', include_self=False)


@socketio.on('whiteboard_clear')
def handle_whiteboard_clear(data):
    slot_id = data.get('slot_id')
    if slot_id:
        emit('whiteboard_clear', data, room=f'whiteboard_{slot_id}', include_self=False)


@socketio.on('whiteboard_undo')
def handle_whiteboard_undo(data):
    slot_id = data.get('slot_id')
    if slot_id:
        emit('whiteboard_undo', data, room=f'whiteboard_{slot_id}', include_self=False)
