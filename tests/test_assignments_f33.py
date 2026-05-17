"""presigned upload validation, attach flow, guardian view, reminder."""
from datetime import date, datetime, timedelta

import pytest
from werkzeug.security import generate_password_hash


@pytest.fixture
def guardian(db_session):
    from models.guardian import Guardian
    g = Guardian(
        name='G', email='g@test.com',
        relationship='parent',
        password_hash=generate_password_hash('Pw1234!@#'),
        is_verified=True,
    )
    db_session.session.add(g)
    db_session.session.commit()
    return g


@pytest.fixture
def student(db_session, guardian):
    from models.student import Student
    s = Student(
        name='K', email='k@test.com',
        password=generate_password_hash('Pw1234!@#'),
        date_of_birth=date(2010, 1, 1),
        guardian_id=guardian.id,
    )
    db_session.session.add(s)
    db_session.session.commit()
    return s


@pytest.fixture
def tutor(db_session):
    from models.tutor import Tutor
    t = Tutor(
        name='T', email='t@test.com',
        password=generate_password_hash('Pw1234!@#'),
        subject='Math', verification_status='verified',
    )
    db_session.session.add(t)
    db_session.session.commit()
    return t


@pytest.fixture
def assignment(db_session, tutor, student):
    from models.assignment import Assignment
    a = Assignment(
        tutor_id=tutor.id, student_id=student.id,
        title='Algebra 101', description='Solve 1-10',
        due_date=datetime.utcnow() + timedelta(hours=12),
        status='assigned',
    )
    db_session.session.add(a)
    db_session.session.commit()
    return a


class TestPresignValidator:
    def test_rejects_unknown_content_type(self, app):
        with app.app_context():
            from services.storage_service import assignment_presign_validate
            ok, err = assignment_presign_validate('image/gif', 1024)
            assert not ok and 'not allowed' in err

    def test_rejects_oversize(self, app):
        with app.app_context():
            from services.storage_service import assignment_presign_validate
            ok, err = assignment_presign_validate(
                'application/pdf', 30 * 1024 * 1024
            )
            assert not ok and '25 MB' in err

    def test_accepts_pdf_under_cap(self, app):
        with app.app_context():
            from services.storage_service import assignment_presign_validate
            ok, err = assignment_presign_validate('application/pdf', 1024)
            assert ok and err is None

    def test_rejects_missing_size(self, app):
        with app.app_context():
            from services.storage_service import assignment_presign_validate
            ok, err = assignment_presign_validate('application/pdf', None)
            assert not ok


class TestObjectKey:
    def test_key_is_scoped_to_assignment(self, app):
        with app.app_context():
            from services.storage_service import build_assignment_object_key
            key = build_assignment_object_key(42, 'student', 'file with space.pdf')
            assert key.startswith('assignments/42/student/')
            assert key.endswith('_file_with_space.pdf')

    def test_key_sanitizes_unsafe_chars(self, app):
        with app.app_context():
            from services.storage_service import build_assignment_object_key
            key = build_assignment_object_key(1, 'tutor', '../../etc/passwd')
            assert '/etc/passwd' not in key
            assert '/passwd' not in key.split('/', 4)[-1]


class TestReminderJob:
    def test_no_op_when_no_due_soon(self, app, db_session, tutor, student):
        from models.assignment import Assignment
        from services.scheduler_service import remind_assignments_due_soon

        # Assignment due far in the future; no reminder expected
        db_session.session.add(Assignment(
            tutor_id=tutor.id, student_id=student.id,
            title='Future', description='-',
            due_date=datetime.utcnow() + timedelta(days=10),
            status='assigned',
        ))
        db_session.session.commit()

        remind_assignments_due_soon(app)
        from models.in_app_notification import InAppNotification
        assert InAppNotification.query.filter_by(
            type='assignment_due_soon').count() == 0

    def test_sends_reminder_for_due_in_12h(
        self, app, db_session, tutor, student, assignment
    ):
        from services.scheduler_service import remind_assignments_due_soon
        from models.in_app_notification import InAppNotification

        remind_assignments_due_soon(app)
        n = InAppNotification.query.filter_by(
            user_id=student.id,
            user_type='student',
            type='assignment_due_soon',
        ).count()
        assert n == 1


class TestRoutes:
    def test_presign_route_registered(self, client, assignment):
        # Unauthenticated → not 404 (route exists)
        resp = client.post(
            f'/api/v1/assignments/{assignment.id}/upload-url',
            json={'file_name': 'a.pdf', 'content_type': 'application/pdf',
                  'size_bytes': 1000},
        )
        assert resp.status_code != 404

    def test_guardian_assignments_route_registered(self, client, student):
        resp = client.get(
            f'/api/v1/guardian/children/{student.id}/assignments'
        )
        assert resp.status_code != 404

    def test_tutor_assignment_detail_route_registered(self, client, assignment):
        resp = client.get(f'/api/v1/tutor/assignments/{assignment.id}')
        assert resp.status_code != 404


class TestSerializeSubmission:
    def test_include_files_returns_full_metadata(
        self, db_session, assignment
    ):
        from models.assignment import Submission
        from routes.api_assignments import _serialize_submission

        sub = Submission(
            assignment_id=assignment.id,
            student_id=assignment.student_id,
            file_urls=[{
                'name': 'work.pdf',
                'key': 'assignments/1/student/abc_work.pdf',
                'content_type': 'application/pdf',
                'size': 2048,
                'uploader_role': 'student',
                'uploaded_at': '2026-05-11T12:00:00',
            }],
            status='submitted',
        )
        db_session.session.add(sub)
        db_session.session.commit()

        # Without include_files: just count
        bare = _serialize_submission(sub)
        assert 'files' not in bare
        assert bare['file_count'] == 1

        # With include_files: full per-file metadata
        full = _serialize_submission(sub, include_files=True)
        assert 'files' in full
        assert full['files'][0]['name'] == 'work.pdf'
        assert full['files'][0]['content_type'] == 'application/pdf'
        assert full['files'][0]['size'] == 2048
        # Defensive: encryption_key from old rows should never leak
        assert 'encryption_key' not in full['files'][0]
