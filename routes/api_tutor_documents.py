"""
JSON API endpoints for tutor document management.

Blueprint prefix: /api/v1
All endpoints return the standard envelope:
  {"success": True,  "data": {...}}
  {"success": False, "error": {"message": "...", "code": 400}}
"""

from flask import Blueprint, jsonify, request, current_app
from flask_login import current_user, login_required
from functools import wraps
from datetime import datetime
import hashlib

from database import db
from models.tutor import Tutor
from models.tutor_document import TutorDocument
from models.in_app_notification import InAppNotification
from models.admin import Admin
from services.storage_service import upload_document, delete_document

api_tutor_documents_bp = Blueprint(
    'api_tutor_documents', __name__, url_prefix='/api/v1'
)

REQUIRED_DOC_TYPES = ['government_id', 'teaching_certificate', 'background_check']
VALID_DOC_TYPES = [
    'government_id', 'teaching_certificate', 'background_check',
    'degree', 'certification', 'teaching_license', 'other',
]
ALLOWED_EXTENSIONS = {'pdf', 'jpg', 'jpeg', 'png'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


# ── Helpers ──────────────────────────────────────────────────────────

def _ok(data, status=200):
    return jsonify({"success": True, "data": data}), status


def _err(message, code=400, field=None):
    payload = {"success": False, "error": {"message": message, "code": code}}
    if field:
        payload["error"]["field"] = field
    return jsonify(payload), code


def _role_required(role):
    """Decorator that enforces login *and* a specific user_type."""
    def decorator(f):
        @wraps(f)
        @login_required
        def decorated(*args, **kwargs):
            if current_user.user_type != role:
                return _err("Access denied", 403)
            return f(*args, **kwargs)
        return decorated
    return decorator


def _allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ═════════════════════════════════════════════════════════════════════
# 1. GET /api/v1/tutor/documents
# ═════════════════════════════════════════════════════════════════════

@api_tutor_documents_bp.route('/tutor/documents', methods=['GET'])
@_role_required('tutor')
def list_documents():
    """Return the current tutor's uploaded documents and verification status."""

    tutor = Tutor.query.get(current_user.id)
    docs = TutorDocument.query.filter_by(tutor_id=current_user.id).all()

    documents = []
    for doc in docs:
        documents.append({
            "id": doc.id,
            "document_type": doc.document_type,
            "status": doc.status,
            "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
            "expiry_date": doc.expiry_date.isoformat() if doc.expiry_date else None,
            "rejection_reason": doc.admin_notes,
            "download_url": "#",
        })

    # Determine which required types are still missing (not uploaded or rejected)
    uploaded_non_rejected = {
        doc.document_type
        for doc in docs
        if doc.status != 'rejected'
    }
    missing_types = [
        dt for dt in REQUIRED_DOC_TYPES
        if dt not in uploaded_non_rejected
    ]

    # Can submit only if all required types have a non-rejected document
    # AND verification_status allows submission
    can_submit = (
        len(missing_types) == 0
        and tutor.verification_status in ('pending_documents', 'revision_required')
    )

    return _ok({
        "documents": documents,
        "verification_status": tutor.verification_status,
        "required_documents": missing_types,
        "can_submit_for_review": can_submit,
    })


# ═════════════════════════════════════════════════════════════════════
# 2. POST /api/v1/tutor/documents
# ═════════════════════════════════════════════════════════════════════

@api_tutor_documents_bp.route('/tutor/documents', methods=['POST'])
@_role_required('tutor')
def upload_doc():
    """Upload a new document for verification."""

    document_type = request.form.get('document_type', '').strip()
    if not document_type:
        return _err("document_type is required", 400, field="document_type")
    if document_type not in VALID_DOC_TYPES:
        return _err(
            f"Invalid document_type. Must be one of: {', '.join(VALID_DOC_TYPES)}",
            400,
            field="document_type",
        )

    # Validate file
    file = request.files.get('file')
    if not file or not file.filename:
        return _err("File is required", 400, field="file")

    if not _allowed_file(file.filename):
        return _err(
            f"File type not allowed. Accepted: {', '.join(ALLOWED_EXTENSIONS)}",
            400,
            field="file",
        )

    file_bytes = file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        return _err("File size exceeds 10 MB limit", 400, field="file")
    if len(file_bytes) == 0:
        return _err("File is empty", 400, field="file")

    # Parse optional expiry_date
    expiry_date = None
    expiry_str = request.form.get('expiry_date', '').strip()
    if expiry_str:
        try:
            expiry_date = datetime.strptime(expiry_str, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return _err(
                "Invalid expiry_date format. Use YYYY-MM-DD.", 400,
                field="expiry_date",
            )

    # Upload to storage
    result = upload_document(file_bytes, current_user.id, file.filename)
    if not result:
        return _err("File upload failed. Please try again.", 500)

    # Determine MIME type
    ext = file.filename.rsplit('.', 1)[1].lower()
    mime_map = {
        'pdf': 'application/pdf',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
    }
    mime_type = mime_map.get(ext, 'application/octet-stream')

    # Create TutorDocument record
    doc = TutorDocument(
        tutor_id=current_user.id,
        document_type=document_type,
        original_filename=file.filename,
        mime_type=mime_type,
        file_size_bytes=result['file_size_bytes'],
        r2_object_key=result['r2_object_key'],
        file_encryption_key=result['file_encryption_key'],
        verification_hash=result['verification_hash'],
        status='pending',
        expiry_date=expiry_date,
    )
    db.session.add(doc)
    db.session.commit()

    return _ok({"document_id": doc.id}, status=201)


# ═════════════════════════════════════════════════════════════════════
# 3. DELETE /api/v1/tutor/documents/<document_id>
# ═════════════════════════════════════════════════════════════════════

@api_tutor_documents_bp.route('/tutor/documents/<int:document_id>', methods=['DELETE'])
@_role_required('tutor')
def delete_doc(document_id):
    """Delete a pending document."""

    doc = TutorDocument.query.get(document_id)
    if not doc:
        return _err("Document not found", 404)
    if doc.tutor_id != current_user.id:
        return _err("Access denied", 403)
    if doc.status != 'pending':
        return _err("Only pending documents can be deleted", 400)

    # Remove file from storage
    delete_document(doc.r2_object_key)

    db.session.delete(doc)
    db.session.commit()

    return _ok({})


# ═════════════════════════════════════════════════════════════════════
# 4. POST /api/v1/tutor/documents/submit-for-review
# ═════════════════════════════════════════════════════════════════════

@api_tutor_documents_bp.route('/tutor/documents/submit-for-review', methods=['POST'])
@_role_required('tutor')
def submit_for_review():
    """Submit all uploaded documents for admin review."""

    tutor = Tutor.query.get(current_user.id)
    docs = TutorDocument.query.filter_by(tutor_id=current_user.id).all()

    # Check which required types have a non-rejected document
    uploaded_non_rejected = {
        doc.document_type
        for doc in docs
        if doc.status != 'rejected'
    }
    missing_types = [
        dt for dt in REQUIRED_DOC_TYPES
        if dt not in uploaded_non_rejected
    ]

    if missing_types:
        return _err(
            f"Missing required documents: {', '.join(missing_types)}",
            400,
        )

    # Update verification status
    tutor.verification_status = 'documents_submitted'

    # Notify all admins
    admins = Admin.query.all()
    for admin in admins:
        notif = InAppNotification(
            user_id=admin.id,
            user_type='admin',
            type='verification',
            title='New verification submission',
            message=f'{tutor.name} has submitted documents for review',
        )
        db.session.add(notif)

    db.session.commit()

    return _ok({"message": "Documents submitted for review"})
