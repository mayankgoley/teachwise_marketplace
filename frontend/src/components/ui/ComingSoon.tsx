import { Clock } from 'lucide-react'

interface ComingSoonProps {
  title: string
  phase?: string
}

export default function ComingSoon({ title, phase }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20">
      <div
        className="flex items-center justify-center mb-4"
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(79,142,255,0.08)',
          border: '1px solid rgba(79,142,255,0.2)',
          color: 'var(--accent)',
        }}
      >
        <Clock size={28} strokeWidth={1.5} />
      </div>
      <h2
        className="font-head font-bold text-[var(--text)]"
        style={{ fontSize: '1.5rem', margin: '0 0 8px' }}
      >
        {title}
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
        This feature is coming soon.
        {phase && (
          <span style={{ display: 'block', marginTop: '4px', fontSize: '0.8rem' }}>
            Planned for {phase}
          </span>
        )}
      </p>
    </div>
  )
}
