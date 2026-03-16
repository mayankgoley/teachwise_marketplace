'use client'

import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

const colorMap = {
  blue: {
    bg: 'rgba(79,142,255,0.12)',
    color: '#4f8eff',
    border: 'rgba(79,142,255,0.25)',
  },
  green: {
    bg: 'rgba(99,153,34,0.12)',
    color: '#639922',
    border: 'rgba(99,153,34,0.25)',
  },
  amber: {
    bg: 'rgba(186,117,23,0.12)',
    color: '#BA7517',
    border: 'rgba(186,117,23,0.25)',
  },
  purple: {
    bg: 'rgba(127,119,221,0.12)',
    color: '#7F77DD',
    border: 'rgba(127,119,221,0.25)',
  },
  cyan: {
    bg: 'rgba(0,229,255,0.12)',
    color: '#00e5ff',
    border: 'rgba(0,229,255,0.25)',
  },
}

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  trend?: { value: number; direction: 'up' | 'down' }
  color?: 'blue' | 'green' | 'amber' | 'purple' | 'cyan'
  onClick?: () => void
}

export default function StatCard({
  label,
  value,
  icon,
  trend,
  color = 'blue',
  onClick,
}: StatCardProps) {
  const c = colorMap[color]

  return (
    <div
      className={`stat-card ${onClick ? 'stat-card-clickable' : ''}`}
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '24px',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="flex items-center justify-center"
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: c.bg,
            border: `1px solid ${c.border}`,
            color: c.color,
          }}
        >
          {icon}
        </div>
        {trend && (
          <span
            className="flex items-center gap-1 text-[0.75rem] font-semibold px-2 py-1 rounded-full"
            style={{
              background:
                trend.direction === 'up'
                  ? 'rgba(99,153,34,0.12)'
                  : 'rgba(226,75,74,0.12)',
              color: trend.direction === 'up' ? '#639922' : '#E24B4A',
            }}
          >
            {trend.direction === 'up' ? (
              <ArrowUpRight size={12} strokeWidth={1.5} />
            ) : (
              <ArrowDownRight size={12} strokeWidth={1.5} />
            )}
            {trend.value}%
          </span>
        )}
      </div>
      <div
        className="font-head font-bold text-[var(--text)]"
        style={{ fontSize: '2rem' }}
      >
        {value}
      </div>
      <div
        className="text-[var(--muted)] uppercase"
        style={{
          fontSize: '0.82rem',
          letterSpacing: '0.06em',
          marginTop: '4px',
        }}
      >
        {label}
      </div>
    </div>
  )
}
