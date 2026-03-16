'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Loader2,
  RefreshCw,
  Send,
} from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate, formatTime, formatCurrency } from '@/lib/format'
import type { RescheduleSlot } from '@/types/tutor-profile'

export default function StudentReschedulePage() {
  const { bookingId } = useParams<{ bookingId: string }>()

  const [slots, setSlots] = useState<RescheduleSlot[]>([])
  const [reschedulesRemaining, setReschedulesRemaining] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const fetchOptions = useCallback(async () => {
    try {
      const res = await apiGet<{
        slots: RescheduleSlot[]
        reschedules_remaining: number
      }>('/api/v1/bookings/' + bookingId + '/reschedule-options')
      if (res.success) {
        setSlots(res.data.slots)
        setReschedulesRemaining(res.data.reschedules_remaining)
      } else {
        setError(
          res.error?.message ?? 'This booking cannot be rescheduled.'
        )
      }
    } catch {
      setError('This booking cannot be rescheduled.')
    } finally {
      setLoading(false)
    }
  }, [bookingId])

  useEffect(() => {
    fetchOptions()
  }, [fetchOptions])

  const handleSubmit = async () => {
    if (!selectedSlotId) return
    setSubmitting(true)
    try {
      const res = await apiPost('/api/v1/bookings/' + bookingId + '/reschedule', {
        new_slot_id: selectedSlotId,
        reason: reason.trim() || undefined,
      })
      if (res.success) {
        setSuccess(true)
      } else {
        setError(res.error?.message ?? 'Failed to send reschedule request.')
      }
    } catch {
      setError('Failed to send reschedule request. Please try again.')
    } finally {
      setSubmitting(false)
    }
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
          Loading reschedule options...
        </p>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20" style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(99,153,34,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <RefreshCw size={26} strokeWidth={1.5} color="#639922" />
        </div>
        <h2
          className="font-head font-bold text-[var(--text)]"
          style={{ fontSize: '1.4rem', margin: '0 0 10px' }}
        >
          Reschedule request sent!
        </h2>
        <p
          style={{
            color: 'var(--muted)',
            fontSize: '0.92rem',
            margin: '0 0 24px',
            maxWidth: 400,
            lineHeight: 1.6,
          }}
        >
          Your tutor will respond within 24 hours.
        </p>
        <Link
          href="/dashboard/student/bookings"
          style={{
            display: 'inline-block',
            padding: '12px 28px',
            borderRadius: '100px',
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            color: '#fff',
            fontSize: '0.88rem',
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'opacity 0.2s',
          }}
        >
          Back to My Bookings
        </Link>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20" style={{ textAlign: 'center' }}>
        <p
          style={{
            color: '#E24B4A',
            fontSize: '0.95rem',
            fontWeight: 500,
            margin: '0 0 20px',
            maxWidth: 400,
          }}
        >
          {error}
        </p>
        <Link
          href="/dashboard/student/bookings"
          className="flex items-center gap-2"
          style={{
            color: 'var(--accent)',
            fontSize: '0.88rem',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
          Back to My Bookings
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Back link */}
      <Link
        href="/dashboard/student/bookings"
        className="flex items-center gap-2"
        style={{
          color: 'var(--muted)',
          fontSize: '0.85rem',
          fontWeight: 500,
          textDecoration: 'none',
          marginBottom: 20,
          transition: 'color 0.2s',
        }}
      >
        <ArrowLeft size={16} strokeWidth={1.5} />
        My Bookings
      </Link>

      {/* Header */}
      <div
        className="flex items-center gap-3 flex-wrap"
        style={{ marginBottom: 24 }}
      >
        <h1
          className="font-head font-bold text-[var(--text)]"
          style={{ fontSize: '1.8rem', margin: 0 }}
        >
          Reschedule Booking
        </h1>

        {/* Reschedules remaining badge */}
        <span
          style={{
            padding: '4px 12px',
            borderRadius: '100px',
            fontSize: '0.75rem',
            fontWeight: 600,
            background:
              reschedulesRemaining <= 1
                ? 'rgba(186,117,23,0.15)'
                : 'rgba(99,153,34,0.15)',
            color: reschedulesRemaining <= 1 ? '#BA7517' : '#639922',
          }}
        >
          {reschedulesRemaining} reschedule{reschedulesRemaining !== 1 ? 's' : ''} remaining
        </span>
      </div>

      {/* No slots */}
      {slots.length === 0 ? (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
          }}
        >
          <EmptyState
            icon={<CalendarDays size={22} strokeWidth={1.5} />}
            title="No available slots"
            description="Your tutor has no open time slots right now. Try contacting them directly to arrange a new time."
          />
        </div>
      ) : (
        <>
          {/* Slot picker */}
          <p
            style={{
              color: 'var(--muted)',
              fontSize: '0.88rem',
              margin: '0 0 16px',
            }}
          >
            Select a new time slot:
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '12px',
              marginBottom: 24,
            }}
          >
            {slots.map((slot) => {
              const isSelected = selectedSlotId === slot.id
              return (
                <button
                  key={slot.id}
                  onClick={() => setSelectedSlotId(slot.id)}
                  style={{
                    background: isSelected
                      ? 'rgba(79,142,255,0.05)'
                      : 'var(--surface)',
                    border: isSelected
                      ? '2px solid var(--accent)'
                      : '1px solid var(--border)',
                    borderRadius: 16,
                    padding: 16,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    outline: 'none',
                  }}
                >
                  <div
                    className="flex items-center gap-2"
                    style={{ marginBottom: 8 }}
                  >
                    <CalendarDays
                      size={15}
                      strokeWidth={1.5}
                      style={{ color: isSelected ? 'var(--accent)' : 'var(--muted)' }}
                    />
                    <span
                      style={{
                        color: 'var(--text)',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                      }}
                    >
                      {formatDate(slot.date)}
                    </span>
                  </div>

                  <div
                    className="flex items-center gap-2"
                    style={{ marginBottom: 8 }}
                  >
                    <Clock
                      size={15}
                      strokeWidth={1.5}
                      style={{ color: isSelected ? 'var(--accent)' : 'var(--muted)' }}
                    />
                    <span
                      style={{
                        color: 'var(--text)',
                        fontSize: '0.85rem',
                      }}
                    >
                      {formatTime(slot.start_time)} &ndash; {formatTime(slot.end_time)}
                    </span>
                  </div>

                  {slot.subject && (
                    <p
                      style={{
                        color: 'var(--muted)',
                        fontSize: '0.8rem',
                        margin: '0 0 6px',
                      }}
                    >
                      {slot.subject}
                    </p>
                  )}

                  <p
                    style={{
                      color: 'var(--text)',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      margin: 0,
                    }}
                  >
                    {formatCurrency(slot.price)}
                  </p>
                </button>
              )
            })}
          </div>

          {/* Reason textarea */}
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: 'block',
                color: 'var(--muted)',
                fontSize: '0.82rem',
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                if (e.target.value.length <= 200) setReason(e.target.value)
              }}
              maxLength={200}
              placeholder="Why do you need to reschedule? (optional)"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                resize: 'vertical',
                minHeight: 80,
                fontSize: '0.85rem',
                lineHeight: 1.5,
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
            <p
              style={{
                color: 'var(--muted)',
                fontSize: '0.72rem',
                margin: '6px 0 0',
                textAlign: 'right',
              }}
            >
              {reason.length}/200
            </p>
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={!selectedSlotId || submitting}
            className="flex items-center gap-2"
            style={{
              padding: '12px 28px',
              borderRadius: '100px',
              fontSize: '0.88rem',
              fontWeight: 600,
              border: 'none',
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              color: '#fff',
              cursor: !selectedSlotId || submitting ? 'not-allowed' : 'pointer',
              opacity: !selectedSlotId || submitting ? 0.5 : 1,
              transition: 'all 0.2s',
            }}
          >
            {submitting ? (
              <>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                <Loader2
                  size={16}
                  strokeWidth={1.5}
                  style={{ animation: 'spin 1s linear infinite' }}
                />
                Sending...
              </>
            ) : (
              <>
                <Send size={16} strokeWidth={1.5} />
                Send Reschedule Request
              </>
            )}
          </button>
        </>
      )}
    </div>
  )
}
