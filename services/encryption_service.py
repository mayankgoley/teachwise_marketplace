from cryptography.fernet import Fernet
from itsdangerous import URLSafeTimedSerializer
from flask import current_app


def get_fernet():
    key = current_app.config['FERNET_KEY']
    if not key:
        raise ValueError('FERNET_KEY not set in .env file')
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_field(plaintext):
    if not plaintext:
        return None
    return get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_field(ciphertext):
    if not ciphertext:
        return None
    try:
        return get_fernet().decrypt(ciphertext.encode()).decode()
    except Exception:
        return '[decryption failed]'


def generate_token(data, salt='email-verify'):
    s = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    return s.dumps(data, salt=salt)


def verify_token(token, salt='email-verify', max_age=86400):
    s = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    try:
        return s.loads(token, salt=salt, max_age=max_age)
    except Exception:
        return None
