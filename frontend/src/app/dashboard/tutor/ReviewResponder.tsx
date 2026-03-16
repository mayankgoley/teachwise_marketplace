'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { apiPost } from '@/lib/api'

interface ReviewResponderProps {
  reviewId: number
}

export default function ReviewResponder({ reviewId }: ReviewResponderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [response, setResponse] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (submitted) {
    return (
      <span
        style={{
          color: '#639922',
          fontSize: '0.8rem',
          fontWeight: 500,
        }}
      >
        Response saved
      </span>
    )
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          background: 'rgba(79,142,255,0.1)',
          border: '1px solid rgba(79,142,255,0.25)',
          borderRadius: '8px',
          padding: '6px 14px',
          color: 'var(--accent)',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Respond
      </button>
    )
  }

  const handleSubmit = async () => {
    if (!response.trim()) return
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await apiPost<{ message: string }>(
        `/api/v1/tutor/reviews/${reviewId}/respond`,
        { response: response.trim() }
      )
      if (res.success) {
        setSubmitted(true)
      } else {
        setError(res.error?.message ?? 'Failed to save response')
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value.slice(0, 500))}
        placeholder="Write your response..."
        rows={2}
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '8px 12px',
          color: 'var(--text)',
          fontSize: '0.82rem',
          resize: 'none',
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !response.trim()}
          className="flex items-center gap-1"
          style={{
            background: 'var(--accent)',
            border: 'none',
            borderRadius: '8px',
            padding: '6px 14px',
            color: '#fff',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            opacity: isSubmitting || !response.trim() ? 0.5 : 1,
          }}
        >
          <Send size={12} strokeWidth={1.5} />
          {isSubmitting ? 'Sending...' : 'Send'}
        </button>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '6px 14px',
            color: 'var(--muted)',
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <span
          style={{
            color: 'var(--muted)',
            fontSize: '0.7rem',
            marginLeft: 'auto',
          }}
        >
          {response.length}/500
        </span>
      </div>
      {error && (
        <p style={{ color: '#E24B4A', fontSize: '0.8rem', margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  )
}
