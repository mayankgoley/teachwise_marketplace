"""
Async email tasks processed by Celery workers.

All email sending goes through these tasks to avoid blocking
the request/response cycle. Emails are queued instantly and
sent in the background with automatic retry on failure.
"""
import resend
import logging
from celery_app import celery
from datetime import datetime

logger = logging.getLogger(__name__)


@celery.task(
    bind=True,
    name='services.tasks.email_tasks.send_email_task',
    max_retries=3,
    default_retry_delay=30,
    rate_limit='100/m',  # Resend API rate limit
    acks_late=True,
)
def send_email_task(self, to_email, subject, html_body, email_type,
                    recipient_type='student', booking_id=None,
                    api_key=None, from_name=None, from_addr=None):
    """
    Send an email via Resend.com and update the database log.

    This task runs in the Celery worker process, not in the Flask
    request handler. It creates a Flask app context to access the
    database for logging.

    Args:
        to_email: Recipient email address
        subject: Email subject line
        html_body: HTML content
        email_type: Type tag for logging
        recipient_type: 'student', 'tutor', 'guardian', 'admin'
        booking_id: Optional FK to bookings table
        api_key: Resend API key
        from_name: Sender display name
        from_addr: Sender email address
    """
    from app import app

    with app.app_context():
        from database import db
        from models.email_notification import EmailNotification

        # Create log entry
        log = EmailNotification(
            recipient_email=to_email,
            recipient_type=recipient_type,
            email_type=email_type,
            subject_line=subject,
            status='queued',
            related_booking_id=booking_id
        )
        db.session.add(log)
        db.session.flush()

        try:
            if not api_key:
                log.status = 'skipped'
                log.error_message = 'RESEND_API_KEY not configured'
                db.session.commit()
                logger.warning(f'Email skipped (no API key): {email_type} to {to_email}')
                return {'status': 'skipped', 'reason': 'no_api_key'}

            resend.api_key = api_key
            resend.Emails.send({
                'from': f'{from_name} <{from_addr}>',
                'to': [to_email],
                'subject': subject,
                'html': html_body
            })

            log.status = 'sent'
            log.sent_at = datetime.utcnow()
            db.session.commit()
            logger.info(f'Email sent: {email_type} to {to_email}')
            return {'status': 'sent', 'to': to_email}

        except Exception as exc:
            log.status = 'failed'
            log.error_message = str(exc)[:500]
            db.session.commit()
            logger.error(f'Email failed: {email_type} to {to_email}: {exc}')

            # Retry with exponential backoff
            raise self.retry(exc=exc, countdown=30 * (2 ** self.request.retries))
