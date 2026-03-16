'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2, Save, Camera, MapPin, X, AlertCircle, RefreshCw } from 'lucide-react'
import { apiGet, apiPut } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import Avatar from '@/components/ui/Avatar'
import StatusBadge from '@/components/ui/StatusBadge'
import type { TutorEditableProfile } from '@/types/tutor-profile'

type Tab = 'basic' | 'session' | 'notifications' | 'account'

const TABS: { key: Tab; label: string }[] = [
  { key: 'basic', label: 'Basic Info' },
  { key: 'session', label: 'Session Settings' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'account', label: 'Account' },
]

const NOTIFICATION_PREFS = [
  { key: 'email_new_booking', label: 'New booking confirmed', desc: 'When a student books a session' },
  { key: 'email_cancellation', label: 'Booking cancelled', desc: 'When a student cancels a session' },
  { key: 'email_message', label: 'New message', desc: 'When a student sends you a message' },
  { key: 'email_review', label: 'New review', desc: 'When a student leaves a review' },
  { key: 'push_session_reminder', label: 'Session reminders', desc: '1 hour before each session' },
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

const saveButtonStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
  color: '#fff',
  borderRadius: 100,
  padding: '12px 28px',
  fontSize: '0.875rem',
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
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

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder: string
}) {
  const [input, setInput] = useState('')

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const value = input.trim()
      if (value && !tags.includes(value)) {
        onChange([...tags, value])
      }
      setInput('')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: tags.length > 0 ? 8 : 0 }}>
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              background: 'rgba(79,142,255,0.12)',
              color: 'var(--accent)',
              borderRadius: 100,
              padding: '4px 12px',
              fontSize: '0.82rem',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
            >
              <X size={14} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
            </button>
          </span>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  )
}

