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
    JWT_EXPIRY = int(os.environ.get('JWT_EXPIRY', 86400))

    # Core service URL
    CORE_SERVICE_URL = os.environ.get('CORE_SERVICE_URL', 'http://core-service:5000')
