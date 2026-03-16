'use client'

import { useState, useEffect, useCallback } from 'react'
import { DollarSign, Loader2, Save } from 'lucide-react'
import { apiGet, apiPut } from '@/lib/api'
import SectionCard from '@/components/ui/SectionCard'
import { formatCurrency } from '@/lib/format'
import type { SpendingData } from '@/types/guardian'

export default function GuardianSpendingPage() {
  const [data, setData] = useState<SpendingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [weeklyLimit, setWeeklyLimit] = useState('')
  const [monthlyLimit, setMonthlyLimit] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const fetchSpending = useCallback(async () => {
    try {
      const res = await apiGet<SpendingData>('/api/v1/guardian/spending')
      if (res.success) {
        setData(res.data)
        setWeeklyLimit(res.data.weekly_limit?.toString() ?? '')
        setMonthlyLimit(res.data.monthly_limit?.toString() ?? '')
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSpending()
  }, [fetchSpending])

  const handleSaveLimits = async () => {
    setSaving(true)
    setSaveSuccess(false)
    setSaveError(null)
    try {
      const res = await apiPut<{ message: string }>('/api/v1/guardian/spending/limits', {
        weekly_limit: weeklyLimit ? parseFloat(weeklyLimit) : null,
        monthly_limit: monthlyLimit ? parseFloat(monthlyLimit) : null,
      })
      if (res.success) {
        setSaveSuccess(true)
        await fetchSpending()
        setTimeout(() => setSaveSuccess(false), 3000)
      } else {
        setSaveError(res.error?.message ?? 'Failed to save limits')
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
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '16px' }}>
          Loading spending data...
        </p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          Failed to load spending data. Please refresh the page.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1
          className="font-head font-bold text-[var(--text)]"
          style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
        >
          Spending Overview
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Track and manage spending limits
        </p>
      </div>

      {/* Stat cards */}
      <div
        className="grid gap-4 mb-8"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
      >
        {/* Total Spent */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            padding: '24px',
          }}
        >
          <div className="flex items-center gap-2" style={{ marginBottom: '12px' }}>
            <DollarSign size={18} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 500 }}>
              Total Spent
            </span>
          </div>
          <span
            className="font-head font-bold text-[var(--text)]"
            style={{ fontSize: '1.5rem' }}
          >
            {formatCurrency(data.total_spent)}
          </span>
        </div>

        {/* This Week */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            padding: '24px',
          }}
        >
          <div className="flex items-center gap-2" style={{ marginBottom: '12px' }}>
            <DollarSign size={18} strokeWidth={1.5} style={{ color: '#4f8eff' }} />
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 500 }}>
              This Week
            </span>
          </div>
          <span
            className="font-head font-bold text-[var(--text)]"
            style={{ fontSize: '1.5rem' }}
          >
            {formatCurrency(data.weekly_spent)}
          </span>
          {data.weekly_limit !== null && (
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: '4px 0 0' }}>
              Limit: {formatCurrency(data.weekly_limit)}
            </p>
          )}
        </div>

        {/* This Month */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            padding: '24px',
          }}
        >
          <div className="flex items-center gap-2" style={{ marginBottom: '12px' }}>
            <DollarSign size={18} strokeWidth={1.5} style={{ color: '#639922' }} />
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 500 }}>
              This Month
            </span>
          </div>
          <span
            className="font-head font-bold text-[var(--text)]"
            style={{ fontSize: '1.5rem' }}
          >
            {formatCurrency(data.monthly_spent)}
          </span>
          {data.monthly_limit !== null && (
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: '4px 0 0' }}>
              Limit: {formatCurrency(data.monthly_limit)}
            </p>
          )}
        </div>
      </div>

      {/* Spending Limits */}
      <SectionCard title="Spending Limits" subtitle="Set weekly and monthly spending caps" className="mb-6">
        <div className="flex items-end gap-4 flex-wrap">
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label
              style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text)',
                display: 'block',
                marginBottom: '6px',
              }}
            >
              Weekly Limit ($)
            </label>
            <input
              type="number"
              value={weeklyLimit}
              onChange={(e) => setWeeklyLimit(e.target.value)}
              placeholder="No limit"
              min="0"
              step="0.01"
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '10px 14px',
                color: 'var(--text)',
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label
              style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text)',
                display: 'block',
                marginBottom: '6px',
              }}
            >
              Monthly Limit ($)
            </label>
            <input
              type="number"
              value={monthlyLimit}
              onChange={(e) => setMonthlyLimit(e.target.value)}
              placeholder="No limit"
              min="0"
              step="0.01"
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '10px 14px',
                color: 'var(--text)',
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            onClick={handleSaveLimits}
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
              whiteSpace: 'nowrap',
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
                Save Limits
              </>
            )}
          </button>
        </div>

        {/* Success / error messages */}
        {saveSuccess && (
          <p style={{ color: '#639922', fontSize: '0.82rem', margin: '12px 0 0' }}>
            Spending limits saved successfully.
          </p>
        )}
        {saveError && (
          <p style={{ color: '#E24B4A', fontSize: '0.82rem', margin: '12px 0 0' }}>
            {saveError}
          </p>
        )}
      </SectionCard>

      {/* By Child */}
      <SectionCard title="By Child" subtitle="Spending breakdown per child" noPadding>
        {data.by_child.length === 0 ? (
          <div style={{ padding: '24px' }}>
            <p style={{ color: 'var(--muted)', fontSize: '0.875rem', margin: 0, textAlign: 'center' }}>
              No children linked yet.
            </p>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div
              className="flex items-center"
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid var(--border)',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <span style={{ flex: 1 }}>Name</span>
              <span style={{ width: '120px', textAlign: 'right' }}>Total Spent</span>
              <span style={{ width: '120px', textAlign: 'right' }}>This Month</span>
            </div>
            {data.by_child.map((child, i) => (
              <div
                key={child.id}
                className="flex items-center"
                style={{
                  padding: '16px 20px',
                  borderBottom:
                    i < data.by_child.length - 1
                      ? '1px solid var(--border)'
                      : 'none',
                }}
              >
                <span
                  style={{
                    flex: 1,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'var(--text)',
                  }}
                >
                  {child.name}
                </span>
                <span
                  style={{
                    width: '120px',
                    textAlign: 'right',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text)',
                  }}
                >
                  {formatCurrency(child.total_spent)}
                </span>
                <span
                  style={{
                    width: '120px',
                    textAlign: 'right',
                    fontSize: '0.875rem',
                    color: 'var(--muted)',
                  }}
                >
                  {formatCurrency(child.monthly_spent)}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
