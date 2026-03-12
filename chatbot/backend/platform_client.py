"""Platform API Client — Stub Functions

The chatbot calls your existing platform as a CLIENT via HTTP.
Each function below documents what data it needs and what endpoint it expects.

YOU NEED TO wire these up by either:
  1. Creating the expected API endpoints in your platform, OR
  2. Replacing the function bodies with direct DB queries

See chatbot/README.md for the full list of assumed endpoints.
"""

import requests
from flask import current_app, request as flask_request

_TIMEOUT = 5


def _base_url():
    return current_app.config.get('APP_URL', 'http://localhost:5001')


def _auth_cookies():
    """Forward the current user's session cookie for auth."""
    cookie = flask_request.cookies.get('session')
    if cookie:
        return {'session': cookie}
    return {}


def _get(path, params=None):
    try:
        resp = requests.get(
            f"{_base_url()}{path}",
            params=params,
            cookies=_auth_cookies(),
            timeout=_TIMEOUT,
        )
        if resp.status_code == 200:
            return resp.json()
        return {'error': f'API returned {resp.status_code}'}
    except requests.RequestException as e:
        return {'error': f'Request failed: {e}'}


def _post(path, data=None):
    try:
        resp = requests.post(
            f"{_base_url()}{path}",
            json=data,
            cookies=_auth_cookies(),
            timeout=_TIMEOUT,
        )
        if resp.status_code in (200, 201):
            return resp.json()
        return {'error': f'API returned {resp.status_code}'}
    except requests.RequestException as e:
        return {'error': f'Request failed: {e}'}


# ---------------------------------------------------------------------------
# USER PROFILE
# ---------------------------------------------------------------------------
def get_user_profile(user_id, user_role):
    """
    Expected endpoint: GET /api/internal/user/<user_id>?role=<user_role>
    Expected response: {id, name, email, city, ...}

    STUB — replace with your actual endpoint or direct query.
    """
    return _get(f'/api/internal/user/{user_id}', {'role': user_role})


# ---------------------------------------------------------------------------
# BOOKINGS
# ---------------------------------------------------------------------------
def get_user_bookings(user_id, user_role, status=None, limit=10):
    """
    Expected endpoint: GET /api/internal/bookings?user_id=X&role=Y&status=Z&limit=N
    Expected response: {bookings: [{booking_id, status, slot: {...}, tutor/student: {...}}]}

    STUB — replace with your actual endpoint or direct query.
    """
    params = {'user_id': user_id, 'role': user_role, 'limit': limit}
    if status and status != 'all':
        params['status'] = status
    return _get('/api/internal/bookings', params)


def get_booking_details(booking_id):
    """
    Expected endpoint: GET /api/internal/bookings/<booking_id>
    Expected response: {booking_id, status, slot, tutor, student, payment}

    STUB — replace with your actual endpoint or direct query.
    """
    return _get(f'/api/internal/bookings/{booking_id}')


def cancel_booking(booking_id, reason, cancelled_by):
    """
    Expected endpoint: POST /api/internal/bookings/<booking_id>/cancel
    Expected body: {reason, cancelled_by}
    Expected response: {booking_id, status, refund_amount}

    STUB — replace with your actual endpoint or direct query.
    """
    return _post(f'/api/internal/bookings/{booking_id}/cancel', {
        'reason': reason,
        'cancelled_by': cancelled_by,
    })


def calculate_refund(booking_id):
    """
    Expected endpoint: GET /api/internal/bookings/<booking_id>/refund-estimate
    Expected response: {booking_id, refund_percentage, refund_amount, original_amount}

    STUB — replace with your actual endpoint or direct query.
    """
    return _get(f'/api/internal/bookings/{booking_id}/refund-estimate')


def get_refund_status(booking_id):
    """
    Expected endpoint: GET /api/internal/payments?booking_id=<booking_id>
    Expected response: {booking_id, payment_status, amount, refund_amount}

    STUB — replace with your actual endpoint or direct query.
    """
    return _get('/api/internal/payments', {'booking_id': booking_id})


def get_payment_status(booking_id):
    """
    Expected endpoint: GET /api/internal/payments?booking_id=<booking_id>
    Expected response: {booking_id, amount, currency, status, refund_amount}

    STUB — replace with your actual endpoint or direct query.
    """
    return _get('/api/internal/payments', {'booking_id': booking_id})


# ---------------------------------------------------------------------------
# TUTOR SEARCH
# ---------------------------------------------------------------------------
def search_tutors(subject=None, mode=None, min_rating=None, max_price=None, limit=10):
    """
    Expected endpoint: GET /api/internal/tutors/search?subject=X&mode=Y&...
    Expected response: {tutors: [{id, name, subject, rating_avg, hourly_rate, ...}]}

    STUB — replace with your actual endpoint or direct query.
    """
    params = {'limit': limit}
    if subject:
        params['subject'] = subject
    if mode:
        params['mode'] = mode
    if min_rating:
        params['min_rating'] = min_rating
    if max_price:
        params['max_price'] = max_price
    return _get('/api/internal/tutors/search', params)


def get_tutor_slots(tutor_id, date_from=None, date_to=None, mode=None):
    """
    Expected endpoint: GET /api/internal/tutors/<tutor_id>/slots?date_from=X&date_to=Y
    Expected response: {slots: [{id, date, start_time, end_time, mode, subject, price}]}

    STUB — replace with your actual endpoint or direct query.
    """
    params = {}
    if date_from:
        params['date_from'] = date_from
    if date_to:
        params['date_to'] = date_to
    if mode:
        params['mode'] = mode
    return _get(f'/api/internal/tutors/{tutor_id}/slots', params)
