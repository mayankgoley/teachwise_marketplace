import resend
from flask import current_app
from database import db
from models.email_notification import EmailNotification
from datetime import datetime


EMAIL_TYPE_PREF_MAP = {
    'booking_confirm': 'booking_notifications',
    'booking_tutor_notify': 'booking_notifications',
    'session_reminder': 'session_reminders',
    'reminder_24h': 'session_reminders',
    'reminder_1h': 'session_reminders',
    'review_prompt': 'review_alerts',
    'marketing': 'marketing_emails',
}


def _check_notification_prefs(to_email, email_type, recipient_type):
    pref_key = EMAIL_TYPE_PREF_MAP.get(email_type)
    if not pref_key:
        return True  # No preference mapping = always send (welcome, guardian, etc.)

    try:
        if recipient_type == 'student':
            from models.student import Student
            user = Student.query.filter_by(email=to_email).first()
        elif recipient_type == 'tutor':
            from models.tutor import Tutor
            user = Tutor.query.filter_by(email=to_email).first()
        else:
            return True  # guardians, admins always receive

        if not user:
            return True
        prefs = getattr(user, 'notification_prefs', None) or {}
        return prefs.get(pref_key, True)  # Default to True if not set
    except Exception:
        return True


def send_email(to_email, subject, html_body, email_type,
               recipient_type='student', booking_id=None):
    if not _check_notification_prefs(to_email, email_type, recipient_type):
        current_app.logger.info(
            f'Email skipped (user preference): {email_type} to {to_email}')
        return False

    api_key = current_app.config.get('RESEND_API_KEY', '')
    from_name = current_app.config.get('EMAIL_FROM_NAME', 'TeachWise')
    from_addr = current_app.config.get('EMAIL_FROM', 'onboarding@resend.dev')

    try:
        from services.tasks.email_tasks import send_email_task
        send_email_task.delay(
            to_email, subject, html_body, email_type,
            recipient_type=recipient_type,
            booking_id=booking_id,
            api_key=api_key,
            from_name=from_name,
            from_addr=from_addr,
        )
        current_app.logger.info(
            f'Email queued (async): {email_type} to {to_email}')
        return True
    except Exception as celery_err:
        current_app.logger.debug(
            f'Celery unavailable ({celery_err}), sending synchronously')
        return _send_email_sync(
            to_email, subject, html_body, email_type,
            recipient_type, booking_id, api_key, from_name, from_addr)


def _send_email_sync(to_email, subject, html_body, email_type,
                     recipient_type, booking_id, api_key, from_name, from_addr):
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
            current_app.logger.warning(f'Email skipped (no API key): {email_type} to {to_email}')
            return False

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
        return True

    except Exception as e:
        log.status = 'failed'
        log.error_message = str(e)[:500]
        db.session.commit()
        current_app.logger.error(f'Email failed: {email_type} to {to_email}: {e}')
        return False


STYLE = '''
  font-family: "Inter", Arial, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  padding: 32px;
  color: #1C2833;
'''

BTN = '''
  display: inline-block;
  padding: 14px 28px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  font-size: 16px;
  margin: 20px 0;
'''


def email_welcome_student(name, verify_url):
    subject = 'Welcome to TeachWise! Please verify your email'
    html = f'''<div style="{STYLE}">
      <h2 style="color:#0D3B66;">Welcome to TeachWise, {name}!</h2>
      <p>We are excited to have you. Please verify your email to start
         finding tutors:</p>
      <a href="{verify_url}"
         style="{BTN} background:#2980B9; color:white;">
        Verify My Email</a>
      <p style="color:#888; font-size:13px;">This link expires in 24 hours.
         If you did not create this account, ignore this email.</p>
    </div>'''
    return subject, html


def email_welcome_tutor(name):
    subject = 'Welcome to TeachWise! Your tutor application is received'
    html = f'''<div style="{STYLE}">
      <h2 style="color:#0D3B66;">Welcome, {name}!</h2>
      <p>Your tutor application has been received. Here is what happens next:</p>
      <ol>
        <li>Complete your profile with qualifications and bio</li>
        <li>Upload verification documents (Phase 2)</li>
        <li>Our team reviews your application within 48 hours</li>
        <li>Once approved, you appear in search results and can accept bookings</li>
      </ol>
      <p>We will notify you by email at each step.</p>
    </div>'''
    return subject, html


def email_guardian_verification(guardian_name, student_name, verify_url):
    subject = f'{student_name} needs your approval on TeachWise'
    html = f'''<div style="{STYLE}">
      <h2 style="color:#0D3B66;">Guardian Verification Required</h2>
      <p>Hello {guardian_name},</p>
      <p><strong>{student_name}</strong> (under 18) has registered on TeachWise
         and listed you as their guardian.</p>
      <p>Please confirm that you approve this registration:</p>
      <a href="{verify_url}"
         style="{BTN} background:#27AE60; color:white;">
        I Approve This Registration</a>
      <p style="color:#888; font-size:13px;">This link expires in 48 hours.
         If you did not expect this email, please ignore it.</p>
      <hr style="border:none; border-top:1px solid #eee; margin:24px 0;">
      <p style="color:#888; font-size:12px;">As a guardian, you will receive
         email notifications whenever {student_name} books a tutoring session.</p>
    </div>'''
    return subject, html


