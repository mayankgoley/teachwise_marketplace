from flask import Blueprint, request, jsonify, render_template, redirect, url_for
from database import db
from models.assignment import Assignment, Submission
from models.session_note import SessionNote
from models.learning_goal import LearningGoal, ProgressEntry
from models.whiteboard import WhiteboardSession
from models.recording import SessionRecording
from shared.jwt_auth import get_jwt_from_request, decode_jwt_token
from datetime import datetime
import bleach

learning_bp = Blueprint('learning_bp', __name__)


def _get_user_info():
    token = get_jwt_from_request()
    if not token:
        return None, None, None
    try:
        payload = decode_jwt_token(token)
        uid = payload.get('uid', '')
        role = payload.get('role', '')
        name = payload.get('name', '')
        if '_' in uid:
            user_id = int(uid.split('_', 1)[1])
        else:
            user_id = int(uid)
        return role, user_id, name
    except Exception:
        return None, None, None


def _require_auth():
    role, user_id, name = _get_user_info()
    if not role:
        return None, None, None
    return role, user_id, name


@learning_bp.route('/api/assignments')
def list_assignments():
    role, user_id, _ = _require_auth()
    if not role:
        return jsonify(error='Authentication required'), 401

    if role == 'tutor':
        assignments = Assignment.query.filter_by(tutor_id=user_id)\
            .order_by(Assignment.created_at.desc()).limit(50).all()
    else:
        assignments = Assignment.query.filter_by(student_id=user_id)\
            .order_by(Assignment.created_at.desc()).limit(50).all()

    return jsonify([{
        'id': a.id, 'title': a.title, 'status': a.status,
        'due_date': a.due_date.isoformat() if a.due_date else None,
        'created_at': a.created_at.isoformat(),
    } for a in assignments])


@learning_bp.route('/api/assignments/<int:assignment_id>')
def get_assignment(assignment_id):
    role, user_id, _ = _require_auth()
    if not role:
        return jsonify(error='Authentication required'), 401

    a = Assignment.query.get_or_404(assignment_id)
    if role == 'tutor' and a.tutor_id != user_id:
        return jsonify(error='Unauthorized'), 403
    if role == 'student' and a.student_id != user_id:
        return jsonify(error='Unauthorized'), 403

    result = {
        'id': a.id, 'title': a.title, 'description': a.description,
        'status': a.status, 'due_date': a.due_date.isoformat() if a.due_date else None,
        'file_urls': a.file_urls, 'created_at': a.created_at.isoformat(),
    }
    if a.submission:
        result['submission'] = {
            'id': a.submission.id,
            'text_response': a.submission.text_response,
            'grade': a.submission.grade,
            'feedback': a.submission.feedback,
            'submitted_at': a.submission.submitted_at.isoformat(),
        }
    return jsonify(result)


@learning_bp.route('/api/assignments', methods=['POST'])
def create_assignment():
    role, user_id, name = _require_auth()
    if not role:
        return jsonify(error='Authentication required'), 401
    if role != 'tutor':
        return jsonify(error='Only tutors can create assignments'), 403

    data = request.get_json() or {}
    title = bleach.clean((data.get('title', '') or '').strip(), tags=[], strip=True)
    student_id = data.get('student_id')
    if not title or not student_id:
        return jsonify(error='title and student_id are required'), 400

    description = bleach.clean(
        (data.get('description', '') or '').strip(), tags=[], strip=True)[:2000]

    due_date = None
    if data.get('due_date'):
        try:
            due_date = datetime.strptime(data['due_date'], '%Y-%m-%dT%H:%M')
        except ValueError:
            try:
                due_date = datetime.strptime(data['due_date'], '%Y-%m-%d')
            except ValueError:
                return jsonify(error='Invalid due_date format (use YYYY-MM-DD or YYYY-MM-DDTHH:MM)'), 400

    assignment = Assignment(
        tutor_id=user_id,
        student_id=int(student_id),
        title=title[:200],
        description=description,
        due_date=due_date,
        file_urls=data.get('file_urls', []),
    )
    db.session.add(assignment)
    db.session.commit()

    return jsonify({
        'id': assignment.id, 'title': assignment.title,
        'status': assignment.status,
    }), 201


@learning_bp.route('/api/assignments/<int:assignment_id>/submit', methods=['POST'])
def submit_assignment(assignment_id):
    role, user_id, name = _require_auth()
    if not role:
        return jsonify(error='Authentication required'), 401
    if role != 'student':
        return jsonify(error='Only students can submit assignments'), 403

    assignment = Assignment.query.get_or_404(assignment_id)
    if assignment.student_id != user_id:
        return jsonify(error='Unauthorized'), 403

    if assignment.submission:
        return jsonify(error='Assignment already submitted'), 409

    data = request.get_json() or {}
    text_response = bleach.clean(
        (data.get('text_response', '') or '').strip(), tags=[], strip=True)[:5000]
    file_urls = data.get('file_urls', [])

    if not text_response and not file_urls:
        return jsonify(error='Provide a text_response or file_urls'), 400

    submission = Submission(
        assignment_id=assignment.id,
        student_id=user_id,
        text_response=text_response or None,
        file_urls=file_urls,
    )
    db.session.add(submission)
    assignment.status = 'submitted'
    db.session.commit()

    try:
        from shared.event_bus import publish_event
        publish_event('assignment.submitted', {
            'assignment_id': assignment.id,
            'submission_id': submission.id,
            'student_id': user_id,
            'tutor_id': assignment.tutor_id,
            'title': assignment.title,
            'student_name': name or '',
        })
    except Exception:
        pass  # Event failure must not block submission

    return jsonify({
        'id': submission.id, 'status': assignment.status,
        'submitted_at': submission.submitted_at.isoformat(),
    }), 201


