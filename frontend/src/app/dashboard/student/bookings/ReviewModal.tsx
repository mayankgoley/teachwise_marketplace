'use client'

import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import StarRating from '@/components/features/StarRating'
import { apiPost } from '@/lib/api'

interface ReviewModalProps {
  bookingId: number
  tutorName: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ReviewModal({
  bookingId,
  tutorName,
  isOpen,
  onClose,
  onSuccess,
}: ReviewModalProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [ratingKnowledge, setRatingKnowledge] = useState(0)
  const [ratingCommunication, setRatingCommunication] = useState(0)
  const [ratingPunctuality, setRatingPunctuality] = useState(0)
  const [ratingValue, setRatingValue] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  const isValid = rating > 0 && comment.trim().length >= 10 && comment.trim().length <= 1000

  const handleSubmit = async () => {
    if (!isValid) return
    setIsSubmitting(true)
    setError(null)

    try {
      const body: Record<string, unknown> = {
        rating,
        comment: comment.trim(),
      }
      if (ratingKnowledge > 0) body.rating_knowledge = ratingKnowledge
      if (ratingCommunication > 0) body.rating_communication = ratingCommunication
      if (ratingPunctuality > 0) body.rating_punctuality = ratingPunctuality
      if (ratingValue > 0) body.rating_value = ratingValue

      const res = await apiPost<{ message: string }>(
        `/api/v1/bookings/${bookingId}/review`,
        body
      )
      if (res.success) {
        onSuccess()
      } else {
        setError(res.error?.message ?? 'Failed to submit review')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', padding: '20px' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '28px',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2
            className="font-head font-bold text-[var(--text)]"
            style={{ fontSize: '1.2rem', margin: 0 }}
          >
            Review {tutorName}
          </h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border)',
              color: 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Overall rating */}
        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '8px',
            }}
          >
            Overall Rating <span style={{ color: '#E24B4A' }}>*</span>
          </label>
          <StarRating
            rating={rating}
            size={28}
            interactive
            onRate={setRating}
          />
          {rating === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '0.75rem', margin: '6px 0 0' }}>
              Please select a rating
            </p>
          )}
        </div>

        {/* Comment */}
        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '8px',
            }}
          >
            Your Review <span style={{ color: '#E24B4A' }}>*</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 1000))}
            placeholder="Share your experience with this tutor..."
            rows={4}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '12px 14px',
              color: 'var(--text)',
              fontSize: '0.88rem',
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
          <div
            className="flex items-center justify-between"
            style={{ marginTop: '4px' }}
          >
            {comment.trim().length > 0 && comment.trim().length < 10 ? (
              <p style={{ color: '#E24B4A', fontSize: '0.75rem', margin: 0 }}>
                Minimum 10 characters required
              </p>
            ) : (
              <span />
            )}
            <span
              style={{
                color: 'var(--muted)',
                fontSize: '0.72rem',
              }}
            >
              {comment.length}/1000
            </span>
          </div>
        </div>

        {/* Sub-ratings */}
        <div style={{ marginBottom: '24px' }}>
          <p
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text)',
              margin: '0 0 12px',
            }}
          >
            Detailed Ratings{' '}
            <span
              style={{
                fontWeight: 400,
                fontSize: '0.78rem',
                color: 'var(--muted)',
              }}
            >
              (optional)
            </span>
          </p>

          <div className="flex flex-col" style={{ gap: '10px' }}>
            {([
              { label: 'Knowledge', value: ratingKnowledge, setter: setRatingKnowledge },
              { label: 'Communication', value: ratingCommunication, setter: setRatingCommunication },
              { label: 'Punctuality', value: ratingPunctuality, setter: setRatingPunctuality },
              { label: 'Value', value: ratingValue, setter: setRatingValue },
            ] as const).map(({ label, value, setter }) => (
              <div
                key={label}
                className="flex items-center justify-between"
              >
                <span
                  style={{
                    color: 'var(--muted)',
                    fontSize: '0.82rem',
                  }}
                >
                  {label}
                </span>
                <StarRating
                  rating={value}
                  size={18}
                  interactive
                  onRate={setter}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p
            style={{
              color: '#E24B4A',
              fontSize: '0.82rem',
              margin: '0 0 14px',
              padding: '10px 14px',
              background: 'rgba(226,75,74,0.1)',
              borderRadius: '8px',
            }}
          >
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '10px 20px',
              color: 'var(--muted)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            style={{
              background: 'var(--accent)',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 24px',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: isValid && !isSubmitting ? 'pointer' : 'not-allowed',
              opacity: isValid && !isSubmitting ? 1 : 0.5,
              transition: 'opacity 0.2s ease',
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  )
}
