'use client'

import { useCallback, useRef, useState } from 'react'
import { Loader2, Upload, X, FileText } from 'lucide-react'
import { apiPost } from '@/lib/api'

type UploadUrlResp = {
  object_key: string
  upload_url: string | null
  uploader_role: 'tutor' | 'student'
  file_name: string
  content_type: string
  size_bytes: number
  expires_in: number
  allowed_extensions: string[]
  fallback_endpoint: string | null
}

type AttachedFile = {
  name: string
  key: string
  content_type: string
  size: number
}

interface Props {
  assignmentId: number
  onChange?: (files: AttachedFile[]) => void
  initialFiles?: AttachedFile[]
  disabled?: boolean
}

// Per-file flow:
//  1. POST /api/v1/assignments/<id>/upload-url to get a presigned PUT URL.
//  2. PUT the bytes directly to MinIO/R2 (browser to object store).
//  3. POST /api/v1/assignments/<id>/attach to record the file server-side.
//
// If upload_url is null (object store not configured), falls back to
// queuing the file for multipart submission; the caller handles that path.
export default function PresignedAssignmentUploader({
  assignmentId,
  onChange,
  initialFiles = [],
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [files, setFiles] = useState<AttachedFile[]>(initialFiles)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [fallbackPending, setFallbackPending] = useState<File[]>([])

  const handleSelect = useCallback(
    async (selected: File[]) => {
      if (!selected.length) return
      setError(null)
      setUploading(true)

      const succeeded: AttachedFile[] = []
      const fallback: File[] = []

      for (const f of selected) {
        try {
          const presignRes = await apiPost<UploadUrlResp>(
            `/api/v1/assignments/${assignmentId}/upload-url`,
            {
              file_name: f.name,
              content_type: f.type || 'application/octet-stream',
              size_bytes: f.size,
            }
          )
          if (!presignRes.success) {
            setError(presignRes.error?.message ?? 'Upload-URL request failed')
            continue
          }
          const { upload_url, object_key, content_type } = presignRes.data

          if (!upload_url) {
            fallback.push(f)
            continue
          }

          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhr.open('PUT', upload_url, true)
            xhr.setRequestHeader('Content-Type', content_type)
            xhr.upload.onprogress = (ev) => {
              if (ev.lengthComputable) {
                setProgress((p) => ({
                  ...p,
                  [f.name]: Math.round((ev.loaded / ev.total) * 100),
                }))
              }
            }
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) resolve()
              else reject(new Error(`PUT ${xhr.status}`))
            }
            xhr.onerror = () => reject(new Error('Network error during upload'))
            xhr.send(f)
          })

          const attachRes = await apiPost<{
            attached_to: string
            file: AttachedFile
          }>(`/api/v1/assignments/${assignmentId}/attach`, {
            object_key,
            file_name: f.name,
            content_type,
            size_bytes: f.size,
          })
          if (attachRes.success) {
            succeeded.push(attachRes.data.file)
          } else {
            setError(attachRes.error?.message ?? 'Attach failed')
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Upload failed')
        }
      }

      setUploading(false)
      if (succeeded.length) {
        const next = [...files, ...succeeded]
        setFiles(next)
        onChange?.(next)
      }
      if (fallback.length) {
        setFallbackPending((prev) => [...prev, ...fallback])
      }
      if (inputRef.current) inputRef.current.value = ''
    },
    [assignmentId, files, onChange]
  )

  const remove = (key: string) => {
    const next = files.filter((f) => f.key !== key)
    setFiles(next)
    onChange?.(next)
  }

  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: '0.82rem',
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: '8px',
        }}
      >
        Attach files
      </label>
      <div
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px dashed var(--border)',
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          disabled={disabled || uploading}
          onChange={(e) => {
            const list = Array.from(e.target.files ?? [])
            handleSelect(list)
          }}
          style={{ display: 'none' }}
          id={`assignment-uploader-${assignmentId}`}
        />
        <label
          htmlFor={`assignment-uploader-${assignmentId}`}
          className="inline-flex items-center gap-2"
          style={{
            background: uploading
              ? 'var(--border)'
              : 'linear-gradient(135deg, var(--accent), var(--accent2))',
            color: '#fff',
            padding: '8px 18px',
            borderRadius: '100px',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: uploading || disabled ? 'not-allowed' : 'pointer',
            opacity: uploading || disabled ? 0.6 : 1,
          }}
        >
          {uploading ? (
            <>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              <Loader2
                size={14}
                strokeWidth={1.5}
                style={{ animation: 'spin 1s linear infinite' }}
              />
              Uploading...
            </>
          ) : (
            <>
              <Upload size={14} strokeWidth={1.5} />
              Choose Files
            </>
          )}
        </label>
        <p
          style={{
            fontSize: '0.75rem',
            color: 'var(--muted)',
            margin: '12px 0 0',
          }}
        >
          PDF, images, docx, txt, md, py, ipynb · max 25 MB each
        </p>
      </div>

      {error && (
        <p style={{ color: '#E24B4A', fontSize: '0.82rem', margin: '8px 0 0' }}>
          {error}
        </p>
      )}

      {files.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '12px 0 0',
          }}
        >
          {files.map((f) => (
            <li
              key={f.key}
              className="flex items-center gap-2"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '8px 12px',
                marginBottom: '6px',
                fontSize: '0.82rem',
                color: 'var(--text)',
              }}
            >
              <FileText size={14} strokeWidth={1.5} color="var(--muted)" />
              <span style={{ flex: 1, minWidth: 0 }}>{f.name}</span>
              <span style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>
                {(f.size / 1024).toFixed(0)} KB
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(f.key)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--muted)',
                    padding: 4,
                  }}
                  aria-label={`Remove ${f.name}`}
                >
                  <X size={14} strokeWidth={1.5} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {uploading && Object.keys(progress).length > 0 && (
        <div style={{ marginTop: '8px' }}>
          {Object.entries(progress).map(([name, pct]) => (
            <div key={name} style={{ marginBottom: '6px' }}>
              <div
                className="flex items-center justify-between"
                style={{ fontSize: '0.72rem', color: 'var(--muted)' }}
              >
                <span>{name}</span>
                <span>{pct}%</span>
              </div>
              <div
                style={{
                  height: '4px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '100px',
                  overflow: 'hidden',
                  marginTop: '4px',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: 'var(--accent)',
                    transition: 'width 0.2s',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {fallbackPending.length > 0 && (
        <p
          style={{
            color: '#BA7517',
            fontSize: '0.78rem',
            margin: '8px 0 0',
          }}
        >
          {fallbackPending.length} file(s) queued for multipart upload via the
          submit form (R2 presigned upload is not configured server-side).
        </p>
      )}
    </div>
  )
}

export type { AttachedFile }
