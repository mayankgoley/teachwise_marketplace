from database import db
from datetime import datetime


class TutorDocument(db.Model):
    __tablename__ = 'tutor_documents'

    id = db.Column(db.Integer, primary_key=True)
    tutor_id = db.Column(db.Integer, db.ForeignKey('tutors.id'), nullable=False)

    document_type = db.Column(db.String(50), nullable=False)
    # Types: 'government_id', 'degree', 'certification', 'teaching_license', 'other'
    original_filename = db.Column(db.String(255), nullable=False)
    mime_type = db.Column(db.String(100), nullable=False)
    file_size_bytes = db.Column(db.Integer, nullable=False)

    r2_object_key = db.Column(db.String(500), nullable=False)
    # Format: 'documents/{tutor_id}/{uuid}.enc'

    file_encryption_key = db.Column(db.Text, nullable=False)
    # Unique Fernet key for this file (encrypted with master FERNET_KEY)
    verification_hash = db.Column(db.String(64), nullable=False)
    # SHA-256 of the ORIGINAL (pre-encryption) file

    status = db.Column(db.String(30), default='pending')
    # States: pending, approved, rejected, revision_required
    admin_notes = db.Column(db.Text, nullable=True)
    reviewed_by = db.Column(db.String(100), nullable=True)
    reviewed_on = db.Column(db.DateTime, nullable=True)

    # 90-day retention
    file_deleted = db.Column(db.Boolean, default=False)
    file_deleted_on = db.Column(db.DateTime, nullable=True)

    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    tutor = db.relationship('Tutor', backref='documents', lazy=True)

    def __repr__(self):
        return f'<TutorDoc {self.document_type} tutor={self.tutor_id} [{self.status}]>'
