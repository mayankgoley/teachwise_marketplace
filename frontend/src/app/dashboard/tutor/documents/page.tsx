'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Upload,
  Clock,
  Eye,
  AlertCircle,
  CheckCircle,
  FileText,
  Trash2,
  Loader2,
  Send,
} from 'lucide-react'
import { apiGet, apiDelete } from '@/lib/api'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatDate } from '@/lib/format'
import type { TutorDocumentsData } from '@/types/tutor-profile'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

const DOCUMENT_TYPES: { key: string; label: string; description: string }[] = [
  {
    key: 'government_id',
    label: 'Government ID',
    description:
      'A valid government-issued photo ID (passport, driver\'s license)',
  },
  {
    key: 'teaching_certificate',
    label: 'Teaching Certificate',
    description: 'Teaching qualification or relevant certification',
  },
  {
    key: 'background_check',
    label: 'Background Check',
    description: 'Background check authorization form',
  },
]

const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

function getStatusBanner(status: string) {
  switch (status) {
    case 'pending_documents':
      return {
        icon: Upload,
        message:
          'Upload the required documents below to begin the verification process.',
        bg: 'rgba(186,117,23,0.08)',
        border: 'rgba(186,117,23,0.2)',
        text: '#BA7517',
      }
    case 'documents_submitted':
      return {
        icon: Clock,
        message:
          'Your documents are under review. We will notify you once the review is complete.',
        bg: 'rgba(79,142,255,0.08)',
        border: 'rgba(79,142,255,0.2)',
        text: '#4f8eff',
      }
    case 'under_review':
      return {
        icon: Eye,
        message: 'Our team is reviewing your documents.',
        bg: 'rgba(79,142,255,0.08)',
        border: 'rgba(79,142,255,0.2)',
        text: '#4f8eff',
      }
    case 'revision_required':
      return {
        icon: AlertCircle,
        message:
          'Some documents need to be updated. Please check the notes below and re-upload.',
        bg: 'rgba(226,75,74,0.08)',
        border: 'rgba(226,75,74,0.2)',
        text: '#E24B4A',
      }
    case 'verified':
      return {
        icon: CheckCircle,
        message: 'Your account is verified!',
        bg: 'rgba(99,153,34,0.08)',
        border: 'rgba(99,153,34,0.2)',
        text: '#639922',
      }
    case 'rejected':
      return {
        icon: AlertCircle,
        message:
          'Verification was unsuccessful. Please contact support for more information.',
        bg: 'rgba(226,75,74,0.08)',
        border: 'rgba(226,75,74,0.2)',
        text: '#E24B4A',
      }
    default:
      return null
  }
}

