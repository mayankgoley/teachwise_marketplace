'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { apiPost, apiDelete } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import type { TutorSlotData } from '@/types/search'

interface EditSlotModalProps {
  slot: TutorSlotData
  onClose: () => void
  onSuccess: () => void
}

export default function EditSlotModal({ slot, onClose, onSuccess }: EditSlotModalProps) {
  const [form, setForm] = useState({
    date: slot.date,
    start_time: slot.start_time,
    end_time: slot.end_time,
    subject: slot.subject,
    price: String(slot.price),
    mode: slot.mode,
    max_students: String(slot.max_students),
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.date || !form.start_time || !form.end_time || !form.subject || !form.price) {
      setError('Please fill all required fields.')
      return
    }
    if (form.end_time <= form.start_time) {
      setError('End time must be after start time.')
      return
    }
    if (parseFloat(form.price) <= 0) {
      setError('Price must be greater than 0.')
      return
    }

    setSubmitting(true)
    try {
      const deleteRes = await apiDelete('/api/v1/tutor/slots/' + slot.id)
      if (!deleteRes.success) {
        setError(deleteRes.error?.message ?? 'Failed to update slot.')
        setSubmitting(false)
        return
      }

      const createRes = await apiPost('/api/v1/tutor/slots', {
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        subject: form.subject,
        price: parseFloat(form.price),
        mode: form.mode,
        max_students: parseInt(form.max_students),
      })

      if (createRes.success) {
        toast.success('Slot updated', 'Your availability has been updated.')
        onSuccess()
        onClose()
      } else {
        setError(createRes.error?.message ?? 'Failed to create updated slot.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'var(--muted)',
    marginBottom: '6px',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1001, background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: '20px',
        padding: '28px', width: '420px', maxWidth: '90vw',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
            Edit Slot
          </h3>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px' }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
            <div>
              <label style={labelStyle}>Date</label>
              <input
                type="date"
                value={form.date}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                style={inputStyle}
                required
              />
            </div>

            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Start time</label>
                <input type="time" value={form.start_time}
                  onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                  style={inputStyle} required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>End time</label>
                <input type="time" value={form.end_time}
                  onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                  style={inputStyle} required />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Subject</label>
              <input type="text" value={form.subject}
                onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                placeholder="e.g. Mathematics"
                style={inputStyle} required />
            </div>

            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Price ($)</label>
                <input type="number" value={form.price} min="1" step="0.01"
                  onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                  style={inputStyle} required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Mode</label>
                <select value={form.mode}
                  onChange={e => setForm(p => ({ ...p, mode: e.target.value }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="online">Online</option>
                  <option value="in_person">In Person</option>
                  <option value="both">Both</option>
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Max students</label>
              <input type="number" value={form.max_students} min="1" max="10"
                onChange={e => setForm(p => ({ ...p, max_students: e.target.value }))}
                style={inputStyle} required />
            </div>
          </div>

          {error && (
            <p style={{ color: '#E24B4A', fontSize: '0.82rem', margin: '0 0 10px', textAlign: 'center' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%', padding: '14px',
              borderRadius: '100px', border: 'none',
              background: submitting ? 'rgba(79,142,255,0.3)' : 'linear-gradient(135deg, #4f8eff, #00e5ff)',
              color: '#fff', fontWeight: 600, fontSize: '0.95rem',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </>
  )
}
