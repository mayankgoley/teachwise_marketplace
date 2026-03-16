'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileText, Clock, Loader2 } from 'lucide-react'
import { apiGet } from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatDate } from '@/lib/format'
import type { Assignment } from '@/types/assignments'

const FILTER_TABS = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'assigned' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Reviewed', value: 'reviewed' },
  { label: 'Overdue', value: 'overdue' },
] as const

type FilterValue = (typeof FILTER_TABS)[number]['value']

export default function StudentAssignmentsPage() {
  const [filter, setFilter] = useState<FilterValue>('all')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredTab, setHoveredTab] = useState<string | null>(null)

  const fetchAssignments = useCallback(async () => {
    setLoading(true)
    try {
      const status = filter === 'all' ? '' : filter
      const res = await apiGet<{ assignments: Assignment[] }>(
        '/api/v1/student/assignments?status=' + status
      )
      if (res.success) {
        setAssignments(res.data.assignments)
      } else {
        setAssignments([])
      }
    } catch {
      setAssignments([])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchAssignments()
  }, [fetchAssignments])

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1
          className="font-head font-bold text-[var(--text)]"
          style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
        >
          Assignments
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Your assignments from tutors
        </p>
      </div>

      <div
        className="flex items-center gap-2"
        style={{
          marginBottom: '20px',
          overflowX: 'auto',
          paddingBottom: '4px',
        }}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = filter === tab.value
          const isHovered = hoveredTab === tab.value && !isActive
          return (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              onMouseEnter={() => setHoveredTab(tab.value)}
              onMouseLeave={() => setHoveredTab(null)}
              style={{
                padding: '8px 18px',
                borderRadius: '100px',
                fontSize: '0.82rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: isActive
                  ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
                  : isHovered
                    ? 'rgba(255,255,255,0.04)'
                    : 'transparent',
                color: isActive ? '#fff' : 'var(--muted)',
                border: isActive ? 'none' : '1px solid var(--border)',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div
          className="flex flex-col items-center justify-center"
          style={{ padding: '60px 20px', gap: '12px' }}
        >
          <Loader2
            size={28}
            strokeWidth={1.5}
            color="var(--accent)"
            style={{ animation: 'spin 1s linear infinite' }}
          />
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', margin: 0 }}>
            Loading assignments...
          </p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : assignments.length === 0 ? (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
          }}
        >
          <EmptyState
            icon={<FileText size={22} strokeWidth={1.5} />}
            title="No assignments found"
            description={
              filter === 'all'
                ? 'You have no assignments yet'
                : `You have no ${filter} assignments`
            }
          />
        </div>
      ) : (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            overflow: 'hidden',
          }}
        >
          {assignments.map((assignment, index) => (
            <div
              key={assignment.id}
              className="flex items-center justify-between"
              style={{
                padding: '16px 20px',
                borderBottom:
                  index < assignments.length - 1
                    ? '1px solid var(--border)'
                    : 'none',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <p
                  className="font-head font-bold text-[var(--text)]"
                  style={{
                    fontSize: '0.875rem',
                    margin: '0 0 4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {assignment.title}
                </p>
                <p
                  style={{
                    color: 'var(--muted)',
                    fontSize: '0.82rem',
                    margin: '0 0 4px',
                  }}
                >
                  {assignment.subject}
                  {assignment.tutor_name ? ` \u00b7 ${assignment.tutor_name}` : ''}
                </p>
                {assignment.due_date && (
                  <p
                    className="flex items-center gap-1"
                    style={{
                      color: 'var(--muted)',
                      fontSize: '0.75rem',
                      margin: 0,
                    }}
                  >
                    <Clock size={12} strokeWidth={1.5} />
                    Due {formatDate(assignment.due_date)}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3" style={{ flexShrink: 0 }}>
                <StatusBadge status={assignment.status} />
                <a
                  href={`/dashboard/student/assignments/${assignment.id}`}
                  style={{
                    color: 'var(--accent)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  View
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
