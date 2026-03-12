from flask import (Blueprint, render_template, request, redirect, url_for,
                   flash, jsonify)
from flask_login import login_required, current_user
from utils.sanitizer import sanitize_input_length
from models.session_note import SessionNote
from models.slots import TutorSlot
from models.booking import Booking
from models.tutor import Tutor
from models.student import Student
from database import db
from datetime import datetime

note_bp = Blueprint('note_bp', __name__)

MAX_NOTE_LENGTH = 5000


def _can_access_session(slot, user_type, user_id):
    """Check if user is the tutor or the booked student for this slot."""
    if user_type == 'tutor' and slot.tutor_id == user_id:
        return True
    if user_type == 'student' and slot.student_id == user_id:
        return True
    return False

@note_bp.route('/session/<int:slot_id>/notes')
@login_required
def view_notes(slot_id):
    slot = TutorSlot.query.get_or_404(slot_id)
    user_type = current_user.user_type
    user_id = current_user.id

    if not _can_access_session(slot, user_type, user_id):
        flash('Access denied.', 'danger')
        if user_type == 'tutor':
            return redirect(url_for('tutor_bp.tutor_dashboard'))
        return redirect(url_for('student_bp.dashboard'))

    # Get notes: show all non-private notes + user's own private notes
    notes = SessionNote.query.filter_by(slot_id=slot_id).order_by(
        SessionNote.created_at.asc()
    ).all()

    # Filter: hide private notes from other users
    visible_notes = []
    for note in notes:
        if note.is_private and not (
            note.author_type == user_type and note.author_id == user_id
        ):
            continue
        visible_notes.append(note)

    tutor = Tutor.query.get(slot.tutor_id)
    student = Student.query.get(slot.student_id) if slot.student_id else None

    # Resolve author names for display
    author_names = {}
    for note in visible_notes:
        key = f"{note.author_type}_{note.author_id}"
        if key not in author_names:
            if note.author_type == 'tutor':
                t = Tutor.query.get(note.author_id)
                author_names[key] = t.name if t else 'Tutor'
            else:
                s = Student.query.get(note.author_id)
                author_names[key] = s.name if s else 'Student'

    return render_template('session_notes.html',
                           slot=slot, tutor=tutor, student=student,
                           notes=visible_notes, author_names=author_names,
                           user_type=user_type, user_id=user_id)

@note_bp.route('/session/<int:slot_id>/notes', methods=['POST'])
@login_required
def add_note(slot_id):
    slot = TutorSlot.query.get_or_404(slot_id)
    user_type = current_user.user_type
    user_id = current_user.id

    if not _can_access_session(slot, user_type, user_id):
        flash('Access denied.', 'danger')
        return redirect(url_for('main.index'))

    content = sanitize_input_length(request.form.get('content', ''), MAX_NOTE_LENGTH)
    is_private = request.form.get('is_private') == 'on'

    if not content or not content.strip():
        flash('Note cannot be empty.', 'danger')
        return redirect(url_for('note_bp.view_notes', slot_id=slot_id))

    note = SessionNote(
        slot_id=slot_id,
        author_type=user_type,
        author_id=user_id,
        content=content.strip(),
        is_private=is_private
    )
    db.session.add(note)
    db.session.commit()

    flash('Note added successfully!', 'success')
    return redirect(url_for('note_bp.view_notes', slot_id=slot_id))

@note_bp.route('/session/notes/<int:note_id>/edit', methods=['POST'])
@login_required
def edit_note(note_id):
    note = SessionNote.query.get_or_404(note_id)
    user_type = current_user.user_type
    user_id = current_user.id

    # Only the author can edit
    if note.author_type != user_type or note.author_id != user_id:
        flash('You can only edit your own notes.', 'danger')
        return redirect(url_for('note_bp.view_notes', slot_id=note.slot_id))

    content = sanitize_input_length(request.form.get('content', ''), MAX_NOTE_LENGTH)
    is_private = request.form.get('is_private') == 'on'

    if not content or not content.strip():
        flash('Note cannot be empty.', 'danger')
        return redirect(url_for('note_bp.view_notes', slot_id=note.slot_id))

    note.content = content.strip()
    note.is_private = is_private
    note.updated_at = datetime.utcnow()
    db.session.commit()

    flash('Note updated!', 'success')
    return redirect(url_for('note_bp.view_notes', slot_id=note.slot_id))

