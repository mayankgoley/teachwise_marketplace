"""add tutor onboarding fields

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-03-11 20:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('tutors', sa.Column('onboarding_step', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('tutors', sa.Column('has_seen_tour', sa.Boolean(), nullable=True, server_default='false'))

def downgrade():
    op.drop_column('tutors', 'has_seen_tour')
    op.drop_column('tutors', 'onboarding_step')
