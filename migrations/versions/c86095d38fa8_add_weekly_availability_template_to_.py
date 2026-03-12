"""Add weekly_availability_template to tutors

Revision ID: c86095d38fa8
Revises: fd7d60002a6c
Create Date: 2026-03-05 06:31:27.516138

"""
from alembic import op
import sqlalchemy as sa

revision = 'c86095d38fa8'
down_revision = 'fd7d60002a6c'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('tutors', schema=None) as batch_op:
        batch_op.add_column(sa.Column('weekly_availability_template', sa.JSON(), nullable=True))


def downgrade():
    with op.batch_alter_table('tutors', schema=None) as batch_op:
        batch_op.drop_column('weekly_availability_template')