@learning_bp.route('/api/assignments/<int:assignment_id>/grade', methods=['POST'])
def grade_assignment(assignment_id):
    role, user_id, name = _require_auth()
    if not role:
        return jsonify(error='Authentication required'), 401
    if role != 'tutor':
        return jsonify(error='Only tutors can grade assignments'), 403

    assignment = Assignment.query.get_or_404(assignment_id)
    if assignment.tutor_id != user_id:
        return jsonify(error='Unauthorized'), 403

    if not assignment.submission:
        return jsonify(error='No submission to grade'), 404

    data = request.get_json() or {}
    grade = bleach.clean((data.get('grade', '') or '').strip(), tags=[], strip=True)[:50]
    feedback = bleach.clean(
        (data.get('feedback', '') or '').strip(), tags=[], strip=True)[:2000]

    if not grade:
        return jsonify(error='grade is required'), 400

    assignment.submission.grade = grade
    assignment.submission.feedback = feedback
    assignment.submission.reviewed_at = datetime.utcnow()
    assignment.status = 'reviewed'
    db.session.commit()

    try:
        from shared.event_bus import publish_event
        publish_event('assignment.graded', {
            'assignment_id': assignment.id,
            'student_id': assignment.student_id,
            'tutor_id': user_id,
            'title': assignment.title,
            'grade': grade,
            'tutor_name': name or '',
        })
    except Exception:
        pass  # Event failure must not block grading

    return jsonify({
        'id': assignment.submission.id,
        'grade': grade, 'feedback': feedback,
        'status': assignment.status,
    })


@learning_bp.route('/api/notes/session/<int:slot_id>')
def list_session_notes(slot_id):
    role, user_id, _ = _require_auth()
    if not role:
        return jsonify(error='Authentication required'), 401

    notes = SessionNote.query.filter_by(slot_id=slot_id)\
        .order_by(SessionNote.created_at.asc()).all()

    result = []
    for n in notes:
        if n.is_private and n.author_id != user_id:
            continue
        result.append({
            'id': n.id, 'content': n.content,
            'author_type': n.author_type, 'author_id': n.author_id,
            'is_private': n.is_private,
            'created_at': n.created_at.isoformat(),
        })
    return jsonify(result)


@learning_bp.route('/api/notes/session/<int:slot_id>', methods=['POST'])
def add_session_note(slot_id):
    role, user_id, _ = _require_auth()
    if not role:
        return jsonify(error='Authentication required'), 401

    data = request.get_json() or {}
    content = bleach.clean((data.get('content', '') or '').strip(), tags=[], strip=True)
    if not content:
        return jsonify(error='Content is required'), 400

    note = SessionNote(
        slot_id=slot_id,
        author_type=role,
        author_id=user_id,
        content=content[:5000],
        is_private=bool(data.get('is_private', False))
    )
    db.session.add(note)
    db.session.commit()

    return jsonify({
        'id': note.id, 'content': note.content,
        'author_type': note.author_type,
        'created_at': note.created_at.isoformat(),
    }), 201


@learning_bp.route('/api/learning-goals')
def list_goals():
    role, user_id, _ = _require_auth()
    if not role:
        return jsonify(error='Authentication required'), 401

    if role == 'student':
        goals = LearningGoal.query.filter_by(student_id=user_id)\
            .order_by(LearningGoal.created_at.desc()).all()
    else:
        goals = LearningGoal.query.filter_by(tutor_id=user_id)\
            .order_by(LearningGoal.created_at.desc()).all()

    return jsonify([{
        'id': g.id, 'title': g.title, 'status': g.status,
        'target_date': g.target_date.isoformat() if g.target_date else None,
        'entries_count': len(g.entries),
        'created_at': g.created_at.isoformat(),
    } for g in goals])


@learning_bp.route('/api/learning-goals/<int:goal_id>')
def get_goal(goal_id):
    role, user_id, _ = _require_auth()
    if not role:
        return jsonify(error='Authentication required'), 401

    goal = LearningGoal.query.get_or_404(goal_id)
    if role == 'student' and goal.student_id != user_id:
        return jsonify(error='Unauthorized'), 403
    if role == 'tutor' and goal.tutor_id != user_id:
        return jsonify(error='Unauthorized'), 403

    return jsonify({
        'id': goal.id, 'title': goal.title, 'description': goal.description,
        'status': goal.status,
        'target_date': goal.target_date.isoformat() if goal.target_date else None,
        'entries': [{
            'id': e.id, 'note': e.note, 'rating': e.rating,
            'created_by': e.created_by,
            'created_at': e.created_at.isoformat(),
        } for e in goal.entries],
    })


