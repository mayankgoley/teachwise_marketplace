'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2, Save, Camera, AlertCircle, RefreshCw, Lock, CheckCircle } from 'lucide-react'
import { apiGet, apiPut } from '@/lib/api'
import Avatar from '@/components/ui/Avatar'
import { useToast } from '@/context/ToastContext'

type Tab = 'personal' | 'account'

const TABS: { key: Tab; label: string }[] = [
  { key: 'personal', label: 'Personal Info' },
  { key: 'account', label: 'Account' },
]

const NOTIFICATION_PREFS = [
  { key: 'email_booking_confirmed', label: 'Booking confirmed', desc: 'When a session is booked and paid' },
  { key: 'email_session_reminder', label: 'Session reminder', desc: '1 hour before each session' },
  { key: 'email_assignment', label: 'New assignment', desc: 'When a tutor assigns you work' },
  { key: 'email_message', label: 'New message', desc: 'When a tutor sends you a message' },
  { key: 'push_all', label: 'In-app notifications', desc: 'Real-time alerts inside the app' },
]

const inputStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  width: '100%',
  outline: 'none',
  fontSize: '0.9rem',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.82rem',
  fontWeight: 500,
  color: 'var(--muted)',
  marginBottom: 6,
  display: 'block',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 20,
  padding: 24,
}

interface StudentProfileData {
  id: number
  name: string
  email: string
  bio: string | null
  grade_level: string | null
  avatar_url: string | null
  is_verified: boolean
  notification_prefs: Record<string, boolean>
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: 48,
        height: 24,
        borderRadius: 12,
        background: value ? '#639922' : 'rgba(255,255,255,0.1)',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: value ? 26 : 2,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
        }}
      />
    </button>
  )
}

export default function StudentProfilePage() {
  const [profile, setProfile] = useState<StudentProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<Tab>('personal')

  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [gradeLevel, setGradeLevel] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({})

  const fileInputRef = useRef<HTMLInputElement>(null)

  const populateForm = useCallback((data: StudentProfileData) => {
    setProfile(data)
    setName(data.name)
    setBio(data.bio ?? '')
    setGradeLevel(data.grade_level ?? '')
    setAvatarUrl(data.avatar_url)
    setNotifPrefs(data.notification_prefs)
  }, [])

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiGet<StudentProfileData>('/api/v1/student/profile')
      if (res.success && res.data) {
        populateForm(res.data)
      } else {
        setError(res.error?.message ?? 'Failed to load profile')
      }
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }, [populateForm])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('avatar', file)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/v1/student/profile/avatar`,
        { method: 'POST', body: formData, credentials: 'include' }
      )
      const json = await res.json()
      if (json.success) {
        setAvatarUrl(json.data.avatar_url)
      }
    } catch {
      // ignore
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await apiPut('/api/v1/student/profile', {
        name,
        bio: bio || null,
        grade_level: gradeLevel || null,
      })
      if (res.success) {
        toast.success('Profile updated', 'Your changes have been saved')
      } else {
        toast.error('Save failed', res.error?.message ?? 'Please try again')
      }
    } catch {
      toast.error('Save failed', 'Please try again')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleNotifPref = async (key: string, value: boolean) => {
    const updated = { ...notifPrefs, [key]: value }
    setNotifPrefs(updated)
    try {
      await apiPut('/api/v1/student/profile/notifications', updated)
    } catch {
      setNotifPrefs(notifPrefs)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} strokeWidth={1.5} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  if (!profile) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          gap: '16px',
        }}
      >
        <AlertCircle size={40} color="#E24B4A" strokeWidth={1.5} />
        <p style={{ color: 'var(--text)', fontFamily: 'var(--font-head)', fontSize: '1.2rem', margin: 0 }}>
          Failed to load profile
        </p>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', margin: 0 }}>
          {error ?? 'An unexpected error occurred'}
        </p>
        <button
          onClick={fetchProfile}
          style={{
            background: 'linear-gradient(135deg, #4f8eff, #00e5ff)',
            color: '#fff',
            border: 'none',
            borderRadius: '100px',
            padding: '10px 24px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <RefreshCw size={16} strokeWidth={1.5} />
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div>
      <h1
        className="font-head font-bold text-[var(--text)]"
        style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
      >
        Profile
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 24px' }}>
        Manage your personal information
      </p>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              borderRadius: 100,
              padding: '8px 18px',
              fontSize: '0.82rem',
              fontWeight: 600,
              border: activeTab === tab.key ? 'none' : '1px solid var(--border)',
              background:
                activeTab === tab.key
                  ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
                  : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'var(--muted)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1 — Personal Info */}
      {activeTab === 'personal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Avatar Section */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Avatar name={name} avatarUrl={avatarUrl} size="xl" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 100,
                  padding: '6px 16px',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  color: 'var(--text)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Camera size={14} strokeWidth={1.5} />
                Change Photo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* Form Fields */}
          <div style={cardStyle}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 16,
              }}
            >
              <div>
                <label style={labelStyle}>Full Name *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Grade Level</label>
                <input
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  placeholder="e.g. 10th Grade, University"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 500))}
                maxLength={500}
                rows={4}
                placeholder="Tell tutors a bit about yourself..."
                style={{ ...inputStyle, resize: 'vertical' }}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4, textAlign: 'right' }}>
                {bio.length} / 500
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                color: '#fff',
                borderRadius: 100,
                padding: '12px 28px',
                fontSize: '0.875rem',
                fontWeight: 600,
                border: 'none',
                cursor: saving || !name.trim() ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                opacity: saving || !name.trim() ? 0.6 : 1,
              }}
            >
              {saving ? (
                <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
              ) : (
                <Save size={16} strokeWidth={1.5} />
              )}
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Tab 2 — Account */}
      {activeTab === 'account' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={cardStyle}>
            {/* Email */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Email</label>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '0.9rem', color: 'var(--text)' }}>{profile.email}</span>
                {profile.is_verified && (
                  <span
                    className="flex items-center gap-1"
                    style={{
                      background: 'rgba(99,153,34,0.15)',
                      color: '#639922',
                      padding: '2px 8px',
                      borderRadius: 100,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                    }}
                  >
                    <CheckCircle size={12} strokeWidth={1.5} />
                    Verified
                  </span>
                )}
              </div>
            </div>

            {/* Change Password */}
            <div>
              <label style={labelStyle}>Password</label>
              <div className="flex items-center gap-2">
                <Lock size={16} strokeWidth={1.5} style={{ color: 'var(--muted)' }} />
                <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                  Use the forgot password flow to change your password
                </span>
              </div>
            </div>
          </div>

          {/* Notification Preferences */}
          <div style={cardStyle}>
            <h3
              className="font-head font-bold text-[var(--text)]"
              style={{ fontSize: '1rem', margin: '0 0 16px' }}
            >
              Notification Preferences
            </h3>
            {NOTIFICATION_PREFS.map((pref, i) => (
              <div
                key={pref.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: '14px 0',
                  borderBottom:
                    i < NOTIFICATION_PREFS.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>
                    {pref.label}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: 2 }}>
                    {pref.desc}
                  </div>
                </div>
                <Toggle
                  value={!!notifPrefs[pref.key]}
                  onChange={(v) => handleToggleNotifPref(pref.key, v)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
