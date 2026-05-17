"""phase5 f32: tutor_quality_score + snapshot

Revision ID: f4b2d6c9e1a3
Revises: f3a1c5b8d9e0
Create Date: 2026-05-11 12:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'f4b2d6c9e1a3'
down_revision = 'f3a1c5b8d9e0'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'tutor_quality_scores',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tutor_id', sa.Integer(), nullable=False),
        sa.Column('score', sa.Float(), nullable=True),
        sa.Column('is_provisional', sa.Boolean(), nullable=False,
                  server_default=sa.text('true')),
        sa.Column('rating_score', sa.Float(), nullable=True),
        sa.Column('completion_rate', sa.Float(), nullable=True),
        sa.Column('response_time_score', sa.Float(), nullable=True),
        sa.Column('repeat_rate', sa.Float(), nullable=True),
        sa.Column('profile_completeness', sa.Float(), nullable=True),
        sa.Column('sessions_in_window', sa.Integer(), nullable=False,
                  server_default=sa.text('0')),
        sa.Column('computed_at', sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['tutor_id'], ['tutors.id']),
        sa.UniqueConstraint('tutor_id', name='uq_tutor_quality_score_tutor'),
    )
    op.create_index('ix_tutor_quality_scores_tutor_id',
                    'tutor_quality_scores', ['tutor_id'])

    op.create_table(
        'tutor_quality_score_snapshots',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tutor_id', sa.Integer(), nullable=False),
        sa.Column('score', sa.Float(), nullable=True),
        sa.Column('is_provisional', sa.Boolean(), nullable=False,
                  server_default=sa.text('true')),
        sa.Column('saved_at', sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['tutor_id'], ['tutors.id']),
    )
    op.create_index('ix_tutor_quality_snap_tutor_id',
                    'tutor_quality_score_snapshots', ['tutor_id'])
    op.create_index('ix_tutor_quality_snap_saved_at',
                    'tutor_quality_score_snapshots', ['saved_at'])


def downgrade():
    op.drop_index('ix_tutor_quality_snap_saved_at',
                  table_name='tutor_quality_score_snapshots')
    op.drop_index('ix_tutor_quality_snap_tutor_id',
                  table_name='tutor_quality_score_snapshots')
    op.drop_table('tutor_quality_score_snapshots')

    op.drop_index('ix_tutor_quality_scores_tutor_id',
                  table_name='tutor_quality_scores')
    op.drop_table('tutor_quality_scores')
