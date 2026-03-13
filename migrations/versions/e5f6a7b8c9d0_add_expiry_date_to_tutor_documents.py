"""add expiry_date to tutor_documents

Revision ID: e5f6a7b8c9d0
Revises: d1e2f3a4b5c6
Create Date: 2026-03-11 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'e5f6a7b8c9d0'
down_revision = 'd1e2f3a4b5c6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('tutor_documents', sa.Column('expiry_date', sa.Date(), nullable=True))


def downgrade():
    op.drop_column('tutor_documents', 'expiry_date')