@note_bp.route('/session/notes/<int:note_id>/delete', methods=['POST'])
@login_required
def delete_note(note_id):
    note = SessionNote.query.get_or_404(note_id)
    user_type = current_user.user_type
    user_id = current_user.id

    # Only the author can delete
    if note.author_type != user_type or note.author_id != user_id:
        flash('You can only delete your own notes.', 'danger')
        return redirect(url_for('note_bp.view_notes', slot_id=note.slot_id))

    slot_id = note.slot_id
    db.session.delete(note)
    db.session.commit()

    flash('Note deleted.', 'success')
    return redirect(url_for('note_bp.view_notes', slot_id=slot_id))

@note_bp.route('/api/session/<int:slot_id>/notes', methods=['POST'])
@login_required
def api_add_note(slot_id):
    slot = TutorSlot.query.get_or_404(slot_id)
    user_type = current_user.user_type
    user_id = current_user.id

    if not _can_access_session(slot, user_type, user_id):
        return jsonify({'error': 'Access denied'}), 403

    data = request.get_json(silent=True) or {}
    content = data.get('content', '')
    is_private = data.get('is_private', False)

    content = sanitize_input_length(content, MAX_NOTE_LENGTH)
    if not content or not content.strip():
        return jsonify({'error': 'Note cannot be empty'}), 400

    note = SessionNote(
        slot_id=slot_id,
        author_type=user_type,
        author_id=user_id,
        content=content.strip(),
        is_private=bool(is_private)
    )
    db.session.add(note)
    db.session.commit()

    return jsonify({
        'ok': True,
        'note': {
            'id': note.id,
            'content': note.content,
            'author_type': note.author_type,
            'author_name': current_user.name,
            'is_private': note.is_private,
            'created_at': note.created_at.strftime('%b %d, %Y %I:%M %p')
        }
    })

@note_bp.route('/api/session/<int:slot_id>/notes', methods=['GET'])
@login_required
def api_get_notes(slot_id):
    slot = TutorSlot.query.get_or_404(slot_id)
    user_type = current_user.user_type
    user_id = current_user.id

    if not _can_access_session(slot, user_type, user_id):
        return jsonify({'error': 'Access denied'}), 403

    notes = SessionNote.query.filter_by(slot_id=slot_id).order_by(
        SessionNote.created_at.asc()
    ).all()

    result = []
    for note in notes:
        # Skip private notes from other users
        if note.is_private and not (
            note.author_type == user_type and note.author_id == user_id
        ):
            continue

        # Resolve author name
        if note.author_type == 'tutor':
            author = Tutor.query.get(note.author_id)
        else:
            author = Student.query.get(note.author_id)

        result.append({
            'id': note.id,
            'content': note.content,
            'author_type': note.author_type,
            'author_name': author.name if author else 'Unknown',
            'is_private': note.is_private,
            'is_own': (note.author_type == user_type and note.author_id == user_id),
            'created_at': note.created_at.strftime('%b %d, %Y %I:%M %p'),
            'updated_at': note.updated_at.strftime('%b %d, %Y %I:%M %p') if note.updated_at else None
        })

    return jsonify({'notes': result})

@note_bp.route('/api/session/notes/<int:note_id>', methods=['DELETE'])
@login_required
def api_delete_note(note_id):
    note = SessionNote.query.get_or_404(note_id)
    user_type = current_user.user_type
    user_id = current_user.id

    if note.author_type != user_type or note.author_id != user_id:
        return jsonify({'error': 'You can only delete your own notes'}), 403

    db.session.delete(note)
    db.session.commit()

    return jsonify({'ok': True})
