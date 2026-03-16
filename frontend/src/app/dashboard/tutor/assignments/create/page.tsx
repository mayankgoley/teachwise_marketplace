'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { apiGet } from '@/lib/api'
import type { TutorStudent } from '@/types/search'

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '12px 16px',
  color: 'var(--text)',
  fontSize: '0.875rem',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.82rem',
  fontWeight: 600,
  color: 'var(--text)',
  marginBottom: '6px',
  display: 'block',
}

const errorStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#E24B4A',
  marginTop: '4px',
}

export default function CreateAssignmentPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  const [students, setStudents] = useState<TutorStudent[]>([])
  const [studentsLoading, setStudentsLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('')
  const [subject, setSubject] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')

  const [allowLate, setAllowLate] = useState(false)
  const [gracePeriod, setGracePeriod] = useState(0)
  const [latePenalty, setLatePenalty] = useState(0)
  const [allowResub, setAllowResub] = useState(false)
  const [maxResubs, setMaxResubs] = useState(1)

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    async function loadStudents() {
      try {
        const res = await apiGet<{ students: TutorStudent[] }>('/api/v1/tutor/students')
        if (res.success) setStudents(res.data.students)
      } finally {
        setStudentsLoading(false)
      }
    }
    loadStudents()
  }, [])

  function validateStep1(): boolean {
    const errs: Record<string, string> = {}
    if (!title.trim()) errs.title = 'Title is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleNext() {
    if (step === 1 && !validateStep1()) return
    setErrors({})
    setStep((s) => Math.min(s + 1, 3))
  }

  function handlePrev() {
    setErrors({})
    setStep((s) => Math.max(s - 1, 1))
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('student_id', String(selectedStudentId))
      formData.append('subject', subject)
      formData.append('due_date', dueDate)
      formData.append('description', description)
      formData.append('allow_late_submission', String(allowLate))
      formData.append('grace_period_hours', String(gracePeriod))
      formData.append('late_penalty_percent', String(latePenalty))
      formData.append('allow_resubmission', String(allowResub))
      formData.append('max_resubmissions', String(maxResubs))

      const res = await fetch(
        (process.env.NEXT_PUBLIC_API_URL ?? '') + '/api/v1/tutor/assignments',
        {
          method: 'POST',
          body: formData,
          credentials: 'include',
        }
      )

      if (res.ok) {
        router.push('/dashboard/tutor/assignments')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const selectedStudent = students.find((s) => s.id === selectedStudentId)

  function renderStepIndicator() {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0',
          marginBottom: '32px',
        }}
      >
        {[1, 2, 3].map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: s <= step ? '#fff' : 'var(--muted)',
                background:
                  s < step
                    ? '#22c55e'
                    : s === step
                      ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
                      : 'rgba(255,255,255,0.05)',
                border: s > step ? '1px solid var(--border)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {s < step ? <Check size={16} strokeWidth={1.5} /> : s}
            </div>
            {i < 2 && (
              <div
                style={{
                  width: '48px',
                  height: '2px',
                  background: s < step ? '#22c55e' : 'var(--border)',
                  transition: 'all 0.2s',
                }}
              />
            )}
          </div>
        ))}
      </div>
    )
  }

  function renderStep1() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={labelStyle}>Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Assignment title"
            style={inputStyle}
          />
          {errors.title && <div style={errorStyle}>{errors.title}</div>}
        </div>

        <div>
          <label style={labelStyle}>Student</label>
          {studentsLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted)', fontSize: '0.875rem' }}>
              <Loader2 size={16} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
              Loading students...
            </div>
          ) : (
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value ? Number(e.target.value) : '')}
              style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
            >
              <option value="">Select a student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          {errors.student && <div style={errorStyle}>{errors.student}</div>}
        </div>

        <div>
          <label style={labelStyle}>Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Mathematics"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Due Date</label>
          <input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={inputStyle}
          />
          {errors.dueDate && <div style={errorStyle}>{errors.dueDate}</div>}
        </div>

        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the assignment..."
            rows={4}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>
      </div>
    )
  }

  function renderStep2() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={allowLate}
              onChange={(e) => setAllowLate(e.target.checked)}
              style={{ accentColor: 'var(--accent)', width: '18px', height: '18px' }}
            />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
              Allow late submissions
            </span>
          </label>
        </div>

        {allowLate && (
          <>
            <div>
              <label style={labelStyle}>Grace Period (hours)</label>
              <input
                type="number"
                value={gracePeriod}
                onChange={(e) => setGracePeriod(Number(e.target.value))}
                min={0}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Late Penalty (%)</label>
              <input
                type="number"
                value={latePenalty}
                onChange={(e) => setLatePenalty(Number(e.target.value))}
                min={0}
                max={100}
                style={inputStyle}
              />
            </div>
          </>
        )}

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={allowResub}
              onChange={(e) => setAllowResub(e.target.checked)}
              style={{ accentColor: 'var(--accent)', width: '18px', height: '18px' }}
            />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
              Allow resubmission
            </span>
          </label>
        </div>

        {allowResub && (
          <div>
            <label style={labelStyle}>Max Resubmissions</label>
            <input
              type="number"
              value={maxResubs}
              onChange={(e) => setMaxResubs(Number(e.target.value))}
              min={1}
              style={inputStyle}
            />
          </div>
        )}
      </div>
    )
  }

  function renderStep3() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          Review Assignment
        </h3>

        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <SummaryRow label="Title" value={title} />
          <SummaryRow label="Student" value={selectedStudent?.name ?? '—'} />
          <SummaryRow label="Subject" value={subject || '—'} />
          <SummaryRow label="Due Date" value={dueDate ? new Date(dueDate).toLocaleString() : '—'} />
          <SummaryRow label="Description" value={description || '—'} />
        </div>

        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <SummaryRow label="Late Submissions" value={allowLate ? 'Allowed' : 'Not allowed'} />
          {allowLate && (
            <>
              <SummaryRow label="Grace Period" value={`${gracePeriod} hours`} />
              <SummaryRow label="Late Penalty" value={`${latePenalty}%`} />
            </>
          )}
          <SummaryRow label="Resubmission" value={allowResub ? 'Allowed' : 'Not allowed'} />
          {allowResub && <SummaryRow label="Max Resubmissions" value={String(maxResubs)} />}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <a
        href="/dashboard/tutor/assignments"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--accent)',
          textDecoration: 'none',
          fontSize: '0.875rem',
          fontWeight: 600,
          marginBottom: '24px',
        }}
      >
        <ArrowLeft size={16} strokeWidth={1.5} />
        Back to Assignments
      </a>

      <h1
        style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--text)',
          margin: '0 0 24px',
        }}
      >
        Create Assignment
      </h1>

      {renderStepIndicator()}

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}

      <div
        style={{
          display: 'flex',
          justifyContent: step === 1 ? 'flex-end' : 'space-between',
          marginTop: '32px',
          gap: '12px',
        }}
      >
        {step > 1 && (
          <button
            onClick={handlePrev}
            style={{
              padding: '10px 24px',
              borderRadius: '100px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ArrowLeft size={16} strokeWidth={1.5} />
            Previous
          </button>
        )}

        {step < 3 ? (
          <button
            onClick={handleNext}
            style={{
              padding: '10px 24px',
              borderRadius: '100px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            Next
            <ArrowRight size={16} strokeWidth={1.5} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: '10px 24px',
              borderRadius: '100px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              border: 'none',
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? (
              <Loader2 size={16} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Check size={16} strokeWidth={1.5} />
            )}
            {submitting ? 'Creating...' : 'Create Assignment'}
          </button>
        )}
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
      <span style={{ fontSize: '0.82rem', color: 'var(--muted)', flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--text)',
          textAlign: 'right',
          wordBreak: 'break-word',
        }}
      >
        {value}
      </span>
    </div>
  )
}
