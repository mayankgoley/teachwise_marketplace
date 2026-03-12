"""Add whiteboard_sessions table

Revision ID: a4e068aa11e0
Revises: 494287830273
Create Date: 2026-03-05 07:01:08.670081

"""
from alembic import op
import sqlalchemy as sa

revision = 'a4e068aa11e0'
down_revision = '494287830273'
branch_labels = None
depends_on = None


def upgrade():
    # Table already exists via db.create_all()
    pass


def downgrade():
    pass
