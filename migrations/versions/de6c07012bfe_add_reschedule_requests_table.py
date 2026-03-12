"""add reschedule_requests table

Revision ID: de6c07012bfe
Revises: 43cb62dfbfa7
Create Date: 2026-03-05 06:17:09.622206

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'de6c07012bfe'
down_revision = '43cb62dfbfa7'
branch_labels = None
depends_on = None


def upgrade():
    # reschedule_requests table already exists via db.create_all()
    pass


def downgrade():
    pass
