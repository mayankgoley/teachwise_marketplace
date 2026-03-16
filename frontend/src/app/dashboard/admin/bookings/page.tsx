'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Loader2 } from 'lucide-react'
import { apiGet } from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'
import Avatar from '@/components/ui/Avatar'
import { formatDate, formatTime, formatCurrency } from '@/lib/format'
import type { AdminBooking } from '@/types/admin'

const filters = ['all', 'pending', 'booked', 'live', 'completed', 'cancelled'] as const
type Filter = (typeof filters)[number]

const filterLabels: Record<Filter, string> = {
  all: 'All',
  pending: 'Pending',
  booked: 'Booked',
  live: 'Live',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

interface BookingsResponse {
  bookings: AdminBooking[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<AdminBooking[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<BookingsResponse>(
        '/api/v1/admin/bookings?status=' + filter + '&page=' + page
      )
      if (res.success) {
        setBookings(res.data.bookings)
        setTotal(res.data.total)
        setTotalPages(res.data.total_pages)
      }
    } finally {
      setLoading(false)
    }
  }, [filter, page])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  useEffect(() => {
    setPage(1)
  }, [filter])

  return (
    <div style={{ padding: '0' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      <div style={{ marginBottom: '24px' }}>
        <h1
          className="font-head"
          style={{
            fontSize: '1.8rem',
            fontWeight: 700,
            color: 'var(--text)',
            margin: '0 0 4px',
          }}
        >
          Bookings
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          All platform bookings
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '8px 18px',
              borderRadius: '100px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: filter === f ? 'none' : '1px solid var(--border)',
              background:
                filter === f
                  ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
                  : 'transparent',
              color: filter === f ? '#fff' : 'var(--muted)',
            }}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '60px 0',
          }}
        >
          <Loader2
            size={28}
            strokeWidth={1.5}
            color="var(--accent)"
            style={{ animation: 'spin 1s linear infinite' }}
          />
        </div>
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={<Calendar size={22} strokeWidth={1.5} />}
          title="No bookings found"
          description={
            filter !== 'all'
              ? 'No bookings match the selected filter.'
              : 'There are no bookings on the platform yet.'
          }
        />
      ) : (
        <>
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              overflow: 'hidden',
            }}
          >
            {bookings.map((booking, index) => (
              <div
                key={booking.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderBottom:
                    index < bookings.length - 1
                      ? '1px solid var(--border)'
                      : 'none',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    minWidth: 0,
                    flex: '1 1 220px',
                  }}
                >
                  <Avatar
                    name={booking.tutor.name}
                    avatarUrl={booking.tutor.avatar_url}
                    size="sm"
                  />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        color: 'var(--text)',
                        fontSize: '0.9rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {booking.tutor.name}
                    </div>
                    <div
                      style={{
                        color: 'var(--muted)',
                        fontSize: '0.8rem',
                        marginTop: '2px',
                      }}
                    >
                      Student: {booking.student.name}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                    flexShrink: 0,
                  }}
                >
                  {booking.subject && (
                    <span
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text)',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {booking.subject}
                    </span>
                  )}

                  {booking.date && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDate(booking.date)}
                      {booking.start_time && booking.end_time && (
                        <>
                          {' '}
                          {formatTime(booking.start_time)} &ndash;{' '}
                          {formatTime(booking.end_time)}
                        </>
                      )}
                    </span>
                  )}

                  <span
                    style={{
                      background: 'rgba(127,119,221,0.15)',
                      color: '#7F77DD',
                      padding: '4px 10px',
                      borderRadius: '100px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      textTransform: 'capitalize',
                    }}
                  >
                    {booking.mode}
                  </span>

                  <span
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--text)',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatCurrency(booking.price)}
                  </span>

                  <StatusBadge status={booking.status} />

                  {booking.status === 'cancelled' && booking.cancelled_by && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      by {booking.cancelled_by}
                      {booking.cancellation_reason && (
                        <> &mdash; {booking.cancellation_reason}</>
                      )}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '16px',
                marginTop: '24px',
              }}
            >
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  padding: '8px 20px',
                  borderRadius: '100px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.05)',
                  color: page <= 1 ? 'var(--muted)' : 'var(--accent)',
                  opacity: page <= 1 ? 0.5 : 1,
                }}
              >
                Previous
              </button>
              <span
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--muted)',
                  fontWeight: 500,
                }}
              >
                Page {page} of {totalPages} ({total} bookings)
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{
                  padding: '8px 20px',
                  borderRadius: '100px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.05)',
                  color: page >= totalPages ? 'var(--muted)' : 'var(--accent)',
                  opacity: page >= totalPages ? 0.5 : 1,
                }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
