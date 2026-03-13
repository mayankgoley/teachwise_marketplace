"""add chat features to messages

Revision ID: a1b2c3d4e5f7
Revises: f6a7b8c9d0e1
Create Date: 2026-03-11 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f7'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade():
    # Delivery status
    op.add_column('messages', sa.Column('status', sa.String(length=20), server_default='sent', nullable=True))
    op.add_column('messages', sa.Column('read_at', sa.DateTime(), nullable=True))

    # File sharing
    op.add_column('messages', sa.Column('message_type', sa.String(length=20), server_default='text', nullable=True))
    op.add_column('messages', sa.Column('file_url', sa.String(length=500), nullable=True))
    op.add_column('messages', sa.Column('file_name', sa.String(length=255), nullable=True))
    op.add_column('messages', sa.Column('file_size', sa.Integer(), nullable=True))
    op.add_column('messages', sa.Column('file_mime_type', sa.String(length=100), nullable=True))

    # Editing and deletion
    op.add_column('messages', sa.Column('edited_at', sa.DateTime(), nullable=True))
    op.add_column('messages', sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=True))


def downgrade():
    op.drop_column('messages', 'is_deleted')
    op.drop_column('messages', 'edited_at')
    op.drop_column('messages', 'file_mime_type')
    op.drop_column('messages', 'file_size')
    op.drop_column('messages', 'file_name')
    op.drop_column('messages', 'file_url')
    op.drop_column('messages', 'message_type')
    op.drop_column('messages', 'read_at')
    op.drop_column('messages', 'status')
