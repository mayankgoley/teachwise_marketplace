"""Add notification_prefs to tutors

Revision ID: c595d9e82567
Revises: a79e1cabd366
Create Date: 2026-03-05 06:40:39.993019

"""
from alembic import op
import sqlalchemy as sa

revision = 'c595d9e82567'
down_revision = 'a79e1cabd366'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('tutors', schema=None) as batch_op:
        batch_op.add_column(sa.Column('notification_prefs', sa.JSON(), nullable=True))


def downgrade():
    with op.batch_alter_table('tutors', schema=None) as batch_op:
        batch_op.drop_column('notification_prefs')