def email_booking_confirmation(student_name, tutor_name, date_str, time_str, mode):
    subject = f'Session Confirmed: {tutor_name} on {date_str}'
    html = f'''<div style="{STYLE}">
      <h2 style="color:#0D3B66;">Session Booked!</h2>
      <p>Hi {student_name}, your session is confirmed:</p>
      <div style="background:#F4F6F7; padding:20px; border-radius:10px; margin:16px 0;">
        <p style="margin:4px 0;"><strong>Tutor:</strong> {tutor_name}</p>
        <p style="margin:4px 0;"><strong>Date:</strong> {date_str}</p>
        <p style="margin:4px 0;"><strong>Time:</strong> {time_str}</p>
        <p style="margin:4px 0;"><strong>Mode:</strong> {mode}</p>
      </div>
      <p>You will receive reminders 24 hours and 1 hour before the session.</p>
    </div>'''
    return subject, html


def email_booking_tutor_notify(tutor_name, student_name, date_str, time_str, mode):
    subject = f'New Booking: {student_name} on {date_str}'
    html = f'''<div style="{STYLE}">
      <h2 style="color:#0D3B66;">New Session Booked!</h2>
      <p>Hi {tutor_name}, a student has booked a session with you:</p>
      <div style="background:#F4F6F7; padding:20px; border-radius:10px; margin:16px 0;">
        <p style="margin:4px 0;"><strong>Student:</strong> {student_name}</p>
        <p style="margin:4px 0;"><strong>Date:</strong> {date_str}</p>
        <p style="margin:4px 0;"><strong>Time:</strong> {time_str}</p>
        <p style="margin:4px 0;"><strong>Mode:</strong> {mode}</p>
      </div>
    </div>'''
    return subject, html


def email_session_reminder(name, other_name, date_str, time_str, hours_before):
    subject = f'Reminder: Session with {other_name} in {hours_before} hours'
    html = f'''<div style="{STYLE}">
      <h2 style="color:#E67E22;">Session Reminder</h2>
      <p>Hi {name}, you have a session in <strong>{hours_before} hours</strong>:</p>
      <div style="background:#FFF8E1; padding:20px; border-radius:10px; margin:16px 0;">
        <p style="margin:4px 0;"><strong>With:</strong> {other_name}</p>
        <p style="margin:4px 0;"><strong>Date:</strong> {date_str}</p>
        <p style="margin:4px 0;"><strong>Time:</strong> {time_str}</p>
      </div>
    </div>'''
    return subject, html


def email_guardian_booking_alert(guardian_name, student_name, tutor_name, date_str, time_str):
    subject = f'{student_name} has booked a tutoring session'
    html = f'''<div style="{STYLE}">
      <h2 style="color:#0D3B66;">Booking Notification</h2>
      <p>Hello {guardian_name},</p>
      <p>Your child <strong>{student_name}</strong> has booked a tutoring session:</p>
      <div style="background:#F4F6F7; padding:20px; border-radius:10px; margin:16px 0;">
        <p style="margin:4px 0;"><strong>Tutor:</strong> {tutor_name}</p>
        <p style="margin:4px 0;"><strong>Date:</strong> {date_str}</p>
        <p style="margin:4px 0;"><strong>Time:</strong> {time_str}</p>
      </div>
    </div>'''
    return subject, html


def email_documents_received(tutor_name):
    subject = 'Documents Received - Under Review'
    html = f'''<div style="{STYLE}">
      <h2 style="color:#0D3B66;">Documents Received!</h2>
      <p>Hi {tutor_name},</p>
      <p>We have received your verification documents. Our team will review
         them within <strong>48 hours</strong>.</p>
      <p>You will receive an email once the review is complete.</p>
      <p style="color:#888; font-size:13px;">No action is needed from you at this time.</p>
    </div>'''
    return subject, html


def email_tutor_approved(tutor_name):
    subject = 'Congratulations! Your TeachWise Profile is Verified'
    html = f'''<div style="{STYLE}">
      <h2 style="color:#27AE60;">You are Verified!</h2>
      <p>Hi {tutor_name},</p>
      <p>Great news! All your documents have been approved and your profile
         is now <strong>fully verified</strong>.</p>
      <p>Your profile is now visible to students and you can start accepting
         bookings immediately.</p>
      <a href="#" style="{BTN} background:#27AE60; color:white;">
        Go to Your Dashboard</a>
    </div>'''
    return subject, html


def email_password_reset(name, reset_url):
    subject = 'Reset Your TeachWise Password'
    html = f'''<div style="{STYLE}">
      <h2 style="color:#0D3B66;">Password Reset Request</h2>
      <p>Hi {name},</p>
      <p>We received a request to reset your password. Click the button below
         to set a new password:</p>
      <a href="{reset_url}"
         style="{BTN} background:#2980B9; color:white;">
        Reset My Password</a>
      <p style="color:#888; font-size:13px;">This link expires in 1 hour.
         If you did not request a password reset, you can safely ignore this email.</p>
    </div>'''
    return subject, html


def email_tutor_rejected(tutor_name, reason=''):
    subject = 'Document Review Update - Action Required'
    reason_block = f'<p><strong>Reason:</strong> {reason}</p>' if reason else ''
    html = f'''<div style="{STYLE}">
      <h2 style="color:#E74C3C;">Document Review Update</h2>
      <p>Hi {tutor_name},</p>
      <p>Unfortunately, one or more of your documents could not be approved.</p>
      {reason_block}
      <p>Please log in and upload corrected documents to continue the
         verification process.</p>
      <a href="#" style="{BTN} background:#2980B9; color:white;">
        Upload New Documents</a>
      <p style="color:#888; font-size:13px;">If you believe this was an error,
         please contact support.</p>
    </div>'''
    return subject, html
