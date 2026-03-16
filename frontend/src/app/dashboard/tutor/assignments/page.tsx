'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileText, Plus, Loader2 } from 'lucide-react'
import { apiGet } from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'
import Avatar from '@/components/ui/Avatar'
import { formatDate } from '@/lib/format'
import type { Assignment } from '@/types/assignments'
import Link from 'next/link'

const filters = ['all', 'assigned', 'submitted', 'reviewed'] as const
type Filter = (typeof filters)[number]

export default function TutorAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)

  const fetchAssignments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<{ assignments: Assignment[] }>(
        '/api/v1/tutor/assignments?status=' + filter
      )
      if (res.success) {
        setAssignments(res.data.assignments)
      }
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchAssignments()
  }, [fetchAssignments])

  return (
    <div style={{ padding: '0' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--text)',
              margin: '0 0 4px',
            }}
          >
            Assignments
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
            Assignments you&apos;ve created
          </p>
        </div>
        <a
          href="/dashboard/tutor/assignments/create"
          style={{
            background:
              'linear-gradient(135deg, var(--accent), var(--accent2))',
            color: '#fff',
            borderRadius: '100px',
            padding: '10px 20px',
            fontSize: '0.875rem',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Plus size={16} strokeWidth={1.5} />
          Create Assignment
        </a>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '8px 18px',
              borderRadius: '100px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              border:
                filter === f ? 'none' : '1px solid var(--border)',
              background:
                filter === f
                  ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
                  : 'transparent',
              color: filter === f ? '#fff' : 'var(--muted)',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '60px 0',
          }}
        >
          <Loader2
            size={28}
            strokeWidth={1.5}
            style={{
              animation: 'spin 1s linear infinite',
              color: 'var(--accent)',
            }}
          />
        </div>
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={<FileText size={24} strokeWidth={1.5} />}
          title="No assignments yet"
          description="Create your first assignment for a student"
        />
      ) : (
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}
        >
          {assignments.map((assignment, index) => (
            <div
              key={assignment.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom:
                  index < assignments.length - 1
                    ? '1px solid var(--border)'
                    : 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <Avatar
                  name={assignment.student_name || 'Student'}
                  size="sm"
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      color: 'var(--text)',
                      fontSize: '0.9rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {assignment.title}
                  </div>
                  <div
                    style={{
                      color: 'var(--muted)',
                      fontSize: '0.8rem',
                      marginTop: '2px',
                    }}
                  >
                    {assignment.student_name}
                    {assignment.subject ? ` \u00B7 ${assignment.subject}` : ''}
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  flexShrink: 0,
                }}
              >
                <StatusBadge status={assignment.status} />
                {assignment.due_date && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatDate(assignment.due_date)}
                  </span>
                )}
                <Link
                  href={`/dashboard/tutor/assignments/${assignment.id}`}
                  style={{
                    color: 'var(--accent)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
