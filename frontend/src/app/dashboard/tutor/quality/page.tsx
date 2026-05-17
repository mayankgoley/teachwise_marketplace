'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Award, TrendingUp } from 'lucide-react'
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { apiGet } from '@/lib/api'
import SectionCard from '@/components/ui/SectionCard'

type Components = {
  rating: number | null
  completion: number | null
  response_time: number | null
  repeat_rate: number | null
  profile_completeness: number | null
}

type Suggestion = {
  component: string
  message: string
  missing?: string[]
}

type MyQuality = {
  tutor_id: number
  score: number | null
  is_provisional: boolean
  components: Components
  sessions_in_window: number
  computed_at: string | null
  profile_checks: Record<string, boolean>
  suggestions: Suggestion[]
}

type HistoryPoint = {
  score: number | null
  is_provisional: boolean
  saved_at: string | null
}

const COMPONENT_META: Record<keyof Components, { label: string; weight: number }> = {
  rating: { label: 'Student Rating', weight: 40 },
  completion: { label: 'Completion Rate', weight: 20 },
  response_time: { label: 'Response Time', weight: 15 },
  repeat_rate: { label: 'Repeat Students', weight: 15 },
  profile_completeness: { label: 'Profile Completeness', weight: 10 },
}

export default function TutorQualityPage() {
  const [data, setData] = useState<MyQuality | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [q, h] = await Promise.all([
        apiGet<MyQuality>('/api/v1/tutor/me/quality'),
        apiGet<{ history: HistoryPoint[] }>('/api/v1/tutor/me/quality/history?weeks=12'),
      ])
      if (q.success) setData(q.data)
      if (h.success) setHistory(h.data.history)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

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

  if (!data) {
    return (
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
        Could not load your quality score.
      </p>
    )
  }

  const chartData = history.map((h) => ({
    saved_at: h.saved_at?.slice(0, 10) ?? '',
    score: h.score,
  }))

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1
          className="font-head font-bold text-[var(--text)]"
          style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
        >
          Quality Score
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Composite score on a rolling 90-day window
        </p>
      </div>

      <SectionCard
        title={data.is_provisional ? 'Provisional' : 'Current Score'}
        subtitle={
          data.is_provisional
            ? `Complete ${Math.max(0, 5 - data.sessions_in_window)} more sessions to qualify`
            : `Computed ${data.computed_at?.slice(0, 16).replace('T', ' ') ?? ''}`
        }
        className="mb-6"
      >
        {data.is_provisional ? (
          <div className="flex items-center gap-3">
            <Award size={24} strokeWidth={1.5} style={{ color: '#BA7517' }} />
            <span style={{ fontSize: '1rem', color: 'var(--text)' }}>
              Building reputation
            </span>
          </div>
        ) : (
          <div className="flex items-baseline gap-3">
            <span
              className="font-head font-bold text-[var(--text)]"
              style={{ fontSize: '2.5rem' }}
            >
              {(data.score ?? 0).toFixed(0)}
            </span>
            <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
              / 100 · {data.sessions_in_window} sessions in window
            </span>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Breakdown"
        subtitle="Weighted contribution of each component"
        className="mb-6"
        noPadding
      >
        {(Object.keys(COMPONENT_META) as (keyof Components)[]).map((key, i, arr) => {
          const value = data.components[key]
          const meta = COMPONENT_META[key]
          const display = value === null ? '—' : `${value.toFixed(0)}`
          const pct = value ?? 0
          return (
            <div
              key={key}
              style={{
                padding: '14px 20px',
                borderBottom:
                  i < arr.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div
                className="flex items-center justify-between"
                style={{ marginBottom: '8px' }}
              >
                <span
                  style={{
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: 'var(--text)',
                  }}
                >
                  {meta.label}{' '}
                  <span style={{ color: 'var(--muted)', fontWeight: 400 }}>
                    · {meta.weight}%
                  </span>
                </span>
                <span
                  style={{
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: value === null ? 'var(--muted)' : 'var(--text)',
                  }}
                >
                  {display}
                  {value !== null && (
                    <span style={{ color: 'var(--muted)', fontWeight: 400 }}>
                      {' '}/ 100
                    </span>
                  )}
                </span>
              </div>
              <div
                style={{
                  height: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '100px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background:
                      pct >= 80
                        ? 'linear-gradient(90deg, #639922, #00e5ff)'
                        : pct >= 60
                          ? 'var(--accent)'
                          : '#BA7517',
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
            </div>
          )
        })}
      </SectionCard>

      {data.suggestions.length > 0 && (
        <SectionCard
          title="Suggestions"
          subtitle="Where you can move the score most"
          className="mb-6"
          noPadding
        >
          {data.suggestions.map((s, i) => (
            <div
              key={s.component}
              style={{
                padding: '14px 20px',
                borderBottom:
                  i < data.suggestions.length - 1
                    ? '1px solid var(--border)'
                    : 'none',
              }}
            >
              <p
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text)',
                  margin: 0,
                  fontWeight: 600,
                }}
              >
                {COMPONENT_META[s.component as keyof Components]?.label ??
                  s.component}
              </p>
              <p
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--muted)',
                  margin: '4px 0 0',
                }}
              >
                {s.message}
              </p>
            </div>
          ))}
        </SectionCard>
      )}

      <SectionCard
        title="12-Week Trend"
        subtitle="Score history snapshots"
        className="mb-6"
      >
        {chartData.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', margin: 0 }}>
            <TrendingUp
              size={14}
              strokeWidth={1.5}
              style={{
                marginRight: 8,
                verticalAlign: 'middle',
                display: 'inline-block',
              }}
            />
            Snapshots appear weekly. Check back next week.
          </p>
        ) : (
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="saved_at"
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    fontSize: '0.82rem',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--accent)', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
