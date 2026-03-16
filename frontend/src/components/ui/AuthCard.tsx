interface AuthCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
}

export default function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-card-lg p-10 overflow-hidden">
      {/* Top edge gradient line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, var(--accent), var(--accent2), transparent)',
        }}
      />

      <h1 className="font-head text-[2rem] font-bold text-[var(--text)] mb-1">
        {title}
      </h1>
      {subtitle && (
        <p className="text-[var(--muted)] text-[0.95rem] mb-8">{subtitle}</p>
      )}

      {children}
    </div>
  )
}
