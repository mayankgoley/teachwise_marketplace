"""Add performance indexes for scaling to 10K-20K concurrent users.

Revision ID: f1a2b3c4d5e6
Revises: ce8288293a68
Create Date: 2026-03-10 12:00:00.000000
"""
from alembic import op

# revision identifiers
revision = 'f1a2b3c4d5e6'
down_revision = 'ce8288293a68'
branch_labels = None
depends_on = None


def upgrade():
    # === tutor_slots: Most queried table (search, bookings, reminders) ===
    op.create_index('ix_tutor_slots_tutor_status', 'tutor_slots',
                    ['tutor_id', 'status'])
    op.create_index('ix_tutor_slots_date_status', 'tutor_slots',
                    ['date', 'status'])
    op.create_index('ix_tutor_slots_status_mode', 'tutor_slots',
                    ['status', 'mode'])
    op.create_index('ix_tutor_slots_student_id', 'tutor_slots',
                    ['student_id'])

    # === bookings: Student/tutor dashboard queries ===
    op.create_index('ix_bookings_student_status', 'bookings',
                    ['student_id', 'status'])
    op.create_index('ix_bookings_tutor_status', 'bookings',
                    ['tutor_id', 'status'])
    op.create_index('ix_bookings_slot_id', 'bookings',
                    ['slot_id'])

    # === messages: Chat performance (unread counts, last message) ===
    op.create_index('ix_messages_conv_created', 'messages',
                    ['conversation_id', 'created_at'])
    op.create_index('ix_messages_sender_read', 'messages',
                    ['sender_type', 'is_read'])

    # === conversations: Chat list queries ===
    op.create_index('ix_conversations_student', 'conversations',
                    ['student_id'])
    op.create_index('ix_conversations_tutor', 'conversations',
                    ['tutor_id'])

    # === favorite_tutors: Student favorites page ===
    op.create_index('ix_favorite_tutors_student_tutor', 'favorite_tutors',
                    ['student_id', 'tutor_id'], unique=True)

    # === reschedule_requests: Status checks ===
    op.create_index('ix_reschedule_booking_status', 'reschedule_requests',
                    ['booking_id', 'status'])

    # === learning_goals: Student progress dashboard ===
    op.create_index('ix_learning_goals_student_status', 'learning_goals',
                    ['student_id', 'status'])
    op.create_index('ix_learning_goals_tutor', 'learning_goals',
                    ['tutor_id'])

    # === progress_entries: Goal detail page timeline ===
    op.create_index('ix_progress_entries_goal_created', 'progress_entries',
                    ['goal_id', 'created_at'])

    # === session_notes: Session notes panel ===
    op.create_index('ix_session_notes_slot_created', 'session_notes',
                    ['slot_id', 'created_at'])

    # === tutors: Search and verification queries ===
    op.create_index('ix_tutors_verification_status', 'tutors',
                    ['verification_status'])
    op.create_index('ix_tutors_city', 'tutors',
                    ['city'])

    # === students: Email lookup (login, notification prefs) ===
    op.create_index('ix_students_email_verified', 'students',
                    ['email_verified'])

    # === email_notifications: Admin dashboard, delivery tracking ===
    op.create_index('ix_email_notif_status', 'email_notifications',
                    ['status'])
    op.create_index('ix_email_notif_type_created', 'email_notifications',
                    ['email_type', 'created_at'])

    # === in_app_notifications: Notification bell queries ===
    op.create_index('ix_inapp_notif_user', 'in_app_notifications',
                    ['user_type', 'user_id', 'is_read'])


def downgrade():
    # Drop all indexes in reverse order
    op.drop_index('ix_inapp_notif_user', 'in_app_notifications')
    op.drop_index('ix_email_notif_type_created', 'email_notifications')
    op.drop_index('ix_email_notif_status', 'email_notifications')
    op.drop_index('ix_students_email_verified', 'students')
    op.drop_index('ix_tutors_city', 'tutors')
    op.drop_index('ix_tutors_verification_status', 'tutors')
    op.drop_index('ix_session_notes_slot_created', 'session_notes')
    op.drop_index('ix_progress_entries_goal_created', 'progress_entries')
    op.drop_index('ix_learning_goals_tutor', 'learning_goals')
    op.drop_index('ix_learning_goals_student_status', 'learning_goals')
    op.drop_index('ix_reschedule_booking_status', 'reschedule_requests')
    op.drop_index('ix_favorite_tutors_student_tutor', 'favorite_tutors')
    op.drop_index('ix_conversations_tutor', 'conversations')
    op.drop_index('ix_conversations_student', 'conversations')
    op.drop_index('ix_messages_sender_read', 'messages')
    op.drop_index('ix_messages_conv_created', 'messages')
    op.drop_index('ix_bookings_slot_id', 'bookings')
    op.drop_index('ix_bookings_tutor_status', 'bookings')
    op.drop_index('ix_bookings_student_status', 'bookings')
    op.drop_index('ix_tutor_slots_student_id', 'tutor_slots')
    op.drop_index('ix_tutor_slots_status_mode', 'tutor_slots')
    op.drop_index('ix_tutor_slots_date_status', 'tutor_slots')
    op.drop_index('ix_tutor_slots_tutor_status', 'tutor_slots')
