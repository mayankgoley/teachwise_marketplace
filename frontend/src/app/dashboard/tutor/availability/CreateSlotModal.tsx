'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { X, Loader2 } from 'lucide-react'
import { apiPost } from '@/lib/api'
import type { TutorSlotData } from '@/types/search'
import type { ApiResponse } from '@/lib/api'

interface CreateSlotModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (slot: TutorSlotData) => void
  initialDate?: string
}

export default function CreateSlotModal({
  isOpen,
  onClose,
  onSuccess,
  initialDate,
}: CreateSlotModalProps) {
  const today = new Date().toISOString().slice(0, 10)

  const [date, setDate] = useState(initialDate ?? today)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [subject, setSubject] = useState('')
  const [price, setPrice] = useState('')
  const [mode, setMode] = useState<'online' | 'in_person' | 'both'>('online')
  const [maxStudents, setMaxStudents] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialDate) setDate(initialDate)
  }, [initialDate])

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

  useEffect(() => {
    if (isOpen) {
      setError(null)
      setSubject('')
      setPrice('')
      setMode('online')
      setMaxStudents(1)
      setStartTime('09:00')
      setEndTime('10:00')
      setDate(initialDate ?? today)
    }
  }, [isOpen, initialDate, today])

  if (!isOpen) return null

  const validate = (): string | null => {
    if (date < today) return 'Date must be today or in the future'
    if (endTime <= startTime) return 'End time must be after start time'
    if (!subject.trim()) return 'Subject is required'
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum <= 0) return 'Price must be greater than 0'
    return null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res: ApiResponse<{ slot: TutorSlotData }> = await apiPost('/api/v1/tutor/slots', {
        date,
        start_time: startTime,
        end_time: endTime,
        subject: subject.trim(),
        price: parseFloat(price),
        mode,
        max_students: maxStudents,
      })

      if (res.success && res.data?.slot) {
        onSuccess(res.data.slot)
      } else {
        setError(res.error?.message ?? 'Failed to create slot')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
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
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--muted)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', zIndex: 50 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h3
            className="font-head font-bold text-[var(--text)]"
            style={{ fontSize: '1.1rem', margin: 0 }}
          >
            Create Availability Slot
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted)',
              padding: '4px',
            }}
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <div className="flex flex-col gap-4">
            {/* Date */}
            <div>
              <label style={labelStyle}>Date</label>
              <input
                type="date"
                value={date}
                min={today}
                onChange={(e) => setDate(e.target.value)}
                style={inputStyle}
                required
              />
            </div>

            {/* Time row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>
            </div>

            {/* Subject */}
            <div>
              <label style={labelStyle}>Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Mathematics, English, Physics"
                style={inputStyle}
                required
              />
            </div>

            {/* Price + Mode row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Price ($)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Mode</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as 'online' | 'in_person' | 'both')}
                  style={inputStyle}
                >
                  <option value="online">Online</option>
                  <option value="in_person">In Person</option>
                  <option value="both">Both</option>
                </select>
              </div>
            </div>

            {/* Max Students */}
            <div>
              <label style={labelStyle}>Max Students</label>
              <input
                type="number"
                value={maxStudents}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  if (v >= 1 && v <= 10) setMaxStudents(v)
                }}
                min={1}
                max={10}
                style={inputStyle}
              />
            </div>

            {/* Error */}
            {error && (
              <p
                style={{
                  color: '#E24B4A',
                  fontSize: '0.82rem',
                  margin: 0,
                  padding: '8px 12px',
                  background: 'rgba(226,75,74,0.1)',
                  borderRadius: '8px',
                }}
              >
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="btn-gradient flex items-center justify-center gap-2 text-white"
              style={{
                padding: '12px',
                borderRadius: '100px',
                fontSize: '0.875rem',
                fontWeight: 600,
                border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                marginTop: '4px',
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Slot'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
