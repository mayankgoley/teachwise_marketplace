"""Add assignments and submissions tables

Revision ID: 494287830273
Revises: 7cb9bee658d4
Create Date: 2026-03-05 06:58:38.367924

"""
from alembic import op
import sqlalchemy as sa

revision = '494287830273'
down_revision = '7cb9bee658d4'
branch_labels = None
depends_on = None


def upgrade():
    # Tables already exist via db.create_all(); this migration tracks the revision chain.
    pass


def downgrade():
    pass
