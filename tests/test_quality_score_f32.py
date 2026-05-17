"""tutor quality score components & composite."""
from datetime import date, datetime, time, timedelta

import pytest
from werkzeug.security import generate_password_hash


@pytest.fixture
def tutor(db_session):
    from models.tutor import Tutor
    t = Tutor(
        name='Tee', email='tee@test.com',
        password=generate_password_hash('Pw1234!@#'),
        subject='Math', verification_status='verified',
        bio='x' * 150,
        profile_photo='photo.jpg',
        qualification='BSc', institution='MIT',
        weekly_availability_template={'mon': ['09:00-17:00']},
        subjects_additional=['Algebra', 'Calculus'],
        response_time_avg=30,  # minutes
    )
    db_session.session.add(t)
    db_session.session.commit()
    return t


@pytest.fixture
def students(db_session):
    from models.student import Student
    out = []
    for i in range(6):
        s = Student(
            name=f'S{i}', email=f's{i}@test.com',
            password=generate_password_hash('Pw1234!@#'),
            date_of_birth=date(2000, 1, 1),
        )
        db_session.session.add(s)
        out.append(s)
    db_session.session.commit()
    return out


def _make_slot(db_session, tutor_id, status, days_ago=10):
    from models.slots import TutorSlot
    d = date.today() - timedelta(days=days_ago)
    slot = TutorSlot(
        tutor_id=tutor_id,
        date=d, start_time=time(15, 0), end_time=time(16, 0),
        mode='online', subject='Math', price=50.0, status=status,
    )
    db_session.session.add(slot)
    db_session.session.commit()
    return slot


def _make_booking(db_session, tutor_id, student_id, slot_id, **kw):
    from models.booking import Booking
    b = Booking(
        tutor_id=tutor_id, student_id=student_id, slot_id=slot_id,
        status=kw.get('status', 'Booked'),
        booked_on=kw.get('booked_on', datetime.utcnow() - timedelta(days=10)),
        cancelled_by=kw.get('cancelled_by'),
        cancelled_on=kw.get('cancelled_on'),
    )
    db_session.session.add(b)
    db_session.session.commit()
    return b


class TestProfileCompleteness:
    def test_full_profile_is_100(self, db_session, tutor):
        from services.quality_service import _profile_completeness
        score, checks = _profile_completeness(tutor)
        assert score == 100.0
        assert all(checks.values())

    def test_missing_bio_drops_score(self, db_session, tutor):
        from services.quality_service import _profile_completeness
        tutor.bio = ''
        db_session.session.commit()
        score, checks = _profile_completeness(tutor)
        assert score == 80.0
        assert checks['bio_min120'] is False

    def test_short_bio_fails_check(self, db_session, tutor):
        from services.quality_service import _profile_completeness
        tutor.bio = 'short'
        db_session.session.commit()
        _, checks = _profile_completeness(tutor)
        assert checks['bio_min120'] is False


class TestResponseTimeScore:
    def test_under_one_hour_is_100(self, tutor):
        from services.quality_service import _response_time_score
        tutor.response_time_avg = 45
        assert _response_time_score(tutor) == 100.0

    def test_over_24h_is_0(self, tutor):
        from services.quality_service import _response_time_score
        tutor.response_time_avg = 24 * 60 + 100
        assert _response_time_score(tutor) == 0.0

    def test_linear_in_between(self, tutor):
        from services.quality_service import _response_time_score
        # midpoint of (60, 1440) is 750; should produce ~50
        tutor.response_time_avg = 750
        score = _response_time_score(tutor)
        assert 49.0 <= score <= 51.0

    def test_null_returns_none(self, tutor):
        from services.quality_service import _response_time_score
        tutor.response_time_avg = None
        assert _response_time_score(tutor) is None


class TestRatingScore:
    def test_under_5_reviews_returns_none(self, db_session, tutor, students):
        from models.review import Review
        for i in range(4):
            db_session.session.add(Review(
                student_id=students[i].id, tutor_id=tutor.id,
                rating=5, created_at=datetime.utcnow() - timedelta(days=10),
            ))
        db_session.session.commit()
        from services.quality_service import _rating_score
        assert _rating_score(tutor.id) is None

    def test_five_reviews_scaled(self, db_session, tutor, students):
        from models.review import Review
        for i in range(5):
            db_session.session.add(Review(
                student_id=students[i].id, tutor_id=tutor.id,
                rating=5, created_at=datetime.utcnow() - timedelta(days=10),
            ))
        db_session.session.commit()
        from services.quality_service import _rating_score
        # all 5-star -> max 100
        assert _rating_score(tutor.id) == 100.0


