'use client'

import { useState, useEffect, useCallback } from 'react'
import { BarChart3, Users, DollarSign, BookOpen, Star, Loader2 } from 'lucide-react'
import { apiGet } from '@/lib/api'
import { formatCurrency } from '@/lib/format'
import type { AnalyticsData } from '@/types/admin'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts'

function formatChartDate(dateStr: unknown): string {
  const d = new Date(String(dateStr) + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const tooltipStyle = {
  contentStyle: {
    background: '#1a1a2e',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#fff',
    fontSize: '0.8rem',
  },
  itemStyle: { color: '#fff' },
  labelStyle: { color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiGet<AnalyticsData>('/api/v1/admin/analytics')
      if (res.success) {
        setData(res.data)
      } else {
        setError(res.error?.message ?? 'Failed to load analytics')
      }
    } catch {
      setError('Failed to load analytics. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2
          size={32}
          strokeWidth={1.5}
          className="animate-spin"
          style={{ color: 'var(--muted)' }}
        />
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: 12 }}>
          Loading analytics...
        </p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          {error ?? 'Failed to load analytics data.'}
        </p>
        <button
          onClick={fetchAnalytics}
          style={{
            marginTop: 12,
            color: 'var(--accent)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '0.875rem',
          }}
        >
          Try again
        </button>
      </div>
    )
  }

  const statCards = [
    {
      label: 'Total Students',
      value: data.users.total_students.toLocaleString(),
      subtext: `+${data.users.new_students_30d} this month`,
      icon: <Users size={24} strokeWidth={1.5} />,
      iconBg: 'rgba(79,142,255,0.12)',
      iconColor: '#4f8eff',
    },
    {
      label: 'Total Tutors',
      value: data.users.total_tutors.toLocaleString(),
      subtext: `${data.users.verified_tutors} verified`,
      icon: <Users size={24} strokeWidth={1.5} />,
      iconBg: 'rgba(99,153,34,0.12)',
      iconColor: '#639922',
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(data.revenue.total),
      subtext: `+${formatCurrency(data.revenue.last_30_days)} this month`,
      icon: <DollarSign size={24} strokeWidth={1.5} />,
      iconBg: 'rgba(234,179,8,0.12)',
      iconColor: '#eab308',
    },
    {
      label: 'Sessions',
      value: data.bookings.completed_sessions.toLocaleString(),
      subtext: `${data.bookings.last_30_days} bookings this month`,
      icon: <BookOpen size={24} strokeWidth={1.5} />,
      iconBg: 'rgba(168,85,247,0.12)',
      iconColor: '#a855f7',
    },
  ]

  const axisProps = {
    tick: { fill: 'var(--muted)', fontSize: 11 },
    axisLine: { stroke: 'var(--border)' },
    tickLine: false as const,
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1
          className="font-head font-bold"
          style={{ fontSize: '1.75rem', color: 'var(--text)', margin: '0 0 4px' }}
        >
          Analytics
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Platform overview and metrics
        </p>
      </div>

      {/* Stat cards */}
      <style>{`
        @media (min-width: 1024px) {
          .analytics-stat-grid {
            grid-template-columns: repeat(4, 1fr) !important;
          }
        }
      `}</style>
      <div
        className="analytics-stat-grid grid gap-4"
        style={{
          gridTemplateColumns: 'repeat(2, 1fr)',
          marginBottom: 32,
        }}
      >
        {statCards.map((card) => (
          <div
            key={card.label}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 20,
              padding: 24,
            }}
          >
            <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
              <div
                className="flex items-center justify-center"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: card.iconBg,
                  color: card.iconColor,
                  flexShrink: 0,
                }}
              >
                {card.icon}
              </div>
              <span
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--muted)',
                  fontWeight: 500,
                }}
              >
                {card.label}
              </span>
            </div>
            <p
              className="font-head font-bold"
              style={{
                fontSize: '2rem',
                color: 'var(--text)',
                margin: '0 0 4px',
                lineHeight: 1.1,
              }}
            >
              {card.value}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: 0 }}>
              {card.subtext}
            </p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div
        className="flex gap-4"
        style={{ flexWrap: 'wrap', marginBottom: 32 }}
      >
        {/* Daily Signups */}
        <div
          style={{
            flex: '1 1 400px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: 24,
          }}
        >
          <h2
            className="font-head font-bold"
            style={{ fontSize: '1.1rem', color: 'var(--text)', margin: '0 0 16px' }}
          >
            Daily Signups
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.charts.daily_signups}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                {...axisProps}
                tickFormatter={formatChartDate}
              />
              <YAxis {...axisProps} allowDecimals={false} />
              <Tooltip
                contentStyle={tooltipStyle.contentStyle}
                itemStyle={tooltipStyle.itemStyle}
                labelStyle={tooltipStyle.labelStyle}
                labelFormatter={formatChartDate}
              />
              <Bar
                dataKey="students"
                name="Students"
                fill="#4f8eff"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="tutors"
                name="Tutors"
                fill="#639922"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Daily Revenue */}
        <div
          style={{
            flex: '1 1 400px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: 24,
          }}
        >
          <h2
            className="font-head font-bold"
            style={{ fontSize: '1.1rem', color: 'var(--text)', margin: '0 0 16px' }}
          >
            Daily Revenue
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.charts.daily_revenue}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                {...axisProps}
                tickFormatter={formatChartDate}
              />
              <YAxis
                {...axisProps}
                allowDecimals={false}
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip
                contentStyle={tooltipStyle.contentStyle}
                itemStyle={tooltipStyle.itemStyle}
                labelStyle={tooltipStyle.labelStyle}
                labelFormatter={formatChartDate}
                formatter={(value: unknown) => [formatCurrency(Number(value)), 'Revenue']}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="#639922"
                strokeWidth={2}
                dot={{ fill: '#639922', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0, fill: '#639922' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Additional stats row */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}
      >
        {/* Total Reviews */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: 24,
          }}
        >
          <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
            <div
              className="flex items-center justify-center"
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(234,179,8,0.12)',
                color: '#eab308',
                flexShrink: 0,
              }}
            >
              <BarChart3 size={24} strokeWidth={1.5} />
            </div>
            <span
              style={{
                fontSize: '0.82rem',
                color: 'var(--muted)',
                fontWeight: 500,
              }}
            >
              Total Reviews
            </span>
          </div>
          <p
            className="font-head font-bold"
            style={{
              fontSize: '2rem',
              color: 'var(--text)',
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            {data.reviews.total.toLocaleString()}
          </p>
        </div>

        {/* Average Rating */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: 24,
          }}
        >
          <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
            <div
              className="flex items-center justify-center"
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(234,179,8,0.12)',
                color: '#eab308',
                flexShrink: 0,
              }}
            >
              <Star size={24} strokeWidth={1.5} />
            </div>
            <span
              style={{
                fontSize: '0.82rem',
                color: 'var(--muted)',
                fontWeight: 500,
              }}
            >
              Average Rating
            </span>
          </div>
          <div className="flex items-center gap-3">
            <p
              className="font-head font-bold"
              style={{
                fontSize: '2rem',
                color: 'var(--text)',
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              {data.reviews.average_rating.toFixed(1)}
            </p>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={18}
                  strokeWidth={1.5}
                  fill={star <= Math.round(data.reviews.average_rating) ? '#eab308' : 'none'}
                  color="#eab308"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
