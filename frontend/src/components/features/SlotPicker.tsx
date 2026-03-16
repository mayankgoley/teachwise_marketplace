'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Clock, Loader2 } from 'lucide-react'
import { apiPost } from '@/lib/api'
import { formatTime, formatCurrency, formatDuration, formatDate } from '@/lib/format'
import EmptyState from '@/components/ui/EmptyState'
import type { AvailableSlot } from '@/types/search'

interface SlotPickerProps {
  slots: AvailableSlot[]
  tutorId: number
}

export default function SlotPicker({ slots, tutorId }: SlotPickerProps) {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null)
  const [isBooking, setIsBooking] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [guardianNote, setGuardianNote] = useState(false)

  if (slots.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays size={22} strokeWidth={1.5} />}
        title="No available slots"
        description="This tutor has no open slots in the next 14 days"
      />
    )
  }

  // Get unique dates
  const uniqueDates = Array.from(new Set(slots.map((s) => s.date))).sort()

  // Slots for selected date
  const dateSlots = selectedDate ? slots.filter((s) => s.date === selectedDate) : []
  const onlineSlots = dateSlots.filter((s) => s.mode === 'online' || s.mode === 'both')
  const inPersonSlots = dateSlots.filter((s) => s.mode === 'in-person' || s.mode === 'in_person' || s.mode === 'both')

  const handleBook = async () => {
    if (!selectedSlot) return
    setIsBooking(true)
    setBookingError(null)
    setGuardianNote(false)

    const res = await apiPost<{
      booking_id: number
      checkout_url: string
      requires_guardian_approval: boolean
    }>('/api/v1/bookings/create', { slot_id: selectedSlot.id })

    if (!res.success) {
      if (res.error?.code === 401) {
        router.push(`/login?next=/tutor/${tutorId}`)
        return
      }
      setBookingError(res.error?.message ?? 'Booking failed')
      setIsBooking(false)
      return
    }

    if (res.data.requires_guardian_approval) {
      setGuardianNote(true)
      setIsBooking(false)
      return
    }

    window.location.href = res.data.checkout_url
  }

  const formatDatePill = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    const day = d.toLocaleDateString('en-US', { weekday: 'short' })
    const month = d.toLocaleDateString('en-US', { month: 'short' })
    const num = d.getDate()
    return { day, label: `${month} ${num}` }
  }

  return (
    <div>
      {/* Step 1: Date Selection */}
      <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: '0 0 10px', fontWeight: 500 }}>
        Select a date
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {uniqueDates.map((date) => {
          const { day, label } = formatDatePill(date)
          const isSelected = selectedDate === date
          return (
            <button
              key={date}
              onClick={() => {
                setSelectedDate(date)
                setSelectedSlot(null)
                setBookingError(null)
                setGuardianNote(false)
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '8px 14px',
                borderRadius: '12px',
                border: isSelected ? 'none' : '1px solid var(--border)',
                background: isSelected
                  ? 'linear-gradient(135deg, #4f8eff, #00e5ff)'
                  : 'transparent',
                color: isSelected ? '#fff' : 'var(--text)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 500,
                minWidth: '60px',
              }}
            >
              <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>{day}</span>
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      {/* Step 2: Time Selection */}
      {selectedDate && dateSlots.length > 0 && (
        <div className="mb-4">
          <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: '0 0 10px', fontWeight: 500 }}>
            Select a time
          </p>

          {onlineSlots.length > 0 && (
            <>
              <p style={{ color: 'var(--muted)', fontSize: '0.72rem', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Online
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {onlineSlots.map((slot) => {
                  const isSelected = selectedSlot?.id === slot.id
                  return (
                    <button
                      key={slot.id}
                      onClick={() => {
                        setSelectedSlot(slot)
                        setBookingError(null)
                        setGuardianNote(false)
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '10px',
                        border: isSelected ? 'none' : '1px solid var(--border)',
                        background: isSelected
                          ? 'linear-gradient(135deg, #4f8eff, #00e5ff)'
                          : 'transparent',
                        color: isSelected ? '#fff' : 'var(--text)',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                      }}
                    >
                      {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                      <span style={{ opacity: 0.7, marginLeft: '6px' }}>
                        {formatCurrency(slot.price)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {inPersonSlots.length > 0 && (
            <>
              <p style={{ color: 'var(--muted)', fontSize: '0.72rem', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                In Person
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {inPersonSlots.map((slot) => {
                  const isSelected = selectedSlot?.id === slot.id
                  return (
                    <button
                      key={`ip-${slot.id}`}
                      onClick={() => {
                        setSelectedSlot(slot)
                        setBookingError(null)
                        setGuardianNote(false)
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '10px',
                        border: isSelected ? 'none' : '1px solid var(--border)',
                        background: isSelected
                          ? 'linear-gradient(135deg, #4f8eff, #00e5ff)'
                          : 'transparent',
                        color: isSelected ? '#fff' : 'var(--text)',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                      }}
                    >
                      {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                      <span style={{ opacity: 0.7, marginLeft: '6px' }}>
                        {formatCurrency(slot.price)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 3: Booking Confirmation */}
      {selectedSlot && (
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '12px',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays size={14} strokeWidth={1.5} color="var(--muted)" />
            <span style={{ color: 'var(--text)', fontSize: '0.875rem' }}>
              {formatDate(selectedSlot.date)}
            </span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} strokeWidth={1.5} color="var(--muted)" />
            <span style={{ color: 'var(--text)', fontSize: '0.875rem' }}>
              {formatTime(selectedSlot.start_time)} – {formatTime(selectedSlot.end_time)}{' '}
              ({formatDuration(selectedSlot.start_time, selectedSlot.end_time)})
            </span>
          </div>
          <div className="flex items-center justify-between mt-3">
            <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
              {selectedSlot.mode === 'online' ? 'Online' : 'In Person'}
            </span>
            <span
              className="font-head"
              style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)' }}
            >
              {formatCurrency(selectedSlot.price)}
            </span>
          </div>
        </div>
      )}

      {/* Book Button */}
      {selectedSlot && !guardianNote && (
        <button
          onClick={handleBook}
          disabled={isBooking}
          style={{
            width: '100%',
            background: isBooking
              ? 'rgba(79,142,255,0.4)'
              : 'linear-gradient(135deg, #4f8eff, #00e5ff)',
            color: '#fff',
            border: 'none',
            padding: '14px',
            borderRadius: '100px',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: isBooking ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {isBooking && <Loader2 size={18} strokeWidth={1.5} className="animate-spin" />}
          {isBooking ? 'Processing...' : 'Book Session'}
        </button>
      )}

      {/* Guardian approval note */}
      {guardianNote && (
        <div
          style={{
            background: 'rgba(186,117,23,0.1)',
            border: '1px solid rgba(186,117,23,0.3)',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '0.85rem',
            color: '#BA7517',
          }}
        >
          Your guardian will receive an approval request. You&apos;ll be notified once approved.
        </div>
      )}

      {/* Error */}
      {bookingError && (
        <p style={{ color: '#E24B4A', fontSize: '0.82rem', margin: '8px 0 0', textAlign: 'center' }}>
          {bookingError}
        </p>
      )}
    </div>
  )
}
