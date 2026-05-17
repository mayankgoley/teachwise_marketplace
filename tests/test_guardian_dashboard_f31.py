"""per-child settings + booking approval expiry."""
from datetime import date, datetime, time, timedelta

import pytest
from werkzeug.security import generate_password_hash


@pytest.fixture
def guardian(db_session):
    from models.guardian import Guardian
    g = Guardian(
        name='G One',
        email='g1@test.com',
        relationship='parent',
        password_hash=generate_password_hash('Pw1234!@#'),
        is_verified=True,
    )
    db_session.session.add(g)
    db_session.session.commit()
    return g


@pytest.fixture
def minor_student(db_session, guardian):
    from models.student import Student
    s = Student(
        name='Kid',
        email='kid@test.com',
        password=generate_password_hash('Pw1234!@#'),
        date_of_birth=date.today().replace(year=date.today().year - 12),
        guardian_id=guardian.id,
        email_verified=True,
    )
    db_session.session.add(s)
    db_session.session.commit()
    return s


@pytest.fixture
def adult_student(db_session, guardian):
    from models.student import Student
    s = Student(
        name='Adult',
        email='adult@test.com',
        password=generate_password_hash('Pw1234!@#'),
        date_of_birth=date(1990, 1, 1),
        guardian_id=guardian.id,
        email_verified=True,
    )
    db_session.session.add(s)
    db_session.session.commit()
    return s


@pytest.fixture
def unlinked_student(db_session):
    from models.student import Student
    s = Student(
        name='Solo',
        email='solo@test.com',
        password=generate_password_hash('Pw1234!@#'),
        date_of_birth=date(2000, 1, 1),
        email_verified=True,
    )
    db_session.session.add(s)
    db_session.session.commit()
    return s


class TestShouldRequireApproval:
    def test_no_guardian_returns_false(self, app, unlinked_student):
        with app.app_context():
            from services.guardian_service import should_require_approval
            assert should_require_approval(unlinked_student) is False

    def test_minor_returns_true(self, app, minor_student):
        with app.app_context():
            from services.guardian_service import should_require_approval
            assert should_require_approval(minor_student) is True

    def test_adult_with_default_settings_returns_false(self, app, adult_student):
        with app.app_context():
            from services.guardian_service import should_require_approval
            # Adult with no explicit child-settings row: not required.
            assert should_require_approval(adult_student) is False

    def test_adult_with_settings_flag_set_returns_true(
        self, app, db_session, guardian, adult_student
    ):
        with app.app_context():
            from models.guardian_child_settings import GuardianChildSettings
            from services.guardian_service import should_require_approval
            row = GuardianChildSettings(
                guardian_id=guardian.id,
                student_id=adult_student.id,
                requires_approval_for_booking=True,
            )
            db_session.session.add(row)
            db_session.session.commit()
            assert should_require_approval(adult_student) is True


class TestEnforceSpendingCap:
    def test_no_guardian_returns_none(self, app, unlinked_student):
        with app.app_context():
            from services.guardian_service import enforce_spending_cap
            assert enforce_spending_cap(unlinked_student, 50) is None

    def test_no_caps_set_returns_none(self, app, minor_student):
        with app.app_context():
            from services.guardian_service import enforce_spending_cap
            assert enforce_spending_cap(minor_student, 50) is None

    def test_per_child_cap_exceeded_returns_error(
        self, app, db_session, guardian, minor_student
    ):
        with app.app_context():
            from models.guardian_child_settings import GuardianChildSettings
            from services.guardian_service import enforce_spending_cap
            db_session.session.add(GuardianChildSettings(
                guardian_id=guardian.id,
                student_id=minor_student.id,
                monthly_spending_cap=100.0,
            ))
            db_session.session.commit()
            err = enforce_spending_cap(minor_student, 150)
            assert err is not None
            assert 'monthly cap' in err.lower()

    def test_per_child_cap_under_limit_returns_none(
        self, app, db_session, guardian, minor_student
    ):
        with app.app_context():
            from models.guardian_child_settings import GuardianChildSettings
            from services.guardian_service import enforce_spending_cap
            db_session.session.add(GuardianChildSettings(
                guardian_id=guardian.id,
                student_id=minor_student.id,
                monthly_spending_cap=100.0,
            ))
            db_session.session.commit()
            assert enforce_spending_cap(minor_student, 50) is None

    def test_falls_back_to_guardian_monthly_limit(
        self, db_session, guardian, minor_student
    ):
        # The db_session fixture already runs us inside an app_context;
        # don't push a nested one. Flask-SQLAlchemy scopes sessions by
        # context and a fresh scope orphans the fixture's ORM objects.
        from services.guardian_service import enforce_spending_cap
        guardian.monthly_spending_limit = 80.0
        db_session.session.commit()
        err = enforce_spending_cap(minor_student, 200)
        assert err is not None
        assert 'guardian monthly limit' in err.lower()


