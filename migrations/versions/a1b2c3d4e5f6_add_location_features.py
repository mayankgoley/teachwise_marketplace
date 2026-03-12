"""Add location features (Phase 1).

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2026-03-11 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geography

# revision identifiers
revision = 'a1b2c3d4e5f6'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Enable PostGIS extension
    op.execute('CREATE EXTENSION IF NOT EXISTS postgis')

    # 2. Add columns to tutors table
    op.add_column('tutors', sa.Column('default_location_label', sa.String(100), nullable=True))
    op.add_column('tutors', sa.Column('default_radius_miles', sa.Float(), server_default='10.0', nullable=True))

    # 3. Add columns to tutor_slots table
    op.add_column('tutor_slots', sa.Column('location_latitude', sa.Float(), nullable=True))
    op.add_column('tutor_slots', sa.Column('location_longitude', sa.Float(), nullable=True))
    op.add_column('tutor_slots', sa.Column('location_label', sa.String(100), nullable=True))
    op.add_column('tutor_slots', sa.Column('location_is_default', sa.Boolean(), server_default='true', nullable=True))
    op.add_column('tutor_slots', sa.Column('radius_miles', sa.Float(), nullable=True))
    op.add_column('tutor_slots', sa.Column('radius_is_default', sa.Boolean(), server_default='true', nullable=True))
    op.add_column('tutor_slots', sa.Column('location_point', Geography('POINT', srid=4326), nullable=True))

    # 4. Create student_saved_locations table
    op.create_table(
        'student_saved_locations',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('student_id', sa.Integer(), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('label', sa.String(100), nullable=False),
        sa.Column('address', sa.String(255), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('location_type', sa.String(50), nullable=False, server_default='other'),
        sa.Column('is_primary', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # 5. Add columns to bookings table
    op.add_column('bookings', sa.Column('meeting_latitude', sa.Float(), nullable=True))
    op.add_column('bookings', sa.Column('meeting_longitude', sa.Float(), nullable=True))
    op.add_column('bookings', sa.Column('meeting_address', sa.String(255), nullable=True))
    op.add_column('bookings', sa.Column('meeting_address_encrypted', sa.LargeBinary(), nullable=True))
    op.add_column('bookings', sa.Column('meeting_location_type', sa.String(50), nullable=True))
    op.add_column('bookings', sa.Column('meeting_location_label', sa.String(100), nullable=True))

    # 6. Create GiST spatial index on tutor_slots.location_point
    op.create_index('idx_slot_location_point', 'tutor_slots', ['location_point'], postgresql_using='gist')

    # 7. Create trigger function + trigger to auto-sync location_point from lat/lng
    op.execute("""
        CREATE OR REPLACE FUNCTION sync_slot_location_point()
        RETURNS TRIGGER AS $$
        BEGIN
          IF NEW.location_latitude IS NOT NULL AND NEW.location_longitude IS NOT NULL THEN
            NEW.location_point := ST_SetSRID(ST_MakePoint(NEW.location_longitude, NEW.location_latitude), 4326)::geography;
          ELSE
            NEW.location_point := NULL;
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trg_sync_slot_location_point
        BEFORE INSERT OR UPDATE OF location_latitude, location_longitude ON tutor_slots
        FOR EACH ROW EXECUTE FUNCTION sync_slot_location_point();
    """)


def downgrade():
    # Drop trigger and function
    op.execute('DROP TRIGGER IF EXISTS trg_sync_slot_location_point ON tutor_slots')
    op.execute('DROP FUNCTION IF EXISTS sync_slot_location_point()')

    # Drop spatial index
    op.drop_index('idx_slot_location_point', table_name='tutor_slots')

    # Drop booking columns
    op.drop_column('bookings', 'meeting_location_label')
    op.drop_column('bookings', 'meeting_location_type')
    op.drop_column('bookings', 'meeting_address_encrypted')
    op.drop_column('bookings', 'meeting_address')
    op.drop_column('bookings', 'meeting_longitude')
    op.drop_column('bookings', 'meeting_latitude')

    # Drop student_saved_locations table
    op.drop_table('student_saved_locations')

    # Drop tutor_slots columns
    op.drop_column('tutor_slots', 'location_point')
    op.drop_column('tutor_slots', 'radius_is_default')
    op.drop_column('tutor_slots', 'radius_miles')
    op.drop_column('tutor_slots', 'location_is_default')
    op.drop_column('tutor_slots', 'location_label')
    op.drop_column('tutor_slots', 'location_longitude')
    op.drop_column('tutor_slots', 'location_latitude')

    # Drop tutors columns
    op.drop_column('tutors', 'default_radius_miles')
    op.drop_column('tutors', 'default_location_label')

    # Drop PostGIS extension
    op.execute('DROP EXTENSION IF EXISTS postgis')
