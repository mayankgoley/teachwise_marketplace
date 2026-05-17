'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import type { ApiResponse } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import { useRouter } from 'next/navigation'
import { formatDate, formatTime, formatRelativeTime } from '@/lib/format'
import { RefreshCw, Loader2, Clock, AlertCircle, MessageSquare } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'
import type { RescheduleRequestData } from '@/types/reschedule'

export default function StudentRescheduleRequestsPage() {
  const toast = useToast()
  const router = useRouter()
  const [requests, setRequests] = useState<RescheduleRequestData[]>([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState<number | null>(null)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const res: ApiResponse<{ requests: RescheduleRequestData[] }> = await apiGet(
        '/api/v1/student/reschedule-requests'
      )
      if (res.success) {
        setRequests(res.data?.requests ?? [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleAccept = async (requestId: number) => {
    if (!window.confirm('Accept this reschedule? Your booking will be moved to the new time.')) return
    setActioning(requestId)
    try {
      const res: ApiResponse<{ message: string }> = await apiPost(
        `/api/v1/student/reschedule-requests/${requestId}/accept`
      )
      if (res.success) {
        toast.success('Reschedule accepted', 'Your booking has been moved to the new time.')
        fetchRequests()
      } else {
        toast.error('Failed', res.error?.message ?? 'Could not accept reschedule.')
      }
    } catch {
      toast.error('Error', 'Something went wrong.')
    } finally {
      setActioning(null)
    }
  }

  const handleCancelAndRefund = async (requestId: number) => {
    if (!window.confirm('Cancel this booking and get a full refund? This cannot be undone.')) return
    setActioning(requestId)
    try {
      const res: ApiResponse<{ message: string }> = await apiPost(
        `/api/v1/student/reschedule-requests/${requestId}/cancel-and-refund`
      )
      if (res.success) {
        toast.success('Booking cancelled', 'A full refund has been issued to your wallet.')
        fetchRequests()
      } else {
        toast.error('Failed', res.error?.message ?? 'Could not cancel booking.')
      }
    } catch {
      toast.error('Error', 'Something went wrong.')
    } finally {
      setActioning(null)
    }
  }

  const actionRequired = requests.filter(
    (r) => r.initiated_by === 'tutor' && r.status === 'pending' && r.action_required
  )
  const myRequests = requests.filter((r) => r.initiated_by === 'student')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} strokeWidth={1.5} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#BA7517'
      case 'accepted': return '#639922'
      case 'rejected': return '#E24B4A'
      case 'cancelled': return '#6b7280'
      default: return 'var(--muted)'
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1
          className="font-head font-bold text-[var(--text)]"
          style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
        >
          Reschedule Requests
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Review and respond to reschedule proposals
        </p>
      </div>

      {requests.length === 0 && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
          }}
        >
          <EmptyState
            icon={<RefreshCw size={22} strokeWidth={1.5} />}
            title="No reschedule requests"
            description="When a tutor proposes a new time for your booking, it will appear here."
          />
        </div>
      )}

      {actionRequired.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
            <AlertCircle size={18} strokeWidth={1.5} color="#BA7517" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              Action Required
            </h2>
            <span
              style={{
                background: 'rgba(186,117,23,0.15)',
                color: '#BA7517',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '2px 10px',
                borderRadius: '100px',
              }}
            >
              {actionRequired.length}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {actionRequired.map((req) => (
              <div
                key={req.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  padding: '20px',
                }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                    {req.subject}
                  </h3>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#BA7517',
                      background: 'rgba(186,117,23,0.1)',
                      padding: '4px 12px',
                      borderRadius: '100px',
                    }}
                  >
                    Reschedule Proposed
                  </span>
                </div>

                <p style={{ fontSize: '0.875rem', color: 'var(--muted)', margin: '0 0 16px' }}>
                  Your tutor <strong style={{ color: 'var(--text)' }}>{req.tutor_name}</strong> has proposed a new time
                </p>

                <div className="flex gap-3" style={{ marginBottom: '16px' }}>
                  <div
                    style={{
                      flex: 1,
                      background: 'rgba(226,75,74,0.06)',
                      border: '1px solid rgba(226,75,74,0.15)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#E24B4A', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Original Time
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text)', fontWeight: 500 }}>
                      {formatDate(req.original_date)}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '2px' }}>
                      {formatTime(req.original_start_time)} &ndash; {formatTime(req.original_end_time)}
                    </div>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      background: 'rgba(99,153,34,0.06)',
                      border: '1px solid rgba(99,153,34,0.15)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#639922', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Proposed Time
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text)', fontWeight: 500 }}>
                      {formatDate(req.proposed_date)}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '2px' }}>
                      {formatTime(req.proposed_start_time)} &ndash; {formatTime(req.proposed_end_time)}
                    </div>
                  </div>
                </div>

                {req.reason && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--muted)', fontStyle: 'italic', margin: '0 0 12px' }}>
                    &ldquo;{req.reason}&rdquo;
                  </p>
                )}

                <div className="flex items-center gap-1" style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '16px' }}>
                  <Clock size={13} strokeWidth={1.5} />
                  <span>Expires {formatRelativeTime(req.expires_at)}</span>
                </div>

                <button
                  onClick={() => router.push('/dashboard/student/messages')}
                  className="flex items-center gap-2"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '10px 16px',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: '100px',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    marginBottom: '10px',
                  }}
                >
                  <MessageSquare size={14} strokeWidth={1.5} />
                  Discuss in Chat with Tutor
                </button>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleAccept(req.id)}
                    disabled={actioning === req.id}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '100px',
                      border: 'none',
                      background: actioning === req.id
                        ? 'rgba(79,142,255,0.3)'
                        : 'linear-gradient(135deg, #4f8eff, #00e5ff)',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      cursor: actioning === req.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {actioning === req.id ? 'Processing...' : 'Accept New Time'}
                  </button>
                  <button
                    onClick={() => handleCancelAndRefund(req.id)}
                    disabled={actioning === req.id}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '100px',
                      background: 'transparent',
                      border: '1px solid rgba(226,75,74,0.4)',
                      color: '#E24B4A',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      cursor: actioning === req.id ? 'not-allowed' : 'pointer',
                      opacity: actioning === req.id ? 0.6 : 1,
                    }}
                  >
                    Cancel &amp; Get Full Refund
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {myRequests.length > 0 && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 16px' }}>
            My Requests
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {myRequests.map((req) => (
              <div
                key={req.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  padding: '20px',
                }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                    {req.subject}
                  </h3>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: statusColor(req.status),
                      background: `${statusColor(req.status)}15`,
                      padding: '4px 12px',
                      borderRadius: '100px',
                      textTransform: 'capitalize',
                    }}
                  >
                    {req.status}
                  </span>
                </div>

                <div className="flex gap-3" style={{ marginBottom: '12px' }}>
                  <div
                    style={{
                      flex: 1,
                      background: 'rgba(226,75,74,0.06)',
                      border: '1px solid rgba(226,75,74,0.15)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#E24B4A', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Original Time
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text)', fontWeight: 500 }}>
                      {formatDate(req.original_date)}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '2px' }}>
                      {formatTime(req.original_start_time)} &ndash; {formatTime(req.original_end_time)}
                    </div>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      background: 'rgba(99,153,34,0.06)',
                      border: '1px solid rgba(99,153,34,0.15)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#639922', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Proposed Time
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text)', fontWeight: 500 }}>
                      {formatDate(req.proposed_date)}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '2px' }}>
                      {formatTime(req.proposed_start_time)} &ndash; {formatTime(req.proposed_end_time)}
                    </div>
                  </div>
                </div>

                {req.reason && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--muted)', fontStyle: 'italic', margin: '0 0 8px' }}>
                    &ldquo;{req.reason}&rdquo;
                  </p>
                )}

                <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                  {req.status === 'pending' && 'Waiting for tutor response...'}
                  {req.status === 'accepted' && 'Your reschedule request was accepted.'}
                  {req.status === 'rejected' && 'Your reschedule request was rejected.'}
                  {req.status === 'cancelled' && 'This request was cancelled.'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
