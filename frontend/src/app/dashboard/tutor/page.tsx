import { cookies } from 'next/headers'
import {
  CalendarDays,
  Users,
  DollarSign,
  Star,
  MessageSquare,
  AlertCircle,
  Wallet,
} from 'lucide-react'
import StatCard from '@/components/ui/StatCard'
import SectionCard from '@/components/ui/SectionCard'
import EmptyState from '@/components/ui/EmptyState'
import Avatar from '@/components/ui/Avatar'
import StatusBadge from '@/components/ui/StatusBadge'
import RecentEarningsTable from '@/components/features/tables/RecentEarningsTable'
import SessionCountdown from '@/components/ui/SessionCountdown'
import ReviewResponder from './ReviewResponder'
import {
  formatCurrency,
  getGreeting,
  getFirstName,
} from '@/lib/format'
import type { TutorDashboardData } from '@/types/dashboard'
import type { ApiResponse } from '@/lib/api'

export default async function TutorDashboardPage() {
  const cookieStore = await cookies()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

  let data: TutorDashboardData | null = null
  let userName = 'Tutor'

  try {
    const [dashRes, meRes] = await Promise.all([
      fetch(`${apiUrl}/api/v1/tutor/dashboard`, {
        headers: { Cookie: cookieStore.toString() },
        cache: 'no-store',
      }),
      fetch(`${apiUrl}/api/v1/auth/me`, {
        headers: { Cookie: cookieStore.toString() },
        cache: 'no-store',
      }),
    ])
    const dashJson: ApiResponse<TutorDashboardData> = await dashRes.json()
    const meJson = await meRes.json()
    if (dashJson.success) data = dashJson.data
    if (meJson.success) userName = meJson.data.name
  } catch {
    // Will show error state
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          Failed to load dashboard data. Please refresh the page.
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
          {getGreeting()}, {getFirstName(userName)}
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Here&apos;s your teaching overview
        </p>
      </div>

      {/* Verification banner */}
      {data.stats.verification_status !== 'verified' && (
        <div
          className="flex items-center gap-3 mb-6"
          style={{
            background: 'rgba(186,117,23,0.1)',
            border: '1px solid rgba(186,117,23,0.3)',
            borderRadius: '12px',
            padding: '16px 20px',
          }}
        >
          <AlertCircle size={20} color="#BA7517" strokeWidth={1.5} />
          <div className="flex-1">
            <p
              className="text-[var(--text)]"
              style={{ fontWeight: 500, margin: 0 }}
            >
              Account verification required
            </p>
            <p
              style={{
                color: 'var(--muted)',
                fontSize: '0.875rem',
                margin: '2px 0 0',
              }}
            >
              Status: <StatusBadge status={data.stats.verification_status} />{' '}
              <a
                href="/dashboard/tutor/documents"
                style={{ color: 'var(--accent)', marginLeft: '4px' }}
              >
                Upload documents &rarr;
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div
        className="grid gap-4 mb-8"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        }}
      >
        <StatCard
          label="Total Students"
          value={data.stats.total_students}
          icon={<Users size={22} strokeWidth={1.5} />}
          color="blue"
        />
        <StatCard
          label="Upcoming Sessions"
          value={data.stats.upcoming_sessions}
          icon={<CalendarDays size={22} strokeWidth={1.5} />}
          color="cyan"
        />
        <StatCard
          label="Total Earnings"
          value={formatCurrency(data.stats.total_earnings)}
          icon={<DollarSign size={22} strokeWidth={1.5} />}
          color="green"
        />
        <StatCard
          label="Pending Payout"
          value={formatCurrency(data.stats.pending_payout)}
          icon={<Wallet size={22} strokeWidth={1.5} />}
          color="amber"
        />
        <StatCard
          label="Avg Rating"
          value={`${data.stats.average_rating.toFixed(1)}`}
          icon={<Star size={22} strokeWidth={1.5} />}
          color="amber"
        />
        <StatCard
          label="Reviews"
          value={data.stats.total_reviews}
          icon={<MessageSquare size={22} strokeWidth={1.5} />}
          color="purple"
        />
      </div>

      {/* Two-column: Upcoming Sessions + Pending Reviews */}
      <div
        className="grid gap-6 mb-6"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}
      >
        <SectionCard
          title="Upcoming Sessions"
          action={
            data.upcoming_sessions.length > 0
              ? { label: 'View all', href: '/dashboard/tutor/availability' }
              : undefined
          }
        >
          {data.upcoming_sessions.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={22} strokeWidth={1.5} />}
              title="No upcoming sessions"
              description="Set your availability to start receiving bookings"
              action={{
                label: 'Set Availability',
                href: '/dashboard/tutor/availability',
              }}
            />
          ) : (
            <div className="flex flex-col">
              {data.upcoming_sessions.map((session, i) => (
                <div
                  key={session.id}
                  className="flex items-center gap-3 py-3"
                  style={{
                    borderBottom:
                      i < data.upcoming_sessions.length - 1
                        ? '1px solid var(--border)'
                        : 'none',
                  }}
                >
                  <Avatar
                    name={session.tutor_name}
                    avatarUrl={session.tutor_avatar_url}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[var(--text)] truncate"
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        margin: 0,
                      }}
                    >
                      {session.tutor_name}
                    </p>
                    <p
                      style={{
                        color: 'var(--muted)',
                        fontSize: '0.8rem',
                        margin: 0,
                      }}
                    >
                      {session.subject}
                    </p>
                  </div>
                  <SessionCountdown
                    date={session.date}
                    startTime={session.start_time}
                    sessionId={session.id}
                    mode={session.mode}
                  />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Pending Reviews">
          {data.pending_reviews.length === 0 ? (
            <EmptyState
              icon={<Star size={22} strokeWidth={1.5} />}
              title="No reviews to respond to"
              description="Your student reviews will appear here"
            />
          ) : (
            <div className="flex flex-col">
              {data.pending_reviews.map((review, i) => (
                <div
                  key={review.id}
                  className="py-3"
                  style={{
                    borderBottom:
                      i < data.pending_reviews.length - 1
                        ? '1px solid var(--border)'
                        : 'none',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar name={review.student_name} size="xs" />
                    <span
                      className="text-[var(--text)]"
                      style={{ fontSize: '0.875rem', fontWeight: 500 }}
                    >
                      {review.student_name}
                    </span>
                    <span style={{ color: '#BA7517', fontSize: '0.8rem' }}>
                      {'★'.repeat(review.rating)}
                      {'☆'.repeat(5 - review.rating)}
                    </span>
                  </div>
                  <p
                    style={{
                      color: 'var(--muted)',
                      fontSize: '0.82rem',
                      margin: '4px 0 8px',
                    }}
                  >
                    {review.comment.length > 100
                      ? review.comment.slice(0, 100) + '...'
                      : review.comment}
                  </p>
                  <ReviewResponder reviewId={review.id} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Recent Earnings - full width */}
      <SectionCard
        title="Recent Earnings"
        noPadding
        action={
          data.recent_earnings.length > 0
            ? { label: 'View all', href: '/dashboard/tutor/earnings' }
            : undefined
        }
      >
        <RecentEarningsTable earnings={data.recent_earnings} />
      </SectionCard>
    </div>
  )
}
