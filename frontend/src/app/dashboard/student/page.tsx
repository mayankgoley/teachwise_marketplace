import { cookies } from 'next/headers'
import {
  CalendarDays,
  CheckCircle,
  Target,
  ClipboardList,
  BookOpen,
  Wallet,
} from 'lucide-react'
import StatCard from '@/components/ui/StatCard'
import SectionCard from '@/components/ui/SectionCard'
import EmptyState from '@/components/ui/EmptyState'
import Avatar from '@/components/ui/Avatar'
import StatusBadge from '@/components/ui/StatusBadge'
import RecentBookingsTable from '@/components/features/tables/RecentBookingsTable'
import SessionCountdown from '@/components/ui/SessionCountdown'
import {
  formatCurrency,
  formatDate,
  getGreeting,
  getFirstName,
} from '@/lib/format'
import type { StudentDashboardData } from '@/types/dashboard'
import type { ApiResponse } from '@/lib/api'

export default async function StudentDashboardPage() {
  const cookieStore = await cookies()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

  let data: StudentDashboardData | null = null
  let userName = 'Student'

  try {
    const [dashRes, meRes] = await Promise.all([
      fetch(`${apiUrl}/api/v1/student/dashboard`, {
        headers: { Cookie: cookieStore.toString() },
        cache: 'no-store',
      }),
      fetch(`${apiUrl}/api/v1/auth/me`, {
        headers: { Cookie: cookieStore.toString() },
        cache: 'no-store',
      }),
    ])
    const dashJson: ApiResponse<StudentDashboardData> = await dashRes.json()
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
          Here&apos;s what&apos;s happening with your learning today
        </p>
      </div>

      {/* Stats grid */}
      <div
        className="grid gap-4 mb-8"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        }}
      >
        <StatCard
          label="Upcoming Sessions"
          value={data.stats.upcoming_sessions}
          icon={<CalendarDays size={22} strokeWidth={1.5} />}
          color="blue"
        />
        <StatCard
          label="Completed"
          value={data.stats.completed_sessions}
          icon={<CheckCircle size={22} strokeWidth={1.5} />}
          color="green"
        />
        <StatCard
          label="Wallet Balance"
          value={formatCurrency(data.stats.wallet_balance)}
          icon={<Wallet size={22} strokeWidth={1.5} />}
          color="amber"
        />
        <StatCard
          label="Active Goals"
          value={data.stats.active_goals}
          icon={<Target size={22} strokeWidth={1.5} />}
          color="purple"
        />
        <StatCard
          label="Assignments Due"
          value={data.stats.pending_assignments}
          icon={<ClipboardList size={22} strokeWidth={1.5} />}
          color="amber"
        />
        <StatCard
          label="Total Bookings"
          value={data.stats.total_bookings}
          icon={<BookOpen size={22} strokeWidth={1.5} />}
          color="blue"
        />
      </div>

      {/* Two-column: Upcoming Sessions + Pending Assignments */}
      <div
        className="grid gap-6 mb-6"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}
      >
        <SectionCard
          title="Upcoming Sessions"
          action={
            data.upcoming_sessions.length > 0
              ? { label: 'View all', href: '/dashboard/student/bookings' }
              : undefined
          }
        >
          {data.upcoming_sessions.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={22} strokeWidth={1.5} />}
              title="No upcoming sessions"
              description="Find a tutor and book your first session"
              action={{ label: 'Find a Tutor', href: '/search' }}
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
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: '100px',
                      background:
                        session.mode === 'online'
                          ? 'rgba(79,142,255,0.12)'
                          : 'rgba(186,117,23,0.12)',
                      color:
                        session.mode === 'online' ? '#4f8eff' : '#BA7517',
                    }}
                  >
                    {session.mode === 'online' ? 'Online' : 'In Person'}
                  </span>
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

        <SectionCard title="Pending Assignments">
          {data.pending_assignments.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={22} strokeWidth={1.5} />}
              title="No pending assignments"
              description="Your tutor will assign work here"
            />
          ) : (
            <div className="flex flex-col">
              {data.pending_assignments.map((a, i) => {
                const isOverdue =
                  a.due_date && new Date(a.due_date) < new Date()
                const isSoon =
                  a.due_date &&
                  !isOverdue &&
                  new Date(a.due_date).getTime() - Date.now() <
                    2 * 24 * 60 * 60 * 1000
                return (
                  <div
                    key={a.id}
                    className="py-3"
                    style={{
                      borderBottom:
                        i < data.pending_assignments.length - 1
                          ? '1px solid var(--border)'
                          : 'none',
                    }}
                  >
                    <p
                      className="text-[var(--text)]"
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        margin: '0 0 2px',
                      }}
                    >
                      {a.title}
                    </p>
                    <p
                      style={{
                        color: 'var(--muted)',
                        fontSize: '0.8rem',
                        margin: '0 0 4px',
                      }}
                    >
                      {a.tutor_name}
                    </p>
                    {a.due_date && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: isOverdue
                            ? '#E24B4A'
                            : isSoon
                              ? '#BA7517'
                              : 'var(--muted)',
                          fontWeight: isOverdue || isSoon ? 600 : 400,
                        }}
                      >
                        {isOverdue ? 'Overdue' : `Due ${formatDate(a.due_date)}`}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Two-column: Goals + Recent Bookings */}
      <div
        className="grid gap-6"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}
      >
        <SectionCard
          title="Learning Goals"
          action={
            data.active_goals.length > 0
              ? { label: 'View all', href: '/dashboard/student/progress' }
              : undefined
          }
        >
          {data.active_goals.length === 0 ? (
            <EmptyState
              icon={<Target size={22} strokeWidth={1.5} />}
              title="No active goals"
              description="Set learning goals to track your progress"
            />
          ) : (
            <div className="flex flex-col">
              {data.active_goals.map((goal, i) => (
                <div
                  key={goal.id}
                  className="py-3"
                  style={{
                    borderBottom:
                      i < data.active_goals.length - 1
                        ? '1px solid var(--border)'
                        : 'none',
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-[var(--text)]"
                      style={{ fontSize: '0.875rem', fontWeight: 500 }}
                    >
                      {goal.title}
                    </span>
                    <StatusBadge status={goal.status} />
                  </div>
                  {goal.skill_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {goal.skill_tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: '0.7rem',
                            padding: '2px 8px',
                            borderRadius: '100px',
                            background: 'rgba(255,255,255,0.06)',
                            color: 'var(--muted)',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Recent Bookings"
          noPadding
          action={
            data.recent_bookings.length > 0
              ? { label: 'View all', href: '/dashboard/student/bookings' }
              : undefined
          }
        >
          <RecentBookingsTable bookings={data.recent_bookings} />
        </SectionCard>
      </div>
    </div>
  )
}
