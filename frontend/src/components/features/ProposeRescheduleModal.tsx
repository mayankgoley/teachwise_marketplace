'use client'

import { useState, useEffect } from 'react'
import { apiPost } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import { formatDate, formatTime } from '@/lib/format'
import { RefreshCw, X } from 'lucide-react'
import type { TutorSlotData } from '@/types/search'

interface ProposeRescheduleModalProps {
  slot: TutorSlotData
  bookingId: number
  onClose: () => void
  onSuccess: () => void
}

export default function ProposeRescheduleModal({
  slot,
  bookingId,
  onClose,
  onSuccess,
}: ProposeRescheduleModalProps) {
  const toast = useToast()
  const [newDate, setNewDate] = useState('')
  const [newStartTime, setNewStartTime] = useState('')
  const [newEndTime, setNewEndTime] = useState('')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!newDate || !newStartTime || !newEndTime) {
      setError('Please fill in all time fields.')
      return
    }

    if (newEndTime <= newStartTime) {
      setError('End time must be after start time.')
      return
    }

    setSubmitting(true)

    const res = await apiPost<{ message: string }>(
      `/api/v1/tutor/bookings/${bookingId}/propose-reschedule`,
      {
        new_date: newDate,
        new_start_time: newStartTime,
        new_end_time: newEndTime,
        reason: reason.trim() || null,
        message: message.trim() || null,
      }
    )

    setSubmitting(false)

    if (res.success) {
      toast.success(
        'Reschedule proposed',
        message.trim()
          ? 'Student notified — your message was sent to their chat'
          : 'The student will be notified.'
      )
      onSuccess()
      onClose()
    } else {
      setError(res.error?.message ?? 'Failed to propose reschedule.')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.875rem',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'var(--muted)',
    display: 'block',
    marginBottom: '6px',
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
        }}
      />

      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '460px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '28px',
          zIndex: 1001,
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
          <div className="flex items-center gap-2">
            <RefreshCw size={20} strokeWidth={1.5} color="#4f8eff" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              Propose New Time
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px' }}
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        <div
          style={{
            background: 'rgba(79,142,255,0.08)',
            border: '1px solid rgba(79,142,255,0.2)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '16px',
            fontSize: '0.875rem',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
            Current Booking
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
            {slot.subject} &middot; {formatDate(slot.date)} &middot; {formatTime(slot.start_time)} &ndash; {formatTime(slot.end_time)}
          </div>
        </div>

        <div
          style={{
            background: 'rgba(186,117,23,0.08)',
            border: '1px solid rgba(186,117,23,0.25)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '0.82rem',
            color: '#BA7517',
          }}
        >
          The student will be notified and can either accept the new time or cancel for a full refund.
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>New date</label>
            <input
              type="date"
              value={newDate}
              min={today}
              onChange={(e) => setNewDate(e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          <div className="flex gap-3" style={{ marginBottom: '14px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Start time</label>
              <input
                type="time"
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                style={inputStyle}
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>End time</label>
              <input
                type="time"
                value={newEndTime}
                onChange={(e) => setNewEndTime(e.target.value)}
                style={inputStyle}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Reason (optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              placeholder="Let the student know why you need to reschedule..."
              rows={3}
              style={{
                ...inputStyle,
                resize: 'vertical',
              }}
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'right', marginTop: '4px' }}>
              {reason.length}/300
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Message to Student (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              placeholder="e.g. I have a conflict at the original time. Would this new time work for you?"
              rows={3}
              style={{
                ...inputStyle,
                resize: 'vertical',
                fontFamily: 'var(--font-body)',
              }}
            />
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textAlign: 'right', marginTop: '4px' }}>
              {message.length}/500 · This message will also appear in your chat thread
            </div>
          </div>

          {error && (
            <p style={{ color: '#E24B4A', fontSize: '0.82rem', margin: '0 0 10px', textAlign: 'center' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '100px',
              border: 'none',
              background: submitting
                ? 'rgba(79,142,255,0.3)'
                : 'linear-gradient(135deg, #4f8eff, #00e5ff)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {submitting ? 'Submitting...' : 'Propose New Time'}
          </button>
        </form>
      </div>
    </>
  )
}