export default function TutorDocumentsPage() {
  const [data, setData] = useState<TutorDocumentsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({})
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const fetchData = useCallback(async () => {
    try {
      const res = await apiGet<TutorDocumentsData>('/api/v1/tutor/documents')
      if (res.success) setData(res.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleFileSelect = async (docType: string, file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      alert('Invalid file type. Please upload a PDF, JPG, or PNG file.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      alert('File is too large. Maximum file size is 10 MB.')
      return
    }

    setUploading((prev) => ({ ...prev, [docType]: true }))

    try {
      const formData = new FormData()
      formData.append('document_type', docType)
      formData.append('file', file)
      const expiry = expiryDates[docType]
      if (expiry) formData.append('expiry_date', expiry)

      const res = await fetch(`${BASE}/api/v1/tutor/documents`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      const json = await res.json()
      if (json.success) {
        setExpiryDates((prev) => {
          const next = { ...prev }
          delete next[docType]
          return next
        })
        await fetchData()
      } else {
        alert(json.error?.message ?? 'Upload failed. Please try again.')
      }
    } catch {
      alert('Upload failed. Please check your connection and try again.')
    } finally {
      setUploading((prev) => ({ ...prev, [docType]: false }))
    }
  }

  const handleDelete = async (docId: number) => {
    if (!confirm('Are you sure you want to delete this document?')) return
    try {
      const res = await apiDelete('/api/v1/tutor/documents/' + docId)
      if (res.success) await fetchData()
    } catch {
      alert('Failed to delete document.')
    }
  }

  const handleSubmitForReview = async () => {
    if (
      !confirm(
        'Once submitted, you cannot add or change documents until the review is complete. Continue?'
      )
    )
      return

    setSubmitting(true)
    try {
      const res = await fetch(
        `${BASE}/api/v1/tutor/documents/submit-for-review`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        }
      )
      const json = await res.json()
      if (json.success) {
        await fetchData()
      } else {
        alert(json.error?.message ?? 'Submission failed. Please try again.')
      }
    } catch {
      alert('Submission failed. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2
          size={28}
          strokeWidth={1.5}
          className="animate-spin"
          style={{ color: 'var(--accent)' }}
        />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          Failed to load documents. Please refresh the page.
        </p>
      </div>
    )
  }

  const banner = getStatusBanner(data.verification_status)

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1
          className="font-head font-bold text-[var(--text)]"
          style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
        >
          Verification Documents
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Upload required documents to verify your account
        </p>
      </div>

      {/* Status Banner */}
      {banner && (
        <div
          style={{
            background: banner.bg,
            border: `1px solid ${banner.border}`,
            borderRadius: 16,
            padding: '16px 20px',
            display: 'flex',
            gap: 12,
            marginBottom: 24,
            alignItems: 'flex-start',
          }}
        >
          <banner.icon
            size={20}
            strokeWidth={1.5}
            style={{ color: banner.text, flexShrink: 0, marginTop: 2 }}
          />
          <p
            style={{
              margin: 0,
              color: banner.text,
              fontSize: '0.88rem',
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            {banner.message}
          </p>
        </div>
      )}

      {/* Document Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {DOCUMENT_TYPES.map((docType) => {
          const doc = data.documents.find(
            (d) => d.document_type === docType.key
          )
          const isUploading = uploading[docType.key] ?? false

          return (
            <div
              key={docType.key}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                padding: 20,
              }}
            >
              {/* Type header */}
              <div style={{ marginBottom: 12 }}>
                <h3
                  className="text-[var(--text)]"
                  style={{
                    margin: '0 0 4px',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                  }}
                >
                  {docType.label}
                </h3>
                <p
                  style={{
                    margin: 0,
                    color: 'var(--muted)',
                    fontSize: '0.82rem',
                  }}
                >
                  {docType.description}
                </p>
              </div>

              {doc ? (
                /* Uploaded document */
                <div>
                  <div
                    className="flex items-center justify-between"
                    style={{ gap: 12 }}
                  >
                    <div
                      className="flex items-center"
                      style={{ gap: 10, minWidth: 0 }}
                    >
                      <FileText
                        size={18}
                        strokeWidth={1.5}
                        style={{
                          color: 'var(--accent)',
                          flexShrink: 0,
                        }}
                      />
                      <span
                        className="text-[var(--text)]"
                        style={{
                          fontSize: '0.85rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {doc.original_filename}
                      </span>
                      <StatusBadge status={doc.status} />
                    </div>

                    {doc.status === 'pending' && (
                      <button
                        onClick={() => handleDelete(doc.id)}
                        style={{
                          background: 'rgba(226,75,74,0.08)',
                          color: '#E24B4A',
                          borderRadius: 8,
                          padding: '6px 12px',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          flexShrink: 0,
                        }}
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                        Delete
                      </button>
                    )}
                  </div>

                  {doc.rejection_reason && (
                    <p
                      style={{
                        margin: '10px 0 0',
                        color: '#E24B4A',
                        fontSize: '0.82rem',
                        lineHeight: 1.5,
                      }}
                    >
                      {doc.rejection_reason}
                    </p>
                  )}

                  {doc.expiry_date && (
                    <p
                      style={{
                        margin: '8px 0 0',
                        color: 'var(--muted)',
                        fontSize: '0.8rem',
                      }}
                    >
                      Expires: {formatDate(doc.expiry_date)}
                    </p>
                  )}
                </div>
              ) : (
                /* Upload dropzone */
                <div>
                  <input
                    ref={(el) => {
                      fileInputRefs.current[docType.key] = el
                    }}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileSelect(docType.key, file)
                      e.target.value = ''
                    }}
                  />

                  <div
                    onClick={() => {
                      if (!isUploading)
                        fileInputRefs.current[docType.key]?.click()
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (isUploading) return
                      const file = e.dataTransfer.files?.[0]
                      if (file) handleFileSelect(docType.key, file)
                    }}
                    style={{
                      border: '2px dashed var(--border)',
                      borderRadius: 12,
                      padding: 32,
                      textAlign: 'center',
                      cursor: isUploading ? 'default' : 'pointer',
                      transition: 'border-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isUploading)
                        (e.currentTarget as HTMLDivElement).style.borderColor =
                          'var(--accent)'
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor =
                        'var(--border)'
                    }}
                  >
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2
                          size={24}
                          strokeWidth={1.5}
                          className="animate-spin"
                          style={{ color: 'var(--accent)' }}
                        />
                        <p
                          style={{
                            margin: 0,
                            color: 'var(--muted)',
                            fontSize: '0.85rem',
                          }}
                        >
                          Uploading...
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload
                          size={24}
                          strokeWidth={1.5}
                          style={{ color: 'var(--muted)' }}
                        />
                        <p
                          style={{
                            margin: 0,
                            color: 'var(--text)',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                          }}
                        >
                          Click to upload or drag and drop
                        </p>
                        <p
                          style={{
                            margin: 0,
                            color: 'var(--muted)',
                            fontSize: '0.78rem',
                          }}
                        >
                          PDF, JPG, or PNG (max 10 MB)
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Optional expiry date */}
                  <div
                    style={{
                      marginTop: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <label
                      style={{
                        color: 'var(--muted)',
                        fontSize: '0.8rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Expiry date (optional):
                    </label>
                    <input
                      type="date"
                      value={expiryDates[docType.key] ?? ''}
                      onChange={(e) =>
                        setExpiryDates((prev) => ({
                          ...prev,
                          [docType.key]: e.target.value,
                        }))
                      }
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '6px 10px',
                        color: 'var(--text)',
                        fontSize: '0.82rem',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Submit for Review */}
      {data.can_submit_for_review && (
        <button
          onClick={handleSubmitForReview}
          disabled={submitting}
          style={{
            marginTop: 24,
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            color: '#fff',
            borderRadius: 100,
            padding: 14,
            width: '100%',
            fontSize: '0.9rem',
            fontWeight: 600,
            border: 'none',
            cursor: submitting ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: submitting ? 0.7 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          {submitting ? (
            <Loader2
              size={18}
              strokeWidth={1.5}
              className="animate-spin"
            />
          ) : (
            <Send size={18} strokeWidth={1.5} />
          )}
          {submitting ? 'Submitting...' : 'Submit for Review'}
        </button>
      )}
    </div>
  )
}
