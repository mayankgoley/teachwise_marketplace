"""
JWT Authentication for TeachWise Microservices

Core service issues JWTs on login. Other services validate them
using the shared SECRET_KEY to authenticate inter-service and
client requests.

Usage in microservices:
    from shared.jwt_auth import jwt_required, create_jwt_token

    @app.route('/api/resource')
    @jwt_required
    def protected(jwt_payload):
        user_id = jwt_payload['uid']
        ...
"""

import jwt
import os
import functools
from datetime import datetime, timedelta
from flask import request, jsonify, current_app


def create_jwt_token(uid, role, name, email=None, extra=None):
    """
    Create a signed JWT token.

    Args:
        uid: User identifier (e.g., 'student_5', 'tutor_12')
        role: User role ('student', 'tutor', 'admin', 'guardian')
        name: Display name
        email: User email (optional)
        extra: Dict of additional claims (optional)

    Returns:
        str: Encoded JWT token
    """
    secret = current_app.config.get('JWT_SECRET_KEY',
                                     current_app.config.get('SECRET_KEY'))
    expiry_seconds = current_app.config.get('JWT_EXPIRY', 86400)  # 24h default

    payload = {
        'uid': str(uid),
        'role': role,
        'name': name,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(seconds=expiry_seconds),
    }
    if email:
        payload['email'] = email
    if extra and isinstance(extra, dict):
        payload.update(extra)

    return jwt.encode(payload, secret, algorithm='HS256')


def decode_jwt_token(token):
    """
    Decode and validate a JWT token.

    Returns:
        dict: Token payload if valid
    Raises:
        jwt.ExpiredSignatureError: If token is expired
        jwt.InvalidTokenError: If token is invalid
    """
    secret = current_app.config.get('JWT_SECRET_KEY',
                                     current_app.config.get('SECRET_KEY'))
    return jwt.decode(token, secret, algorithms=['HS256'])


def get_jwt_from_request():
    """
    Extract JWT token from the request.
    Checks: Authorization header (Bearer token), then query param, then cookie.

    Returns:
        str or None: The token string, or None if not found
    """
    # 1. Authorization: Bearer <token>
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:]

    # 2. Query parameter: ?token=xxx
    token = request.args.get('token')
    if token:
        return token

    # 3. Cookie: tw_jwt
    token = request.cookies.get('tw_jwt')
    if token:
        return token

    return None


def jwt_required(f):
    """
    Decorator that requires a valid JWT token.

    The decoded payload is passed to the wrapped function as
    the first positional argument named `jwt_payload`.

    Usage:
        @app.route('/api/protected')
        @jwt_required
        def my_endpoint(jwt_payload):
            uid = jwt_payload['uid']
            role = jwt_payload['role']
            ...

    Returns 401 if no token, 403 if expired/invalid.
    """
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        token = get_jwt_from_request()
        if not token:
            return jsonify({'error': 'Authentication required'}), 401

        try:
            payload = decode_jwt_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 403

        return f(payload, *args, **kwargs)

    return decorated


def jwt_optional(f):
    """
    Like @jwt_required but doesn't fail if no token is present.
    Passes None as jwt_payload if no valid token.

    Usage:
        @app.route('/api/public')
        @jwt_optional
        def my_endpoint(jwt_payload):
            if jwt_payload:
                # Authenticated user
            else:
                # Anonymous access
    """
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        token = get_jwt_from_request()
        payload = None
        if token:
            try:
                payload = decode_jwt_token(token)
            except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
                pass  # Treat as anonymous

        return f(payload, *args, **kwargs)

    return decorated


def create_internal_token():
    """
    Create a short-lived token for internal service-to-service calls.
    Valid for 60 seconds — just enough for a single request.

    Returns:
        str: JWT token with role='internal'
    """
    secret = current_app.config.get('JWT_SECRET_KEY',
                                     current_app.config.get('SECRET_KEY'))
    payload = {
        'uid': 'service',
        'role': 'internal',
        'name': 'Internal Service',
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(seconds=60),
    }
    return jwt.encode(payload, secret, algorithm='HS256')


def internal_only(f):
    """
    Decorator that only allows internal service-to-service calls.
    Requires JWT with role='internal'.
    """
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        token = get_jwt_from_request()
        if not token:
            return jsonify({'error': 'Authentication required'}), 401

        try:
            payload = decode_jwt_token(token)
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            return jsonify({'error': 'Invalid token'}), 403

        if payload.get('role') != 'internal':
            return jsonify({'error': 'Internal access only'}), 403

        return f(payload, *args, **kwargs)

    return decorated