export default function TutorProfilePage() {
  const [profile, setProfile] = useState<TutorEditableProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<Tab>('basic')

  // Basic Info form state
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [subject, setSubject] = useState('')
  const [hourlyRate, setHourlyRate] = useState<number>(0)
  const [experienceYears, setExperienceYears] = useState<number | ''>('')
  const [education, setEducation] = useState('')
  const [additionalSubjects, setAdditionalSubjects] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  // Session Settings form state
  const [offersOnline, setOffersOnline] = useState(false)
  const [offersInPerson, setOffersInPerson] = useState(false)
  const [serviceRadius, setServiceRadius] = useState(25)
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({})

  const fileInputRef = useRef<HTMLInputElement>(null)

  const populateForm = useCallback((data: TutorEditableProfile) => {
    setProfile(data)
    setName(data.name)
    setBio(data.bio ?? '')
    setSubject(data.subject)
    setHourlyRate(data.hourly_rate)
    setExperienceYears(data.experience_years ?? '')
    setEducation(data.education ?? '')
    setAdditionalSubjects(data.subjects_additional)
    setLanguages(data.languages)
    setAvatarUrl(data.avatar_url)
    setOffersOnline(data.offers_online)
    setOffersInPerson(data.offers_in_person)
    setServiceRadius(data.service_radius_km)
    setLatitude(data.latitude)
    setLongitude(data.longitude)
    setNotifPrefs(data.notification_prefs)
  }, [])

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiGet<TutorEditableProfile>('/api/v1/tutor/profile')
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
        `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/v1/tutor/profile/avatar`,
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

  const handleSaveBasicOrSession = async () => {
    setSaving(true)
    try {
      const res = await apiPut('/api/v1/tutor/profile', {
        name,
        bio: bio || null,
        subject,
        hourly_rate: hourlyRate,
        experience_years: experienceYears === '' ? null : experienceYears,
        education: education || null,
        subjects_additional: additionalSubjects,
        languages,
        offers_online: offersOnline,
        offers_in_person: offersInPerson,
        service_radius_km: serviceRadius,
      })
      if (res.success) {
        toast.success('Profile updated', 'Your changes have been saved')
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
      await apiPut('/api/v1/tutor/profile/notifications', updated)
    } catch {
      // revert on failure
      setNotifPrefs(notifPrefs)
    }
  }

  const handleUpdateLocation = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        try {
          const res = await apiPut<{ latitude: number; longitude: number }>(
            '/api/v1/tutor/profile/location',
            { latitude: lat, longitude: lng }
          )
          if (res.success) {
            setLatitude(lat)
            setLongitude(lng)
          }
        } catch {
          // ignore
        }
      },
      () => {
        // denied or error
      }
    )
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
      {/* Header */}
      <h1
        className="font-head font-bold text-[var(--text)]"
        style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
      >
        Profile
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 24px' }}>
        Manage your tutor profile and settings
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

      {/* Tab 1 — Basic Info */}
      {activeTab === 'basic' && (
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
                <label style={labelStyle}>Primary Subject</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Hourly Rate ($)</label>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  min={0}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Experience Years</label>
                <input
                  type="number"
                  value={experienceYears}
                  onChange={(e) =>
                    setExperienceYears(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  min={0}
                  style={inputStyle}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Education</label>
                <input
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Bio */}
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 1000))}
                maxLength={1000}
                rows={4}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4, textAlign: 'right' }}>
                {bio.length} / 1000
              </div>
            </div>

            {/* Additional Subjects */}
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>Additional Subjects</label>
              <TagInput
                tags={additionalSubjects}
                onChange={setAdditionalSubjects}
                placeholder="Type a subject and press Enter"
              />
            </div>

            {/* Languages */}
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>Languages</label>
              <TagInput
                tags={languages}
                onChange={setLanguages}
                placeholder="Type a language and press Enter"
              />
            </div>
          </div>

          {/* Save Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleSaveBasicOrSession}
              disabled={saving || !name.trim()}
              style={{ ...saveButtonStyle, opacity: saving || !name.trim() ? 0.6 : 1 }}
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

      {/* Tab 2 — Session Settings */}
      {activeTab === 'session' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={cardStyle}>
            {/* Online toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text)' }}>
                Online Sessions
              </span>
              <Toggle value={offersOnline} onChange={setOffersOnline} />
            </div>

            {/* In-person toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: offersInPerson ? '1px solid var(--border)' : 'none',
              }}
            >
              <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text)' }}>
                In-Person Sessions
              </span>
              <Toggle value={offersInPerson} onChange={setOffersInPerson} />
            </div>

            {/* Service Radius (only if in-person) */}
            {offersInPerson && (
              <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                <label style={labelStyle}>
                  Service Radius: {serviceRadius} km
                </label>
                <input
                  type="range"
                  min={1}
                  max={200}
                  value={serviceRadius}
                  onChange={(e) => setServiceRadius(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
              </div>
            )}

            {/* Location (only if in-person) */}
            {offersInPerson && (
              <div style={{ padding: '16px 0' }}>
                <label style={labelStyle}>Location</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text)' }}>
                    {latitude !== null && longitude !== null
                      ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
                      : 'No location set'}
                  </span>
                  <button
                    type="button"
                    onClick={handleUpdateLocation}
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
                    <MapPin size={14} strokeWidth={1.5} />
                    Update Location
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleSaveBasicOrSession}
              disabled={saving}
              style={{ ...saveButtonStyle, opacity: saving ? 0.6 : 1 }}
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

      {/* Tab 3 — Notifications */}
      {activeTab === 'notifications' && (
        <div style={cardStyle}>
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
      )}

      {/* Tab 4 — Account */}
      {activeTab === 'account' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={cardStyle}>
            {/* Email */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Email</label>
              <div style={{ fontSize: '0.9rem', color: 'var(--text)' }}>{profile.email}</div>
            </div>

            {/* Verification */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Verification Status</label>
              <StatusBadge status={profile.verification_status} />
            </div>

            {/* Stripe */}
            <div>
              <label style={labelStyle}>Stripe Account</label>
              {profile.stripe_account_connected ? (
                <span
                  style={{
                    background: 'rgba(99,153,34,0.15)',
                    color: '#639922',
                    padding: '4px 10px',
                    borderRadius: 100,
                    fontSize: '0.72rem',
                    fontWeight: 600,
                  }}
                >
                  Connected
                </span>
              ) : (
                <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Not connected</span>
              )}
            </div>
          </div>

          {/* Delete Account */}
          <div style={cardStyle}>
            <button
              disabled
              title="Contact support to delete your account"
              style={{
                background: 'none',
                border: '1px solid #E24B4A',
                borderRadius: 100,
                padding: '10px 24px',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#E24B4A',
                cursor: 'not-allowed',
                opacity: 0.5,
              }}
            >
              Delete Account
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
