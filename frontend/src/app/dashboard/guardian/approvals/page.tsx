'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, Loader2, Check, X } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'
import Avatar from '@/components/ui/Avatar'
import { formatDate, formatTime, formatCurrency } from '@/lib/format'
import type { GuardianApproval } from '@/types/guardian'

type FilterTab = 'pending' | 'approved' | 'rejected'

export default function GuardianApprovalsPage() {
  const [approvals, setApprovals] = useState<GuardianApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('pending')
  const [actioning, setActioning] = useState<number | null>(null)
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fetchApprovals = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<{ approvals: GuardianApproval[] }>(
        '/api/v1/guardian/approvals?status=' + filter
      )
      if (res.success) {
        setApprovals(res.data.approvals)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchApprovals()
  }, [fetchApprovals])

  const handleApprove = async (approvalId: number) => {
    setActioning(approvalId)
    setError(null)
    try {
      const res = await apiPost<{ message: string }>(
        `/api/v1/guardian/bookings/${approvalId}/approve`
      )
      if (res.success) {
        await fetchApprovals()
      } else {
        setError(res.error?.message ?? 'Failed to approve')
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setActioning(null)
    }
  }

  const handleReject = async (approvalId: number) => {
    setActioning(approvalId)
    setError(null)
    try {
      const res = await apiPost<{ message: string }>(
        `/api/v1/guardian/bookings/${approvalId}/reject`,
        { reason: rejectReason.trim() || undefined }
      )
      if (res.success) {
        setRejectingId(null)
        setRejectReason('')
        await fetchApprovals()
      } else {
        setError(res.error?.message ?? 'Failed to reject')
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setActioning(null)
    }
  }

  const tabs: { label: string; value: FilterTab }[] = [
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1
          className="font-head font-bold text-[var(--text)]"
          style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
        >
          Booking Approvals
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Review and approve your children&apos;s bookings
        </p>
      </div>

      {/* Filter tabs */}
      <div
        className="flex items-center gap-2"
        style={{ marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}
      >
        {tabs.map((tab) => {
          const isActive = filter === tab.value
          return (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              style={{
                padding: '8px 18px',
                borderRadius: '100px',
                fontSize: '0.82rem',
                fontWeight: 600,
                border: isActive ? 'none' : '1px solid var(--border)',
                background: isActive
                  ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
                  : 'transparent',
                color: isActive ? '#fff' : 'var(--muted)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            background: 'rgba(226,75,74,0.12)',
            border: '1px solid rgba(226,75,74,0.3)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '16px',
          }}
        >
          <p style={{ color: '#E24B4A', fontSize: '0.82rem', margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <Loader2
            size={32}
            strokeWidth={1.5}
            style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }}
          />
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '16px' }}>
            Loading approvals...
          </p>
        </div>
      ) : approvals.length === 0 ? (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
          }}
        >
          <EmptyState
            icon={<ShieldCheck size={22} strokeWidth={1.5} />}
            title={`No ${filter} approvals`}
            description={
              filter === 'pending'
                ? 'No bookings are waiting for your approval.'
                : `No ${filter} bookings found.`
            }
          />
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: '12px' }}>
          {approvals.map((approval) => (
            <div
              key={approval.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '20px',
                padding: '24px',
              }}
            >
              <div className="flex items-start gap-4 flex-wrap">
                {/* Tutor info */}
                <Avatar
                  name={approval.tutor.name}
                  avatarUrl={approval.tutor.avatar_url}
                  size="md"
                />
                <div className="flex-1 min-w-0" style={{ minWidth: '200px' }}>
                  {/* Child name */}
                  <p
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--muted)',
                      margin: '0 0 4px',
                      fontWeight: 500,
                    }}
                  >
                    {approval.child.name}
                  </p>

                  {/* Tutor name + verification */}
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3
                      className="font-head font-bold text-[var(--text)]"
                      style={{ fontSize: '1.05rem', margin: 0 }}
                    >
                      {approval.tutor.name}
                    </h3>
                    {approval.tutor.verification_status === 'verified' && (
                      <span
                        style={{
                          background: 'rgba(99,153,34,0.15)',
                          color: '#639922',
                          padding: '2px 8px',
                          borderRadius: '100px',
                          fontSize: '0.68rem',
                          fontWeight: 600,
                        }}
                      >
                        Verified
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div
                    className="flex items-center gap-3 flex-wrap"
                    style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '8px' }}
                  >
                    {approval.subject && <span>{approval.subject}</span>}
                    {approval.date && <span>{formatDate(approval.date)}</span>}
                    {approval.start_time && approval.end_time && (
                      <span>
                        {formatTime(approval.start_time)} &ndash;{' '}
                        {formatTime(approval.end_time)}
                      </span>
                    )}
                    <span
                      style={{
                        background:
                          approval.mode === 'online'
                            ? 'rgba(79,142,255,0.12)'
                            : 'rgba(186,117,23,0.12)',
                        color:
                          approval.mode === 'online' ? '#4f8eff' : '#BA7517',
                        padding: '2px 8px',
                        borderRadius: '100px',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                      }}
                    >
                      {approval.mode === 'online' ? 'Online' : 'In Person'}
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {formatCurrency(approval.price)}
                    </span>
                  </div>
                </div>

                {/* Actions for pending */}
                {filter === 'pending' && (
                  <div className="flex-shrink-0">
                    {rejectingId === approval.id ? (
                      <div className="flex flex-col gap-2" style={{ minWidth: '200px' }}>
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Reason for rejection (optional)..."
                          rows={2}
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            color: 'var(--text)',
                            fontSize: '0.8rem',
                            resize: 'none',
                            outline: 'none',
                            fontFamily: 'inherit',
                          }}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReject(approval.id)}
                            disabled={actioning === approval.id}
                            style={{
                              background: '#E24B4A',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '5px 12px',
                              color: '#fff',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: actioning === approval.id ? 'not-allowed' : 'pointer',
                              opacity: actioning === approval.id ? 0.5 : 1,
                            }}
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => {
                              setRejectingId(null)
                              setRejectReason('')
                            }}
                            style={{
                              background: 'none',
                              border: '1px solid var(--border)',
                              borderRadius: '8px',
                              padding: '5px 12px',
                              color: 'var(--muted)',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(approval.id)}
                          disabled={actioning === approval.id}
                          className="flex items-center gap-1.5"
                          style={{
                            background: 'linear-gradient(135deg, #639922, #00e5ff)',
                            border: 'none',
                            borderRadius: '100px',
                            padding: '8px 16px',
                            color: '#fff',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            cursor: actioning === approval.id ? 'not-allowed' : 'pointer',
                            opacity: actioning === approval.id ? 0.5 : 1,
                          }}
                        >
                          <Check size={14} strokeWidth={1.5} />
                          Approve
                        </button>
                        <button
                          onClick={() => setRejectingId(approval.id)}
                          disabled={actioning === approval.id}
                          className="flex items-center gap-1.5"
                          style={{
                            background: 'rgba(226,75,74,0.12)',
                            border: '1px solid rgba(226,75,74,0.25)',
                            borderRadius: '100px',
                            padding: '8px 16px',
                            color: '#E24B4A',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            cursor: actioning === approval.id ? 'not-allowed' : 'pointer',
                            opacity: actioning === approval.id ? 0.5 : 1,
                          }}
                        >
                          <X size={14} strokeWidth={1.5} />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Status badge for non-pending */}
                {filter !== 'pending' && (
                  <div className="flex-shrink-0">
                    <StatusBadge
                      status={
                        approval.guardian_approved === true
                          ? 'approved'
                          : approval.guardian_approved === false
                            ? 'rejected'
                            : 'pending'
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
