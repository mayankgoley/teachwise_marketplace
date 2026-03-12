from database import db
from models.in_app_notification import InAppNotification
import logging

logger = logging.getLogger(__name__)


def handle_booking_created(event_data):
    student_id = event_data.get('student_id')
    tutor_id = event_data.get('tutor_id')
    tutor_name = event_data.get('tutor_name', 'a tutor')
    student_name = event_data.get('student_name', 'a student')

    if student_id:
        _create_notification(
            user_id=student_id, user_type='student',
            type='booking_confirmed', title='Booking Confirmed',
            message=f'Your session with {tutor_name} has been booked',
            icon='fa-check-circle', color='green',
            url='/student/dashboard'
        )

    if tutor_id:
        _create_notification(
            user_id=tutor_id, user_type='tutor',
            type='new_booking', title='New Booking',
            message=f'{student_name} booked a session with you',
            icon='fa-calendar-plus', color='green',
            url='/tutor/dashboard'
        )


def handle_booking_cancelled(event_data):
    student_id = event_data.get('student_id')
    tutor_id = event_data.get('tutor_id')

    if student_id:
        _create_notification(
            user_id=student_id, user_type='student',
            type='booking_cancelled', title='Booking Cancelled',
            message='Your booking has been cancelled',
            icon='fa-times-circle', color='red',
            url='/student/dashboard'
        )

    if tutor_id:
        _create_notification(
            user_id=tutor_id, user_type='tutor',
            type='booking_cancelled', title='Booking Cancelled',
            message='A booking has been cancelled',
            icon='fa-times-circle', color='red',
            url='/tutor/dashboard'
        )


def handle_payment_completed(event_data):
    student_id = event_data.get('student_id')
    amount = event_data.get('amount', '')

    if student_id:
        _create_notification(
            user_id=student_id, user_type='student',
            type='payment_success', title='Payment Successful',
            message=f'Payment of {amount} processed successfully',
            icon='fa-credit-card', color='green',
            url='/student/dashboard'
        )


def handle_message_sent(event_data):
    sender_type = event_data.get('sender_type')
    sender_name = event_data.get('sender_name', 'Someone')
    preview = event_data.get('preview', 'sent you a message')
    conversation_id = event_data.get('conversation_id')

    logger.info(
        f'Message notification: {sender_name} ({sender_type}) '
        f'in conversation {conversation_id}'
    )


def handle_assignment_submitted(event_data):
    tutor_id = event_data.get('tutor_id')
    student_name = event_data.get('student_name', 'A student')
    title = event_data.get('assignment_title', 'an assignment')

    if tutor_id:
        _create_notification(
            user_id=tutor_id, user_type='tutor',
            type='assignment_submitted', title='Assignment Submitted',
            message=f'{student_name} submitted "{title}"',
            icon='fa-file-alt', color='blue',
            url='/tutor/dashboard'
        )


def handle_assignment_graded(event_data):
    student_id = event_data.get('student_id')
    grade = event_data.get('grade', '')
    title = event_data.get('assignment_title', 'your assignment')

    if student_id:
        _create_notification(
            user_id=student_id, user_type='student',
            type='assignment_graded', title='Assignment Graded',
            message=f'Your "{title}" received a grade of {grade}',
            icon='fa-check-circle', color='green',
            url='/student/dashboard'
        )


def handle_goal_completed(event_data):
    student_id = event_data.get('student_id')
    tutor_id = event_data.get('tutor_id')
    goal_title = event_data.get('title', 'a learning goal')

    if student_id:
        _create_notification(
            user_id=student_id, user_type='student',
            type='goal_completed', title='Goal Completed!',
            message=f'Congratulations! You completed "{goal_title}"',
            icon='fa-trophy', color='yellow',
            url='/student/progress'
        )


def handle_tutor_verified(event_data):
    tutor_id = event_data.get('tutor_id')

    if tutor_id:
        _create_notification(
            user_id=tutor_id, user_type='tutor',
            type='verification_approved', title='Profile Verified!',
            message='Your profile is now verified and visible to students',
            icon='fa-check-circle', color='green',
            url='/tutor/dashboard'
        )


def handle_review_created(event_data):
    tutor_id = event_data.get('tutor_id')
    rating = event_data.get('rating', 0)

    if tutor_id:
        _create_notification(
            user_id=tutor_id, user_type='tutor',
            type='new_review', title=f'New {rating}-Star Review',
            message='You received a new review',
            icon='fa-star', color='yellow',
            url=f'/tutor/{tutor_id}'
        )


def _create_notification(user_id, user_type, type, title, message,
                          icon='fa-bell', color='blue', url=None):
    try:
        notif = InAppNotification(
            user_id=user_id, user_type=user_type,
            type=type, title=title, message=message,
            icon=icon, color=color, url=url
        )
        db.session.add(notif)
        db.session.commit()
        logger.info(f'Notification created: {type} for {user_type}_{user_id}')
    except Exception as e:
        db.session.rollback()
        logger.error(f'Failed to create notification: {e}')
