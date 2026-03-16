'use client'

import { useState, useEffect, useCallback } from 'react'
import { Settings, Loader2, Save } from 'lucide-react'
import { apiGet } from '@/lib/api'
import SectionCard from '@/components/ui/SectionCard'
import { formatDate } from '@/lib/format'
import type { PlatformSetting } from '@/types/admin'

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSetting[]>([])
  const [editedValues, setEditedValues] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<{ settings: PlatformSetting[] }>(
        '/api/v1/admin/settings'
      )
      if (res.success) {
        setSettings(res.data.settings)
        setEditedValues({})
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleValueChange = (id: number, value: string) => {
    setEditedValues((prev) => ({ ...prev, [id]: value }))
  }

  const getValue = (setting: PlatformSetting): string => {
    if (editedValues[setting.id] !== undefined) return editedValues[setting.id]
    return setting.value
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const settingsPayload = settings.map((s) => ({
        id: s.id,
        value: editedValues[s.id] !== undefined ? editedValues[s.id] : s.value,
      }))
      await fetch('/api/v1/admin/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsPayload }),
      })
      await fetchSettings()
    } finally {
      setSaving(false)
    }
  }

  const grouped = settings.reduce<Record<string, PlatformSetting[]>>(
    (acc, setting) => {
      const cat = setting.category || 'General'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(setting)
      return acc
    },
    {}
  )

  const categories = Object.keys(grouped).sort()

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
          Platform Settings
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Configure platform behavior
        </p>
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
      ) : settings.length === 0 ? (
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: '20px',
            border: '1px solid var(--border)',
            padding: '40px 20px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <Settings size={22} strokeWidth={1.5} color="var(--muted)" />
          </div>
          <h4
            className="font-head"
            style={{
              fontWeight: 700,
              fontSize: '1.1rem',
              color: 'var(--text)',
              margin: '0 0 8px',
            }}
          >
            No settings configured
          </h4>
          <p
            style={{
              color: 'var(--muted)',
              fontSize: '0.9rem',
              margin: 0,
              maxWidth: '300px',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            Platform settings will appear here once they have been created.
          </p>
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            {categories.map((category) => (
              <SectionCard
                key={category}
                title={category}
                subtitle={grouped[category].length + ' setting' + (grouped[category].length !== 1 ? 's' : '')}
                noPadding
              >
                {grouped[category].map((setting, index) => (
                  <div
                    key={setting.id}
                    style={{
                      padding: '16px 20px',
                      borderBottom:
                        index < grouped[category].length - 1
                          ? '1px solid var(--border)'
                          : 'none',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '16px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            color: 'var(--text)',
                            fontSize: '0.88rem',
                            marginBottom: '4px',
                          }}
                        >
                          {setting.key}
                        </div>
                        {setting.description && (
                          <div
                            style={{
                              color: 'var(--muted)',
                              fontSize: '0.78rem',
                              marginBottom: '8px',
                              lineHeight: 1.4,
                            }}
                          >
                            {setting.description}
                          </div>
                        )}
                        {(setting.updated_by || setting.updated_at) && (
                          <div
                            style={{
                              fontSize: '0.72rem',
                              color: 'var(--muted)',
                              opacity: 0.7,
                            }}
                          >
                            {setting.updated_by && (
                              <span>Updated by {setting.updated_by}</span>
                            )}
                            {setting.updated_by && setting.updated_at && ' on '}
                            {setting.updated_at && (
                              <span>{formatDate(setting.updated_at)}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div style={{ flex: '0 1 280px', minWidth: '180px' }}>
                        <input
                          type="text"
                          value={getValue(setting)}
                          onChange={(e) =>
                            handleValueChange(setting.id, e.target.value)
                          }
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '12px',
                            border: '1px solid var(--border)',
                            background: 'var(--surface)',
                            color: 'var(--text)',
                            fontSize: '0.85rem',
                            outline: 'none',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </SectionCard>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '28px',
            }}
          >
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 28px',
                borderRadius: '100px',
                fontSize: '0.88rem',
                fontWeight: 600,
                border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
                background:
                  'linear-gradient(135deg, var(--accent), var(--accent2))',
                color: '#fff',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? (
                <Loader2
                  size={16}
                  strokeWidth={1.5}
                  style={{ animation: 'spin 1s linear infinite' }}
                />
              ) : (
                <Save size={16} strokeWidth={1.5} />
              )}
              Save Changes
            </button>
          </div>
        </>
      )}
    </div>
  )
}
