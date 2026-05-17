'use client'

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
import { formatCurrency } from '@/lib/format'

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

const axisProps = {
  tick: { fill: 'var(--muted)', fontSize: 11 },
  axisLine: { stroke: 'var(--border)' },
  tickLine: false as const,
}

interface AnalyticsChartsProps {
  dailySignups: Array<Record<string, unknown>>
  dailyRevenue: Array<Record<string, unknown>>
}

export default function AnalyticsCharts({ dailySignups, dailyRevenue }: AnalyticsChartsProps) {
  return (
    <div
      className="flex gap-4"
      style={{ flexWrap: 'wrap', marginBottom: 32 }}
    >
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
          <BarChart data={dailySignups}>
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
          <LineChart data={dailyRevenue}>
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
  )
}
