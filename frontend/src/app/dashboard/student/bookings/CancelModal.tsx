'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { AlertTriangle, X, Clock } from 'lucide-react'
import { apiPost } from '@/lib/api'
import { formatDate, formatTime } from '@/lib/format'

interface CancelModalProps {
  bookingId: number
  sessionDate: string
  sessionTime: string
  isOpen: boolean
  onClose: () => void
  onSuccess: (refundAmount: number) => void
}

export default function CancelModal({
  bookingId,
  sessionDate,
  sessionTime,
  isOpen,
  onClose,
  onSuccess,
}: CancelModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleKeyDown])

  const refundPolicy = useMemo(() => {
    const [hours, minutes] = sessionTime.split(':').map(Number)
    const sessionDateTime = new Date(sessionDate + 'T00:00:00')
    sessionDateTime.setHours(hours, minutes)
    const now = new Date()
    const hoursUntil = (sessionDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (hoursUntil >= 24) {
      return {
        percentage: 100,
        label: 'Full refund',
        description: 'You are cancelling more than 24 hours before the session.',
        color: '#639922',
      }
    } else if (hoursUntil >= 6) {
      return {
        percentage: 50,
        label: '50% refund',
        description: 'You are cancelling between 6 and 24 hours before the session.',
        color: '#BA7517',
      }
    } else {
      return {
        percentage: 0,
        label: 'No refund',
        description: 'You are cancelling less than 6 hours before the session.',
        color: '#E24B4A',
      }
    }
  }, [sessionDate, sessionTime])

  if (!isOpen) return null

  const handleCancel = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await apiPost<{ message: string; refund_amount: number }>(
        `/api/v1/bookings/${bookingId}/cancel`
      )
      if (res.success) {
        onSuccess(res.data.refund_amount)
      } else {
        setError(res.error?.message ?? 'Failed to cancel booking')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', padding: '20px' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '28px',
          width: '100%',
          maxWidth: '440px',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2
            className="font-head font-bold text-[var(--text)]"
            style={{ fontSize: '1.2rem', margin: 0 }}
          >
            Cancel Booking
          </h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border)',
              color: 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Session info */}
        <div
          className="flex items-center gap-3"
          style={{
            background: 'rgba(255,255,255,0.04)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '16px',
          }}
        >
          <Clock size={18} strokeWidth={1.5} color="var(--muted)" />
          <div>
            <p
              style={{
                color: 'var(--text)',
                fontSize: '0.88rem',
                fontWeight: 500,
                margin: 0,
              }}
            >
              {formatDate(sessionDate)}
            </p>
            <p
              style={{
                color: 'var(--muted)',
                fontSize: '0.82rem',
                margin: 0,
              }}
            >
              {formatTime(sessionTime)}
            </p>
          </div>
        </div>

        {/* Refund policy info */}
        <div
          style={{
            background: `${refundPolicy.color}12`,
            border: `1px solid ${refundPolicy.color}30`,
            borderRadius: '10px',
            padding: '14px 16px',
            marginBottom: '16px',
          }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={18}
              strokeWidth={1.5}
              color={refundPolicy.color}
              className="flex-shrink-0"
              style={{ marginTop: '1px' }}
            />
            <div>
              <p
                style={{
                  color: refundPolicy.color,
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  margin: '0 0 4px',
                }}
              >
                {refundPolicy.label} ({refundPolicy.percentage}%)
              </p>
              <p
                style={{
                  color: 'var(--muted)',
                  fontSize: '0.82rem',
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                {refundPolicy.description}
              </p>
            </div>
          </div>
        </div>

        {/* Refund policy summary */}
        <div
          style={{
            fontSize: '0.78rem',
            color: 'var(--muted)',
            lineHeight: 1.5,
            marginBottom: '20px',
            padding: '0 2px',
          }}
        >
          <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--text)' }}>
            Refund Policy
          </p>
          <p style={{ margin: 0 }}>
            &bull; 24+ hours before: Full refund
            <br />
            &bull; 6&ndash;24 hours before: 50% refund
            <br />
            &bull; Less than 6 hours: No refund
          </p>
        </div>

        {/* Error */}
        {error && (
          <p
            style={{
              color: '#E24B4A',
              fontSize: '0.82rem',
              margin: '0 0 14px',
              padding: '10px 14px',
              background: 'rgba(226,75,74,0.1)',
              borderRadius: '8px',
            }}
          >
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '10px 20px',
              color: 'var(--muted)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Keep Booking
          </button>
          <button
            onClick={handleCancel}
            disabled={isSubmitting}
            style={{
              background: '#E24B4A',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 24px',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.5 : 1,
              transition: 'opacity 0.2s ease',
            }}
          >
            {isSubmitting ? 'Cancelling...' : 'Confirm Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
