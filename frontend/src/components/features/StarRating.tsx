'use client'

import { Star } from 'lucide-react'

interface StarRatingProps {
  rating: number
  maxStars?: number
  size?: number
  interactive?: boolean
  onRate?: (rating: number) => void
}

export default function StarRating({
  rating,
  maxStars = 5,
  size = 16,
  interactive = false,
  onRate,
}: StarRatingProps) {
  return (
    <div className="flex items-center gap-0.5" style={{ cursor: interactive ? 'pointer' : 'default' }}>
      {Array.from({ length: maxStars }, (_, i) => {
        const starIndex = i + 1
        const isFull = rating >= starIndex
        const isPartial = !isFull && rating > i
        const fraction = isPartial ? rating - i : 0

        return (
          <span
            key={i}
            onClick={() => interactive && onRate?.(starIndex)}
            style={{
              position: 'relative',
              display: 'inline-flex',
              cursor: interactive ? 'pointer' : 'default',
            }}
          >
            {/* Background (empty) star */}
            <Star
              size={size}
              fill="none"
              color="var(--muted)"
              strokeWidth={1.5}
              style={{ opacity: 0.3 }}
            />
            {/* Filled overlay */}
            {(isFull || isPartial) && (
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  overflow: 'hidden',
                  width: isFull ? '100%' : `${fraction * 100}%`,
                }}
              >
                <Star
                  size={size}
                  fill="#BA7517"
                  color="#BA7517"
                  strokeWidth={1.5}
                />
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}
