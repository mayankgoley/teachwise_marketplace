"""Add group session fields to tutor_slots

Revision ID: 392648b0b106
Revises: a4e068aa11e0
Create Date: 2026-03-05 07:03:31.049473

"""
from alembic import op
import sqlalchemy as sa

revision = '392648b0b106'
down_revision = 'a4e068aa11e0'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('tutor_slots', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_group', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('max_students', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('current_students', sa.Integer(), nullable=True))


def downgrade():
    with op.batch_alter_table('tutor_slots', schema=None) as batch_op:
        batch_op.drop_column('current_students')
        batch_op.drop_column('max_students')
        batch_op.drop_column('is_group')
