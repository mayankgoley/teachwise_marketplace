"""whiteboard snapshot pruning + access helpers."""
from datetime import date, datetime, time, timedelta

import pytest
from werkzeug.security import generate_password_hash


@pytest.fixture
def tutor(db_session):
    from models.tutor import Tutor
    t = Tutor(
        name='WBTutor', email='wb_tutor@test.com',
        password=generate_password_hash('Pw1234!@#'),
        subject='Math', verification_status='verified',
    )
    db_session.session.add(t)
    db_session.session.commit()
    return t


@pytest.fixture
def student(db_session):
    from models.student import Student
    s = Student(
        name='WBStudent', email='wb_student@test.com',
        password=generate_password_hash('Pw1234!@#'),
        date_of_birth=date(2000, 1, 1),
    )
    db_session.session.add(s)
    db_session.session.commit()
    return s


@pytest.fixture
def slot(db_session, tutor, student):
    from models.slots import TutorSlot
    sl = TutorSlot(
        tutor_id=tutor.id, student_id=student.id,
        date=date.today() + timedelta(days=1),
        start_time=time(15, 0), end_time=time(16, 0),
        status='booked', price=50.0, mode='online', subject='Math',
    )
    db_session.session.add(sl)
    db_session.session.commit()
    return sl


class TestPruneSnapshots:
    def test_no_op_when_under_cap(self, app, db_session, slot, monkeypatch):
        from models.whiteboard import WhiteboardSession
        wb = WhiteboardSession(
            slot_id=slot.id,
            snapshots=[
                {'key': f'k{i}', 'name': f'n{i}', 'created_at': '2026-05-01'}
                for i in range(5)
            ],
        )
        db_session.session.add(wb)
        db_session.session.commit()

        deleted = []
        monkeypatch.setattr(
            'services.storage_service.delete_document',
            lambda key: deleted.append(key) or True,
        )

        from services.scheduler_service import prune_whiteboard_snapshots
        prune_whiteboard_snapshots(app)
        assert deleted == []
        assert len(WhiteboardSession.query.get(wb.id).snapshots) == 5

    def test_prunes_oldest_when_over_cap(
        self, app, db_session, slot, monkeypatch
    ):
        from models.whiteboard import WhiteboardSession
        wb = WhiteboardSession(
            slot_id=slot.id,
            snapshots=[
                {'key': f'k{i}', 'name': f'n{i}', 'created_at': '2026-05-01'}
                for i in range(13)  # 3 over the cap of 10
            ],
        )
        db_session.session.add(wb)
        db_session.session.commit()

        deleted = []
        monkeypatch.setattr(
            'services.storage_service.delete_document',
            lambda key: deleted.append(key) or True,
        )

        from services.scheduler_service import prune_whiteboard_snapshots
        prune_whiteboard_snapshots(app)

        # The 3 oldest (k0, k1, k2) should be gone; k3..k12 kept.
        assert deleted == ['k0', 'k1', 'k2']
        kept = WhiteboardSession.query.get(wb.id).snapshots
        assert len(kept) == 10
        assert kept[0]['key'] == 'k3'
        assert kept[-1]['key'] == 'k12'


class TestSocketioAuth:
    def test_check_session_access_for_booked_student(self, slot, student):
        from routes.whiteboard_routes import _check_session_access
        from flask_login import login_user
        from app import app

        with app.test_request_context():
            login_user(student)
            assert _check_session_access(slot) is True

    def test_check_session_access_rejects_unrelated_student(
        self, db_session, slot
    ):
        from models.student import Student
        other = Student(
            name='Other', email='other@test.com',
            password=generate_password_hash('Pw1234!@#'),
            date_of_birth=date(2000, 1, 1),
        )
        db_session.session.add(other)
        db_session.session.commit()

        from routes.whiteboard_routes import _check_session_access
        from flask_login import login_user
        from app import app

        with app.test_request_context():
            login_user(other)
            assert _check_session_access(slot) is False


class TestRoutes:
    def test_load_route_registered(self, client, slot):
        # Unauthenticated → 401/403/redirect, never 404
        resp = client.get(f'/api/whiteboard/{slot.id}/load')
        assert resp.status_code != 404


class TestSocketioJoinAuth:
    def test_unauthorized_join_gets_error_and_not_in_room(
        self, app, db_session, slot
    ):
        """An unrelated student must not be able to join the room.

        The handler should send `whiteboard_error` and NOT `whiteboard_full_state`.
        The absence of `whiteboard_full_state` proves the join short-circuited
        before `join_room` ran.
        """
        from extensions import socketio as sio
        from models.student import Student

        # Unrelated student: neither the booked one nor the slot's tutor.
        intruder = Student(
            name='Intruder',
            email='intruder@test.com',
            password=generate_password_hash('Pw1234!@#'),
            date_of_birth=date(2000, 1, 1),
            email_verified=True,
        )
        db_session.session.add(intruder)
        db_session.session.commit()

        flask_client = app.test_client()
        login = flask_client.post('/api/v1/student/login', json={
            'email': 'intruder@test.com',
            'password': 'Pw1234!@#',
        })
        assert login.status_code in (200, 302), (
            f'login failed: {login.status_code} {login.get_data(as_text=True)[:200]}'
        )

        sio_client = sio.test_client(app, flask_test_client=flask_client)
        assert sio_client.is_connected()

        sio_client.emit('join_whiteboard', {'slot_id': slot.id})
        received = sio_client.get_received()
        event_names = [r['name'] for r in received]

        assert 'whiteboard_error' in event_names, (
            f'expected whiteboard_error, got {event_names!r}'
        )
        assert 'whiteboard_full_state' not in event_names, (
            f'unauthorized user received state: {event_names!r}'
        )

        sio_client.disconnect()
