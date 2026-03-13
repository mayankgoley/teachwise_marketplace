"""add cancellation_reason and has_seen_tour

Revision ID: d1e2f3a4b5c6
Revises: ab21d211205d
Create Date: 2026-03-11 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd1e2f3a4b5c6'
down_revision = 'ab21d211205d'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('bookings', sa.Column('cancellation_reason', sa.String(length=255), nullable=True))
    op.add_column('students', sa.Column('has_seen_tour', sa.Boolean(), nullable=True, server_default='false'))


def downgrade():
    op.drop_column('students', 'has_seen_tour')
    op.drop_column('bookings', 'cancellation_reason')
