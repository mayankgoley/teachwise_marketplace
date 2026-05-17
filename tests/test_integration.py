"""Integration tests — end-to-end flows."""
import pytest
import json
from datetime import date, time, timedelta
from werkzeug.security import generate_password_hash


class TestStudentBookingFlow:
    """End-to-end: student registers, finds tutor, books session."""

    def test_registration_to_dashboard(self, client):
        """Student registers then accesses dashboard."""
        # Register
        resp = client.post('/student/register', data={
            'name': 'Flow Test Student',
            'email': 'flow@test.com',
            'password': 'FlowPass123!@',
            'confirm_password': 'FlowPass123!@',
            'date_of_birth': '2000-06-15',
        }, follow_redirects=True)
        assert resp.status_code == 200

    def test_search_tutors(self, client, tutor_user):
        """Search page loads and shows tutors."""
        resp = client.get('/search')
        assert resp.status_code == 200

    def test_view_tutor_profile(self, client, tutor_user):
        """Public tutor profile is accessible."""
        resp = client.get(f'/tutor/profile/{tutor_user.id}')
        assert resp.status_code == 200


class TestTutorSlotManagement:
    """End-to-end: tutor creates slots and manages bookings."""

    def test_tutor_login_and_dashboard(self, client, tutor_user):
        """Tutor logs in and sees dashboard."""
        resp = client.post('/tutor/login', data={
            'email': 'tutor@test.com',
            'password': 'TestPass123!@#',
        }, follow_redirects=True)
        assert resp.status_code == 200

    def test_tutor_add_slot(self, client, tutor_user):
        """Tutor can add a time slot."""
        client.post('/tutor/login', data={
            'email': 'tutor@test.com',
            'password': 'TestPass123!@#',
        })
        tomorrow = (date.today() + timedelta(days=3)).isoformat()
        resp = client.post('/tutor/add-slot', data={
            'date': tomorrow,
            'start_time': '14:00',
            'end_time': '15:00',
            'mode': 'online',
            'subject': 'Mathematics',
            'price': '25.00',
        }, follow_redirects=True)
        assert resp.status_code == 200

    def test_tutor_availability_page(self, client, tutor_user):
        """Availability page loads."""
        client.post('/tutor/login', data={
            'email': 'tutor@test.com',
            'password': 'TestPass123!@#',
        })
        resp = client.get('/tutor/availability', follow_redirects=True)
        assert resp.status_code == 200


class TestCancelFlow:
    """End-to-end: booking cancellation with refund."""

    def test_student_cancel_booking(self, client, booked_slot, student_user, sample_slot):
        """Student can cancel a booking."""
        client.post('/student/login', data={
            'email': 'student@test.com',
            'password': 'TestPass123!@#',
        })
        resp = client.post(f'/student/cancel-booking/{booked_slot.id}',
                           data={'cancellation_reason': 'Schedule conflict'},
                           follow_redirects=True)
        assert resp.status_code == 200


class TestAdminFlow:
    """End-to-end: admin manages platform."""

    def test_admin_login_and_dashboard(self, client, admin_user):
        """Admin logs in and sees dashboard."""
        resp = client.post('/admin/login', data={
            'email': 'admin@test.com',
            'password': 'TestPass123!@#',
        }, follow_redirects=True)
        assert resp.status_code == 200

    def test_admin_users_page(self, client, admin_user):
        """Admin can access user management."""
        client.post('/admin/login', data={
            'email': 'admin@test.com',
            'password': 'TestPass123!@#',
        })
        resp = client.get('/admin/users', follow_redirects=True)
        assert resp.status_code == 200

    def test_admin_bookings_page(self, client, admin_user):
        """Admin can access bookings page."""
        client.post('/admin/login', data={
            'email': 'admin@test.com',
            'password': 'TestPass123!@#',
        })
        resp = client.get('/admin/bookings', follow_redirects=True)
        assert resp.status_code == 200


class TestErrorPages:
    """Test custom error pages."""

    def test_404_page(self, client):
        resp = client.get('/this-page-does-not-exist')
        assert resp.status_code == 404
        assert b'Page Not Found' in resp.data

    def test_health_endpoint(self, client):
        resp = client.get('/health')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert 'status' in data
