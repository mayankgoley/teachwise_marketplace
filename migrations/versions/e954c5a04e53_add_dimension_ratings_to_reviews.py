"""Add dimension ratings to reviews

Revision ID: e954c5a04e53
Revises: 36e38a7537b1
Create Date: 2026-03-05 06:46:57.165638

"""
from alembic import op
import sqlalchemy as sa

revision = 'e954c5a04e53'
down_revision = '36e38a7537b1'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('reviews', schema=None) as batch_op:
        batch_op.add_column(sa.Column('rating_knowledge', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('rating_communication', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('rating_punctuality', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('rating_value', sa.Integer(), nullable=True))


def downgrade():
    with op.batch_alter_table('reviews', schema=None) as batch_op:
        batch_op.drop_column('rating_value')
        batch_op.drop_column('rating_punctuality')
        batch_op.drop_column('rating_communication')
        batch_op.drop_column('rating_knowledge')
