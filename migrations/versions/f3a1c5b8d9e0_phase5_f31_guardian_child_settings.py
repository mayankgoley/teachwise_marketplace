"""phase5 f31: guardian_child_settings + booking approval expiry

Revision ID: f3a1c5b8d9e0
Revises: a1b2c3d4e5f7
Create Date: 2026-05-11 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'f3a1c5b8d9e0'
down_revision = 'a1b2c3d4e5f7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'guardian_child_settings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('guardian_id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('monthly_spending_cap', sa.Float(), nullable=True),
        sa.Column('session_window_start', sa.Time(), nullable=True),
        sa.Column('session_window_end', sa.Time(), nullable=True),
        sa.Column('requires_approval_for_booking', sa.Boolean(),
                  nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['guardian_id'], ['guardians.id']),
        sa.ForeignKeyConstraint(['student_id'], ['students.id']),
        sa.UniqueConstraint('guardian_id', 'student_id',
                            name='uq_guardian_student_settings'),
    )
    op.create_index('ix_guardian_child_settings_guardian_id',
                    'guardian_child_settings', ['guardian_id'])
    op.create_index('ix_guardian_child_settings_student_id',
                    'guardian_child_settings', ['student_id'])

    with op.batch_alter_table('bookings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('requires_guardian_approval',
                                      sa.Boolean(), nullable=False,
                                      server_default=sa.text('false')))
        batch_op.add_column(sa.Column('guardian_approval_expires_at',
                                      sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('bookings', schema=None) as batch_op:
        batch_op.drop_column('guardian_approval_expires_at')
        batch_op.drop_column('requires_guardian_approval')

    op.drop_index('ix_guardian_child_settings_student_id',
                  table_name='guardian_child_settings')
    op.drop_index('ix_guardian_child_settings_guardian_id',
                  table_name='guardian_child_settings')
    op.drop_table('guardian_child_settings')