class TestCompletionRate:
    def test_no_bookings_returns_none(self, tutor):
        from services.quality_service import _completion_rate
        assert _completion_rate(tutor.id) is None

    def test_all_completed_is_100(self, db_session, tutor, students):
        from services.quality_service import _completion_rate
        for s in students[:3]:
            slot = _make_slot(db_session, tutor.id, status='completed')
            _make_booking(db_session, tutor.id, s.id, slot.id, status='Completed')
        assert _completion_rate(tutor.id) == 100.0

    def test_late_student_cancel_excluded(self, db_session, tutor, students):
        from services.quality_service import _completion_rate
        # 2 completed
        for s in students[:2]:
            slot = _make_slot(db_session, tutor.id, status='completed')
            _make_booking(db_session, tutor.id, s.id, slot.id, status='Completed')
        # 1 late-cancel by student (>24h before start); should NOT count
        slot = _make_slot(db_session, tutor.id, status='cancelled', days_ago=-5)  # future
        cancelled_on = datetime.combine(slot.date, slot.start_time) - timedelta(days=2)
        _make_booking(
            db_session, tutor.id, students[2].id, slot.id,
            status='Cancelled', cancelled_by='student', cancelled_on=cancelled_on,
        )
        # Denominator excludes the late student cancel, so 2/2 = 100
        assert _completion_rate(tutor.id) == 100.0

    def test_tutor_cancel_counts_against(self, db_session, tutor, students):
        from services.quality_service import _completion_rate
        slot1 = _make_slot(db_session, tutor.id, status='completed')
        _make_booking(db_session, tutor.id, students[0].id, slot1.id, status='Completed')
        slot2 = _make_slot(db_session, tutor.id, status='cancelled')
        _make_booking(
            db_session, tutor.id, students[1].id, slot2.id,
            status='Cancelled', cancelled_by='tutor',
            cancelled_on=datetime.utcnow() - timedelta(days=2),
        )
        assert _completion_rate(tutor.id) == 50.0


class TestComputeAndProvisional:
    def test_under_threshold_is_provisional(self, db_session, tutor, students):
        # Only 2 completed slots in window
        for s in students[:2]:
            slot = _make_slot(db_session, tutor.id, status='completed')
            _make_booking(db_session, tutor.id, s.id, slot.id, status='Completed')

        from services.quality_service import compute_tutor_score
        row = compute_tutor_score(tutor.id)
        assert row is not None
        assert row.is_provisional is True
        assert row.score is None
        assert row.sessions_in_window == 2

    def test_score_persisted_when_qualified(self, db_session, tutor, students):
        # 6 completed sessions + 5 reviews
        from models.review import Review
        for s in students[:6]:
            slot = _make_slot(db_session, tutor.id, status='completed')
            _make_booking(db_session, tutor.id, s.id, slot.id, status='Completed')
        for s in students[:5]:
            db_session.session.add(Review(
                student_id=s.id, tutor_id=tutor.id, rating=5,
                created_at=datetime.utcnow() - timedelta(days=10),
            ))
        db_session.session.commit()

        from services.quality_service import compute_tutor_score
        row = compute_tutor_score(tutor.id, save_snapshot=True)
        assert row.is_provisional is False
        assert row.score is not None
        assert 70 <= row.score <= 100  # mostly maxed components

        from models.tutor_quality_score import TutorQualityScoreSnapshot
        snaps = TutorQualityScoreSnapshot.query.filter_by(
            tutor_id=tutor.id).all()
        assert len(snaps) == 1


class TestRoutes:
    def test_public_endpoint_registered(self, client, tutor):
        resp = client.get(f'/api/v1/tutors/{tutor.id}/quality')
        assert resp.status_code == 200
        data = resp.get_json()['data']
        assert 'is_provisional' in data
