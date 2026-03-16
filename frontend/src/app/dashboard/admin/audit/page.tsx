'use client'

import { useState, useEffect, useCallback } from 'react'
import { ScrollText, Loader2, Search } from 'lucide-react'
import { apiGet } from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate } from '@/lib/format'
import type { AuditLogEntry } from '@/types/admin'

interface AuditLogResponse {
  logs: AuditLogEntry[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [actionFilter, setActionFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<AuditLogResponse>(
        '/api/v1/admin/audit-log?action=' + encodeURIComponent(actionFilter) + '&page=' + page
      )
      if (res.success) {
        setLogs(res.data.logs)
        setTotal(res.data.total)
        setTotalPages(res.data.total_pages)
      }
    } finally {
      setLoading(false)
    }
  }, [actionFilter, page])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    setPage(1)
  }, [actionFilter])

  return (
    <div style={{ padding: '0' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      <div style={{ marginBottom: '24px' }}>
        <h1
          className="font-head"
          style={{
            fontSize: '1.8rem',
            fontWeight: 700,
            color: 'var(--text)',
            margin: '0 0 4px',
          }}
        >
          Audit Log
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Admin activity history
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '360px' }}>
          <Search
            size={16}
            strokeWidth={1.5}
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Filter by action..."
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 38px',
              borderRadius: '100px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
        </div>
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
            color="var(--accent)"
            style={{ animation: 'spin 1s linear infinite' }}
          />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<ScrollText size={22} strokeWidth={1.5} />}
          title="No audit log entries"
          description={
            actionFilter
              ? 'No entries match your filter. Try a different search.'
              : 'No admin activity has been recorded yet.'
          }
        />
      ) : (
        <>
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              overflow: 'hidden',
            }}
          >
            {logs.map((entry, index) => (
              <div
                key={entry.id}
                style={{
                  padding: '16px 20px',
                  borderBottom:
                    index < logs.length - 1
                      ? '1px solid var(--border)'
                      : 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
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
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'rgba(127,119,221,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <ScrollText size={14} strokeWidth={1.5} color="#7F77DD" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            color: 'var(--text)',
                            fontSize: '0.9rem',
                          }}
                        >
                          {entry.admin_name || 'System'}
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            color: 'var(--accent)',
                            fontSize: '0.82rem',
                          }}
                        >
                          {entry.action}
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          color: 'var(--muted)',
                          fontSize: '0.78rem',
                          marginTop: '2px',
                          flexWrap: 'wrap',
                        }}
                      >
                        {entry.target_type && (
                          <span>
                            {entry.target_type}
                            {entry.target_id !== null && <> #{entry.target_id}</>}
                          </span>
                        )}
                        {entry.ip_address && (
                          <span
                            style={{
                              background: 'rgba(255,255,255,0.05)',
                              padding: '1px 8px',
                              borderRadius: '100px',
                              fontSize: '0.72rem',
                            }}
                          >
                            {entry.ip_address}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      flexShrink: 0,
                    }}
                  >
                    {entry.created_at && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--muted)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatDate(entry.created_at)}
                      </span>
                    )}
                    {entry.details && (
                      <button
                        onClick={() =>
                          setExpandedId(
                            expandedId === entry.id ? null : entry.id
                          )
                        }
                        style={{
                          padding: '4px 12px',
                          borderRadius: '100px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          border: '1px solid var(--border)',
                          background: 'transparent',
                          color: 'var(--accent)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {expandedId === entry.id ? 'Hide' : 'Details'}
                      </button>
                    )}
                  </div>
                </div>

                {expandedId === entry.id && entry.details && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border)',
                      overflow: 'auto',
                    }}
                  >
                    <pre
                      style={{
                        margin: 0,
                        fontSize: '0.75rem',
                        color: 'var(--muted)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        fontFamily: 'monospace',
                      }}
                    >
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '16px',
                marginTop: '24px',
              }}
            >
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  padding: '8px 20px',
                  borderRadius: '100px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.05)',
                  color: page <= 1 ? 'var(--muted)' : 'var(--accent)',
                  opacity: page <= 1 ? 0.5 : 1,
                }}
              >
                Previous
              </button>
              <span
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--muted)',
                  fontWeight: 500,
                }}
              >
                Page {page} of {totalPages} ({total} entries)
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{
                  padding: '8px 20px',
                  borderRadius: '100px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.05)',
                  color: page >= totalPages ? 'var(--muted)' : 'var(--accent)',
                  opacity: page >= totalPages ? 0.5 : 1,
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
