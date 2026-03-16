'use client'

import { useState, useEffect, useCallback } from 'react'
import { Flag, Loader2, Check, X } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatDate } from '@/lib/format'
import type { ModerationReport } from '@/types/admin'

const filters = ['pending', 'reviewed', 'dismissed', 'all'] as const
type Filter = (typeof filters)[number]

export default function AdminModerationPage() {
  const [reports, setReports] = useState<ModerationReport[]>([])
  const [filter, setFilter] = useState<Filter>('pending')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<number | null>(null)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<{
        reports: ModerationReport[]
        total: number
        page: number
        per_page: number
        total_pages: number
      }>('/api/v1/admin/moderation?status=' + filter + '&page=' + page)
      if (res.success) {
        setReports(res.data.reports)
        setTotalPages(res.data.total_pages)
      }
    } finally {
      setLoading(false)
    }
  }, [filter, page])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const handleAction = async (reportId: number, action: 'reviewed' | 'dismiss') => {
    setActing(reportId)
    try {
      await apiPost(`/api/v1/admin/moderation/${reportId}/resolve`, { action })
      await fetchReports()
    } finally {
      setActing(null)
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text)',
            margin: '0 0 4px',
          }}
        >
          Content Moderation
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Review flagged content
        </p>
      </div>

      {/* Filter tabs */}
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
            onClick={() => {
              setFilter(f)
              setPage(1)
            }}
            style={{
              padding: '8px 18px',
              borderRadius: '100px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: filter === f ? 'none' : '1px solid var(--border)',
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

      {/* Content */}
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
      ) : reports.length === 0 ? (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
          }}
        >
          <EmptyState
            icon={<Flag size={22} strokeWidth={1.5} />}
            title="No reports found"
            description={
              filter === 'all'
                ? 'No content has been flagged yet'
                : `No ${filter} reports`
            }
          />
        </div>
      ) : (
        <>
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              overflow: 'hidden',
            }}
          >
            {reports.map((report, index) => (
              <div
                key={report.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderBottom:
                    index < reports.length - 1
                      ? '1px solid var(--border)'
                      : 'none',
                  gap: '16px',
                }}
              >
                {/* Report info */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap',
                      marginBottom: '4px',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        color: 'var(--text)',
                        fontSize: '0.9rem',
                      }}
                    >
                      {report.reporter_name}
                    </span>
                    <StatusBadge status={report.reporter_type} />
                    <span
                      style={{
                        color: 'var(--muted)',
                        fontSize: '0.78rem',
                      }}
                    >
                      reported{' '}
                      <span style={{ color: 'var(--text)', fontWeight: 500 }}>
                        {report.content_type}
                      </span>
                    </span>
                  </div>
                  <div
                    style={{
                      fontWeight: 600,
                      color: 'var(--text)',
                      fontSize: '0.85rem',
                      marginBottom: '2px',
                    }}
                  >
                    {report.reason}
                  </div>
                  {report.details && (
                    <div
                      style={{
                        color: 'var(--muted)',
                        fontSize: '0.8rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '500px',
                      }}
                    >
                      {report.details}
                    </div>
                  )}
                </div>

                {/* Right side: status, date, actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexShrink: 0,
                  }}
                >
                  <StatusBadge status={report.status} />
                  {report.created_at && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDate(report.created_at)}
                    </span>
                  )}
                  {report.status === 'pending' && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <button
                        onClick={() => handleAction(report.id, 'reviewed')}
                        disabled={acting === report.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 16px',
                          borderRadius: '100px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          border: 'none',
                          cursor: acting === report.id ? 'not-allowed' : 'pointer',
                          background: 'rgba(99,153,34,0.15)',
                          color: '#639922',
                          opacity: acting === report.id ? 0.6 : 1,
                        }}
                      >
                        <Check size={13} strokeWidth={2} />
                        Mark Reviewed
                      </button>
                      <button
                        onClick={() => handleAction(report.id, 'dismiss')}
                        disabled={acting === report.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 16px',
                          borderRadius: '100px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          border: 'none',
                          cursor: acting === report.id ? 'not-allowed' : 'pointer',
                          background: 'rgba(226,75,74,0.15)',
                          color: '#E24B4A',
                          opacity: acting === report.id ? 0.6 : 1,
                        }}
                      >
                        <X size={13} strokeWidth={2} />
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '12px',
                marginTop: '20px',
              }}
            >
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  padding: '8px 18px',
                  borderRadius: '100px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: page <= 1 ? 'var(--border)' : 'var(--muted)',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                Previous
              </button>
              <span
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--muted)',
                }}
              >
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{
                  padding: '8px 18px',
                  borderRadius: '100px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: page >= totalPages ? 'var(--border)' : 'var(--muted)',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
