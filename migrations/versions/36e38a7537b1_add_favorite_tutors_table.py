"""Add favorite_tutors table

Revision ID: 36e38a7537b1
Revises: c595d9e82567
Create Date: 2026-03-05 06:44:58.224897

"""
from alembic import op
import sqlalchemy as sa

revision = '36e38a7537b1'
down_revision = 'c595d9e82567'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('favorite_tutors',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('tutor_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['student_id'], ['students.id']),
        sa.ForeignKeyConstraint(['tutor_id'], ['tutors.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('student_id', 'tutor_id', name='uq_student_tutor_fav')
    )


def downgrade():
    op.drop_table('favorite_tutors')
