"""Add session recordings and booking consent fields

Revision ID: 823251ab49d7
Revises: 392648b0b106
Create Date: 2026-03-05 07:06:30.288465

"""
from alembic import op
import sqlalchemy as sa

revision = '823251ab49d7'
down_revision = '392648b0b106'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('bookings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('recording_consent_student', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('recording_consent_tutor', sa.Boolean(), nullable=True))
    # session_recordings table already exists via db.create_all()


def downgrade():
    with op.batch_alter_table('bookings', schema=None) as batch_op:
        batch_op.drop_column('recording_consent_tutor')
        batch_op.drop_column('recording_consent_student')
