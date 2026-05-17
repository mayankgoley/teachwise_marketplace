'use client'

import { useState, useMemo, useEffect, type FormEvent } from 'react'
import { CalendarDays, X, Loader2 } from 'lucide-react'
import { apiPost } from '@/lib/api'

interface RecurringSlotModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (count: number) => void
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function RecurringSlotModal({ isOpen, onClose, onSuccess }: RecurringSlotModalProps) {
  const [form, setForm] = useState({
    start_time: '09:00',
    end_time: '10:00',
    subject: '',
    price: '',
    mode: 'online',
    max_students: 1,
    days_of_week: [0] as number[],
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const previewCount = useMemo(() => {
    if (!form.start_date || !form.end_date || form.days_of_week.length === 0) return 0
    const start = new Date(form.start_date)
    const end = new Date(form.end_date)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return 0
    let count = 0
    const current = new Date(start)
    while (current <= end) {
      const dayOfWeek = (current.getDay() + 6) % 7 // Convert Sun=0 to Mon=0
      if (form.days_of_week.includes(dayOfWeek)) count++
      current.setDate(current.getDate() + 1)
    }
    return count
  }, [form.start_date, form.end_date, form.days_of_week])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (previewCount === 0) return
    setSubmitting(true)
    setError(null)

    const res = await apiPost<{ slots_created: number; message: string }>(
      '/api/v1/tutor/slots/recurring',
      {
        start_time: form.start_time,
        end_time: form.end_time,
        subject: form.subject,
        price: parseFloat(form.price),
        mode: form.mode,
        max_students: form.max_students,
        days_of_week: form.days_of_week,
        start_date: form.start_date,
        end_date: form.end_date,
      }
    )

    setSubmitting(false)

    if (res.success) {
      onSuccess(res.data.slots_created)
    } else {
      setError(res.error?.message ?? 'Failed to create slots')
    }
  }

  if (!isOpen) return null

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.875rem',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'var(--muted)',
    display: 'block',
    marginBottom: '6px',
  }

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 99,
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '480px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '28px',
          zIndex: 100,
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Recurring Slots
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px' }}
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex gap-3" style={{ marginBottom: '14px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Start time</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
                style={inputStyle}
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>End time</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
                style={inputStyle}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Subject</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              placeholder="e.g. Mathematics"
              style={inputStyle}
              required
            />
          </div>

          <div className="flex gap-3" style={{ marginBottom: '14px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Price ($)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                placeholder="50"
                style={inputStyle}
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Mode</label>
              <select
                value={form.mode}
                onChange={(e) => setForm((p) => ({ ...p, mode: e.target.value }))}
                style={inputStyle}
              >
                <option value="online">Online</option>
                <option value="in_person">In Person</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Days of week</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {DAYS.map((day, index) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      days_of_week: prev.days_of_week.includes(index)
                        ? prev.days_of_week.filter((d) => d !== index)
                        : [...prev.days_of_week, index],
                    }))
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '100px',
                    border: 'none',
                    cursor: 'pointer',
                    background: form.days_of_week.includes(index)
                      ? 'linear-gradient(135deg, #4f8eff, #00e5ff)'
                      : 'var(--bg)',
                    color: form.days_of_week.includes(index) ? '#fff' : 'var(--muted)',
                    fontWeight: form.days_of_week.includes(index) ? 600 : 400,
                    fontSize: '0.875rem',
                    transition: 'all 0.2s',
                  }}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3" style={{ marginBottom: '14px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Start date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                style={inputStyle}
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>End date</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                style={inputStyle}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Max students per slot</label>
            <input
              type="number"
              min="1"
              max="10"
              value={form.max_students}
              onChange={(e) => setForm((p) => ({ ...p, max_students: parseInt(e.target.value) || 1 }))}
              style={inputStyle}
            />
          </div>

          {previewCount > 0 && (
            <div
              style={{
                background: 'rgba(79,142,255,0.08)',
                border: '1px solid rgba(79,142,255,0.2)',
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '14px',
              }}
            >
              <CalendarDays size={18} strokeWidth={1.5} color="var(--accent)" />
              <span style={{ fontSize: '0.9rem', color: 'var(--text)' }}>
                <strong>{previewCount} slots</strong> will be created
                {form.days_of_week.length > 0 && (
                  <span style={{ color: 'var(--muted)' }}>
                    {' '}— every {form.days_of_week.sort((a, b) => a - b).map((d) => DAYS[d]).join(', ')}
                  </span>
                )}
              </span>
            </div>
          )}

          {error && (
            <p style={{ color: '#E24B4A', fontSize: '0.82rem', margin: '0 0 10px', textAlign: 'center' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || previewCount === 0}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '100px',
              border: 'none',
              background:
                submitting || previewCount === 0
                  ? 'rgba(79,142,255,0.3)'
                  : 'linear-gradient(135deg, #4f8eff, #00e5ff)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: submitting || previewCount === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {submitting && <Loader2 size={18} strokeWidth={1.5} className="animate-spin" />}
            {submitting ? 'Creating...' : `Create ${previewCount} Slots`}
          </button>
        </form>
      </div>
    </>
  )
}
