import { cookies } from 'next/headers'
import Link from 'next/link'
import { CalendarDays, Clock, Video, MapPin, CheckCircle } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate, formatTime, formatCurrency, formatDuration } from '@/lib/format'
import type { StudentBooking } from '@/types/search'
import type { ApiResponse } from '@/lib/api'
import BookingActions from './BookingActions'

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
] as const

export default async function StudentBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; booking?: string }>
}) {
  const params = await searchParams
  const activeStatus = params.status ?? ''
  const showSuccess = params.booking === 'success'

  const cookieStore = await cookies()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

  let bookings: StudentBooking[] = []
  let fetchError = false

  try {
    const queryStr = activeStatus ? `?status=${activeStatus}` : ''
    const res = await fetch(`${apiUrl}/api/v1/student/bookings${queryStr}`, {
      headers: { Cookie: cookieStore.toString() },
      cache: 'no-store',
    })
    const json: ApiResponse<{ bookings: StudentBooking[] }> = await res.json()
    if (json.success) {
      bookings = json.data.bookings
    } else {
      fetchError = true
    }
  } catch {
    fetchError = true
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          Failed to load bookings. Please refresh the page.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1
          className="font-head font-bold text-[var(--text)]"
          style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
        >
          My Bookings
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          View and manage your tutoring sessions
        </p>
      </div>

      {/* Success banner */}
      {showSuccess && (
        <div
          className="flex items-center gap-3"
          style={{
            background: 'rgba(99,153,34,0.12)',
            border: '1px solid rgba(99,153,34,0.3)',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '20px',
          }}
        >
          <CheckCircle size={20} strokeWidth={1.5} color="#639922" />
          <p
            style={{
              color: '#639922',
              fontSize: '0.9rem',
              fontWeight: 600,
              margin: 0,
            }}
          >
            Booking confirmed successfully! Your tutor will be notified.
          </p>
        </div>
      )}

      {/* Status filter tabs */}
      <div
        className="flex items-center gap-2"
        style={{
          marginBottom: '20px',
          overflowX: 'auto',
          paddingBottom: '4px',
        }}
      >
        {STATUS_TABS.map((tab) => {
          const isActive = activeStatus === tab.value
          return (
            <Link
              key={tab.value}
              href={
                tab.value
                  ? `/dashboard/student/bookings?status=${tab.value}`
                  : '/dashboard/student/bookings'
              }
              style={{
                padding: '8px 18px',
                borderRadius: '100px',
                fontSize: '0.85rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                textDecoration: 'none',
                background: isActive
                  ? 'var(--accent)'
                  : 'rgba(255,255,255,0.05)',
                color: isActive ? '#fff' : 'var(--muted)',
                border: isActive
                  ? 'none'
                  : '1px solid var(--border)',
                transition: 'all 0.2s ease',
              }}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {/* Booking cards */}
      {bookings.length === 0 ? (
        <div
          style={{
            background: 'var(--glass)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '20px',
          }}
        >
          <EmptyState
            icon={<CalendarDays size={22} strokeWidth={1.5} />}
            title="No bookings found"
            description={
              activeStatus
                ? `You have no ${activeStatus} bookings`
                : 'Book a session with a tutor to get started'
            }
            action={
              !activeStatus
                ? { label: 'Find a Tutor', href: '/search' }
                : undefined
            }
          />
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: '16px' }}>
          {bookings.map((booking) => (
            <div
              key={booking.id}
              style={{
                background: 'var(--glass)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '20px',
              }}
            >
              <div className="flex items-start gap-4 flex-wrap">
                {/* Tutor avatar & info */}
                <Avatar
                  name={booking.tutor_name}
                  avatarUrl={booking.tutor_avatar_url}
                  size="lg"
                />

                <div className="flex-1 min-w-0" style={{ minWidth: '200px' }}>
                  {/* Tutor name + status */}
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3
                      className="font-head font-bold text-[var(--text)]"
                      style={{ fontSize: '1.05rem', margin: 0 }}
                    >
                      {booking.tutor_name}
                    </h3>
                    <StatusBadge status={booking.status} />
                  </div>

                  {/* Subject */}
                  <p
                    style={{
                      color: 'var(--muted)',
                      fontSize: '0.88rem',
                      margin: '0 0 10px',
                    }}
                  >
                    {booking.subject}
                  </p>

                  {/* Date / time / duration / mode / amount */}
                  <div
                    className="flex items-center gap-4 flex-wrap"
                    style={{ fontSize: '0.82rem' }}
                  >
                    <span
                      className="flex items-center gap-1.5"
                      style={{ color: 'var(--text)' }}
                    >
                      <CalendarDays size={15} strokeWidth={1.5} color="var(--muted)" />
                      {formatDate(booking.date)}
                    </span>

                    <span
                      className="flex items-center gap-1.5"
                      style={{ color: 'var(--text)' }}
                    >
                      <Clock size={15} strokeWidth={1.5} color="var(--muted)" />
                      {formatTime(booking.start_time)} &ndash;{' '}
                      {formatTime(booking.end_time)}
                    </span>

                    <span
                      style={{
                        color: 'var(--muted)',
                        fontSize: '0.78rem',
                      }}
                    >
                      {formatDuration(booking.start_time, booking.end_time)}
                    </span>

                    {/* Mode badge */}
                    <span
                      className="flex items-center gap-1"
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '3px 10px',
                        borderRadius: '100px',
                        background:
                          booking.mode === 'online'
                            ? 'rgba(79,142,255,0.12)'
                            : 'rgba(186,117,23,0.12)',
                        color:
                          booking.mode === 'online' ? '#4f8eff' : '#BA7517',
                      }}
                    >
                      {booking.mode === 'online' ? (
                        <Video size={12} strokeWidth={1.5} />
                      ) : (
                        <MapPin size={12} strokeWidth={1.5} />
                      )}
                      {booking.mode === 'online' ? 'Online' : 'In Person'}
                    </span>

                    {/* Amount */}
                    <span
                      style={{
                        color: 'var(--text)',
                        fontWeight: 600,
                      }}
                    >
                      {formatCurrency(booking.amount)}
                    </span>
                  </div>
                </div>

                {/* Actions (client component) */}
                <div className="flex-shrink-0">
                  <BookingActions booking={booking} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
