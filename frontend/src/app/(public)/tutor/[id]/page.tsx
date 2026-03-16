import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import {
  CheckCircle,
  Award,
  BookOpen,
  MessageSquare,
  Video,
  MapPin,
  Lock,
} from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import SectionCard from '@/components/ui/SectionCard'
import StarRating from '@/components/features/StarRating'
import SlotPicker from '@/components/features/SlotPicker'
import { formatCurrency, formatRelativeTime } from '@/lib/format'
import type { TutorProfile } from '@/types/search'
import type { ApiResponse } from '@/lib/api'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'
  try {
    const res = await fetch(`${apiUrl}/api/v1/tutors/${id}/profile`, {
      cache: 'no-store',
    })
    const data = await res.json()
    if (!data.success) return { title: 'Tutor Not Found' }
    return {
      title: `${data.data.name} — ${data.data.subject} Tutor | Teachwise`,
      description:
        data.data.bio?.slice(0, 155) ??
        `Book sessions with ${data.data.name} on Teachwise`,
    }
  } catch {
    return { title: 'Tutor Not Found' }
  }
}

export default async function TutorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

  const res = await fetch(`${apiUrl}/api/v1/tutors/${id}/profile`, {
    headers: { Cookie: cookieStore.toString() },
    cache: 'no-store',
  })
  const json: ApiResponse<TutorProfile> = await res.json()
  if (!json.success || !json.data) notFound()
  const tutor = {
    ...json.data,
    subjects_additional: json.data.subjects_additional ?? [],
    reviews: json.data.reviews ?? [],
    languages: json.data.languages ?? [],
    modes: json.data.modes ?? [],
    available_slots: json.data.available_slots ?? [],
    rating_breakdown: json.data.rating_breakdown ?? {},
    rating_avg: json.data.rating_avg ?? 0,
    total_reviews: json.data.total_reviews ?? 0,
    total_sessions: json.data.total_sessions ?? 0,
  }

  const hasInPerson = tutor.modes.some(
    (m) => m === 'in-person' || m === 'in_person' || m === 'both'
  )

  return (
    <div
      style={{
        maxWidth: '1120px',
        margin: '0 auto',
        padding: '40px 24px 80px',
      }}
    >
      <div
        className="flex gap-8"
        style={{ alignItems: 'flex-start' }}
      >
        {/* ─── LEFT COLUMN ─── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Hero Section */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              padding: '32px',
              marginBottom: '24px',
            }}
          >
            <div className="flex items-center gap-5" style={{ marginBottom: '20px' }}>
              <Avatar name={tutor.name} avatarUrl={tutor.avatar_url} size="xl" />
              <div style={{ minWidth: 0 }}>
                <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                  <h1
                    className="font-head font-bold text-[var(--text)]"
                    style={{ fontSize: '2.5rem', margin: 0, lineHeight: 1.1 }}
                  >
                    {tutor.name}
                  </h1>
                  {tutor.verification_status === 'verified' && (
                    <CheckCircle
                      size={22}
                      strokeWidth={1.5}
                      color="#4f8eff"
                      style={{ flexShrink: 0 }}
                    />
                  )}
                </div>

                {/* Subject pills */}
                <div
                  className="flex flex-wrap gap-2"
                  style={{ marginBottom: '12px' }}
                >
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      padding: '4px 12px',
                      borderRadius: '100px',
                      background: 'rgba(79,142,255,0.12)',
                      color: '#4f8eff',
                    }}
                  >
                    {tutor.subject}
                  </span>
                  {tutor.subjects_additional.map((subj) => (
                    <span
                      key={subj}
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 500,
                        padding: '4px 12px',
                        borderRadius: '100px',
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--muted)',
                      }}
                    >
                      {subj}
                    </span>
                  ))}
                </div>

                {/* Rating row */}
                <div className="flex items-center gap-3 flex-wrap">
                  <StarRating rating={tutor.rating_avg} size={18} />
                  <span
                    className="font-head"
                    style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: 'var(--text)',
                    }}
                  >
                    {tutor.rating_avg.toFixed(1)}
                  </span>
                  <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                    ({tutor.total_reviews}{' '}
                    {tutor.total_reviews === 1 ? 'review' : 'reviews'})
                  </span>
                  <span
                    style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      background: 'var(--muted)',
                      opacity: 0.5,
                    }}
                  />
                  <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                    {tutor.total_sessions}{' '}
                    {tutor.total_sessions === 1 ? 'session' : 'sessions'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* About Section */}
          <SectionCard title="About" className="mb-6">
            {tutor.bio ? (
              <p
                style={{
                  color: 'var(--text)',
                  fontSize: '0.9rem',
                  lineHeight: 1.7,
                  margin: 0,
                  whiteSpace: 'pre-line',
                }}
              >
                {tutor.bio}
              </p>
            ) : (
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
                No bio provided yet.
              </p>
            )}
          </SectionCard>

          {/* Details Section */}
          <SectionCard title="Details" className="mb-6">
            <div
              className="grid gap-5"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
            >
              {/* Experience */}
              <div className="flex items-start gap-3">
                <Award
                  size={20}
                  strokeWidth={1.5}
                  color="var(--muted)"
                  style={{ marginTop: '2px', flexShrink: 0 }}
                />
                <div>
                  <p
                    style={{
                      color: 'var(--muted)',
                      fontSize: '0.75rem',
                      margin: '0 0 2px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Experience
                  </p>
                  <p
                    style={{
                      color: 'var(--text)',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      margin: 0,
                    }}
                  >
                    {tutor.experience_years != null
                      ? `${tutor.experience_years} ${tutor.experience_years === 1 ? 'year' : 'years'}`
                      : 'Not specified'}
                  </p>
                </div>
              </div>

              {/* Education */}
              <div className="flex items-start gap-3">
                <BookOpen
                  size={20}
                  strokeWidth={1.5}
                  color="var(--muted)"
                  style={{ marginTop: '2px', flexShrink: 0 }}
                />
                <div>
                  <p
                    style={{
                      color: 'var(--muted)',
                      fontSize: '0.75rem',
                      margin: '0 0 2px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Education
                  </p>
                  <p
                    style={{
                      color: 'var(--text)',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      margin: 0,
                    }}
                  >
                    {tutor.education ?? 'Not specified'}
                  </p>
                </div>
              </div>

              {/* Languages */}
              <div className="flex items-start gap-3">
                <MessageSquare
                  size={20}
                  strokeWidth={1.5}
                  color="var(--muted)"
                  style={{ marginTop: '2px', flexShrink: 0 }}
                />
                <div>
                  <p
                    style={{
                      color: 'var(--muted)',
                      fontSize: '0.75rem',
                      margin: '0 0 2px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Languages
                  </p>
                  <p
                    style={{
                      color: 'var(--text)',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      margin: 0,
                    }}
                  >
                    {tutor.languages.length > 0
                      ? tutor.languages.join(', ')
                      : 'English'}
                  </p>
                </div>
              </div>

              {/* Session Modes */}
              <div className="flex items-start gap-3">
                <Video
                  size={20}
                  strokeWidth={1.5}
                  color="var(--muted)"
                  style={{ marginTop: '2px', flexShrink: 0 }}
                />
                <div>
                  <p
                    style={{
                      color: 'var(--muted)',
                      fontSize: '0.75rem',
                      margin: '0 0 2px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Session Modes
                  </p>
                  <div className="flex flex-wrap gap-2" style={{ marginTop: '2px' }}>
                    {tutor.modes.map((mode) => (
                      <span
                        key={mode}
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '3px 10px',
                          borderRadius: '100px',
                          background:
                            mode === 'online'
                              ? 'rgba(79,142,255,0.12)'
                              : mode === 'both'
                                ? 'rgba(127,119,221,0.12)'
                                : 'rgba(186,117,23,0.12)',
                          color:
                            mode === 'online'
                              ? '#4f8eff'
                              : mode === 'both'
                                ? '#7F77DD'
                                : '#BA7517',
                        }}
                      >
                        {mode === 'online'
                          ? 'Online'
                          : mode === 'both'
                            ? 'Online & In Person'
                            : 'In Person'}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Service Area (only if in-person is available) */}
              {hasInPerson && (
                <div className="flex items-start gap-3">
                  <MapPin
                    size={20}
                    strokeWidth={1.5}
                    color="var(--muted)"
                    style={{ marginTop: '2px', flexShrink: 0 }}
                  />
                  <div>
                    <p
                      style={{
                        color: 'var(--muted)',
                        fontSize: '0.75rem',
                        margin: '0 0 2px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Service Area
                    </p>
                    <p
                      style={{
                        color: 'var(--text)',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        margin: 0,
                      }}
                    >
                      Within {tutor.service_radius_km} km
                    </p>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Reviews Section */}
          <SectionCard
            title="Reviews"
            subtitle={`${tutor.total_reviews} ${tutor.total_reviews === 1 ? 'review' : 'reviews'}`}
          >
            {tutor.reviews.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
                No reviews yet.
              </p>
            ) : (
              <div>
                {/* Overall rating display */}
                <div
                  className="flex gap-8 items-start flex-wrap"
                  style={{ marginBottom: '32px' }}
                >
                  {/* Large rating number */}
                  <div style={{ textAlign: 'center', minWidth: '100px' }}>
                    <p
                      className="font-head"
                      style={{
                        fontSize: '3rem',
                        fontWeight: 700,
                        color: 'var(--text)',
                        margin: '0 0 4px',
                        lineHeight: 1,
                      }}
                    >
                      {tutor.rating_avg.toFixed(1)}
                    </p>
                    <StarRating rating={tutor.rating_avg} size={16} />
                    <p
                      style={{
                        color: 'var(--muted)',
                        fontSize: '0.78rem',
                        margin: '6px 0 0',
                      }}
                    >
                      {tutor.total_reviews}{' '}
                      {tutor.total_reviews === 1 ? 'review' : 'reviews'}
                    </p>
                  </div>

                  {/* Star breakdown bars */}
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count =
                        tutor.rating_breakdown[String(star)] ?? 0
                      const pct =
                        tutor.total_reviews > 0
                          ? (count / tutor.total_reviews) * 100
                          : 0

                      return (
                        <div
                          key={star}
                          className="flex items-center gap-3"
                          style={{ marginBottom: '6px' }}
                        >
                          <span
                            style={{
                              color: 'var(--muted)',
                              fontSize: '0.78rem',
                              width: '14px',
                              textAlign: 'right',
                              flexShrink: 0,
                            }}
                          >
                            {star}
                          </span>
                          <div
                            style={{
                              flex: 1,
                              height: '8px',
                              borderRadius: '100px',
                              background: 'var(--border)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                borderRadius: '100px',
                                background: '#BA7517',
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
                          <span
                            style={{
                              color: 'var(--muted)',
                              fontSize: '0.75rem',
                              width: '28px',
                              textAlign: 'right',
                              flexShrink: 0,
                            }}
                          >
                            {count}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Individual review cards */}
                <div className="flex flex-col">
                  {tutor.reviews.map((review, i) => (
                    <div
                      key={review.id}
                      style={{
                        paddingTop: i === 0 ? 0 : '20px',
                        paddingBottom: '20px',
                        borderBottom:
                          i < tutor.reviews.length - 1
                            ? '1px solid var(--border)'
                            : 'none',
                      }}
                    >
                      {/* Review header */}
                      <div
                        className="flex items-center gap-3"
                        style={{ marginBottom: '10px' }}
                      >
                        <Avatar
                          name={review.student_name}
                          avatarUrl={review.student_avatar_url}
                          size="sm"
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            className="text-[var(--text)]"
                            style={{
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              margin: 0,
                            }}
                          >
                            {review.student_name}
                          </p>
                          <p
                            style={{
                              color: 'var(--muted)',
                              fontSize: '0.75rem',
                              margin: 0,
                            }}
                          >
                            {formatRelativeTime(review.created_at)}
                          </p>
                        </div>
                        <StarRating rating={review.rating} size={14} />
                      </div>

                      {/* Sub-ratings */}
                      {(review.rating_knowledge != null ||
                        review.rating_communication != null ||
                        review.rating_punctuality != null ||
                        review.rating_value != null) && (
                        <div
                          className="flex flex-wrap gap-3"
                          style={{ marginBottom: '10px' }}
                        >
                          {review.rating_knowledge != null && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                color: 'var(--muted)',
                                padding: '3px 10px',
                                borderRadius: '100px',
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              Knowledge {review.rating_knowledge}/5
                            </span>
                          )}
                          {review.rating_communication != null && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                color: 'var(--muted)',
                                padding: '3px 10px',
                                borderRadius: '100px',
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              Communication {review.rating_communication}/5
                            </span>
                          )}
                          {review.rating_punctuality != null && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                color: 'var(--muted)',
                                padding: '3px 10px',
                                borderRadius: '100px',
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              Punctuality {review.rating_punctuality}/5
                            </span>
                          )}
                          {review.rating_value != null && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                color: 'var(--muted)',
                                padding: '3px 10px',
                                borderRadius: '100px',
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              Value {review.rating_value}/5
                            </span>
                          )}
                        </div>
                      )}

                      {/* Comment */}
                      <p
                        style={{
                          color: 'var(--text)',
                          fontSize: '0.875rem',
                          lineHeight: 1.6,
                          margin: 0,
                        }}
                      >
                        {review.comment}
                      </p>

                      {/* Tutor response */}
                      {review.tutor_response && (
                        <div
                          style={{
                            marginTop: '12px',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            background: 'rgba(255,255,255,0.03)',
                            borderLeft: '3px solid var(--border)',
                          }}
                        >
                          <p
                            style={{
                              color: 'var(--muted)',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              margin: '0 0 4px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            Tutor Response
                          </p>
                          <p
                            style={{
                              color: 'var(--text)',
                              fontSize: '0.84rem',
                              lineHeight: 1.6,
                              margin: 0,
                            }}
                          >
                            {review.tutor_response}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* ─── RIGHT COLUMN — STICKY BOOKING CARD ─── */}
        <div
          style={{
            width: '320px',
            flexShrink: 0,
            position: 'sticky',
            top: '88px',
            alignSelf: 'flex-start',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              padding: '28px 24px',
            }}
          >
            {/* Rate */}
            <div style={{ marginBottom: '20px' }}>
              <span
                className="font-head"
                style={{
                  fontSize: '2rem',
                  fontWeight: 700,
                  color: 'var(--text)',
                }}
              >
                {formatCurrency(tutor.hourly_rate)}
              </span>
              <span
                style={{
                  color: 'var(--muted)',
                  fontSize: '0.9rem',
                  marginLeft: '4px',
                }}
              >
                /hr
              </span>
            </div>

            {/* Mode badges */}
            <div
              className="flex flex-wrap gap-2"
              style={{ marginBottom: '20px' }}
            >
              {tutor.modes.map((mode) => (
                <span
                  key={mode}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '4px 12px',
                    borderRadius: '100px',
                    background:
                      mode === 'online'
                        ? 'rgba(79,142,255,0.12)'
                        : mode === 'both'
                          ? 'rgba(127,119,221,0.12)'
                          : 'rgba(186,117,23,0.12)',
                    color:
                      mode === 'online'
                        ? '#4f8eff'
                        : mode === 'both'
                          ? '#7F77DD'
                          : '#BA7517',
                  }}
                >
                  {mode === 'online'
                    ? 'Online'
                    : mode === 'both'
                      ? 'Online & In Person'
                      : 'In Person'}
                </span>
              ))}
            </div>

            {/* Divider */}
            <div
              style={{
                height: '1px',
                background: 'var(--border)',
                margin: '0 0 20px',
              }}
            />

            {/* Slot Picker */}
            <SlotPicker slots={tutor.available_slots} tutorId={tutor.id} />

            {/* Divider */}
            <div
              style={{
                height: '1px',
                background: 'var(--border)',
                margin: '20px 0',
              }}
            />

            {/* Secure payment note */}
            <div
              className="flex items-center justify-center gap-2"
              style={{ color: 'var(--muted)', fontSize: '0.78rem' }}
            >
              <Lock size={14} strokeWidth={1.5} />
              <span>Secure payment via Stripe</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