class TestEnforceSessionWindow:
    def test_no_settings_returns_none(self, app, minor_student):
        with app.app_context():
            from services.guardian_service import enforce_session_window
            assert enforce_session_window(minor_student, time(8, 0)) is None

    def test_inside_window(self, app, db_session, guardian, minor_student):
        with app.app_context():
            from models.guardian_child_settings import GuardianChildSettings
            from services.guardian_service import enforce_session_window
            db_session.session.add(GuardianChildSettings(
                guardian_id=guardian.id,
                student_id=minor_student.id,
                session_window_start=time(15, 0),
                session_window_end=time(20, 0),
            ))
            db_session.session.commit()
            assert enforce_session_window(minor_student, time(16, 30)) is None

    def test_outside_window(self, app, db_session, guardian, minor_student):
        with app.app_context():
            from models.guardian_child_settings import GuardianChildSettings
            from services.guardian_service import enforce_session_window
            db_session.session.add(GuardianChildSettings(
                guardian_id=guardian.id,
                student_id=minor_student.id,
                session_window_start=time(15, 0),
                session_window_end=time(20, 0),
            ))
            db_session.session.commit()
            err = enforce_session_window(minor_student, time(21, 30))
            assert err is not None
            assert 'outside' in err.lower() or 'no later' in err.lower()


class TestExpireStaleApprovals:
    def test_expires_old_pending_booking(
        self, app, db_session, minor_student
    ):
        from models.booking import Booking
        from models.slots import TutorSlot
        from models.tutor import Tutor

        with app.app_context():
            tutor = Tutor(
                name='T', email='t@test.com',
                password=generate_password_hash('Pw1234!@#'),
                subject='Math',
            )
            db_session.session.add(tutor)
            db_session.session.commit()

            slot = TutorSlot(
                tutor_id=tutor.id,
                date=date.today() + timedelta(days=3),
                start_time=time(15, 0),
                end_time=time(16, 0),
                status='booked',
                price=50.0,
                mode='online',
                subject='Math',
            )
            db_session.session.add(slot)
            db_session.session.commit()

            booking = Booking(
                student_id=minor_student.id,
                tutor_id=tutor.id,
                slot_id=slot.id,
                status='PendingGuardianApproval',
                requires_guardian_approval=True,
                guardian_approved=None,
                guardian_approval_expires_at=datetime.utcnow() - timedelta(hours=1),
            )
            db_session.session.add(booking)
            db_session.session.commit()

            from services.guardian_service import expire_stale_approvals
            count = expire_stale_approvals()
            assert count == 1

            refreshed = Booking.query.get(booking.id)
            assert refreshed.status == 'Cancelled'
            assert refreshed.cancellation_reason == 'Guardian approval expired'

    def test_does_not_expire_already_approved(
        self, app, db_session, minor_student
    ):
        from models.booking import Booking
        from models.slots import TutorSlot
        from models.tutor import Tutor

        with app.app_context():
            tutor = Tutor(
                name='T2', email='t2@test.com',
                password=generate_password_hash('Pw1234!@#'),
                subject='Math',
            )
            db_session.session.add(tutor)
            db_session.session.commit()

            slot = TutorSlot(
                tutor_id=tutor.id,
                date=date.today() + timedelta(days=3),
                start_time=time(15, 0),
                end_time=time(16, 0),
                status='booked',
                price=50.0,
                mode='online',
                subject='Math',
            )
            db_session.session.add(slot)
            db_session.session.commit()

            booking = Booking(
                student_id=minor_student.id,
                tutor_id=tutor.id,
                slot_id=slot.id,
                status='Booked',
                requires_guardian_approval=True,
                guardian_approved=True,
                guardian_approval_expires_at=datetime.utcnow() - timedelta(hours=1),
            )
            db_session.session.add(booking)
            db_session.session.commit()

            from services.guardian_service import expire_stale_approvals
            assert expire_stale_approvals() == 0
            assert Booking.query.get(booking.id).status == 'Booked'


class TestChildSettingsApi:
    """Route-level smoke test: unauthenticated request to the new endpoint
    should not 404 (proves the blueprint is registered)."""

    def test_route_is_registered(self, client, guardian, minor_student):
        resp = client.get(
            f'/api/v1/guardian/children/{minor_student.id}/settings'
        )
        # Anything except 404 means the route exists. The exact auth-failure
        # status varies (Flask-Login redirects can yield 302/401/403).
        assert resp.status_code != 404
