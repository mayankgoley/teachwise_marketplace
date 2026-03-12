import jwt
import os
import functools
from datetime import datetime, timedelta
from flask import request, jsonify, current_app


def create_jwt_token(uid, role, name, email=None, extra=None):
    secret = current_app.config.get('JWT_SECRET_KEY',
                                     current_app.config.get('SECRET_KEY'))
    expiry_seconds = current_app.config.get('JWT_EXPIRY', 86400)

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
    secret = current_app.config.get('JWT_SECRET_KEY',
                                     current_app.config.get('SECRET_KEY'))
    return jwt.decode(token, secret, algorithms=['HS256'])


def get_jwt_from_request():
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:]

    token = request.args.get('token')
    if token:
        return token

    token = request.cookies.get('tw_jwt')
    if token:
        return token

    return None


def jwt_required(f):
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
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        token = get_jwt_from_request()
        payload = None
        if token:
            try:
                payload = decode_jwt_token(token)
            except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
                pass

        return f(payload, *args, **kwargs)

    return decorated


def create_internal_token():
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
