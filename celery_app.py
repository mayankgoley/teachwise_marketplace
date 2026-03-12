from celery import Celery
from config import Config

celery = Celery(
    'teachwise',
    broker=Config.CELERY_BROKER_URL,
    backend=Config.CELERY_RESULT_BACKEND,
)

celery.conf.update(
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],
    timezone='UTC',
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_soft_time_limit=120,
    task_time_limit=180,
    result_expires=3600,
    task_default_rate_limit='100/m',
    task_default_retry_delay=30,
    task_max_retries=3,
    task_routes={
        'services.tasks.email_tasks.*': {'queue': 'email'},
    },
)

celery.autodiscover_tasks(['services.tasks'])
