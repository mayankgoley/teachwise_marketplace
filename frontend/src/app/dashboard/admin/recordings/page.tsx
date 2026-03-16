'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Video,
  Shield,
  Loader2,
  Play,
  Trash2,
  AlertCircle,
} from 'lucide-react'
import { apiGet } from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatDate } from '@/lib/format'
import type { AdminRecording } from '@/types/tutor-profile'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

export default function AdminRecordingsPage() {
  const [recordings, setRecordings] = useState<AdminRecording[]>([])
  const [loading, setLoading] = useState(true)

  // Access modal state
  const [accessModal, setAccessModal] = useState<{
    recording: AdminRecording
    reason: string
    submitting: boolean
    videoUrl: string | null
    error: string | null
  } | null>(null)

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchRecordings = useCallback(async () => {
    try {
      const res = await apiGet<{ recordings: AdminRecording[] }>(
        '/api/v1/admin/recordings'
      )
      if (res.success) {
        setRecordings(res.data.recordings)
      }
    } catch {
      // Silently fail, user can refresh
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRecordings()
  }, [fetchRecordings])

  const handleAccessRecording = async () => {
    if (!accessModal || accessModal.reason.trim().length < 20) return
    setAccessModal((prev) => (prev ? { ...prev, submitting: true, error: null } : null))

    try {
      const res = await fetch(
        `${BASE}/api/v1/admin/recordings/${accessModal.recording.id}/access?reason=${encodeURIComponent(accessModal.reason.trim())}`,
        { credentials: 'include' }
      )
      const json = await res.json()
      if (json.success && json.data?.url) {
        setAccessModal((prev) =>
          prev ? { ...prev, submitting: false, videoUrl: json.data.url } : null
        )
      } else {
        setAccessModal((prev) =>
          prev
            ? {
                ...prev,
                submitting: false,
                error: json.error?.message ?? 'Failed to access recording.',
              }
            : null
        )
      }
    } catch {
      setAccessModal((prev) =>
        prev
          ? { ...prev, submitting: false, error: 'Network error. Please try again.' }
          : null
      )
    }
  }

  const handleDelete = async (id: number) => {
    setDeleteLoading(true)
    try {
      await fetch(`${BASE}/api/v1/admin/recordings/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      setDeleteId(null)
      await fetchRecordings()
    } catch {
      // Delete failed
    } finally {
      setDeleteLoading(false)
    }
  }

  const getConsentLabel = (rec: AdminRecording) => {
    if (rec.student_consent && rec.tutor_consent) return 'both'
    return 'partial'
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <Loader2
          size={32}
          strokeWidth={1.5}
          style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }}
        />
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '16px' }}>
          Loading recordings...
        </p>
      </div>
    )
  }

  return (
    <div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Page header */}
      <div
        className="flex items-center gap-3 flex-wrap"
        style={{ marginBottom: 20 }}
      >
        <h1
          className="font-head font-bold text-[var(--text)]"
          style={{ fontSize: '1.8rem', margin: 0 }}
        >
          Session Recordings
        </h1>
        <span
          style={{
            padding: '4px 12px',
            borderRadius: '100px',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: 'rgba(79,142,255,0.15)',
            color: '#4f8eff',
          }}
        >
          {recordings.length} total
        </span>
      </div>

      {/* Restricted access banner */}
      <div
        className="flex items-start gap-3"
        style={{
          background: 'rgba(226,75,74,0.08)',
          border: '1px solid rgba(226,75,74,0.2)',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 24,
        }}
      >
        <Shield
          size={20}
          strokeWidth={1.5}
          style={{ color: '#E24B4A', flexShrink: 0, marginTop: 2 }}
        />
        <div>
          <p
            style={{
              color: '#E24B4A',
              fontSize: '0.88rem',
              fontWeight: 700,
              margin: '0 0 4px',
            }}
          >
            Restricted Access &mdash; Admin Only
          </p>
          <p
            style={{
              color: 'var(--muted)',
              fontSize: '0.82rem',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Session recordings are confidential. All access is logged in the audit trail.
            Only access recordings when there is a legitimate operational or safety reason.
          </p>
        </div>
      </div>

      {/* Recordings list */}
      {recordings.length === 0 ? (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 20,
          }}
        >
          <EmptyState
            icon={<Video size={22} strokeWidth={1.5} />}
            title="No recordings"
            description="There are no session recordings available."
          />
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: 0 }}>
          {recordings.map((rec) => {
            const consent = getConsentLabel(rec)
            const isExpired = rec.is_expired

            return (
              <div
                key={rec.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 16,
                  padding: 20,
                  marginBottom: 12,
                  opacity: isExpired ? 0.5 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                <div className="flex items-start gap-4 flex-wrap">
                  {/* Main info */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    {/* Names row */}
                    <div
                      className="flex items-center gap-2 flex-wrap"
                      style={{ marginBottom: 6 }}
                    >
                      <h3
                        className="font-head font-bold text-[var(--text)]"
                        style={{ fontSize: '0.95rem', margin: 0 }}
                      >
                        {rec.tutor_name}
                      </h3>
                      <span
                        style={{
                          color: 'var(--muted)',
                          fontSize: '0.82rem',
                        }}
                      >
                        &rarr;
                      </span>
                      <span
                        style={{
                          color: 'var(--text)',
                          fontSize: '0.92rem',
                          fontWeight: 500,
                        }}
                      >
                        {rec.student_name}
                      </span>
                    </div>

                    {/* Subject */}
                    {rec.subject && (
                      <p
                        style={{
                          color: 'var(--muted)',
                          fontSize: '0.82rem',
                          margin: '0 0 8px',
                        }}
                      >
                        {rec.subject}
                      </p>
                    )}

                    {/* Meta row */}
                    <div
                      className="flex items-center gap-4 flex-wrap"
                      style={{ fontSize: '0.8rem' }}
                    >
                      {rec.session_date && (
                        <span style={{ color: 'var(--text)' }}>
                          {formatDate(rec.session_date)}
                        </span>
                      )}
                      {rec.duration_minutes != null && (
                        <span style={{ color: 'var(--muted)' }}>
                          {rec.duration_minutes} min
                        </span>
                      )}
                      {rec.quality && (
                        <StatusBadge status={rec.quality} />
                      )}
                      {rec.file_size_mb != null && (
                        <span style={{ color: 'var(--muted)' }}>
                          {rec.file_size_mb.toFixed(1)} MB
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right side: consent + expiry + actions */}
                  <div
                    className="flex items-center gap-3 flex-wrap"
                    style={{ flexShrink: 0 }}
                  >
                    {/* Consent badge */}
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '100px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        background:
                          consent === 'both'
                            ? 'rgba(99,153,34,0.15)'
                            : 'rgba(186,117,23,0.15)',
                        color: consent === 'both' ? '#639922' : '#BA7517',
                      }}
                    >
                      {consent === 'both' ? 'Both consented' : 'Partial'}
                    </span>

                    {/* Expired badge */}
                    {isExpired && (
                      <StatusBadge status="cancelled" />
                    )}

                    {/* Expiry date */}
                    {rec.expires_at && !isExpired && (
                      <span
                        style={{
                          color: 'var(--muted)',
                          fontSize: '0.72rem',
                        }}
                      >
                        Expires {formatDate(rec.expires_at)}
                      </span>
                    )}

                    {/* Access button */}
                    {!isExpired && consent === 'both' && (
                      <button
                        onClick={() =>
                          setAccessModal({
                            recording: rec,
                            reason: '',
                            submitting: false,
                            videoUrl: null,
                            error: null,
                          })
                        }
                        className="flex items-center gap-1.5"
                        style={{
                          padding: '6px 16px',
                          borderRadius: '100px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          border: 'none',
                          background:
                            'linear-gradient(135deg, var(--accent), var(--accent2))',
                          color: '#fff',
                          cursor: 'pointer',
                          transition: 'opacity 0.2s',
                        }}
                      >
                        <Play size={13} strokeWidth={1.5} />
                        Access Recording
                      </button>
                    )}

                    {/* Delete button */}
                    <button
                      onClick={() => setDeleteId(rec.id)}
                      className="flex items-center gap-1"
                      style={{
                        padding: '6px 12px',
                        borderRadius: '100px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        border: '1px solid rgba(226,75,74,0.3)',
                        background: 'transparent',
                        color: '#E24B4A',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <Trash2 size={13} strokeWidth={1.5} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteId !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => {
            if (!deleteLoading) setDeleteId(null)
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              borderRadius: 20,
              padding: 32,
              maxWidth: 440,
              width: '100%',
            }}
          >
            <div
              className="flex items-center gap-3"
              style={{ marginBottom: 16 }}
            >
              <AlertCircle size={22} strokeWidth={1.5} color="#E24B4A" />
              <h2
                className="font-head font-bold text-[var(--text)]"
                style={{ fontSize: '1.2rem', margin: 0 }}
              >
                Delete Recording?
              </h2>
            </div>
            <p
              style={{
                color: 'var(--muted)',
                fontSize: '0.88rem',
                margin: '0 0 24px',
                lineHeight: 1.6,
              }}
            >
              This action is permanent and cannot be undone. The recording will
              be removed from storage.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleDelete(deleteId)}
                disabled={deleteLoading}
                className="flex items-center gap-2"
                style={{
                  padding: '10px 24px',
                  borderRadius: '100px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  border: 'none',
                  background: '#E24B4A',
                  color: '#fff',
                  cursor: deleteLoading ? 'not-allowed' : 'pointer',
                  opacity: deleteLoading ? 0.6 : 1,
                  transition: 'all 0.2s',
                }}
              >
                {deleteLoading ? (
                  <>
                    <Loader2
                      size={15}
                      strokeWidth={1.5}
                      style={{ animation: 'spin 1s linear infinite' }}
                    />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={15} strokeWidth={1.5} />
                    Delete Permanently
                  </>
                )}
              </button>
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleteLoading}
                style={{
                  padding: '10px 24px',
                  borderRadius: '100px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--muted)',
                  cursor: deleteLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Access recording modal */}
      {accessModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => {
            if (!accessModal.submitting) setAccessModal(null)
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              borderRadius: 20,
              padding: 32,
              maxWidth: 640,
              width: '100%',
            }}
          >
            {/* Video player view */}
            {accessModal.videoUrl ? (
              <>
                <h2
                  className="font-head font-bold text-[var(--text)]"
                  style={{ fontSize: '1.2rem', margin: '0 0 16px' }}
                >
                  Session Recording
                </h2>

                <video
                  controls
                  autoPlay
                  style={{
                    width: '100%',
                    borderRadius: 12,
                    background: '#000',
                    marginBottom: 16,
                  }}
                >
                  <source src={accessModal.videoUrl} />
                  Your browser does not support the video tag.
                </video>

                <p
                  style={{
                    color: 'var(--muted)',
                    fontSize: '0.78rem',
                    margin: '0 0 20px',
                    lineHeight: 1.5,
                  }}
                >
                  This link expires in 4 hours. Do not share this URL.
                </p>

                <button
                  onClick={() => setAccessModal(null)}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '100px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  Close
                </button>
              </>
            ) : (
              <>
                {/* Access reason form */}
                <div
                  className="flex items-center gap-3"
                  style={{ marginBottom: 16 }}
                >
                  <Shield size={22} strokeWidth={1.5} color="#E24B4A" />
                  <h2
                    className="font-head font-bold text-[var(--text)]"
                    style={{ fontSize: '1.2rem', margin: 0 }}
                  >
                    Access Recording
                  </h2>
                </div>

                {/* Warning */}
                <div
                  className="flex items-center gap-2"
                  style={{
                    background: 'rgba(186,117,23,0.08)',
                    border: '1px solid rgba(186,117,23,0.2)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    marginBottom: 20,
                  }}
                >
                  <AlertCircle
                    size={16}
                    strokeWidth={1.5}
                    style={{ color: '#BA7517', flexShrink: 0 }}
                  />
                  <p
                    style={{
                      color: '#BA7517',
                      fontSize: '0.82rem',
                      margin: 0,
                      fontWeight: 500,
                    }}
                  >
                    This access will be logged in the audit trail.
                  </p>
                </div>

                {/* Recording info */}
                <div
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--text)',
                    marginBottom: 20,
                  }}
                >
                  <p style={{ margin: '0 0 4px' }}>
                    <span style={{ color: 'var(--muted)' }}>Tutor:</span>{' '}
                    {accessModal.recording.tutor_name}
                  </p>
                  <p style={{ margin: '0 0 4px' }}>
                    <span style={{ color: 'var(--muted)' }}>Student:</span>{' '}
                    {accessModal.recording.student_name}
                  </p>
                  {accessModal.recording.session_date && (
                    <p style={{ margin: 0 }}>
                      <span style={{ color: 'var(--muted)' }}>Date:</span>{' '}
                      {formatDate(accessModal.recording.session_date)}
                    </p>
                  )}
                </div>

                {/* Reason textarea */}
                <label
                  style={{
                    display: 'block',
                    color: 'var(--muted)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    marginBottom: 8,
                  }}
                >
                  Why are you accessing this recording?{' '}
                  <span style={{ color: '#E24B4A' }}>*</span>
                </label>
                <textarea
                  value={accessModal.reason}
                  onChange={(e) =>
                    setAccessModal((prev) =>
                      prev ? { ...prev, reason: e.target.value } : null
                    )
                  }
                  placeholder="Provide a reason (minimum 20 characters)..."
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    resize: 'vertical',
                    minHeight: 90,
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
                <p
                  style={{
                    color:
                      accessModal.reason.trim().length >= 20
                        ? '#639922'
                        : 'var(--muted)',
                    fontSize: '0.72rem',
                    margin: '6px 0 0',
                    textAlign: 'right',
                  }}
                >
                  {accessModal.reason.trim().length}/20 characters minimum
                </p>

                {/* Error */}
                {accessModal.error && (
                  <p
                    style={{
                      color: '#E24B4A',
                      fontSize: '0.85rem',
                      margin: '12px 0 0',
                    }}
                  >
                    {accessModal.error}
                  </p>
                )}

                {/* Action buttons */}
                <div
                  className="flex items-center gap-3"
                  style={{ marginTop: 20 }}
                >
                  <button
                    onClick={handleAccessRecording}
                    disabled={
                      accessModal.reason.trim().length < 20 ||
                      accessModal.submitting
                    }
                    className="flex items-center gap-2"
                    style={{
                      padding: '10px 24px',
                      borderRadius: '100px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      border: 'none',
                      background:
                        'linear-gradient(135deg, var(--accent), var(--accent2))',
                      color: '#fff',
                      cursor:
                        accessModal.reason.trim().length < 20 ||
                        accessModal.submitting
                          ? 'not-allowed'
                          : 'pointer',
                      opacity:
                        accessModal.reason.trim().length < 20 ||
                        accessModal.submitting
                          ? 0.5
                          : 1,
                      transition: 'all 0.2s',
                    }}
                  >
                    {accessModal.submitting ? (
                      <>
                        <Loader2
                          size={15}
                          strokeWidth={1.5}
                          style={{ animation: 'spin 1s linear infinite' }}
                        />
                        Accessing...
                      </>
                    ) : (
                      <>
                        <Play size={15} strokeWidth={1.5} />
                        Confirm Access
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setAccessModal(null)}
                    disabled={accessModal.submitting}
                    style={{
                      padding: '10px 24px',
                      borderRadius: '100px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--muted)',
                      cursor: accessModal.submitting
                        ? 'not-allowed'
                        : 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
