import Link from 'next/link'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: { label: string; href: string }
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: '40px 20px' }}
    >
      <div
        className="flex items-center justify-center mb-4"
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
          color: 'var(--muted)',
        }}
      >
        {icon}
      </div>
      <h4
        className="font-head font-bold text-[var(--text)]"
        style={{ fontSize: '1.1rem', margin: '0 0 8px' }}
      >
        {title}
      </h4>
      <p
        style={{
          color: 'var(--muted)',
          fontSize: '0.9rem',
          margin: 0,
          maxWidth: '300px',
        }}
      >
        {description}
      </p>
      {action && (
        <Link
          href={action.href}
          className="mt-4 inline-block btn-gradient text-white no-underline"
          style={{
            padding: '10px 24px',
            borderRadius: '100px',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}
