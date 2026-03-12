"""Add booking_id and is_verified to reviews

Revision ID: a79e1cabd366
Revises: c86095d38fa8
Create Date: 2026-03-05 06:39:05.966575

"""
from alembic import op
import sqlalchemy as sa

revision = 'a79e1cabd366'
down_revision = 'c86095d38fa8'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('reviews', schema=None) as batch_op:
        batch_op.add_column(sa.Column('booking_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('is_verified', sa.Boolean(), nullable=True))
        batch_op.create_foreign_key('fk_review_booking', 'bookings', ['booking_id'], ['id'])


def downgrade():
    with op.batch_alter_table('reviews', schema=None) as batch_op:
        batch_op.drop_constraint('fk_review_booking', type_='foreignkey')
        batch_op.drop_column('is_verified')
        batch_op.drop_column('booking_id')
