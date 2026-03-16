'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, CheckCheck, Loader2 } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import { formatRelativeTime } from '@/lib/format'
import type { AppNotification } from '@/types/search'

type FilterTab = 'all' | 'unread'

interface DateGroup {
  label: string
  notifications: AppNotification[]
}

function groupByDate(notifications: AppNotification[]): DateGroup[] {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)
  const weekStart = new Date(todayStart.getTime() - 6 * 86400000)

  const groups: Record<string, AppNotification[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    Earlier: [],
  }

  for (const n of notifications) {
    const created = new Date(n.created_at)
    if (created >= todayStart) {
      groups['Today'].push(n)
    } else if (created >= yesterdayStart) {
      groups['Yesterday'].push(n)
    } else if (created >= weekStart) {
      groups['This Week'].push(n)
    } else {
      groups['Earlier'].push(n)
    }
  }

  return ['Today', 'Yesterday', 'This Week', 'Earlier']
    .filter((label) => groups[label].length > 0)
    .map((label) => ({ label, notifications: groups[label] }))
}

function getNotificationColor(type: string): string {
  const colorMap: Record<string, string> = {
    booking: '#4f8eff',
    session: '#00e5ff',
    payment: '#639922',
    assignment: '#BA7517',
    review: '#7F77DD',
    message: '#4f8eff',
    cancellation: '#E24B4A',
    reminder: '#00e5ff',
    system: 'var(--muted)',
  }
  return colorMap[type] ?? 'var(--accent)'
}

