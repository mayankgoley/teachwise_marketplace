'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, ClipboardList } from 'lucide-react'
import { apiGet } from '@/lib/api'
import SectionCard from '@/components/ui/SectionCard'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate } from '@/lib/format'

type AssignmentRow = {
  id: number
  title: string
  description: string | null
  subject: string | null
  due_date: string | null
  status: string
  created_at: string | null
  tutor_name: string | null
  file_count: number
  submission?: {
    id: number
    status: string
    submitted_at: string | null
    grade: string | null
    is_late: boolean
  }
}

type ChildAssignments = {
  child: { id: number; name: string }
  assignments: AssignmentRow[]
}

function statusBadge(a: AssignmentRow) {
  const s = a.submission?.status ?? a.status
  const color =
    s === 'graded' || s === 'returned'
      ? '#639922'
      : s === 'submitted'
        ? '#4f8eff'
        : s === 'overdue'
          ? '#E24B4A'
          : '#BA7517'
  const bg =
    s === 'graded' || s === 'returned'
      ? 'rgba(99,153,34,0.15)'
      : s === 'submitted'
        ? 'rgba(79,142,255,0.15)'
        : s === 'overdue'
          ? 'rgba(226,75,74,0.15)'
          : 'rgba(186,117,23,0.15)'
  return (
    <span
      style={{
        background: bg,
        color,
        padding: '2px 8px',
        borderRadius: '100px',
        fontSize: '0.68rem',
        fontWeight: 600,
        textTransform: 'capitalize',
      }}
    >
      {s}
    </span>
  )
}

export default function GuardianChildAssignmentsPage() {
  const params = useParams()
  const childId = Number(params?.id)
  const [data, setData] = useState<ChildAssignments | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!childId) return
    setLoading(true)
    try {
      const res = await apiGet<ChildAssignments>(
        `/api/v1/guardian/children/${childId}/assignments`
      )
      if (res.success) setData(res.data)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [childId])

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
        Could not load assignments.
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
          {data.child.name}&apos;s Assignments
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Read-only view — your child can submit, only the tutor can grade.
        </p>
      </div>

      <SectionCard
        title="All Assignments"
        subtitle={`${data.assignments.length} total`}
        noPadding
      >
        {data.assignments.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={22} strokeWidth={1.5} />}
            title="No assignments yet"
            description="Tutors haven't assigned any work."
          />
        ) : (
          <div>
            {data.assignments.map((a, i) => (
              <div
                key={a.id}
                style={{
                  padding: '16px 20px',
                  borderBottom:
                    i < data.assignments.length - 1
                      ? '1px solid var(--border)'
                      : 'none',
                }}
              >
                <div
                  className="flex items-center gap-2 flex-wrap"
                  style={{ marginBottom: '4px' }}
                >
                  <span
                    className="font-head font-bold text-[var(--text)]"
                    style={{ fontSize: '0.95rem' }}
                  >
                    {a.title}
                  </span>
                  {statusBadge(a)}
                  {a.submission?.is_late && (
                    <span
                      style={{
                        background: 'rgba(226,75,74,0.12)',
                        color: '#E24B4A',
                        padding: '2px 8px',
                        borderRadius: '100px',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                      }}
                    >
                      Late
                    </span>
                  )}
                </div>
                <div
                  className="flex items-center gap-3 flex-wrap"
                  style={{ fontSize: '0.75rem', color: 'var(--muted)' }}
                >
                  {a.tutor_name && <span>Tutor: {a.tutor_name}</span>}
                  {a.subject && <span>{a.subject}</span>}
                  {a.due_date && <span>Due {formatDate(a.due_date)}</span>}
                  {a.submission?.grade && (
                    <span style={{ color: 'var(--text)', fontWeight: 600 }}>
                      Grade: {a.submission.grade}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
