import os
import hashlib
import uuid
from cryptography.fernet import Fernet
from flask import current_app
from services.encryption_service import encrypt_field, decrypt_field


def _use_local_storage():
    endpoint = current_app.config.get('R2_ENDPOINT_URL', '')
    access_key = current_app.config.get('R2_ACCESS_KEY_ID', '')
    if not endpoint or '<' in endpoint or not access_key or access_key.startswith('your-'):
        return True
    return False


def _local_docs_dir():
    path = os.path.join(current_app.config['UPLOAD_FOLDER'], 'documents')
    os.makedirs(path, exist_ok=True)
    return path


def _get_r2_client():
    import boto3
    return boto3.client(
        's3',
        endpoint_url=current_app.config['R2_ENDPOINT_URL'],
        aws_access_key_id=current_app.config['R2_ACCESS_KEY_ID'],
        aws_secret_access_key=current_app.config['R2_SECRET_ACCESS_KEY'],
        region_name='auto'
    )


def upload_public_file(file_data, path, content_type):
    try:
        if _use_local_storage():
            local_dir = os.path.join(
                current_app.static_folder, 'uploads',
                os.path.dirname(path))
            os.makedirs(local_dir, exist_ok=True)
            local_path = os.path.join(current_app.static_folder, 'uploads', path)
            with open(local_path, 'wb') as f:
                f.write(file_data)
            return f'/static/uploads/{path}'
        else:
            client = _get_r2_client()
            bucket = current_app.config['R2_BUCKET_NAME']
            client.put_object(
                Bucket=bucket,
                Key=path,
                Body=file_data,
                ContentType=content_type
            )
            public_url = current_app.config.get('R2_PUBLIC_URL', '')
            if public_url:
                return f'{public_url.rstrip("/")}/{path}'
            return f'{current_app.config["R2_ENDPOINT_URL"]}/{bucket}/{path}'
    except Exception as e:
        current_app.logger.error(f'Public upload failed for {path}: {e}')
        return None


def delete_public_file(path):
    try:
        if _use_local_storage():
            local_path = os.path.join(current_app.static_folder, 'uploads', path)
            if os.path.exists(local_path):
                os.remove(local_path)
            return True
        else:
            client = _get_r2_client()
            bucket = current_app.config['R2_BUCKET_NAME']
            client.delete_object(Bucket=bucket, Key=path)
            return True
    except Exception as e:
        current_app.logger.error(f'Public delete failed for {path}: {e}')
        return False


def upload_document(file_bytes, tutor_id, original_filename):
    try:
        file_hash = hashlib.sha256(file_bytes).hexdigest()

        file_key = Fernet.generate_key()
        cipher = Fernet(file_key)

        encrypted_bytes = cipher.encrypt(file_bytes)

        encrypted_file_key = encrypt_field(file_key.decode())

        ext = original_filename.rsplit('.', 1)[-1] if '.' in original_filename else 'bin'
        object_key = f'documents/{tutor_id}/{uuid.uuid4().hex}.{ext}.enc'

        if _use_local_storage():
            dest_dir = os.path.join(_local_docs_dir(), str(tutor_id))
            os.makedirs(dest_dir, exist_ok=True)
            dest_path = os.path.join(_local_docs_dir(), f'{tutor_id}',
                                     os.path.basename(object_key.split('/')[-1]))
            with open(dest_path, 'wb') as f:
                f.write(encrypted_bytes)
            object_key = dest_path
        else:
            client = _get_r2_client()
            bucket = current_app.config['R2_BUCKET_NAME']
            client.put_object(
                Bucket=bucket,
                Key=object_key,
                Body=encrypted_bytes,
                ContentType='application/octet-stream'
            )

        return {
            'r2_object_key': object_key,
            'file_encryption_key': encrypted_file_key,
            'verification_hash': file_hash,
            'file_size_bytes': len(file_bytes),
        }

    except Exception as e:
        current_app.logger.error(f'Upload failed for tutor {tutor_id}: {e}')
        return None


def download_document(r2_object_key, encrypted_file_key):
    try:
        if _use_local_storage():
            with open(r2_object_key, 'rb') as f:
                encrypted_bytes = f.read()
        else:
            client = _get_r2_client()
            bucket = current_app.config['R2_BUCKET_NAME']
            response = client.get_object(Bucket=bucket, Key=r2_object_key)
            encrypted_bytes = response['Body'].read()

        file_key = decrypt_field(encrypted_file_key)
        if file_key == '[decryption failed]':
            return None, None

        cipher = Fernet(file_key.encode())
        decrypted_bytes = cipher.decrypt(encrypted_bytes)

        parts = r2_object_key.rsplit('.', 2)
        ext = parts[-2] if len(parts) >= 3 else 'bin'

        return decrypted_bytes, ext

    except Exception as e:
        current_app.logger.error(f'Download failed: {r2_object_key}: {e}')
        return None, None


def delete_document(r2_object_key):
    try:
        if _use_local_storage():
            if os.path.exists(r2_object_key):
                os.remove(r2_object_key)
            return True
        else:
            client = _get_r2_client()
            bucket = current_app.config['R2_BUCKET_NAME']
            client.delete_object(Bucket=bucket, Key=r2_object_key)
            return True
    except Exception as e:
        current_app.logger.error(f'Delete failed: {r2_object_key}: {e}')
        return False