export default function StudentNotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAllRead, setMarkingAllRead] = useState(false)
  const [filter, setFilter] = useState<FilterTab>('all')
  const socketRef = useRef<ReturnType<typeof Object> | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiGet<{ notifications: AppNotification[]; unread_count: number }>('/api/v1/student/notifications')
      if (res.success) {
        setNotifications(res.data.notifications)
      }
    } catch {
      // Silently fail, user can refresh
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    let socket: { on: (event: string, cb: (data: AppNotification) => void) => void; disconnect: () => void } | null = null

    const connectSocket = async () => {
      try {
        const { io } = await import('socket.io-client')
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
        socket = io(apiUrl, {
          withCredentials: true,
          transports: ['websocket', 'polling'],
        })

        socket.on('notification', (data: AppNotification) => {
          setNotifications((prev) => [data, ...prev])
        })

        socketRef.current = socket
      } catch {
        // Socket.IO not available, rely on polling
      }
    }

    connectSocket()

    return () => {
      if (socket) {
        socket.disconnect()
      }
    }
  }, [])

  const handleMarkRead = async (notification: AppNotification) => {
    if (!notification.is_read) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, is_read: true } : n
        )
      )
      try {
        await apiPost(`/api/v1/student/notifications/${notification.id}/read`)
      } catch {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, is_read: false } : n
          )
        )
      }
    }

    if (notification.url) {
      router.push(notification.url)
    }
  }

  const handleMarkAllRead = async () => {
    setMarkingAllRead(true)
    const previousNotifications = [...notifications]

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true }))
    )

    try {
      await apiPost('/api/v1/student/notifications/read-all')
    } catch {
      setNotifications(previousNotifications)
    } finally {
      setMarkingAllRead(false)
    }
  }

  const filtered = filter === 'unread'
    ? notifications.filter((n) => !n.is_read)
    : notifications

  const unreadCount = notifications.filter((n) => !n.is_read).length
  const groups = groupByDate(filtered)

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
          Loading notifications...
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div
        className="flex items-start justify-between"
        style={{ marginBottom: '24px' }}
      >
        <div>
          <h1
            className="font-head font-bold text-[var(--text)]"
            style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
          >
            Notifications
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
              : 'You\'re all caught up'}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAllRead}
            className="flex items-center gap-2"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border)',
              borderRadius: '100px',
              padding: '8px 16px',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--accent)',
              cursor: markingAllRead ? 'not-allowed' : 'pointer',
              opacity: markingAllRead ? 0.6 : 1,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (!markingAllRead) {
                e.currentTarget.style.background = 'rgba(79,142,255,0.08)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
            }}
          >
            <CheckCheck size={16} strokeWidth={1.5} />
            Mark all read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div
        className="flex items-center gap-2"
        style={{ marginBottom: '24px' }}
      >
        {(['all', 'unread'] as const).map((tab) => {
          const isActive = filter === tab
          const label = tab === 'all' ? 'All' : 'Unread only'
          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                padding: '8px 18px',
                borderRadius: '100px',
                fontSize: '0.82rem',
                fontWeight: 600,
                border: isActive ? 'none' : '1px solid var(--border)',
                background: isActive
                  ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
                  : 'transparent',
                color: isActive ? '#fff' : 'var(--muted)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              {label}
              {tab === 'unread' && unreadCount > 0 && (
                <span
                  style={{
                    marginLeft: '6px',
                    background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(79,142,255,0.15)',
                    color: isActive ? '#fff' : 'var(--accent)',
                    padding: '2px 7px',
                    borderRadius: '100px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Notification list */}
      {filtered.length === 0 ? (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
          }}
        >
          <EmptyState
            icon={<Bell size={22} strokeWidth={1.5} />}
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            description={
              filter === 'unread'
                ? 'You\'re all caught up! Switch to "All" to see past notifications.'
                : 'When you receive notifications about bookings, sessions, and more, they\'ll appear here.'
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <div key={group.label}>
              {/* Group header */}
              <h3
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  margin: '0 0 10px',
                  paddingLeft: '4px',
                }}
              >
                {group.label}
              </h3>

              {/* Group items */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                }}
              >
                {group.notifications.map((notification, idx) => (
                  <div
                    key={notification.id}
                    onClick={() => handleMarkRead(notification)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleMarkRead(notification)
                      }
                    }}
                    className="flex items-start gap-3"
                    style={{
                      padding: '16px 20px',
                      borderBottom:
                        idx < group.notifications.length - 1
                          ? '1px solid var(--border)'
                          : 'none',
                      cursor: notification.url ? 'pointer' : 'default',
                      background: notification.is_read
                        ? 'transparent'
                        : 'rgba(79,142,255,0.03)',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = notification.is_read
                        ? 'transparent'
                        : 'rgba(79,142,255,0.03)'
                    }}
                  >
                    {/* Color dot */}
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: getNotificationColor(notification.type),
                        flexShrink: 0,
                        marginTop: '6px',
                        opacity: notification.is_read ? 0.3 : 1,
                      }}
                    />

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: '0.9rem',
                          fontWeight: notification.is_read ? 400 : 600,
                          color: 'var(--text)',
                          margin: '0 0 2px',
                          lineHeight: 1.4,
                        }}
                      >
                        {notification.title}
                      </p>
                      <p
                        style={{
                          fontSize: '0.82rem',
                          color: 'var(--muted)',
                          margin: '0 0 6px',
                          lineHeight: 1.4,
                        }}
                      >
                        {notification.message}
                      </p>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--muted)',
                        }}
                      >
                        {formatRelativeTime(notification.created_at)}
                      </span>
                    </div>

                    {/* Unread indicator */}
                    {!notification.is_read && (
                      <div
                        className="flex items-center justify-center"
                        style={{ flexShrink: 0, marginTop: '4px' }}
                        title="Mark as read"
                      >
                        <div
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: 'var(--accent)',
                            boxShadow: '0 0 8px rgba(79,142,255,0.4)',
                          }}
                        />
                      </div>
                    )}

                    {/* Read indicator */}
                    {notification.is_read && (
                      <div
                        className="flex items-center justify-center"
                        style={{ flexShrink: 0, marginTop: '4px' }}
                      >
                        <Check
                          size={14}
                          strokeWidth={1.5}
                          style={{ color: 'var(--muted)', opacity: 0.5 }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
