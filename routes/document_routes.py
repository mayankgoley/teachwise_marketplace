import os
import magic
import hashlib
from flask import (Blueprint, request, redirect, url_for, flash,
                    render_template, send_file, current_app)
from flask_login import current_user
from utils.auth import role_required
from database import db
from extensions import limiter
from models.tutor import Tutor
from models.tutor_document import TutorDocument
from services.storage_service import upload_document, download_document, delete_document
from datetime import datetime
from io import BytesIO

doc_bp = Blueprint('doc_bp', __name__)


@doc_bp.route('/tutor/upload-documents', methods=['GET', 'POST'])
@limiter.limit('10 per hour', methods=['POST'])
@role_required('tutor')
def upload_docs():
    tutor = current_user
    tutor_id = tutor.id

    if request.method == 'POST':
        doc_type = request.form.get('document_type', 'other')
        files = request.files.getlist('documents')

        if not files or all(not f.filename for f in files):
            flash('Please select at least one file to upload.', 'warning')
            return redirect(url_for('doc_bp.upload_docs'))

        max_bytes = current_app.config['DOC_MAX_SIZE_MB'] * 1024 * 1024
        uploaded_count = 0
        errors = []

        for file in files:
            if not file or not file.filename:
                continue

            # Read file bytes
            file_bytes = file.read()

            # Validation 1: File size
            if len(file_bytes) > max_bytes:
                errors.append(f'{file.filename}: exceeds {current_app.config["DOC_MAX_SIZE_MB"]} MB limit')
                continue

            # Validation 2: File extension
            ext = os.path.splitext(file.filename)[1].lower()
            if ext not in current_app.config['ALLOWED_DOC_EXTENSIONS']:
                errors.append(f'{file.filename}: only PDF, JPG, and PNG are allowed')
                continue

            # Validation 3: Actual file type (magic bytes)
            detected_mime = magic.from_buffer(file_bytes, mime=True)
            if detected_mime not in current_app.config['ALLOWED_DOC_TYPES']:
                errors.append(f'{file.filename}: file type not allowed ({detected_mime})')
                continue

            # Upload (encrypted — to R2 or local fallback)
            result = upload_document(file_bytes, tutor_id, file.filename)
            if not result:
                errors.append(f'{file.filename}: upload failed')
                continue

            # Create database record
            doc = TutorDocument(
                tutor_id=tutor_id,
                document_type=doc_type,
                original_filename=file.filename,
                mime_type=detected_mime,
                file_size_bytes=result['file_size_bytes'],
                r2_object_key=result['r2_object_key'],
                file_encryption_key=result['file_encryption_key'],
                verification_hash=result['verification_hash'],
                status='pending'
            )
            db.session.add(doc)
            uploaded_count += 1

        # Update tutor status if this is their first document
        if uploaded_count > 0 and tutor.verification_status == 'pending_documents':
            tutor.verification_status = 'documents_submitted'

        db.session.commit()

        if uploaded_count > 0:
            # Send notification email
            try:
                from services.email_service import send_email, email_documents_received
                subj, html = email_documents_received(tutor.name)
                send_email(tutor.email, subj, html, 'documents_received', 'tutor')
            except Exception:
                pass
            flash(f'{uploaded_count} document{"s" if uploaded_count != 1 else ""} uploaded successfully! Our team will review within 48 hours.', 'success')

        for err in errors:
            flash(err, 'danger')

        return redirect(url_for('doc_bp.upload_docs'))

    # GET: show upload form and existing documents
    existing_docs = TutorDocument.query.filter_by(tutor_id=tutor_id).order_by(
        TutorDocument.uploaded_at.desc()).all()
    return render_template('tutor_upload_docs.html',
                           tutor=tutor, documents=existing_docs)


