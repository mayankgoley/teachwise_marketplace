'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Loader2, Calendar } from 'lucide-react'
import { apiGet } from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'
import Avatar from '@/components/ui/Avatar'
import SectionCard from '@/components/ui/SectionCard'
import { formatDate, formatTime, formatCurrency } from '@/lib/format'
import type { ChildActivity } from '@/types/guardian'

export default function ChildActivityPage() {
  const params = useParams()
  const childId = params.id as string
  const [data, setData] = useState<ChildActivity | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchActivity = useCallback(async () => {
    try {
      const res = await apiGet<ChildActivity>('/api/v1/guardian/children/' + childId + '/activity')
      if (res.success) {
        setData(res.data)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }, [childId])

  useEffect(() => {
    fetchActivity()
  }, [fetchActivity])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <Loader2
          size={32}
          strokeWidth={1.5}
          style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }}
        />
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '16px' }}>
          Loading activity...
        </p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          Failed to load activity data. Please refresh the page.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Back link */}
      <Link
        href="/dashboard/guardian/children"
        className="flex items-center gap-1.5"
        style={{
          color: 'var(--muted)',
          fontSize: '0.82rem',
          textDecoration: 'none',
          marginBottom: '16px',
          display: 'inline-flex',
        }}
      >
        <ArrowLeft size={16} strokeWidth={1.5} />
        Back
      </Link>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1
          className="font-head font-bold text-[var(--text)]"
          style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
        >
          {data.child.name}&apos;s Activity
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Recent bookings and payments
        </p>
      </div>

      {/* Recent Bookings */}
      <SectionCard title="Recent Bookings" className="mb-6" noPadding>
        {data.bookings.length === 0 ? (
          <div style={{ padding: '24px' }}>
            <EmptyState
              icon={<Calendar size={22} strokeWidth={1.5} />}
              title="No bookings yet"
              description="This child has no bookings to display."
            />
          </div>
        ) : (
          <div>
            {data.bookings.map((booking, i) => (
              <div
                key={booking.id}
                className="flex items-center gap-4"
                style={{
                  padding: '16px 20px',
                  borderBottom:
                    i < data.bookings.length - 1
                      ? '1px solid var(--border)'
                      : 'none',
                }}
              >
                <Avatar
                  name={booking.tutor.name}
                  avatarUrl={booking.tutor.avatar_url}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--text)',
                      }}
                    >
                      {booking.tutor.name}
                    </span>
                    <StatusBadge status={booking.status} />
                  </div>
                  <div
                    className="flex items-center gap-3 flex-wrap"
                    style={{ fontSize: '0.8rem', color: 'var(--muted)' }}
                  >
                    {booking.subject && <span>{booking.subject}</span>}
                    {booking.date && (
                      <span>{formatDate(booking.date)}</span>
                    )}
                    {booking.start_time && booking.end_time && (
                      <span>
                        {formatTime(booking.start_time)} &ndash; {formatTime(booking.end_time)}
                      </span>
                    )}
                    <span
                      style={{
                        background:
                          booking.mode === 'online'
                            ? 'rgba(79,142,255,0.12)'
                            : 'rgba(186,117,23,0.12)',
                        color:
                          booking.mode === 'online' ? '#4f8eff' : '#BA7517',
                        padding: '2px 8px',
                        borderRadius: '100px',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                      }}
                    >
                      {booking.mode === 'online' ? 'Online' : 'In Person'}
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {formatCurrency(booking.price)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Recent Payments */}
      <SectionCard title="Recent Payments" noPadding>
        {data.payments.length === 0 ? (
          <div style={{ padding: '24px' }}>
            <EmptyState
              icon={<Calendar size={22} strokeWidth={1.5} />}
              title="No payments yet"
              description="This child has no payments to display."
            />
          </div>
        ) : (
          <div>
            {data.payments.map((payment, i) => (
              <div
                key={payment.id}
                className="flex items-center justify-between"
                style={{
                  padding: '16px 20px',
                  borderBottom:
                    i < data.payments.length - 1
                      ? '1px solid var(--border)'
                      : 'none',
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: 'var(--text)',
                    }}
                  >
                    {formatCurrency(payment.amount)}
                  </span>
                  <StatusBadge status={payment.status} />
                </div>
                {payment.created_at && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                    {formatDate(payment.created_at)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
