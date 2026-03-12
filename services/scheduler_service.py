from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta

scheduler = BackgroundScheduler(daemon=True)


def check_reminders(app):
    with app.app_context():
        from models.slots import TutorSlot
        from models.tutor import Tutor
        from models.student import Student
        from services.email_service import (
            send_email, email_session_reminder
        )
        from database import db
        from sqlalchemy import or_

        now = datetime.utcnow()
        tomorrow_plus = (now + timedelta(hours=26)).date()

        upcoming = (
            TutorSlot.query
            .filter(
                TutorSlot.status == 'booked',
                TutorSlot.date >= now.date(),
                TutorSlot.date <= tomorrow_plus,  # Only next ~26 hours
                or_(
                    TutorSlot.reminder_24h_sent == False,
                    TutorSlot.reminder_1h_sent == False
                )
            )
            .limit(500)  # Safety limit
            .all()
        )

        if not upcoming:
            return

        tutor_ids = set(s.tutor_id for s in upcoming)
        student_ids = set(s.student_id for s in upcoming if s.student_id)

        tutor_map = {}
        if tutor_ids:
            tutors = Tutor.query.filter(Tutor.id.in_(list(tutor_ids))).all()
            tutor_map = {t.id: t for t in tutors}

        student_map = {}
        if student_ids:
            students = Student.query.filter(Student.id.in_(list(student_ids))).all()
            student_map = {s.id: s for s in students}

        for slot in upcoming:
            start_dt = datetime.combine(slot.date, slot.start_time)
            hours_until = (start_dt - now).total_seconds() / 3600

            tutor = tutor_map.get(slot.tutor_id)
            student = student_map.get(slot.student_id) if slot.student_id else None
            if not tutor or not student:
                continue

            if 23 <= hours_until <= 25 and not slot.reminder_24h_sent:
                _send_slot_reminders_batch(slot, 24, tutor, student)
                slot.reminder_24h_sent = True

            if 0.5 <= hours_until <= 1.5 and not slot.reminder_1h_sent:
                _send_slot_reminders_batch(slot, 1, tutor, student)
                slot.reminder_1h_sent = True

        db.session.commit()


def _send_slot_reminders_batch(slot, hours_before, tutor, student):
    from services.email_service import send_email, email_session_reminder

    date_str = slot.date.strftime('%B %d, %Y')
    time_str = slot.start_time.strftime('%I:%M %p')

    subj, html = email_session_reminder(
        student.name, tutor.name, date_str, time_str, hours_before)
    send_email(student.email, subj, html,
              f'reminder_{hours_before}h', 'student')

    subj, html = email_session_reminder(
        tutor.name, student.name, date_str, time_str, hours_before)
    send_email(tutor.email, subj, html,
              f'reminder_{hours_before}h', 'tutor')

    if student.is_minor and student.guardian and student.guardian.is_verified:
        subj, html = email_session_reminder(
            student.guardian.name, tutor.name, date_str, time_str, hours_before)
        send_email(student.guardian.email, subj, html,
                   f'reminder_{hours_before}h', 'guardian')


def cleanup_expired_documents(app):
    with app.app_context():
        from models.tutor_document import TutorDocument
        from models.tutor import Tutor
        from services.storage_service import delete_document
        from database import db

        cutoff = datetime.utcnow() - timedelta(
            days=app.config.get('DOC_RETENTION_DAYS', 90)
        )

        expired_docs = (
            TutorDocument.query
            .join(Tutor)
            .filter(
                Tutor.verified_on.isnot(None),
                Tutor.verified_on <= cutoff,
                TutorDocument.file_deleted == False
            )
            .all()
        )

        deleted_count = 0
        for doc in expired_docs:
            success = delete_document(doc.r2_object_key)
            if success:
                doc.file_deleted = True
                doc.file_deleted_on = datetime.utcnow()
                deleted_count += 1

        db.session.commit()
        if deleted_count:
            app.logger.info(
                f'Document cleanup: deleted {deleted_count} expired file(s) from R2')


def check_expired_reschedules(app):
    with app.app_context():
        from models.reschedule import RescheduleRequest
        from database import db

        expired = RescheduleRequest.query.filter(
            RescheduleRequest.status == 'pending',
            RescheduleRequest.expires_at <= datetime.utcnow()
        ).all()

        for req in expired:
            req.status = 'expired'

        if expired:
            db.session.commit()
            app.logger.info(
                f'Reschedule cleanup: expired {len(expired)} request(s)')


def cleanup_expired_recordings(app):
    with app.app_context():
        from models.recording import SessionRecording
        from services.storage_service import delete_document
        from database import db

        expired = SessionRecording.query.filter(
            SessionRecording.is_deleted == False,
            SessionRecording.expires_at <= datetime.utcnow()
        ).all()

        deleted_count = 0
        for rec in expired:
            if rec.r2_object_key:
                success = delete_document(rec.r2_object_key)
                if success:
                    rec.is_deleted = True
                    deleted_count += 1

        if expired:
            db.session.commit()
            app.logger.info(
                f'Recording cleanup: deleted {deleted_count} expired recording(s)')


def check_overdue_assignments(app):
    with app.app_context():
        from models.assignment import Assignment
        from database import db

        now = datetime.utcnow()
        overdue = Assignment.query.filter(
            Assignment.status == 'assigned',
            Assignment.due_date <= now
        ).all()

        for a in overdue:
            a.status = 'overdue'

        if overdue:
            db.session.commit()
            app.logger.info(f'Assignment overdue check: marked {len(overdue)} as overdue')


def init_scheduler(app):
    scheduler.add_job(
        func=check_reminders,
        trigger='interval',
        minutes=15,
        args=[app],
        id='session_reminders',
        replace_existing=True
    )
    scheduler.add_job(
        func=cleanup_expired_documents,
        trigger='cron',
        hour=3,
        minute=0,
        args=[app],
        id='document_cleanup',
        replace_existing=True
    )
    scheduler.add_job(
        func=check_expired_reschedules,
        trigger='interval',
        hours=1,
        args=[app],
        id='reschedule_expiry',
        replace_existing=True
    )
    scheduler.add_job(
        func=check_overdue_assignments,
        trigger='cron',
        hour=8,
        minute=0,
        args=[app],
        id='overdue_assignments',
        replace_existing=True
    )
    scheduler.add_job(
        func=cleanup_expired_recordings,
        trigger='cron',
        hour=4,
        minute=0,
        args=[app],
        id='recording_cleanup',
        replace_existing=True
    )
    scheduler.start()
    app.logger.info(
        'APScheduler started: reminders every 15 min, '
        'doc cleanup daily at 3 AM, recording cleanup daily at 4 AM, '
        'overdue assignments daily at 8 AM, reschedule expiry every hour')
