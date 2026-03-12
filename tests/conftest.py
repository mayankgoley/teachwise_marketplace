import pytest
import sys
import os
from datetime import date, datetime, time, timedelta
from werkzeug.security import generate_password_hash

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


@pytest.fixture(scope='session')
def app():
    from app import app as flask_app
    from config import TestConfig
    flask_app.config.from_object(TestConfig)

    with flask_app.app_context():
        from database import db
        db.create_all()
        yield flask_app
        db.drop_all()


@pytest.fixture(scope='function')
def db_session(app):
    from database import db
    with app.app_context():
        db.create_all()
        yield db
        db.session.rollback()
        db.drop_all()


@pytest.fixture
def client(app, db_session):
    return app.test_client()


@pytest.fixture
def student_user(db_session):
    from models.student import Student
    student = Student(
        name='Test Student',
        email='student@test.com',
        password=generate_password_hash('TestPass123!@#'),
        date_of_birth=date(2000, 1, 1),
        email_verified=True,
    )
    db_session.session.add(student)
    db_session.session.commit()
    return student


@pytest.fixture
def tutor_user(db_session):
    from models.tutor import Tutor
    tutor = Tutor(
        name='Test Tutor',
        email='tutor@test.com',
        password=generate_password_hash('TestPass123!@#'),
        subject='Mathematics',
        experience=5,
        verification_status='verified',
    )
    db_session.session.add(tutor)
    db_session.session.commit()
    return tutor


@pytest.fixture
def admin_user(db_session):
    from models.admin import Admin
    admin = Admin(
        name='Test Admin',
        email='admin@test.com',
        password=generate_password_hash('TestPass123!@#'),
    )
    db_session.session.add(admin)
    db_session.session.commit()
    return admin


@pytest.fixture
def sample_slot(db_session, tutor_user):
    from models.slots import TutorSlot
    tomorrow = date.today() + timedelta(days=2)
    slot = TutorSlot(
        tutor_id=tutor_user.id,
        date=tomorrow,
        start_time=time(10, 0),
        end_time=time(11, 0),
        mode='online',
        subject='Mathematics',
        price=25.0,
        status='pending',
    )
    db_session.session.add(slot)
    db_session.session.commit()
    return slot


@pytest.fixture
def booked_slot(db_session, student_user, tutor_user, sample_slot):
    from models.booking import Booking
    sample_slot.status = 'booked'
    sample_slot.student_id = student_user.id
    booking = Booking(
        student_id=student_user.id,
        tutor_id=tutor_user.id,
        slot_id=sample_slot.id,
        status='Booked',
    )
    db_session.session.add(booking)
    db_session.session.commit()
    return booking
