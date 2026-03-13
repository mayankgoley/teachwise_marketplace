import os
from dotenv import load_dotenv

load_dotenv()  # Load .env file into os.environ


class Config:
    # --- Flask Core ---
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-fallback-change-me')
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL',
        'sqlite:///teachwise.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # --- DB Connection Pooling (via PgBouncer in production) ---
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 15,
        'max_overflow': 30,
        'pool_pre_ping': True,
        'pool_recycle': 300,
    }

    # --- Server-Side Sessions (Redis) ---
    SESSION_TYPE = os.environ.get('SESSION_TYPE', 'filesystem')  # 'redis' in production
    SESSION_PERMANENT = True
    PERMANENT_SESSION_LIFETIME = 2592000
    SESSION_KEY_PREFIX = 'tw:session:'
    SESSION_USE_SIGNER = True

    # --- Email (Resend.com) ---
    RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
    EMAIL_FROM = os.environ.get('EMAIL_FROM', 'onboarding@resend.dev')
    EMAIL_FROM_NAME = os.environ.get('EMAIL_FROM_NAME', 'TeachWise')

    # --- Encryption ---
    FERNET_KEY = os.environ.get('FERNET_KEY', '')

    # --- App URL ---
    APP_URL = os.environ.get('APP_URL', 'http://localhost:5000')

    # --- Token Expiry (seconds) ---
    EMAIL_VERIFY_EXPIRY = 86400
    GUARDIAN_VERIFY_EXPIRY = 172800
    PASSWORD_RESET_EXPIRY = 3600

    # --- Rate Limiting ---
    RATELIMIT_DEFAULT = '200 per hour'
    RATELIMIT_LOGIN = '10 per 15 minutes'
    RATELIMIT_STORAGE_URI = os.environ.get('REDIS_URL', 'memory://')

    # --- File Upload ---
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')

    # --- Cloudflare R2 ---
    R2_ACCOUNT_ID = os.environ.get('R2_ACCOUNT_ID', '')
    R2_ACCESS_KEY_ID = os.environ.get('R2_ACCESS_KEY_ID', '')
    R2_SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY', '')
    R2_BUCKET_NAME = os.environ.get('R2_BUCKET_NAME', 'teachwise-docs')
    R2_ENDPOINT_URL = os.environ.get('R2_ENDPOINT_URL', '')
    R2_PUBLIC_URL = os.environ.get('R2_PUBLIC_URL', '')  # e.g. https://cdn.teachwiseedu.com or https://bucket.r2.dev

    # --- Document Verification ---
    DOC_MAX_SIZE_MB = int(os.environ.get('DOC_MAX_SIZE_MB', 5))
    DOC_RETENTION_DAYS = int(os.environ.get('DOC_RETENTION_DAYS', 90))
    ALLOWED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
    ALLOWED_DOC_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png'}

    # --- Redis (Upstash) ---
    REDIS_URL = os.environ.get('REDIS_URL', '')
    CACHE_TTL = int(os.environ.get('CACHE_TTL_SECONDS', 900))

    # --- Celery ---
    CELERY_BROKER_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
    CELERY_RESULT_BACKEND = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

    # --- Stripe Payments ---
    STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', 'sk_test_placeholder')
    STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY', 'pk_test_placeholder')
    STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', 'whsec_placeholder')
    PLATFORM_FEE_PERCENT = 15
    WALLET_MIN_TOPUP = int(os.environ.get('WALLET_MIN_TOPUP', 5))
    WALLET_MAX_TOPUP = int(os.environ.get('WALLET_MAX_TOPUP', 500))

    # --- Recommendation Weights (must sum to 1.0) ---
    REC_WEIGHT_SUBJECT = 0.40
    REC_WEIGHT_RATING = 0.25
    REC_WEIGHT_DISTANCE = 0.20
    REC_WEIGHT_EXPERIENCE = 0.10
    REC_WEIGHT_AVAILABILITY = 0.05

    # --- App Version (for static asset cache busting) ---
    VERSION = os.environ.get('APP_VERSION', '1.0.0')

    # --- User Loader Cache TTL (seconds) ---
    USER_CACHE_TTL = int(os.environ.get('USER_CACHE_TTL', 300))

    # --- JWT (Microservices Auth) ---
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', SECRET_KEY)
    JWT_EXPIRY = int(os.environ.get('JWT_EXPIRY', 86400))

    # --- Chatbot ---
    OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')

    # --- Microservice URLs (for inter-service REST calls) ---
    CORE_SERVICE_URL = os.environ.get('CORE_SERVICE_URL', 'http://core-service:5000')
    SEARCH_SERVICE_URL = os.environ.get('SEARCH_SERVICE_URL', 'http://search-service:5000')
    CHAT_SERVICE_URL = os.environ.get('CHAT_SERVICE_URL', 'http://chat-service:5000')
    LEARNING_SERVICE_URL = os.environ.get('LEARNING_SERVICE_URL', 'http://learning-service:5000')
    NOTIFICATION_SERVICE_URL = os.environ.get('NOTIFICATION_SERVICE_URL', 'http://notification-service:5000')
    SERVICE_CLIENT_TIMEOUT = int(os.environ.get('SERVICE_CLIENT_TIMEOUT', 3))
    SERVICE_CLIENT_RETRIES = int(os.environ.get('SERVICE_CLIENT_RETRIES', 2))


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_ENGINE_OPTIONS = {}  # No pooling for SQLite
    WTF_CSRF_ENABLED = False
    RATELIMIT_ENABLED = False
    RATELIMIT_DEFAULT = '9999 per second'
    SERVER_NAME = 'localhost'
    SECRET_KEY = 'test-secret-key'
    FERNET_KEY = 'dGVzdC1mZXJuZXQta2V5LXRoYXQtaXMtMzItYnl0ZXM='  # base64 32-byte key
    STRIPE_SECRET_KEY = 'sk_test_fake'
    STRIPE_PUBLISHABLE_KEY = 'pk_test_fake'
    STRIPE_WEBHOOK_SECRET = 'whsec_fake'
    REDIS_URL = ''
    APP_URL = 'http://localhost'
    SESSION_TYPE = 'filesystem'
