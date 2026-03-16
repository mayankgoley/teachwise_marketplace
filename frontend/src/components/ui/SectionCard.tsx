import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface SectionCardProps {
  title: string
  subtitle?: string
  action?: { label: string; href: string }
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}

export default function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = '',
  noPadding = false,
}: SectionCardProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '20px',
        overflow: 'hidden',
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div>
          <h3
            className="font-head font-bold text-[var(--text)]"
            style={{ fontSize: '1.1rem', margin: 0 }}
          >
            {title}
          </h3>
          {subtitle && (
            <p
              style={{
                color: 'var(--muted)',
                fontSize: '0.82rem',
                margin: '2px 0 0',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {action && (
          <Link
            href={action.href}
            className="flex items-center gap-1 no-underline hover:underline"
            style={{ color: 'var(--accent)', fontSize: '0.82rem' }}
          >
            {action.label}
            <ChevronRight size={14} strokeWidth={1.5} />
          </Link>
        )}
      </div>
      <div style={{ padding: noPadding ? 0 : '24px' }}>{children}</div>
    </div>
  )
}
