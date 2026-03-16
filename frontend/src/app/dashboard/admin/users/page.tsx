'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Search, Loader2, Shield, ShieldOff, Mail } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'
import Avatar from '@/components/ui/Avatar'
import { formatDate } from '@/lib/format'
import type { AdminUser } from '@/types/admin'

const filters = ['all', 'students', 'tutors'] as const
type Filter = (typeof filters)[number]

interface UsersResponse {
  users: AdminUser[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<UsersResponse>(
        '/api/v1/admin/users?type=' + filter + '&search=' + encodeURIComponent(search) + '&page=' + page
      )
      if (res.success) {
        setUsers(res.data.users)
        setTotal(res.data.total)
        setTotalPages(res.data.total_pages)
      }
    } finally {
      setLoading(false)
    }
  }, [filter, search, page])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    setPage(1)
  }, [filter, search])

  const handleSuspend = async (user: AdminUser) => {
    setActionLoading(user.id)
    try {
      await apiPost('/api/v1/admin/users/' + user.user_type + '/' + user.id + '/suspend', { days: 30 })
      await fetchUsers()
    } finally {
      setActionLoading(null)
    }
  }

  const handleUnsuspend = async (user: AdminUser) => {
    setActionLoading(user.id)
    try {
      await apiPost('/api/v1/admin/users/' + user.user_type + '/' + user.id + '/unsuspend')
      await fetchUsers()
    } finally {
      setActionLoading(null)
    }
  }

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
          User Management
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Manage students and tutors
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
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
      ) : users.length === 0 ? (
        <EmptyState
          icon={<Users size={22} strokeWidth={1.5} />}
          title="No users found"
          description={
            search
              ? 'No users match your search. Try a different query.'
              : 'No users to display for the selected filter.'
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
            {users.map((user, index) => (
              <div
                key={`${user.user_type}-${user.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderBottom:
                    index < users.length - 1
                      ? '1px solid var(--border)'
                      : 'none',
                  gap: '12px',
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
                    name={user.name}
                    avatarUrl={user.user_type === 'tutor' ? user.avatar_url : undefined}
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
                      {user.name}
                      {user.is_suspended && (
                        <span
                          style={{
                            marginLeft: '8px',
                            background: 'rgba(226,75,74,0.15)',
                            color: '#E24B4A',
                            padding: '2px 8px',
                            borderRadius: '100px',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                          }}
                        >
                          Suspended
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'var(--muted)',
                        fontSize: '0.8rem',
                        marginTop: '2px',
                      }}
                    >
                      <Mail size={12} strokeWidth={1.5} />
                      <span
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {user.email}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      background:
                        user.user_type === 'tutor'
                          ? 'rgba(127,119,221,0.15)'
                          : 'rgba(79,142,255,0.15)',
                      color:
                        user.user_type === 'tutor' ? '#7F77DD' : '#4f8eff',
                      padding: '4px 10px',
                      borderRadius: '100px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {user.user_type === 'tutor' ? 'Tutor' : 'Student'}
                  </span>

                  {user.user_type === 'tutor' && user.verification_status && (
                    <StatusBadge status={user.verification_status} />
                  )}

                  {user.created_at && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDate(user.created_at)}
                    </span>
                  )}

                  {user.is_suspended ? (
                    <button
                      onClick={() => handleUnsuspend(user)}
                      disabled={actionLoading === user.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 14px',
                        borderRadius: '100px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        border: 'none',
                        cursor: actionLoading === user.id ? 'not-allowed' : 'pointer',
                        background: 'rgba(99,153,34,0.15)',
                        color: '#639922',
                        opacity: actionLoading === user.id ? 0.6 : 1,
                      }}
                    >
                      <ShieldOff size={13} strokeWidth={1.5} />
                      Unsuspend
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSuspend(user)}
                      disabled={actionLoading === user.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 14px',
                        borderRadius: '100px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        border: 'none',
                        cursor: actionLoading === user.id ? 'not-allowed' : 'pointer',
                        background: 'rgba(226,75,74,0.15)',
                        color: '#E24B4A',
                        opacity: actionLoading === user.id ? 0.6 : 1,
                      }}
                    >
                      <Shield size={13} strokeWidth={1.5} />
                      Suspend
                    </button>
                  )}
                </div>
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
                  padding: '8px 18px',
                  borderRadius: '100px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: page <= 1 ? 'var(--muted)' : 'var(--text)',
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
                Page {page} of {totalPages} ({total} users)
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{
                  padding: '8px 18px',
                  borderRadius: '100px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: page >= totalPages ? 'var(--muted)' : 'var(--text)',
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
