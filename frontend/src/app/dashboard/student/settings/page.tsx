'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPut } from '@/lib/api'
import { Loader2, Bell, CheckCircle } from 'lucide-react'

interface NotifPrefs {
  email_booking_confirmed: boolean
  email_session_reminder: boolean
  email_assignment: boolean
  email_message: boolean
  push_all: boolean
}

const DEFAULT_PREFS: NotifPrefs = {
  email_booking_confirmed: true,
  email_session_reminder: true,
  email_assignment: true,
  email_message: true,
  push_all: true,
}

const NOTIF_ITEMS: { key: keyof NotifPrefs; label: string; description: string }[] = [
  { key: 'email_booking_confirmed', label: 'Booking confirmed', description: 'When a session is booked and paid' },
  { key: 'email_session_reminder', label: 'Session reminder', description: '1 hour before each session' },
  { key: 'email_assignment', label: 'New assignment', description: 'When a tutor assigns you work' },
  { key: 'email_message', label: 'New message', description: 'When a tutor sends you a message' },
  { key: 'push_all', label: 'In-app notifications', description: 'Real-time alerts inside the app' },
]

export default function StudentSettingsPage() {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  const fetchPrefs = useCallback(async () => {
    try {
      const res = await apiGet<{ notification_prefs?: Record<string, boolean> }>('/api/v1/auth/me')
      if (res.success && res.data?.notification_prefs) {
        setPrefs({ ...DEFAULT_PREFS, ...res.data.notification_prefs } as NotifPrefs)
      }
    } catch {
      // use defaults
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPrefs()
  }, [fetchPrefs])

  const handleToggle = async (key: keyof NotifPrefs) => {
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    setSaved(false)
    try {
      await apiPut('/api/v1/student/profile/notifications', updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setPrefs(prefs) // revert
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} strokeWidth={1.5} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  return (
    <div>
      <h1
        className="font-head font-bold text-[var(--text)]"
        style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
      >
        Settings
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 24px' }}>
        Manage your notification preferences
      </p>

      {saved && (
        <div
          className="flex items-center gap-2"
          style={{
            background: 'rgba(99,153,34,0.12)',
            color: '#639922',
            padding: '10px 16px',
            borderRadius: '12px',
            fontSize: '0.875rem',
            fontWeight: 500,
            marginBottom: '16px',
          }}
        >
          <CheckCircle size={16} strokeWidth={1.5} />
          Preferences saved
        </div>
      )}

      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          overflow: 'hidden',
        }}
      >
        <div
          className="flex items-center gap-[10px]"
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            fontWeight: 600,
            color: 'var(--text)',
          }}
        >
          <Bell size={18} strokeWidth={1.5} color="var(--accent)" />
          Notification Preferences
        </div>

        {NOTIF_ITEMS.map((item, i) => (
          <div
            key={item.key}
            className="flex items-center justify-between"
            style={{
              padding: '20px 24px',
              borderBottom: i < NOTIF_ITEMS.length - 1 ? '1px solid var(--border)' : 'none',
              gap: '16px',
            }}
          >
            <div>
              <div style={{ fontWeight: 500, marginBottom: '2px', color: 'var(--text)' }}>
                {item.label}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                {item.description}
              </div>
            </div>
            <button
              onClick={() => handleToggle(item.key)}
              role="switch"
              aria-checked={prefs[item.key]}
              aria-label={item.label}
              style={{
                width: '44px',
                height: '24px',
                borderRadius: '100px',
                border: 'none',
                background: prefs[item.key]
                  ? 'linear-gradient(135deg, #4f8eff, #00e5ff)'
                  : 'rgba(255,255,255,0.1)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  left: prefs[item.key] ? '22px' : '2px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
