'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { apiPost } from '@/lib/api'

interface ApprovalActionsProps {
  bookingId: number
}

export default function ApprovalActions({ bookingId }: ApprovalActionsProps) {
  const [status, setStatus] = useState<
    'idle' | 'rejecting' | 'loading' | 'approved' | 'rejected'
  >('idle')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (status === 'approved') {
    return (
      <span style={{ color: '#639922', fontSize: '0.82rem', fontWeight: 600 }}>
        Approved
      </span>
    )
  }

  if (status === 'rejected') {
    return (
      <span style={{ color: '#E24B4A', fontSize: '0.82rem', fontWeight: 600 }}>
        Rejected
      </span>
    )
  }

  const handleApprove = async () => {
    setStatus('loading')
    setError(null)
    try {
      const res = await apiPost<{ message: string }>(
        `/api/v1/guardian/bookings/${bookingId}/approve`
      )
      if (res.success) {
        setStatus('approved')
      } else {
        setError(res.error?.message ?? 'Failed to approve')
        setStatus('idle')
      }
    } catch {
      setError('Something went wrong')
      setStatus('idle')
    }
  }

  const handleReject = async () => {
    if (!reason.trim()) return
    setStatus('loading')
    setError(null)
    try {
      const res = await apiPost<{ message: string }>(
        `/api/v1/guardian/bookings/${bookingId}/reject`,
        { reason: reason.trim() }
      )
      if (res.success) {
        setStatus('rejected')
      } else {
        setError(res.error?.message ?? 'Failed to reject')
        setStatus('rejecting')
      }
    } catch {
      setError('Something went wrong')
      setStatus('rejecting')
    }
  }

  if (status === 'rejecting') {
    return (
      <div className="flex flex-col gap-2" style={{ minWidth: '200px' }}>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for rejection..."
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
            onClick={handleReject}
            disabled={!reason.trim()}
            style={{
              background: '#E24B4A',
              border: 'none',
              borderRadius: '8px',
              padding: '5px 12px',
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: !reason.trim() ? 0.5 : 1,
            }}
          >
            Confirm
          </button>
          <button
            onClick={() => setStatus('idle')}
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
        {error && (
          <p style={{ color: '#E24B4A', fontSize: '0.75rem', margin: 0 }}>
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <button
        onClick={handleApprove}
        disabled={status === 'loading'}
        title="Approve"
        className="flex items-center justify-center"
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: 'rgba(99,153,34,0.12)',
          border: '1px solid rgba(99,153,34,0.25)',
          color: '#639922',
          cursor: 'pointer',
          opacity: status === 'loading' ? 0.5 : 1,
        }}
      >
        <Check size={16} strokeWidth={1.5} />
      </button>
      <button
        onClick={() => setStatus('rejecting')}
        disabled={status === 'loading'}
        title="Reject"
        className="flex items-center justify-center"
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: 'rgba(226,75,74,0.12)',
          border: '1px solid rgba(226,75,74,0.25)',
          color: '#E24B4A',
          cursor: 'pointer',
          opacity: status === 'loading' ? 0.5 : 1,
        }}
      >
        <X size={16} strokeWidth={1.5} />
      </button>
      {error && (
        <span style={{ color: '#E24B4A', fontSize: '0.75rem' }}>{error}</span>
      )}
    </div>
  )
}
