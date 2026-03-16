'use client'

import Link from 'next/link'
import {
  Heart,
  Star,
  BookOpen,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import { formatCurrency, formatDate } from '@/lib/format'
import type { TutorSearchResult } from '@/types/search'

interface TutorCardProps {
  tutor: TutorSearchResult
  isFavorite?: boolean
  onFavoriteToggle?: (tutorId: number) => void
}

export default function TutorCard({
  tutor,
  isFavorite = false,
  onFavoriteToggle,
}: TutorCardProps) {
  const additionalToShow = (tutor.subjects_additional ?? []).slice(0, 2)
  const extraCount = (tutor.subjects_additional ?? []).length - 2

  return (
    <Link
      href={`/tutor/${tutor.id}`}
      className="tutor-card no-underline block"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '20px',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '20px', position: 'relative' }}>
        {/* Favorite button */}
        {onFavoriteToggle && (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onFavoriteToggle(tutor.id)
            }}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <Heart
              size={18}
              strokeWidth={1.5}
              fill={isFavorite ? '#E24B4A' : 'none'}
              color={isFavorite ? '#E24B4A' : 'var(--muted)'}
            />
          </button>
        )}

        {/* Avatar + Name */}
        <div className="flex items-center gap-3 mb-3">
          <Avatar name={tutor.name} avatarUrl={tutor.avatar_url} size="lg" />
          <div>
            <div className="flex items-center gap-1.5">
              <span
                className="font-head text-[var(--text)]"
                style={{ fontSize: '1.1rem', fontWeight: 700 }}
              >
                {tutor.name}
              </span>
            </div>
            {tutor.verification_status === 'verified' ? (
              <div className="flex items-center gap-1" style={{ marginTop: '2px' }}>
                <CheckCircle size={14} strokeWidth={1.5} color="#639922" />
                <span style={{ color: '#639922', fontSize: '0.75rem', fontWeight: 500 }}>
                  Verified
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1" style={{ marginTop: '2px' }}>
                <AlertCircle size={14} strokeWidth={1.5} color="#BA7517" />
                <span style={{ color: '#BA7517', fontSize: '0.75rem', fontWeight: 500 }}>
                  Pending verification
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Subject pills */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span
            style={{
              background: 'rgba(79,142,255,0.1)',
              color: 'var(--accent)',
              padding: '3px 10px',
              borderRadius: '100px',
              fontSize: '0.75rem',
              fontWeight: 500,
            }}
          >
            {tutor.subject}
          </span>
          {additionalToShow.map((s) => (
            <span
              key={s}
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--muted)',
                padding: '3px 10px',
                borderRadius: '100px',
                fontSize: '0.75rem',
              }}
            >
              {s}
            </span>
          ))}
          {extraCount > 0 && (
            <span
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--muted)',
                padding: '3px 10px',
                borderRadius: '100px',
                fontSize: '0.75rem',
              }}
            >
              +{extraCount} more
            </span>
          )}
        </div>

        {/* Bio */}
        {tutor.bio && (
          <p
            style={{
              color: 'var(--muted)',
              fontSize: '0.875rem',
              margin: '0 0 12px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {tutor.bio.length > 80 ? tutor.bio.slice(0, 80) + '...' : tutor.bio}
          </p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 mb-3" style={{ fontSize: '0.82rem' }}>
          <div className="flex items-center gap-1">
            <Star size={14} strokeWidth={1.5} fill="#BA7517" color="#BA7517" />
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>
              {tutor.rating_avg.toFixed(1)}
            </span>
            <span style={{ color: 'var(--muted)' }}>({tutor.total_reviews})</span>
          </div>
          <div style={{ width: '1px', height: '14px', background: 'var(--border)' }} />
          <div className="flex items-center gap-1" style={{ color: 'var(--muted)' }}>
            <BookOpen size={14} strokeWidth={1.5} />
            {tutor.total_sessions} sessions
          </div>
        </div>

        {/* Mode badges */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tutor.modes.includes('online') && (
            <span
              style={{
                background: 'rgba(79,142,255,0.1)',
                color: '#4f8eff',
                padding: '2px 8px',
                borderRadius: '100px',
                fontSize: '0.72rem',
                fontWeight: 500,
              }}
            >
              Online
            </span>
          )}
          {tutor.modes.includes('in_person') && (
            <span
              style={{
                background: 'rgba(186,117,23,0.1)',
                color: '#BA7517',
                padding: '2px 8px',
                borderRadius: '100px',
                fontSize: '0.72rem',
                fontWeight: 500,
              }}
            >
              In Person
            </span>
          )}
        </div>

        {/* Distance + Availability */}
        <div className="flex flex-wrap gap-3" style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
          {tutor.distance_km != null && (
            <div className="flex items-center gap-1">
              <MapPin size={12} strokeWidth={1.5} />
              {tutor.distance_km.toFixed(1)}km away
            </div>
          )}
          {tutor.availability_next && (
            <div className="flex items-center gap-1">
              <Clock size={12} strokeWidth={1.5} />
              Available {formatDate(tutor.availability_next)}
            </div>
          )}
        </div>
      </div>

      {/* Bottom section */}
      <div
        className="flex items-center justify-between"
        style={{
          borderTop: '1px solid var(--border)',
          padding: '16px 20px',
        }}
      >
        <div>
          <span
            className="font-head"
            style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)' }}
          >
            {formatCurrency(tutor.hourly_rate)}
          </span>
          <span style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>/hr</span>
        </div>
        <span
          style={{
            background: 'linear-gradient(135deg, #4f8eff, #00e5ff)',
            color: '#fff',
            padding: '8px 20px',
            borderRadius: '100px',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          Book Now
        </span>
      </div>
    </Link>
  )
}
