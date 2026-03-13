"""D3: Tests for payment routes and Stripe integration."""
import pytest
import json
from unittest.mock import patch, MagicMock


class TestCheckoutPage:
    def test_checkout_requires_login(self, client):
        resp = client.get('/payment/checkout/1')
        assert resp.status_code in (302, 401)

    def test_checkout_nonexistent_slot(self, client, student_user):
        client.post('/student/login', data={
            'email': 'student@test.com',
            'password': 'TestPass123!@#',
        })
        resp = client.get('/payment/checkout/99999', follow_redirects=True)
        assert resp.status_code in (200, 404)


class TestPaymentSuccess:
    def test_payment_success_page(self, client, student_user):
        client.post('/student/login', data={
            'email': 'student@test.com',
            'password': 'TestPass123!@#',
        })
        resp = client.get('/payment/success?session_id=test_session_123', follow_redirects=True)
        assert resp.status_code in (200, 302, 400)


class TestPaymentCancel:
    def test_payment_cancel_page(self, client, student_user):
        client.post('/student/login', data={
            'email': 'student@test.com',
            'password': 'TestPass123!@#',
        })
        resp = client.get('/payment/cancel', follow_redirects=True)
        assert resp.status_code == 200


class TestStripeWebhook:
    @patch('stripe.Webhook.construct_event')
    def test_webhook_invalid_signature(self, mock_construct, client):
        mock_construct.side_effect = Exception('Invalid signature')
        resp = client.post('/payment/webhook',
                           data='{}',
                           content_type='application/json',
                           headers={'Stripe-Signature': 'invalid'})
        assert resp.status_code in (200, 400)


class TestWallet:
    def test_wallet_page_requires_login(self, client):
        resp = client.get('/wallet/')
        assert resp.status_code in (302, 401)

    def test_wallet_page_loads(self, client, student_user):
        client.post('/student/login', data={
            'email': 'student@test.com',
            'password': 'TestPass123!@#',
        })
        resp = client.get('/wallet/', follow_redirects=True)
        assert resp.status_code == 200
