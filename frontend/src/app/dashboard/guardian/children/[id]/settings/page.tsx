'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Save } from 'lucide-react'
import { apiGet, apiPut } from '@/lib/api'
import SectionCard from '@/components/ui/SectionCard'
import type { ChildSettings } from '@/types/guardian'

export default function GuardianChildSettingsPage() {
  const params = useParams()
  const childId = Number(params?.id)

  const [settings, setSettings] = useState<ChildSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [cap, setCap] = useState('')
  const [windowStart, setWindowStart] = useState('')
  const [windowEnd, setWindowEnd] = useState('')
  const [requiresApproval, setRequiresApproval] = useState(true)

  const fetchSettings = useCallback(async () => {
    if (!childId) return
    setLoading(true)
    try {
      const res = await apiGet<{ settings: ChildSettings }>(
        `/api/v1/guardian/children/${childId}/settings`
      )
      if (res.success) {
        setSettings(res.data.settings)
        setCap(res.data.settings.monthly_spending_cap?.toString() ?? '')
        setWindowStart(res.data.settings.session_window_start?.slice(0, 5) ?? '')
        setWindowEnd(res.data.settings.session_window_end?.slice(0, 5) ?? '')
        setRequiresApproval(res.data.settings.requires_approval_for_booking)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }, [childId])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSave = async () => {
    setSaving(true)
    setSaveSuccess(false)
    setSaveError(null)
    try {
      const res = await apiPut<{ settings: ChildSettings }>(
        `/api/v1/guardian/children/${childId}/settings`,
        {
          monthly_spending_cap: cap ? parseFloat(cap) : null,
          session_window_start: windowStart || null,
          session_window_end: windowEnd || null,
          requires_approval_for_booking: requiresApproval,
        }
      )
      if (res.success) {
        setSettings(res.data.settings)
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      } else {
        setSaveError(res.error?.message ?? 'Failed to save')
      }
    } catch {
      setSaveError('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

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

  const inputStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '10px 14px',
    color: 'var(--text)',
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box' as const,
    width: '100%',
  }
  const labelStyle = {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'var(--text)',
    display: 'block',
    marginBottom: '6px',
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1
          className="font-head font-bold text-[var(--text)]"
          style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
        >
          Per-Child Settings
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Overrides apply only to this child. Leave blank to use your guardian-level defaults.
        </p>
      </div>

      <SectionCard
        title="Spending Cap"
        subtitle="Maximum total spend per 30 days for this child"
        className="mb-6"
      >
        <label style={labelStyle}>Monthly cap ($)</label>
        <input
          type="number"
          value={cap}
          onChange={(e) => setCap(e.target.value)}
          placeholder="No per-child cap"
          min="0"
          step="0.01"
          style={inputStyle}
        />
      </SectionCard>

      <SectionCard
        title="Session Time Window"
        subtitle="Bookings outside this window are blocked"
        className="mb-6"
      >
        <div className="flex gap-4 flex-wrap">
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={labelStyle}>Earliest start</label>
            <input
              type="time"
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={labelStyle}>Latest start</label>
            <input
              type="time"
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Approval Required"
        subtitle="When on, every booking waits for your sign-off"
        className="mb-6"
      >
        <label className="flex items-center gap-3" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={requiresApproval}
            onChange={(e) => setRequiresApproval(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
          />
          <span style={{ fontSize: '0.9rem', color: 'var(--text)' }}>
            Require approval for new bookings
          </span>
        </label>
      </SectionCard>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2"
          style={{
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            color: '#fff',
            borderRadius: '100px',
            padding: '10px 20px',
            fontSize: '0.82rem',
            fontWeight: 600,
            border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? (
            <>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              <Loader2
                size={14}
                strokeWidth={1.5}
                style={{ animation: 'spin 1s linear infinite' }}
              />
              Saving...
            </>
          ) : (
            <>
              <Save size={14} strokeWidth={1.5} />
              Save Settings
            </>
          )}
        </button>
        {saveSuccess && (
          <span style={{ color: '#639922', fontSize: '0.82rem' }}>Saved.</span>
        )}
        {saveError && (
          <span style={{ color: '#E24B4A', fontSize: '0.82rem' }}>{saveError}</span>
        )}
      </div>
    </div>
  )
}
