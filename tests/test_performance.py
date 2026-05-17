"""Performance test skeletons using Locust.

Run with: locust -f tests/test_performance.py --host=http://localhost:5001

These are skeleton tests that define key user flows for load testing.
They require a running TeachWise instance with test data.
"""

try:
    from locust import HttpUser, task, between, tag
except ImportError:
    import sys
    print("Locust not installed. Install with: pip install locust")
    sys.exit(0)


class StudentUser(HttpUser):
    """Simulates a student browsing and booking sessions."""
    wait_time = between(1, 3)

    def on_start(self):
        """Login as test student."""
        self.client.post('/student/login', data={
            'email': 'student@test.com',
            'password': 'TestPass123!',
        })

    @task(3)
    @tag('browse')
    def view_dashboard(self):
        self.client.get('/student/dashboard')

    @task(5)
    @tag('browse')
    def search_tutors(self):
        self.client.get('/search')

    @task(2)
    @tag('browse')
    def view_bookings(self):
        self.client.get('/student/bookings')

    @task(1)
    @tag('browse')
    def view_notifications(self):
        self.client.get('/notifications/')

    @task(1)
    @tag('api')
    def chatbot_quick_replies(self):
        self.client.get('/api/chatbot/quick-replies')


class TutorUser(HttpUser):
    """Simulates a tutor managing their schedule."""
    wait_time = between(1, 3)

    def on_start(self):
        """Login as test tutor."""
        self.client.post('/tutor/login', data={
            'email': 'tutor@test.com',
            'password': 'TestPass123!',
        })

    @task(3)
    @tag('browse')
    def view_dashboard(self):
        self.client.get('/tutor/dashboard')

    @task(2)
    @tag('browse')
    def view_availability(self):
        self.client.get('/tutor/availability')

    @task(2)
    @tag('browse')
    def view_earnings(self):
        self.client.get('/tutor/earnings')

    @task(1)
    @tag('browse')
    def view_students(self):
        self.client.get('/tutor/students')


class AdminUser(HttpUser):
    """Simulates an admin reviewing the platform."""
    wait_time = between(2, 5)

    def on_start(self):
        """Login as test admin."""
        self.client.post('/admin/login', data={
            'email': 'admin@test.com',
            'password': 'TestPass123!',
        })

    @task(3)
    @tag('admin')
    def view_dashboard(self):
        self.client.get('/admin/dashboard')

    @task(2)
    @tag('admin')
    def view_users(self):
        self.client.get('/admin/users')

    @task(2)
    @tag('admin')
    def view_bookings(self):
        self.client.get('/admin/bookings')

    @task(1)
    @tag('admin')
    def view_analytics(self):
        self.client.get('/admin/analytics/bookings')

    @task(1)
    @tag('admin')
    def view_audit_log(self):
        self.client.get('/admin/audit-log')


class GuestUser(HttpUser):
    """Simulates unauthenticated browsing."""
    wait_time = between(1, 5)

    @task(5)
    @tag('public')
    def view_homepage(self):
        self.client.get('/')

    @task(3)
    @tag('public')
    def search_tutors(self):
        self.client.get('/search')

    @task(1)
    @tag('public')
    def health_check(self):
        self.client.get('/health')

    @task(1)
    @tag('api')
    def chatbot_quick_replies(self):
        self.client.get('/api/chatbot/quick-replies')