@doc_bp.route('/tutor/document/<int:doc_id>/delete', methods=['POST'])
@role_required('tutor')
def delete_doc(doc_id):
    tutor_id = current_user.id

    doc = TutorDocument.query.get_or_404(doc_id)

    # Only the owning tutor can delete, and only pending/rejected docs
    if doc.tutor_id != tutor_id:
        flash('Unauthorized.', 'danger')
        return redirect(url_for('doc_bp.upload_docs'))

    if doc.status not in ('pending', 'rejected', 'revision_required'):
        flash('Only pending or rejected documents can be deleted.', 'warning')
        return redirect(url_for('doc_bp.upload_docs'))

    # Delete the stored file
    delete_document(doc.r2_object_key)

    # Remove DB record
    db.session.delete(doc)

    # If no documents remain, reset tutor status to pending_documents
    remaining = TutorDocument.query.filter(
        TutorDocument.tutor_id == tutor_id,
        TutorDocument.id != doc_id
    ).count()
    if remaining == 0:
        tutor = Tutor.query.get(tutor_id)
        if tutor and tutor.verification_status in ('documents_submitted', 'revision_required'):
            tutor.verification_status = 'pending_documents'

    db.session.commit()
    flash(f'"{doc.original_filename}" has been deleted.', 'success')
    return redirect(url_for('doc_bp.upload_docs'))


@doc_bp.route('/admin/document/<int:doc_id>/view')
@role_required('admin')
def admin_view_document(doc_id):

    doc = TutorDocument.query.get_or_404(doc_id)
    if doc.file_deleted:
        flash('This document file has been deleted (90-day retention).', 'warning')
        return redirect(url_for('doc_bp.admin_verification_queue'))

    # Download and decrypt from R2
    file_bytes, ext = download_document(doc.r2_object_key, doc.file_encryption_key)
    if not file_bytes:
        flash('Could not retrieve document.', 'danger')
        return redirect(url_for('doc_bp.admin_verification_queue'))

    # Serve the decrypted file to the admin's browser
    mime_map = {'pdf': 'application/pdf', 'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg', 'png': 'image/png'}
    mime = mime_map.get(ext, 'application/octet-stream')

    return send_file(
        BytesIO(file_bytes),
        mimetype=mime,
        as_attachment=False,
        download_name=doc.original_filename
    )


@doc_bp.route('/admin/document/<int:doc_id>/review', methods=['POST'])
@role_required('admin')
def admin_review_document(doc_id):

    doc = TutorDocument.query.get_or_404(doc_id)
    action = request.form.get('action')
    notes = request.form.get('admin_notes', '')

    doc.admin_notes = notes
    doc.reviewed_by = current_user.name
    doc.reviewed_on = datetime.utcnow()

    if action == 'approve':
        doc.status = 'approved'
    elif action == 'reject':
        doc.status = 'rejected'
    elif action == 'revision':
        doc.status = 'revision_required'

    tutor = doc.tutor
    all_docs = TutorDocument.query.filter_by(tutor_id=tutor.id).all()
    all_approved = all_docs and all(d.status == 'approved' for d in all_docs)

    if all_approved:
        tutor.verification_status = 'verified'
        tutor.verified_on = datetime.utcnow()
        tutor.is_profile_complete = True
        # Send approval email
        try:
            from services.email_service import send_email, email_tutor_approved
            subj, html = email_tutor_approved(tutor.name)
            send_email(tutor.email, subj, html, 'tutor_approved', 'tutor')
        except Exception:
            pass
        flash(f'{tutor.name} is now VERIFIED!', 'success')

    elif action == 'reject':
        tutor.verification_status = 'rejected'
        try:
            from services.email_service import send_email, email_tutor_rejected
            subj, html = email_tutor_rejected(tutor.name, notes)
            send_email(tutor.email, subj, html, 'tutor_rejected', 'tutor')
        except Exception:
            pass
        flash(f'{tutor.name} has been rejected.', 'warning')

    elif action == 'revision':
        tutor.verification_status = 'revision_required'
        flash(f'{tutor.name} marked for revision.', 'info')

    db.session.commit()
    return redirect(url_for('doc_bp.admin_verification_queue'))


@doc_bp.route('/admin/verification-queue')
@role_required('admin')
def admin_verification_queue():

    # Get tutors with pending/submitted documents
    pending_tutors = Tutor.query.filter(
        Tutor.verification_status.in_([
            'documents_submitted', 'under_review', 'revision_required'
        ])
    ).order_by(Tutor.created_at.asc()).all()

    # Get all documents grouped by tutor
    tutor_docs = {}
    for tutor in pending_tutors:
        tutor_docs[tutor.id] = TutorDocument.query.filter_by(
            tutor_id=tutor.id
        ).order_by(TutorDocument.uploaded_at.desc()).all()

    return render_template('admin_verification.html',
                           pending_tutors=pending_tutors,
                           tutor_docs=tutor_docs)
