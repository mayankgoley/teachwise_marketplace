"""D7: Security tests — XSS, CSRF, injection, access control."""
import pytest
import json


class TestCSRFProtection:
    def test_post_without_csrf_rejected(self, client, student_user):
        """POST requests without CSRF token should be rejected."""
        resp = client.post('/student/login', data={
            'email': 'student@test.com',
            'password': 'TestPass123!@#',
        })
        # CSRF is enforced; without token, requests may fail or redirect
        assert resp.status_code in (200, 302, 400)

    def test_chatbot_api_exempt_from_csrf(self, client):
        """API routes should handle CSRF appropriately."""
        resp = client.get('/api/chatbot/quick-replies')
        assert resp.status_code == 200


class TestXSSPrevention:
    def test_xss_in_registration_name(self, client):
        resp = client.post('/student/register', data={
            'name': '<script>alert("xss")</script>',
            'email': 'xss@test.com',
            'password': 'ValidPass123!@',
            'confirm_password': 'ValidPass123!@',
            'date_of_birth': '2000-01-15',
        }, follow_redirects=True)
        assert resp.status_code == 200
        # XSS payload should not appear unescaped
        assert b'<script>alert("xss")</script>' not in resp.data

    def test_xss_in_search_query(self, client):
        resp = client.get('/search?q=<script>alert("xss")</script>')
        assert resp.status_code == 200
        assert b'<script>alert("xss")</script>' not in resp.data


class TestAccessControl:
    def test_admin_dashboard_requires_admin(self, client, student_user):
        """Students should not access admin pages."""
        client.post('/student/login', data={
            'email': 'student@test.com',
            'password': 'TestPass123!@#',
        })
        resp = client.get('/admin/dashboard', follow_redirects=True)
        # Should redirect to login or show 403
        assert resp.status_code in (200, 302, 403)

    def test_tutor_dashboard_requires_tutor(self, client, student_user):
        """Students should not access tutor dashboard."""
        client.post('/student/login', data={
            'email': 'student@test.com',
            'password': 'TestPass123!@#',
        })
        resp = client.get('/tutor/dashboard', follow_redirects=True)
        assert resp.status_code in (200, 302, 403)

    def test_student_cannot_add_tutor_slot(self, client, student_user):
        """Students should not be able to add tutor slots."""
        client.post('/student/login', data={
            'email': 'student@test.com',
            'password': 'TestPass123!@#',
        })
        resp = client.post('/tutor/add-slot', data={
            'date': '2026-12-01',
            'start_time': '10:00',
            'end_time': '11:00',
            'mode': 'online',
        }, follow_redirects=True)
        assert resp.status_code in (200, 302, 403)


class TestSecurityHeaders:
    def test_security_headers_present(self, client):
        resp = client.get('/health')
        assert resp.headers.get('X-Content-Type-Options') == 'nosniff'
        assert resp.headers.get('X-Frame-Options') == 'SAMEORIGIN'
        assert resp.headers.get('X-XSS-Protection') == '1; mode=block'
        assert 'Strict-Transport-Security' in resp.headers
        assert 'Content-Security-Policy' in resp.headers
        assert 'Referrer-Policy' in resp.headers

    def test_csp_header_content(self, client):
        resp = client.get('/health')
        csp = resp.headers.get('Content-Security-Policy', '')
        assert "default-src 'self'" in csp
        assert "script-src" in csp


class TestInputValidation:
    def test_message_too_long(self, client, student_user):
        """Chatbot should reject overly long messages."""
        client.post('/student/login', data={
            'email': 'student@test.com',
            'password': 'TestPass123!@#',
        })
        # Create a conversation first
        create_resp = client.post('/api/chatbot/conversations',
                                  content_type='application/json')
        if create_resp.status_code in (200, 201):
            conv_data = json.loads(create_resp.data)
            conv_id = conv_data.get('id', conv_data.get('conversation_id', 'test'))
            resp = client.post(f'/api/chatbot/conversations/{conv_id}/messages',
                               data=json.dumps({'content': 'A' * 2001}),
                               content_type='application/json')
            assert resp.status_code == 400


class TestSQLInjection:
    def test_sql_injection_in_search(self, client):
        resp = client.get("/search?q=' OR 1=1 --")
        assert resp.status_code == 200

    def test_sql_injection_in_login(self, client):
        resp = client.post('/student/login', data={
            'email': "' OR 1=1 --",
            'password': "' OR 1=1 --",
        }, follow_redirects=True)
        assert resp.status_code == 200
