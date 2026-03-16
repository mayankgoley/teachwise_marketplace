'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Video, Star, XCircle, Shield, RefreshCw } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import type { StudentBooking } from '@/types/search'
import ReviewModal from './ReviewModal'
import CancelModal from './CancelModal'

interface BookingActionsProps {
  booking: StudentBooking
}

export default function BookingActions({ booking }: BookingActionsProps) {
  const router = useRouter()
  const [showReview, setShowReview] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const [cancelledRefund, setCancelledRefund] = useState<number | null>(null)

  // After review submitted
  if (reviewSubmitted) {
    return (
      <span
        style={{
          color: '#639922',
          fontSize: '0.82rem',
          fontWeight: 600,
        }}
      >
        Review submitted
      </span>
    )
  }

  // After cancellation
  if (cancelledRefund !== null) {
    return (
      <span
        style={{
          color: 'var(--muted)',
          fontSize: '0.82rem',
          fontWeight: 500,
        }}
      >
        Cancelled{cancelledRefund > 0 ? ` — ${formatCurrency(cancelledRefund)} refunded` : ''}
      </span>
    )
  }

  // Guardian approval pending
  if (booking.guardian_approved === false) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="flex items-center gap-1.5"
          style={{
            padding: '6px 14px',
            borderRadius: '100px',
            fontSize: '0.78rem',
            fontWeight: 600,
            background: 'rgba(186,117,23,0.12)',
            color: '#BA7517',
            whiteSpace: 'nowrap',
          }}
        >
          <Shield size={13} strokeWidth={1.5} />
          Awaiting guardian approval
        </span>
      </div>
    )
  }

  const canReschedule =
    booking.status === 'confirmed' || booking.status === 'Booked'

  const hasActions =
    booking.can_review ||
    booking.can_cancel ||
    canReschedule ||
    (booking.jitsi_room_name && booking.status === 'live')

  if (!hasActions) return null

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Join session */}
        {booking.jitsi_room_name && booking.status === 'live' && (
          <a
            href={`/dashboard/student/session/${booking.jitsi_room_name}`}
            className="flex items-center gap-1.5"
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              fontSize: '0.82rem',
              fontWeight: 600,
              background: '#639922',
              color: '#fff',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              transition: 'opacity 0.2s ease',
            }}
          >
            <Video size={14} strokeWidth={1.5} />
            Join Session
          </a>
        )}

        {/* Leave review */}
        {booking.can_review && (
          <button
            onClick={() => setShowReview(true)}
            className="flex items-center gap-1.5"
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              fontSize: '0.82rem',
              fontWeight: 600,
              background: 'rgba(79,142,255,0.1)',
              border: '1px solid rgba(79,142,255,0.25)',
              color: 'var(--accent)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Star size={14} strokeWidth={1.5} />
            Leave Review
          </button>
        )}

        {/* Reschedule */}
        {canReschedule && (
          <Link
            href={`/dashboard/student/bookings/reschedule/${booking.id}`}
            className="flex items-center gap-1.5"
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              fontSize: '0.82rem',
              fontWeight: 600,
              background: 'rgba(186,117,23,0.08)',
              border: '1px solid rgba(186,117,23,0.2)',
              color: '#BA7517',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <RefreshCw size={14} strokeWidth={1.5} />
            Reschedule
          </Link>
        )}

        {/* Cancel */}
        {booking.can_cancel && (
          <button
            onClick={() => setShowCancel(true)}
            className="flex items-center gap-1.5"
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              fontSize: '0.82rem',
              fontWeight: 600,
              background: 'rgba(226,75,74,0.08)',
              border: '1px solid rgba(226,75,74,0.2)',
              color: '#E24B4A',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <XCircle size={14} strokeWidth={1.5} />
            Cancel
          </button>
        )}
      </div>

      {/* Review modal */}
      <ReviewModal
        bookingId={booking.id}
        tutorName={booking.tutor_name}
        isOpen={showReview}
        onClose={() => setShowReview(false)}
        onSuccess={() => {
          setShowReview(false)
          setReviewSubmitted(true)
          router.refresh()
        }}
      />

      {/* Cancel modal */}
      <CancelModal
        bookingId={booking.id}
        sessionDate={booking.date}
        sessionTime={booking.start_time}
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        onSuccess={(refundAmount) => {
          setShowCancel(false)
          setCancelledRefund(refundAmount)
          router.refresh()
        }}
      />
    </>
  )
}
