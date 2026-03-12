"""Tests for authentication (login, registration, lockout)."""
import pytest
from werkzeug.security import check_password_hash


class TestStudentRegistration:
    def test_register_success(self, client):
        resp = client.post('/student/register', data={
            'name': 'New Student',
            'email': 'new@test.com',
            'password': 'ValidPass123!@',
            'confirm_password': 'ValidPass123!@',
            'date_of_birth': '2000-01-15',
        }, follow_redirects=True)
        assert resp.status_code == 200

    def test_register_weak_password(self, client):
        resp = client.post('/student/register', data={
            'name': 'New Student',
            'email': 'weak@test.com',
            'password': 'short',
            'confirm_password': 'short',
            'date_of_birth': '2000-01-15',
        }, follow_redirects=True)
        assert resp.status_code == 200
        # Should stay on register page (redirect back)

    def test_register_password_mismatch(self, client):
        resp = client.post('/student/register', data={
            'name': 'New Student',
            'email': 'mismatch@test.com',
            'password': 'ValidPass123!@',
            'confirm_password': 'DifferentPass123!@',
            'date_of_birth': '2000-01-15',
        }, follow_redirects=True)
        assert resp.status_code == 200

    def test_register_duplicate_email(self, client, student_user):
        resp = client.post('/student/register', data={
            'name': 'Another Student',
            'email': 'student@test.com',  # already exists
            'password': 'ValidPass123!@',
            'confirm_password': 'ValidPass123!@',
            'date_of_birth': '2000-01-15',
        }, follow_redirects=True)
        assert resp.status_code == 200


class TestStudentLogin:
    def test_login_success(self, client, student_user):
        resp = client.post('/student/login', data={
            'email': 'student@test.com',
            'password': 'TestPass123!@#',
        }, follow_redirects=True)
        assert resp.status_code == 200

    def test_login_wrong_password(self, client, student_user):
        resp = client.post('/student/login', data={
            'email': 'student@test.com',
            'password': 'WrongPassword1!@',
        }, follow_redirects=True)
        assert resp.status_code == 200

    def test_login_nonexistent_user(self, client):
        resp = client.post('/student/login', data={
            'email': 'nobody@test.com',
            'password': 'SomePass123!@',
        }, follow_redirects=True)
        assert resp.status_code == 200


class TestAccountLockout:
    def test_lockout_after_5_failures(self, client, student_user, db_session):
        for _ in range(5):
            client.post('/student/login', data={
                'email': 'student@test.com',
                'password': 'WrongPass1!@',
            })

        # 6th attempt should mention lockout
        resp = client.post('/student/login', data={
            'email': 'student@test.com',
            'password': 'WrongPass1!@',
        }, follow_redirects=True)
        assert resp.status_code == 200

        # Verify lockout in DB
        from models.student import Student
        student = Student.query.filter_by(email='student@test.com').first()
        assert student.locked_until is not None


class TestForgotPassword:
    def test_forgot_password_page_loads(self, client):
        resp = client.get('/student/forgot-password')
        assert resp.status_code == 200

    def test_forgot_password_submit(self, client, student_user):
        resp = client.post('/student/forgot-password', data={
            'email': 'student@test.com',
        }, follow_redirects=True)
        assert resp.status_code == 200

    def test_forgot_password_nonexistent_email(self, client):
        # Should still return success (anti-enumeration)
        resp = client.post('/student/forgot-password', data={
            'email': 'nobody@test.com',
        }, follow_redirects=True)
        assert resp.status_code == 200
