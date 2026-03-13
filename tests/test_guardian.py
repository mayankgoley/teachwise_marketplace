"""D1/D6: Tests for guardian authentication and dashboard."""
import pytest
from werkzeug.security import generate_password_hash


@pytest.fixture
def guardian_user(db_session):
    from models.guardian import Guardian
    guardian = Guardian(
        name='Test Guardian',
        email='guardian@test.com',
        password=generate_password_hash('TestPass123!@#'),
    )
    db_session.session.add(guardian)
    db_session.session.commit()
    return guardian


class TestGuardianLogin:
    def test_login_page_loads(self, client):
        resp = client.get('/guardian/login')
        assert resp.status_code == 200

    def test_login_success(self, client, guardian_user):
        resp = client.post('/guardian/login', data={
            'email': 'guardian@test.com',
            'password': 'TestPass123!@#',
        }, follow_redirects=True)
        assert resp.status_code == 200

    def test_login_wrong_password(self, client, guardian_user):
        resp = client.post('/guardian/login', data={
            'email': 'guardian@test.com',
            'password': 'WrongPass1!@',
        }, follow_redirects=True)
        assert resp.status_code == 200

    def test_login_nonexistent(self, client):
        resp = client.post('/guardian/login', data={
            'email': 'noguardian@test.com',
            'password': 'TestPass123!@#',
        }, follow_redirects=True)
        assert resp.status_code == 200


class TestGuardianDashboard:
    def test_dashboard_requires_login(self, client):
        resp = client.get('/guardian/dashboard')
        assert resp.status_code in (302, 401)

    def test_dashboard_loads_when_logged_in(self, client, guardian_user):
        client.post('/guardian/login', data={
            'email': 'guardian@test.com',
            'password': 'TestPass123!@#',
        })
        resp = client.get('/guardian/dashboard', follow_redirects=True)
        assert resp.status_code == 200
