from flask import (Blueprint, render_template, request, redirect, url_for,
                   flash, jsonify)
from flask_login import login_required, current_user
from utils.sanitizer import sanitize_input_length
from models.session_note import SessionNote, NoteVersion
from models.slots import TutorSlot
from models.booking import Booking
from models.tutor import Tutor
from models.student import Student
from services.storage_service import upload_document, download_document
from database import db
from datetime import datetime
import bleach

note_bp = Blueprint('note_bp', __name__)

MAX_NOTE_LENGTH = 5000
ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 's', 'ol', 'ul', 'li',
                'h1', 'h2', 'h3', 'blockquote', 'pre', 'code', 'a', 'span']
ALLOWED_ATTRS = {'a': ['href', 'target'], 'span': ['style'], '*': ['class']}

# B5: Note templates
NOTE_TEMPLATES = [
    {'name': 'Session Summary', 'content': '<h3>Topics Covered</h3><ul><li></li></ul><h3>Key Takeaways</h3><p></p><h3>Homework / Next Steps</h3><ul><li></li></ul>'},
    {'name': 'Lesson Plan', 'content': '<h3>Objectives</h3><ul><li></li></ul><h3>Activities</h3><ol><li></li></ol><h3>Assessment</h3><p></p>'},
    {'name': 'Student Feedback', 'content': '<h3>Strengths</h3><p></p><h3>Areas for Improvement</h3><p></p><h3>Recommendations</h3><ul><li></li></ul>'},
    {'name': 'Quick Notes', 'content': '<p>- </p>'},
]

# B6: File attachment settings
NOTE_ALLOWED_EXT = {'pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'txt'}
NOTE_MAX_FILE_MB = 10


def _can_access_session(slot, user_type, user_id):
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

    # B4: Search filter
    search_q = request.args.get('q', '').strip()

    notes = SessionNote.query.filter_by(slot_id=slot_id).order_by(
        SessionNote.created_at.asc()
    ).all()

    visible_notes = []
    for note in notes:
        if note.is_private and not (
            note.author_type == user_type and note.author_id == user_id
        ):
            continue
        # B4: Filter by search
        if search_q and search_q.lower() not in note.content.lower():
            continue
        visible_notes.append(note)

    tutor = Tutor.query.get(slot.tutor_id)
    student = Student.query.get(slot.student_id) if slot.student_id else None

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
                           user_type=user_type, user_id=user_id,
                           note_templates=NOTE_TEMPLATES,
                           search_q=search_q,
                           allowed_ext=', '.join(NOTE_ALLOWED_EXT),
                           max_file_mb=NOTE_MAX_FILE_MB)


@note_bp.route('/session/<int:slot_id>/notes', methods=['POST'])
@login_required
def add_note(slot_id):
    slot = TutorSlot.query.get_or_404(slot_id)
    user_type = current_user.user_type
    user_id = current_user.id

    if not _can_access_session(slot, user_type, user_id):
        flash('Access denied.', 'danger')
        return redirect(url_for('main.index'))

    content = request.form.get('content', '')
    # B1: Sanitize rich text
    content = bleach.clean(content, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, strip=True)
    content = sanitize_input_length(content, MAX_NOTE_LENGTH)
    is_private = request.form.get('is_private') == 'on'

    if not content or not content.strip():
        flash('Note cannot be empty.', 'danger')
        return redirect(url_for('note_bp.view_notes', slot_id=slot_id))

    # B6: Handle file attachments
    attachments = []
    files = request.files.getlist('attachments')
    for f in files:
        if f and f.filename:
            ext = f.filename.rsplit('.', 1)[-1].lower() if '.' in f.filename else ''
            if ext not in NOTE_ALLOWED_EXT:
                continue
            file_bytes = f.read()
            if len(file_bytes) > NOTE_MAX_FILE_MB * 1024 * 1024:
                continue
            result = upload_document(file_bytes, user_id, f.filename)
            if result:
                attachments.append({
                    'key': result['r2_object_key'],
                    'encryption_key': result['file_encryption_key'],
                    'name': f.filename,
                    'size': len(file_bytes)
                })

    note = SessionNote(
        slot_id=slot_id,
        author_type=user_type,
        author_id=user_id,
        content=content.strip(),
        is_private=is_private,
        attachments=attachments if attachments else None
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

    if note.author_type != user_type or note.author_id != user_id:
        flash('You can only edit your own notes.', 'danger')
        return redirect(url_for('note_bp.view_notes', slot_id=note.slot_id))

    content = request.form.get('content', '')
    content = bleach.clean(content, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, strip=True)
    content = sanitize_input_length(content, MAX_NOTE_LENGTH)
    is_private = request.form.get('is_private') == 'on'

    if not content or not content.strip():
        flash('Note cannot be empty.', 'danger')
        return redirect(url_for('note_bp.view_notes', slot_id=note.slot_id))

    # B3: Save version history before edit
    version = NoteVersion(
        note_id=note.id,
        content=note.content,
        edited_by=note.author_type
    )
    db.session.add(version)

    note.content = content.strip()
    note.is_private = is_private
    note.updated_at = datetime.utcnow()
    db.session.commit()

    flash('Note updated!', 'success')
    return redirect(url_for('note_bp.view_notes', slot_id=note.slot_id))


@note_bp.route('/session/notes/<int:note_id>/history')
@login_required
def note_history(note_id):
    """B3: View edit history of a note."""
    note = SessionNote.query.get_or_404(note_id)
    user_type = current_user.user_type
    user_id = current_user.id

    # Only the author can view version history
    if note.author_type != user_type or note.author_id != user_id:
        return jsonify({'error': 'Access denied'}), 403

    versions = NoteVersion.query.filter_by(note_id=note_id)\
        .order_by(NoteVersion.created_at.desc()).all()

    return jsonify({
        'versions': [{
            'id': v.id,
            'content': v.content,
            'edited_by': v.edited_by,
            'created_at': v.created_at.strftime('%b %d, %Y %I:%M %p')
        } for v in versions]
    })


@note_bp.route('/session/notes/<int:note_id>/delete', methods=['POST'])
@login_required
def delete_note(note_id):
    note = SessionNote.query.get_or_404(note_id)
    user_type = current_user.user_type
    user_id = current_user.id

    if note.author_type != user_type or note.author_id != user_id:
        flash('You can only delete your own notes.', 'danger')
        return redirect(url_for('note_bp.view_notes', slot_id=note.slot_id))

    slot_id = note.slot_id
    # Delete version history too
    NoteVersion.query.filter_by(note_id=note.id).delete()
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

    content = bleach.clean(content, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, strip=True)
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
        if note.is_private and not (
            note.author_type == user_type and note.author_id == user_id
        ):
            continue

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
            'updated_at': note.updated_at.strftime('%b %d, %Y %I:%M %p') if note.updated_at else None,
            'has_versions': len(note.versions) > 0 if note.versions else False
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

    NoteVersion.query.filter_by(note_id=note.id).delete()
    db.session.delete(note)
    db.session.commit()

    return jsonify({'ok': True})
