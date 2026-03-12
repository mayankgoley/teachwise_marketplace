import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-fallback-change-me')
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL',
        'postgresql://teachwise:teachwise@pgbouncer:6432/teachwise')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 5,
        'max_overflow': 10,
        'pool_pre_ping': True,
        'pool_recycle': 300,
    }

    # Redis
    REDIS_URL = os.environ.get('REDIS_URL', '')

    # JWT
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY',
                                     os.environ.get('SECRET_KEY', 'dev-fallback-change-me'))

    # Core service URL
    CORE_SERVICE_URL = os.environ.get('CORE_SERVICE_URL', 'http://core-service:5000')

    # File storage (R2/S3)
    R2_ACCOUNT_ID = os.environ.get('R2_ACCOUNT_ID', '')
    R2_ACCESS_KEY_ID = os.environ.get('R2_ACCESS_KEY_ID', '')
    R2_SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY', '')
    R2_BUCKET_NAME = os.environ.get('R2_BUCKET_NAME', 'teachwise-docs')
    R2_ENDPOINT_URL = os.environ.get('R2_ENDPOINT_URL', '')
    R2_PUBLIC_URL = os.environ.get('R2_PUBLIC_URL', '')

    # Encryption
    FERNET_KEY = os.environ.get('FERNET_KEY', '')

    # Upload
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
