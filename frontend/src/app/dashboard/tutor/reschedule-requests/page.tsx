'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  CalendarDays,
  Loader2,
  Check,
  X,
} from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate, formatTime, formatRelativeTime } from '@/lib/format'
import type { RescheduleRequest } from '@/types/tutor-profile'

export default function TutorRescheduleRequestsPage() {
  const [requests, setRequests] = useState<RescheduleRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [declineId, setDeclineId] = useState<number | null>(null)
  const [declineReason, setDeclineReason] = useState('')

  const fetchRequests = useCallback(async () => {
    try {
      const res = await apiGet<{ requests: RescheduleRequest[] }>(
        '/api/v1/tutor/reschedule-requests'
      )
      if (res.success) {
        setRequests(res.data.requests)
      }
    } catch {
      // Silently fail, user can refresh
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleAccept = async (request: RescheduleRequest) => {
    const confirmed = window.confirm(
      `Accept reschedule request from ${request.student_name}? The booking will be moved to ${formatDate(request.proposed_date)} at ${formatTime(request.proposed_start_time)}.`
    )
    if (!confirmed) return

    setActionLoading(request.id)
    try {
      await apiPost(
        `/api/v1/bookings/${request.booking_id}/reschedule/${request.id}/approve`
      )
      setRequests((prev) => prev.filter((r) => r.id !== request.id))
    } catch {
      // Action failed
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeclineSubmit = async (request: RescheduleRequest) => {
    setActionLoading(request.id)
    try {
      await apiPost(
        `/api/v1/bookings/${request.booking_id}/reschedule/${request.id}/reject`,
        { reason: declineReason.trim() || undefined }
      )
      setRequests((prev) => prev.filter((r) => r.id !== request.id))
      setDeclineId(null)
      setDeclineReason('')
    } catch {
      // Action failed
    } finally {
      setActionLoading(null)
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length

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
          Loading reschedule requests...
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div
        className="flex items-center gap-3 flex-wrap"
        style={{ marginBottom: 24 }}
      >
        <h1
          className="font-head font-bold text-[var(--text)]"
          style={{ fontSize: '1.8rem', margin: 0 }}
        >
          Reschedule Requests
        </h1>
        {pendingCount > 0 && (
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
            {pendingCount} pending
          </span>
        )}
      </div>

      {/* Empty state */}
      {requests.length === 0 ? (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
          }}
        >
          <EmptyState
            icon={<RefreshCw size={22} strokeWidth={1.5} />}
            title="No pending requests"
            description="You have no reschedule requests from students at this time."
          />
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: '0' }}>
          {requests.map((request) => {
            const isLoading = actionLoading === request.id
            const isShowingDecline = declineId === request.id

            return (
              <div
                key={request.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid rgba(79,142,255,0.25)',
                  borderRadius: 16,
                  padding: 20,
                  marginBottom: 16,
                }}
              >
                {/* Top row: student name + expires */}
                <div
                  className="flex items-center justify-between flex-wrap"
                  style={{ marginBottom: 12, gap: 8 }}
                >
                  <h3
                    className="font-head font-bold text-[var(--text)]"
                    style={{ fontSize: '1.05rem', margin: 0 }}
                  >
                    {request.student_name}
                  </h3>
                  <span
                    style={{
                      color: 'var(--muted)',
                      fontSize: '0.78rem',
                    }}
                  >
                    Expires {formatRelativeTime(request.expires_at)}
                  </span>
                </div>

                {/* Subject */}
                <p
                  style={{
                    color: 'var(--muted)',
                    fontSize: '0.88rem',
                    margin: '0 0 14px',
                  }}
                >
                  {request.subject}
                </p>

                {/* Current slot */}
                <div
                  className="flex items-center gap-2"
                  style={{ marginBottom: 8 }}
                >
                  <CalendarDays
                    size={15}
                    strokeWidth={1.5}
                    style={{ color: 'var(--muted)' }}
                  />
                  <span
                    style={{
                      color: 'var(--text)',
                      fontSize: '0.85rem',
                    }}
                  >
                    {formatDate(request.original_date)} at{' '}
                    {formatTime(request.original_start_time)}
                  </span>
                  <span
                    style={{
                      color: 'var(--muted)',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Current
                  </span>
                </div>

                {/* Proposed slot */}
                <div
                  className="flex items-center gap-2"
                  style={{ marginBottom: 14 }}
                >
                  <CalendarDays
                    size={15}
                    strokeWidth={1.5}
                    style={{ color: 'var(--accent)' }}
                  />
                  <span
                    style={{
                      color: 'var(--accent)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}
                  >
                    {formatDate(request.proposed_date)} at{' '}
                    {formatTime(request.proposed_start_time)}
                  </span>
                  <span
                    style={{
                      color: 'var(--accent)',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Proposed
                  </span>
                </div>

                {/* Reason */}
                <div
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    marginBottom: 16,
                    borderLeft: '3px solid var(--border)',
                  }}
                >
                  {request.reason ? (
                    <p
                      style={{
                        color: 'var(--text)',
                        fontSize: '0.85rem',
                        margin: 0,
                        lineHeight: 1.5,
                        fontStyle: 'italic',
                      }}
                    >
                      &ldquo;{request.reason}&rdquo;
                    </p>
                  ) : (
                    <p
                      style={{
                        color: 'var(--muted)',
                        fontSize: '0.85rem',
                        margin: 0,
                        fontStyle: 'italic',
                      }}
                    >
                      No reason provided
                    </p>
                  )}
                </div>

                {/* Decline reason textarea */}
                {isShowingDecline && (
                  <div style={{ marginBottom: 16 }}>
                    <label
                      style={{
                        display: 'block',
                        color: 'var(--muted)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        marginBottom: 8,
                      }}
                    >
                      Reason for declining (optional)
                    </label>
                    <textarea
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      placeholder="Let the student know why you're declining..."
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        resize: 'vertical',
                        minHeight: 70,
                        fontSize: '0.85rem',
                        lineHeight: 1.5,
                        outline: 'none',
                        boxSizing: 'border-box',
                        fontFamily: 'inherit',
                      }}
                    />
                    <div
                      className="flex items-center gap-2"
                      style={{ marginTop: 10 }}
                    >
                      <button
                        onClick={() => handleDeclineSubmit(request)}
                        disabled={isLoading}
                        className="flex items-center gap-2"
                        style={{
                          padding: '8px 20px',
                          borderRadius: '100px',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          border: 'none',
                          background: 'rgba(226,75,74,0.15)',
                          color: '#E24B4A',
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          opacity: isLoading ? 0.5 : 1,
                          transition: 'all 0.2s',
                        }}
                      >
                        {isLoading ? 'Declining...' : 'Confirm Decline'}
                      </button>
                      <button
                        onClick={() => {
                          setDeclineId(null)
                          setDeclineReason('')
                        }}
                        style={{
                          padding: '8px 20px',
                          borderRadius: '100px',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          border: '1px solid var(--border)',
                          background: 'transparent',
                          color: 'var(--muted)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                {!isShowingDecline && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => setDeclineId(request.id)}
                      disabled={isLoading}
                      className="flex items-center gap-2"
                      style={{
                        padding: '8px 20px',
                        borderRadius: '100px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        border: '1px solid rgba(226,75,74,0.4)',
                        background: 'transparent',
                        color: '#E24B4A',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        opacity: isLoading ? 0.5 : 1,
                        transition: 'all 0.2s',
                      }}
                    >
                      <X size={15} strokeWidth={1.5} />
                      Decline
                    </button>

                    <button
                      onClick={() => handleAccept(request)}
                      disabled={isLoading}
                      className="flex items-center gap-2"
                      style={{
                        padding: '8px 20px',
                        borderRadius: '100px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        border: 'none',
                        background: 'linear-gradient(135deg, #639922, #4a8019)',
                        color: '#fff',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        opacity: isLoading ? 0.5 : 1,
                        transition: 'all 0.2s',
                      }}
                    >
                      {isLoading ? (
                        <>
                          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                          <Loader2
                            size={15}
                            strokeWidth={1.5}
                            style={{ animation: 'spin 1s linear infinite' }}
                          />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Check size={15} strokeWidth={1.5} />
                          Accept
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
