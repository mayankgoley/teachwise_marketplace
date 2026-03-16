import { cookies } from 'next/headers'
import {
  CalendarDays,
  Users,
  DollarSign,
  CheckCircle,
  Video,
  AlertCircle,
  Award,
} from 'lucide-react'
import StatCard from '@/components/ui/StatCard'
import SectionCard from '@/components/ui/SectionCard'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'
import AdminBookingsTable from '@/components/features/tables/AdminBookingsTable'
import { formatCurrency, formatRelativeTime } from '@/lib/format'
import type { AdminDashboardData } from '@/types/dashboard'
import type { ApiResponse } from '@/lib/api'

export default async function AdminDashboardPage() {
  const cookieStore = await cookies()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

  let data: AdminDashboardData | null = null

  try {
    const res = await fetch(`${apiUrl}/api/v1/admin/dashboard`, {
      headers: { Cookie: cookieStore.toString() },
      cache: 'no-store',
    })
    const json: ApiResponse<AdminDashboardData> = await res.json()
    if (json.success) data = json.data
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
      {/* Pending verifications alert */}
      {data.stats.pending_verifications > 0 && (
        <div
          className="flex items-center justify-between mb-6"
          style={{
            background: 'rgba(226,75,74,0.08)',
            border: '1px solid rgba(226,75,74,0.25)',
            borderRadius: '12px',
            padding: '16px 20px',
          }}
        >
          <div className="flex items-center gap-3">
            <AlertCircle size={20} color="#E24B4A" strokeWidth={1.5} />
            <span
              className="text-[var(--text)]"
              style={{ fontWeight: 500 }}
            >
              {data.stats.pending_verifications} tutors waiting for verification
            </span>
          </div>
          <a
            href="/dashboard/admin/verification"
            style={{
              color: '#E24B4A',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Review now &rarr;
          </a>
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
          label="Total Tutors"
          value={data.stats.total_tutors}
          icon={<Award size={22} strokeWidth={1.5} />}
          color="green"
        />
        <StatCard
          label="Total Bookings"
          value={data.stats.total_bookings}
          icon={<CalendarDays size={22} strokeWidth={1.5} />}
          color="purple"
        />
        <StatCard
          label="Total Revenue"
          value={formatCurrency(data.stats.total_revenue)}
          icon={<DollarSign size={22} strokeWidth={1.5} />}
          color="green"
        />
        <StatCard
          label="Pending Verifications"
          value={data.stats.pending_verifications}
          icon={<CheckCircle size={22} strokeWidth={1.5} />}
          color="amber"
        />
        <StatCard
          label="Live Sessions Now"
          value={data.stats.active_sessions_now}
          icon={<Video size={22} strokeWidth={1.5} />}
          color="cyan"
        />
      </div>

      {/* Three-column grid */}
      <div
        className="grid gap-6"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
      >
        {/* Pending Verifications */}
        <SectionCard
          title="Pending Verifications"
          action={
            data.pending_verifications.length > 0
              ? { label: 'View all', href: '/dashboard/admin/verification' }
              : undefined
          }
        >
          {data.pending_verifications.length === 0 ? (
            <EmptyState
              icon={<CheckCircle size={22} strokeWidth={1.5} />}
              title="All clear"
              description="No pending verifications"
            />
          ) : (
            <div className="flex flex-col">
              {data.pending_verifications.map((v, i) => (
                <div
                  key={v.id}
                  className="py-3"
                  style={{
                    borderBottom:
                      i < data.pending_verifications.length - 1
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
                    {v.tutor_name}
                  </p>
                  <p
                    style={{
                      color: 'var(--muted)',
                      fontSize: '0.8rem',
                      margin: '0 0 4px',
                    }}
                  >
                    {v.email}
                  </p>
                  <div className="flex items-center justify-between">
                    <span
                      style={{
                        color: 'var(--muted)',
                        fontSize: '0.75rem',
                      }}
                    >
                      {v.document_count} document{v.document_count !== 1 ? 's' : ''} &middot;{' '}
                      {formatRelativeTime(v.submitted_at)}
                    </span>
                    <a
                      href={`/dashboard/admin/verification?id=${v.id}`}
                      style={{
                        color: 'var(--accent)',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                      }}
                    >
                      Review
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Recent Bookings */}
        <SectionCard
          title="Recent Bookings"
          noPadding
          action={
            data.recent_bookings.length > 0
              ? { label: 'View all', href: '/dashboard/admin/bookings' }
              : undefined
          }
        >
          <AdminBookingsTable bookings={data.recent_bookings} />
        </SectionCard>

        {/* Recent Reports */}
        <SectionCard
          title="Recent Reports"
          action={
            data.recent_reports.length > 0
              ? { label: 'View all', href: '/dashboard/admin/moderation' }
              : undefined
          }
        >
          {data.recent_reports.length === 0 ? (
            <EmptyState
              icon={<AlertCircle size={22} strokeWidth={1.5} />}
              title="No reports"
              description="No content reports to review"
            />
          ) : (
            <div className="flex flex-col">
              {data.recent_reports.map((r, i) => (
                <div
                  key={r.id}
                  className="py-3"
                  style={{
                    borderBottom:
                      i < data.recent_reports.length - 1
                        ? '1px solid var(--border)'
                        : 'none',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={r.status} />
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--muted)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {r.content_type}
                    </span>
                  </div>
                  <p
                    className="text-[var(--text)]"
                    style={{
                      fontSize: '0.82rem',
                      margin: '0 0 2px',
                    }}
                  >
                    {r.reason}
                  </p>
                  <p
                    style={{
                      color: 'var(--muted)',
                      fontSize: '0.75rem',
                      margin: 0,
                    }}
                  >
                    Reported by {r.reporter_name} &middot;{' '}
                    {formatRelativeTime(r.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