@learning_bp.route('/api/learning-goals', methods=['POST'])
def create_goal():
    role, user_id, _ = _require_auth()
    if not role:
        return jsonify(error='Authentication required'), 401

    data = request.get_json() or {}
    title = bleach.clean((data.get('title', '') or '').strip(), tags=[], strip=True)
    if not title:
        return jsonify(error='Title is required'), 400

    goal = LearningGoal(
        student_id=data.get('student_id', user_id if role == 'student' else 0),
        tutor_id=data.get('tutor_id', user_id if role == 'tutor' else 0),
        title=title[:200],
        description=bleach.clean(data.get('description', '') or '', tags=[], strip=True)[:2000],
    )
    if data.get('target_date'):
        try:
            goal.target_date = datetime.strptime(data['target_date'], '%Y-%m-%d').date()
        except ValueError:
            pass

    db.session.add(goal)
    db.session.commit()

    try:
        from shared.event_bus import publish_event
        publish_event('goal.created', {
            'goal_id': goal.id,
            'student_id': goal.student_id,
            'tutor_id': goal.tutor_id,
            'title': goal.title,
        })
    except Exception:
        pass

    return jsonify({'id': goal.id, 'title': goal.title}), 201


@learning_bp.route('/api/learning-goals/<int:goal_id>', methods=['PUT', 'PATCH'])
def update_goal(goal_id):
    role, user_id, name = _require_auth()
    if not role:
        return jsonify(error='Authentication required'), 401

    goal = LearningGoal.query.get_or_404(goal_id)
    if role == 'student' and goal.student_id != user_id:
        return jsonify(error='Unauthorized'), 403
    if role == 'tutor' and goal.tutor_id != user_id:
        return jsonify(error='Unauthorized'), 403

    data = request.get_json() or {}
    old_status = goal.status

    if 'title' in data:
        goal.title = bleach.clean((data['title'] or '').strip(), tags=[], strip=True)[:200]
    if 'description' in data:
        goal.description = bleach.clean(
            (data['description'] or '').strip(), tags=[], strip=True)[:2000]
    if 'status' in data and data['status'] in ('active', 'completed', 'paused'):
        goal.status = data['status']
    if 'target_date' in data:
        if data['target_date']:
            try:
                goal.target_date = datetime.strptime(data['target_date'], '%Y-%m-%d').date()
            except ValueError:
                pass
        else:
            goal.target_date = None

    db.session.commit()

    if goal.status == 'completed' and old_status != 'completed':
        try:
            from shared.event_bus import publish_event
            publish_event('goal.completed', {
                'goal_id': goal.id,
                'student_id': goal.student_id,
                'tutor_id': goal.tutor_id,
                'title': goal.title,
            })
        except Exception:
            pass

    return jsonify({
        'id': goal.id, 'title': goal.title,
        'status': goal.status,
    })


@learning_bp.route('/api/learning-goals/<int:goal_id>/entries', methods=['POST'])
def add_progress_entry(goal_id):
    role, user_id, _ = _require_auth()
    if not role:
        return jsonify(error='Authentication required'), 401

    goal = LearningGoal.query.get_or_404(goal_id)
    data = request.get_json() or {}

    entry = ProgressEntry(
        goal_id=goal_id,
        slot_id=data.get('slot_id'),
        note=bleach.clean((data.get('note', '') or '').strip(), tags=[], strip=True)[:2000],
        rating=data.get('rating'),
        created_by=role
    )
    db.session.add(entry)
    db.session.commit()

    return jsonify({
        'id': entry.id, 'note': entry.note,
        'created_at': entry.created_at.isoformat(),
    }), 201


@learning_bp.route('/api/whiteboard/<int:slot_id>')
def get_whiteboard(slot_id):
    role, user_id, _ = _require_auth()
    if not role:
        return jsonify(error='Authentication required'), 401

    wb = WhiteboardSession.query.filter_by(slot_id=slot_id).first()
    if not wb:
        return jsonify({'data': {}, 'exists': False})

    return jsonify({
        'id': wb.id, 'data': wb.data,
        'snapshot_url': wb.snapshot_url, 'exists': True,
    })


@learning_bp.route('/api/whiteboard/<int:slot_id>', methods=['POST'])
def save_whiteboard(slot_id):
    role, user_id, _ = _require_auth()
    if not role:
        return jsonify(error='Authentication required'), 401

    data = request.get_json() or {}
    wb = WhiteboardSession.query.filter_by(slot_id=slot_id).first()

    if not wb:
        wb = WhiteboardSession(slot_id=slot_id, created_by=role)
        db.session.add(wb)

    wb.data = data.get('data', {})
    wb.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({'id': wb.id, 'saved': True})
