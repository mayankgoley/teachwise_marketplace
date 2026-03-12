"""Add jitsi_room_name to tutor_slots

Revision ID: fd7d60002a6c
Revises: de6c07012bfe
Create Date: 2026-03-05 06:26:42.977288

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'fd7d60002a6c'
down_revision = 'de6c07012bfe'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('tutor_slots', schema=None) as batch_op:
        batch_op.add_column(sa.Column('jitsi_room_name', sa.String(length=255), nullable=True))


def downgrade():
    with op.batch_alter_table('tutor_slots', schema=None) as batch_op:
        batch_op.drop_column('jitsi_room_name')
