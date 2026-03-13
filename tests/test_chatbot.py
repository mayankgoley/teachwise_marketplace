"""D4: Tests for the chatbot API endpoints."""
import pytest
import json


class TestChatbotConversations:
    def test_create_conversation(self, client, student_user):
        client.post('/student/login', data={
            'email': 'student@test.com',
            'password': 'TestPass123!@#',
        })
        resp = client.post('/api/chatbot/conversations',
                           content_type='application/json')
        assert resp.status_code in (201, 200)

    def test_get_active_conversation_no_login(self, client):
        resp = client.get('/api/chatbot/conversations/active')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data == {}

    def test_get_active_conversation_logged_in(self, client, student_user):
        client.post('/student/login', data={
            'email': 'student@test.com',
            'password': 'TestPass123!@#',
        })
        resp = client.get('/api/chatbot/conversations/active')
        assert resp.status_code == 200


class TestChatbotMessages:
    def test_send_message_invalid_conversation(self, client, student_user):
        client.post('/student/login', data={
            'email': 'student@test.com',
            'password': 'TestPass123!@#',
        })
        resp = client.post('/api/chatbot/conversations/invalid-id/messages',
                           data=json.dumps({'content': 'Hello'}),
                           content_type='application/json')
        assert resp.status_code == 404

    def test_send_empty_message(self, client, student_user):
        client.post('/student/login', data={
            'email': 'student@test.com',
            'password': 'TestPass123!@#',
        })
        # First create a conversation
        create_resp = client.post('/api/chatbot/conversations',
                                  content_type='application/json')
        if create_resp.status_code in (200, 201):
            conv_data = json.loads(create_resp.data)
            conv_id = conv_data.get('id', conv_data.get('conversation_id', 'test'))
            resp = client.post(f'/api/chatbot/conversations/{conv_id}/messages',
                               data=json.dumps({'content': ''}),
                               content_type='application/json')
            assert resp.status_code == 400


class TestQuickReplies:
    def test_quick_replies_endpoint(self, client):
        resp = client.get('/api/chatbot/quick-replies')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert isinstance(data, list)
        assert len(data) >= 3


class TestMessageFeedback:
    def test_feedback_invalid_message(self, client, student_user):
        client.post('/student/login', data={
            'email': 'student@test.com',
            'password': 'TestPass123!@#',
        })
        resp = client.post('/api/chatbot/conversations/fake-conv/messages/fake-msg/feedback',
                           data=json.dumps({'feedback': 'helpful'}),
                           content_type='application/json')
        assert resp.status_code == 404
