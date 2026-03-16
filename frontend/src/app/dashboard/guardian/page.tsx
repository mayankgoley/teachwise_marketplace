import { cookies } from 'next/headers'
import { Users, CheckCircle, CreditCard, CalendarDays } from 'lucide-react'
import StatCard from '@/components/ui/StatCard'
import SectionCard from '@/components/ui/SectionCard'
import EmptyState from '@/components/ui/EmptyState'
import Avatar from '@/components/ui/Avatar'
import ApprovalActions from './ApprovalActions'
import {
  formatCurrency,
  formatDate,
  formatTime,
  formatRelativeTime,
  getGreeting,
  getFirstName,
} from '@/lib/format'
import type { GuardianDashboardData } from '@/types/dashboard'
import type { ApiResponse } from '@/lib/api'

export default async function GuardianDashboardPage() {
  const cookieStore = await cookies()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

  let data: GuardianDashboardData | null = null
  let userName = 'Guardian'

  try {
    const [dashRes, meRes] = await Promise.all([
      fetch(`${apiUrl}/api/v1/guardian/dashboard`, {
        headers: { Cookie: cookieStore.toString() },
        cache: 'no-store',
      }),
      fetch(`${apiUrl}/api/v1/auth/me`, {
        headers: { Cookie: cookieStore.toString() },
        cache: 'no-store',
      }),
    ])
    const dashJson: ApiResponse<GuardianDashboardData> = await dashRes.json()
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

  const spendingPercent =
    data.stats.monthly_limit && data.stats.monthly_limit > 0
      ? (data.stats.this_month_spending / data.stats.monthly_limit) * 100
      : 0

  const activityDotColors: Record<string, string> = {
    booking: '#4f8eff',
    session: '#639922',
    payment: '#BA7517',
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
          Monitor your children&apos;s learning activity
        </p>
      </div>

      {/* Spending progress bar */}
      {data.stats.monthly_limit && data.stats.monthly_limit > 0 && (
        <SectionCard title="Monthly Spending" className="mb-6">
          <div>
            <div
              className="flex justify-between"
              style={{ marginBottom: '8px' }}
            >
              <span
                style={{ color: 'var(--muted)', fontSize: '0.875rem' }}
              >
                {formatCurrency(data.stats.this_month_spending)} spent
              </span>
              <span
                style={{ color: 'var(--muted)', fontSize: '0.875rem' }}
              >
                {formatCurrency(data.stats.monthly_limit)} limit
              </span>
            </div>
            <div
              style={{
                background: 'var(--border)',
                borderRadius: '100px',
                height: '8px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.min(spendingPercent, 100)}%`,
                  height: '100%',
                  background:
                    spendingPercent > 90
                      ? '#E24B4A'
                      : spendingPercent > 70
                        ? '#BA7517'
                        : '#639922',
                  borderRadius: '100px',
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
          </div>
        </SectionCard>
      )}

      {/* Stats grid */}
      <div
        className="grid gap-4 mb-8"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        }}
      >
        <StatCard
          label="Children"
          value={data.stats.linked_children}
          icon={<Users size={22} strokeWidth={1.5} />}
          color="blue"
        />
        <StatCard
          label="Pending Approvals"
          value={data.stats.pending_approvals}
          icon={<CheckCircle size={22} strokeWidth={1.5} />}
          color="amber"
        />
        <StatCard
          label="This Month"
          value={formatCurrency(data.stats.this_month_spending)}
          icon={<CreditCard size={22} strokeWidth={1.5} />}
          color="green"
        />
      </div>

      {/* Pending Approvals */}
      {data.pending_approvals.length > 0 && (
        <SectionCard
          title="Pending Approvals"
          className="mb-6"
          action={{ label: 'View all', href: '/dashboard/guardian/approvals' }}
        >
          <div className="flex flex-col">
            {data.pending_approvals.map((a, i) => (
              <div
                key={a.id}
                className="flex items-center gap-4 py-3"
                style={{
                  borderBottom:
                    i < data.pending_approvals.length - 1
                      ? '1px solid var(--border)'
                      : 'none',
                }}
              >
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[var(--text)]"
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      margin: '0 0 2px',
                    }}
                  >
                    {a.child_name} &rarr; {a.tutor_name}
                  </p>
                  <p
                    style={{
                      color: 'var(--muted)',
                      fontSize: '0.8rem',
                      margin: 0,
                    }}
                  >
                    {a.subject} &middot; {formatDate(a.date)} at{' '}
                    {formatTime(a.start_time)} &middot;{' '}
                    {formatCurrency(a.amount)}
                  </p>
                </div>
                <ApprovalActions bookingId={a.booking_id} />
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Children overview grid */}
      <SectionCard
        title="Your Children"
        className="mb-6"
        action={
          data.children.length > 0
            ? { label: 'View all', href: '/dashboard/guardian/children' }
            : undefined
        }
      >
        {data.children.length === 0 ? (
          <EmptyState
            icon={<Users size={22} strokeWidth={1.5} />}
            title="No children linked"
            description="Your linked children will appear here"
          />
        ) : (
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            }}
          >
            {data.children.map((child) => (
              <div
                key={child.id}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  padding: '20px',
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Avatar
                    name={child.name}
                    avatarUrl={child.avatar_url}
                    size="lg"
                  />
                  <div>
                    <p
                      className="text-[var(--text)]"
                      style={{
                        fontWeight: 600,
                        fontSize: '1rem',
                        margin: 0,
                      }}
                    >
                      {child.name}
                    </p>
                    {child.last_session_date && (
                      <p
                        style={{
                          color: 'var(--muted)',
                          fontSize: '0.75rem',
                          margin: 0,
                        }}
                      >
                        Last session: {formatDate(child.last_session_date)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-4">
                  <div>
                    <span
                      className="font-head font-bold text-[var(--text)]"
                      style={{ fontSize: '1.3rem' }}
                    >
                      {child.upcoming_sessions}
                    </span>
                    <span
                      style={{
                        color: 'var(--muted)',
                        fontSize: '0.72rem',
                        display: 'block',
                      }}
                    >
                      Upcoming
                    </span>
                  </div>
                  <div>
                    <span
                      className="font-head font-bold text-[var(--text)]"
                      style={{ fontSize: '1.3rem' }}
                    >
                      {child.pending_assignments}
                    </span>
                    <span
                      style={{
                        color: 'var(--muted)',
                        fontSize: '0.72rem',
                        display: 'block',
                      }}
                    >
                      Assignments
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Recent Activity */}
      <SectionCard
        title="Recent Activity"
        action={
          data.recent_activity.length > 0
            ? { label: 'View all', href: '/dashboard/guardian/activity' }
            : undefined
        }
      >
        {data.recent_activity.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={22} strokeWidth={1.5} />}
            title="No recent activity"
            description="Activity from your children will appear here"
          />
        ) : (
          <div className="flex flex-col">
            {data.recent_activity.map((activity, i) => (
              <div
                key={i}
                className="flex items-start gap-3 py-3"
                style={{
                  borderBottom:
                    i < data.recent_activity.length - 1
                      ? '1px solid var(--border)'
                      : 'none',
                }}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background:
                      activityDotColors[activity.type] ?? 'var(--muted)',
                    marginTop: '6px',
                    flexShrink: 0,
                  }}
                />
                <div className="flex-1">
                  <p
                    className="text-[var(--text)]"
                    style={{
                      fontSize: '0.875rem',
                      margin: '0 0 2px',
                    }}
                  >
                    {activity.description}
                  </p>
                  <p
                    style={{
                      color: 'var(--muted)',
                      fontSize: '0.75rem',
                      margin: 0,
                    }}
                  >
                    {activity.child_name} &middot;{' '}
                    {formatRelativeTime(activity.date)}
                    {activity.amount !== null &&
                      ` · ${formatCurrency(activity.amount)}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
