'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Target, Star, BarChart3 } from 'lucide-react'
import {
  Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { apiGet } from '@/lib/api'
import SectionCard from '@/components/ui/SectionCard'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate } from '@/lib/format'
import type { ChildProgress } from '@/types/guardian'

export default function GuardianChildProgressPage() {
  const params = useParams()
  const childId = Number(params?.id)
  const [data, setData] = useState<ChildProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProgress = useCallback(async () => {
    if (!childId) return
    setLoading(true)
    try {
      const res = await apiGet<ChildProgress>(
        `/api/v1/guardian/children/${childId}/progress`
      )
      if (res.success) {
        setData(res.data)
      } else {
        setError(res.error?.message ?? 'Failed to load progress')
      }
    } catch {
      setError('Failed to load progress')
    } finally {
      setLoading(false)
    }
  }, [childId])

  useEffect(() => {
    fetchProgress()
  }, [fetchProgress])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <Loader2
          size={32}
          strokeWidth={1.5}
          style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }}
        />
      </div>
    )
  }

  if (error || !data) {
    return (
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
        {error ?? 'Could not load progress.'}
      </p>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1
          className="font-head font-bold text-[var(--text)]"
          style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
        >
          {data.child.name}&apos;s Progress
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Learning goals, recent ratings, and session trend
        </p>
      </div>

      <SectionCard
        title="Learning Goals"
        subtitle="Goals tracked by tutors"
        className="mb-6"
        noPadding
      >
        {data.goals.length === 0 ? (
          <EmptyState
            icon={<Target size={22} strokeWidth={1.5} />}
            title="No goals yet"
            description="Tutors haven't set learning goals for this child."
          />
        ) : (
          <div>
            {data.goals.map((g, i) => (
              <div
                key={g.id}
                style={{
                  padding: '16px 20px',
                  borderBottom:
                    i < data.goals.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className="font-head font-bold text-[var(--text)]"
                    style={{ fontSize: '0.95rem' }}
                  >
                    {g.title}
                  </span>
                  <span
                    style={{
                      background:
                        g.status === 'completed'
                          ? 'rgba(99,153,34,0.15)'
                          : g.status === 'paused'
                            ? 'rgba(186,117,23,0.15)'
                            : 'rgba(79,142,255,0.15)',
                      color:
                        g.status === 'completed'
                          ? '#639922'
                          : g.status === 'paused'
                            ? '#BA7517'
                            : '#4f8eff',
                      padding: '2px 8px',
                      borderRadius: '100px',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      textTransform: 'capitalize',
                    }}
                  >
                    {g.status}
                  </span>
                </div>
                {g.description && (
                  <p
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--muted)',
                      margin: '4px 0 8px',
                    }}
                  >
                    {g.description}
                  </p>
                )}
                <div
                  className="flex items-center gap-3 flex-wrap"
                  style={{ fontSize: '0.75rem', color: 'var(--muted)' }}
                >
                  {g.tutor && <span>Tutor: {g.tutor.name}</span>}
                  {g.target_date && <span>Target: {formatDate(g.target_date)}</span>}
                  <span>{g.entry_count} progress entries</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Recent Ratings"
        subtitle="Last 10 reviews submitted by this child"
        className="mb-6"
        noPadding
      >
        {data.recent_reviews.length === 0 ? (
          <EmptyState
            icon={<Star size={22} strokeWidth={1.5} />}
            title="No ratings yet"
            description="This child hasn't reviewed any sessions."
          />
        ) : (
          <div>
            {data.recent_reviews.map((r, i) => (
              <div
                key={r.id}
                style={{
                  padding: '14px 20px',
                  borderBottom:
                    i < data.recent_reviews.length - 1
                      ? '1px solid var(--border)'
                      : 'none',
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    style={{
                      fontSize: '0.95rem',
                      color: 'var(--text)',
                      fontWeight: 600,
                    }}
                  >
                    {'★'.repeat(r.rating)}
                    {'☆'.repeat(5 - r.rating)}
                  </span>
                  {r.created_at && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                      {formatDate(r.created_at)}
                    </span>
                  )}
                </div>
                {r.comment && (
                  <p
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--muted)',
                      margin: 0,
                    }}
                  >
                    {r.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Session Trend"
        subtitle="Sessions booked per month — last 6 months"
        className="mb-6"
      >
        {data.session_trend.length === 0 ? (
          <EmptyState
            icon={<BarChart3 size={22} strokeWidth={1.5} />}
            title="No sessions yet"
            description="No bookings in the last 6 months."
          />
        ) : (
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.session_trend}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    fontSize: '0.82rem',
                  }}
                />
                <Bar dataKey="count" fill="var(--accent2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
