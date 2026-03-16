'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  CheckCircle,
  Clock,
  Video,
  Loader2,
  ArrowLeft,
} from 'lucide-react'
import { apiGet } from '@/lib/api'
import SectionCard from '@/components/ui/SectionCard'
import Avatar from '@/components/ui/Avatar'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatDate, formatTime, formatCurrency } from '@/lib/format'
import type { SessionSummary } from '@/types/session'

export default function SessionSummaryPage() {
  const params = useParams()
  const router = useRouter()
  const slotId = params.slotId as string

  const [data, setData] = useState<SessionSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const loadSummary = useCallback(async () => {
    try {
      const res = await apiGet<SessionSummary>(`/api/v1/session/${slotId}/summary`)
      if (res.success) {
        setData(res.data)
      }
    } catch {
      // Will show error state
    } finally {
      setLoading(false)
    }
  }, [slotId])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2
          size={32}
          strokeWidth={1.5}
          className="animate-spin"
          style={{ color: 'var(--accent)' }}
        />
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '16px' }}>
          Loading session summary...
        </p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          Failed to load session summary.
        </p>
        <button
          onClick={() => router.back()}
          style={{
            marginTop: '16px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border)',
            borderRadius: '100px',
            padding: '10px 24px',
            color: 'var(--accent)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Go Back
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px 16px' }}>
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 mb-6"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent)',
          fontSize: '0.875rem',
          fontWeight: 500,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <ArrowLeft size={16} strokeWidth={1.5} />
        Back
      </button>

      <div
        className="flex flex-col items-center text-center mb-8"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '32px 24px',
        }}
      >
        <div
          className="flex items-center justify-center mb-4"
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(99,153,34,0.15)',
          }}
        >
          <CheckCircle size={28} strokeWidth={1.5} style={{ color: '#639922' }} />
        </div>
        <h1
          className="font-head font-bold text-[var(--text)]"
          style={{ fontSize: '1.5rem', margin: '0 0 4px' }}
        >
          Session Complete
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 16px' }}>
          {data.subject || 'Tutoring Session'}
        </p>

        <div
          className="flex items-center gap-6"
          style={{ flexWrap: 'wrap', justifyContent: 'center' }}
        >
          {data.date && (
            <div className="flex items-center gap-2">
              <Clock size={14} strokeWidth={1.5} style={{ color: 'var(--muted)' }} />
              <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                {formatDate(data.date)}
              </span>
            </div>
          )}
          {data.start_time && data.end_time && (
            <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
              {formatTime(data.start_time)} - {formatTime(data.end_time)}
            </span>
          )}
          {data.duration_minutes && (
            <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
              {data.duration_minutes} min
            </span>
          )}
          <StatusBadge status={data.status} />
        </div>

        <div className="flex items-center gap-4 mt-6">
          {data.tutor && (
            <div className="flex items-center gap-2">
              <Avatar
                name={data.tutor.name}
                avatarUrl={data.tutor.avatar_url}
                size="sm"
              />
              <div style={{ textAlign: 'left' }}>
                <p style={{ color: 'var(--text)', fontSize: '0.875rem', fontWeight: 500, margin: 0 }}>
                  {data.tutor.name}
                </p>
                <p style={{ color: 'var(--muted)', fontSize: '0.72rem', margin: 0 }}>Tutor</p>
              </div>
            </div>
          )}
          {data.student && (
            <div className="flex items-center gap-2">
              <Avatar name={data.student.name} size="sm" />
              <div style={{ textAlign: 'left' }}>
                <p style={{ color: 'var(--text)', fontSize: '0.875rem', fontWeight: 500, margin: 0 }}>
                  {data.student.name}
                </p>
                <p style={{ color: 'var(--muted)', fontSize: '0.72rem', margin: 0 }}>Student</p>
              </div>
            </div>
          )}
        </div>

        {data.price > 0 && (
          <div
            className="mt-6"
            style={{
              background: 'rgba(99,153,34,0.08)',
              borderRadius: '12px',
              padding: '12px 24px',
            }}
          >
            <span style={{ color: '#639922', fontSize: '1.2rem', fontWeight: 700 }}>
              {formatCurrency(data.price)}
            </span>
          </div>
        )}
      </div>

      {data.notes.length > 0 && (
        <SectionCard title="Session Notes" className="mb-6">
          <div className="flex flex-col gap-3">
            {data.notes.map((note) => (
              <div
                key={note.id}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '12px',
                  padding: '14px 16px',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: note.author_type === 'tutor' ? 'var(--accent)' : '#BA7517',
                      textTransform: 'uppercase',
                    }}
                  >
                    {note.author_type}
                  </span>
                  {note.is_private && (
                    <span
                      style={{
                        fontSize: '0.65rem',
                        color: 'var(--muted)',
                        background: 'rgba(255,255,255,0.05)',
                        padding: '1px 6px',
                        borderRadius: '100px',
                      }}
                    >
                      Private
                    </span>
                  )}
                </div>
                <p style={{ color: 'var(--text)', fontSize: '0.875rem', margin: 0, lineHeight: 1.5 }}>
                  {note.content}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {data.recordings.length > 0 && (
        <SectionCard title="Recordings" className="mb-6">
          <div className="flex flex-col gap-2">
            {data.recordings.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center justify-between"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                }}
              >
                <div className="flex items-center gap-3">
                  <Video size={18} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
                  <div>
                    <p style={{ color: 'var(--text)', fontSize: '0.875rem', margin: 0 }}>
                      Recording #{rec.id}
                    </p>
                    {rec.duration_seconds && (
                      <p style={{ color: 'var(--muted)', fontSize: '0.75rem', margin: 0 }}>
                        {Math.floor(rec.duration_seconds / 60)} min
                      </p>
                    )}
                  </div>
                </div>
                <StatusBadge status={rec.is_consented ? 'completed' : 'pending'} />
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <div className="flex items-center justify-center gap-3 mt-8">
        <a
          href="/dashboard/student/bookings"
          style={{
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            color: '#fff',
            borderRadius: '100px',
            padding: '12px 28px',
            fontSize: '0.875rem',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Back to Dashboard
        </a>
      </div>
    </div>
  )
}
