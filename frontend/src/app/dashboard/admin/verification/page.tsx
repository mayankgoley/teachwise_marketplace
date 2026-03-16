'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, Loader2, FileText, Check, X, RotateCcw } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'
import Avatar from '@/components/ui/Avatar'
import { formatDate } from '@/lib/format'
import type { VerificationTutor } from '@/types/admin'

const FILTER_TABS = [
  { label: 'All', value: 'all' },
  { label: 'Submitted', value: 'documents_submitted' },
  { label: 'Under Review', value: 'under_review' },
  { label: 'Revision Required', value: 'revision_required' },
] as const

type FilterValue = (typeof FILTER_TABS)[number]['value']

export default function AdminVerificationPage() {
  const [tutors, setTutors] = useState<VerificationTutor[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterValue>('all')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [feedbackTutorId, setFeedbackTutorId] = useState<number | null>(null)
  const [feedbackAction, setFeedbackAction] = useState<'reject' | 'revision' | null>(null)
  const [feedback, setFeedback] = useState('')

  const fetchTutors = useCallback(async () => {
    try {
      const res = await apiGet<{ tutors: VerificationTutor[] }>(
        '/api/v1/admin/verification?status=' + filter
      )
      if (res.success) {
        setTutors(res.data.tutors)
      }
    } catch {
      // Silently fail, user can refresh
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    setLoading(true)
    fetchTutors()
  }, [fetchTutors])

  const handleApprove = async (tutorId: number) => {
    setActionLoading(tutorId)
    try {
      await apiPost(`/api/v1/admin/verification/${tutorId}/approve`)
      setExpandedId(null)
      setFeedbackTutorId(null)
      setFeedbackAction(null)
      setFeedback('')
      await fetchTutors()
    } catch {
      // Action failed
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (tutorId: number) => {
    setActionLoading(tutorId)
    try {
      await apiPost(`/api/v1/admin/verification/${tutorId}/reject`, { feedback })
      setExpandedId(null)
      setFeedbackTutorId(null)
      setFeedbackAction(null)
      setFeedback('')
      await fetchTutors()
    } catch {
      // Action failed
    } finally {
      setActionLoading(null)
    }
  }

  const handleRequestRevision = async (tutorId: number) => {
    setActionLoading(tutorId)
    try {
      await apiPost(`/api/v1/admin/verification/${tutorId}/request-revision`, { feedback })
      setExpandedId(null)
      setFeedbackTutorId(null)
      setFeedbackAction(null)
      setFeedback('')
      await fetchTutors()
    } catch {
      // Action failed
    } finally {
      setActionLoading(null)
    }
  }

  const openFeedback = (tutorId: number, action: 'reject' | 'revision') => {
    setFeedbackTutorId(tutorId)
    setFeedbackAction(action)
    setFeedback('')
  }

  const cancelFeedback = () => {
    setFeedbackTutorId(null)
    setFeedbackAction(null)
    setFeedback('')
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2
          size={32}
          strokeWidth={1.5}
          className="animate-spin"
          style={{ color: 'var(--accent)' }}
        />
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '16px' }}>
          Loading verification queue...
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: '24px' }}>
        <h1
          className="font-head font-bold text-[var(--text)]"
          style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
        >
          Verification Queue
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Review tutor applications
        </p>
      </div>

      {/* Filter tabs */}
      <div
        className="flex items-center gap-2"
        style={{
          marginBottom: '24px',
          overflowX: 'auto',
          paddingBottom: '4px',
        }}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = filter === tab.value
          return (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              style={{
                padding: '8px 18px',
                borderRadius: '100px',
                fontSize: '0.82rem',
                fontWeight: 600,
                border: isActive ? 'none' : '1px solid var(--border)',
                background: isActive
                  ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
                  : 'transparent',
                color: isActive ? '#fff' : 'var(--muted)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tutor cards */}
      {tutors.length === 0 ? (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
          }}
        >
          <EmptyState
            icon={<ShieldCheck size={22} strokeWidth={1.5} />}
            title="No tutors in queue"
            description="There are no tutor applications matching this filter."
          />
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: '16px' }}>
          {tutors.map((tutor) => {
            const isExpanded = expandedId === tutor.id
            const isShowingFeedback = feedbackTutorId === tutor.id
            const isLoading = actionLoading === tutor.id

            return (
              <div
                key={tutor.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '20px',
                  overflow: 'hidden',
                }}
              >
                {/* Header row */}
                <div
                  onClick={() => {
                    setExpandedId(isExpanded ? null : tutor.id)
                    if (isExpanded) cancelFeedback()
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setExpandedId(isExpanded ? null : tutor.id)
                      if (isExpanded) cancelFeedback()
                    }
                  }}
                  className="flex items-center gap-4 flex-wrap"
                  style={{
                    padding: '20px',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <Avatar
                    name={tutor.name}
                    avatarUrl={tutor.avatar_url}
                    size="md"
                  />

                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className="font-head font-bold text-[var(--text)]"
                        style={{ fontSize: '1rem', margin: 0 }}
                      >
                        {tutor.name}
                      </h3>
                      <StatusBadge status={tutor.verification_status} />
                    </div>
                    <p
                      style={{
                        color: 'var(--muted)',
                        fontSize: '0.82rem',
                        margin: '2px 0 0',
                      }}
                    >
                      {tutor.email}
                    </p>
                  </div>

                  <span
                    style={{
                      color: 'var(--muted)',
                      fontSize: '0.82rem',
                      fontWeight: 500,
                    }}
                  >
                    {tutor.subject}
                  </span>

                  {tutor.created_at && (
                    <span
                      style={{
                        color: 'var(--muted)',
                        fontSize: '0.75rem',
                      }}
                    >
                      {formatDate(tutor.created_at)}
                    </span>
                  )}
                </div>

                {/* Expanded section */}
                {isExpanded && (
                  <div
                    style={{
                      padding: '0 20px 20px',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    {/* Qualification & Institution */}
                    <div
                      className="flex flex-wrap gap-6"
                      style={{ padding: '16px 0', fontSize: '0.85rem' }}
                    >
                      {tutor.qualification && (
                        <div>
                          <span style={{ color: 'var(--muted)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Qualification
                          </span>
                          <p style={{ color: 'var(--text)', margin: '4px 0 0', fontWeight: 500 }}>
                            {tutor.qualification}
                          </p>
                        </div>
                      )}
                      {tutor.institution && (
                        <div>
                          <span style={{ color: 'var(--muted)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Institution
                          </span>
                          <p style={{ color: 'var(--text)', margin: '4px 0 0', fontWeight: 500 }}>
                            {tutor.institution}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Admin feedback */}
                    {tutor.admin_feedback && (
                      <div
                        style={{
                          background: 'rgba(186,117,23,0.08)',
                          border: '1px solid rgba(186,117,23,0.2)',
                          borderRadius: '12px',
                          padding: '12px 16px',
                          marginBottom: '16px',
                        }}
                      >
                        <span style={{ color: '#BA7517', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Previous Feedback
                        </span>
                        <p style={{ color: 'var(--text)', fontSize: '0.85rem', margin: '6px 0 0', lineHeight: 1.5 }}>
                          {tutor.admin_feedback}
                        </p>
                      </div>
                    )}

                    {/* Documents list */}
                    <div style={{ marginBottom: '16px' }}>
                      <h4
                        style={{
                          color: 'var(--muted)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          margin: '0 0 10px',
                        }}
                      >
                        Documents ({tutor.documents.length})
                      </h4>

                      {tutor.documents.length === 0 ? (
                        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: 0 }}>
                          No documents uploaded.
                        </p>
                      ) : (
                        <div className="flex flex-col" style={{ gap: '8px' }}>
                          {tutor.documents.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center gap-3 flex-wrap"
                              style={{
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid var(--border)',
                                borderRadius: '12px',
                                padding: '12px 16px',
                              }}
                            >
                              <FileText
                                size={18}
                                strokeWidth={1.5}
                                style={{ color: 'var(--muted)', flexShrink: 0 }}
                              />
                              <div style={{ flex: 1, minWidth: '140px' }}>
                                <p
                                  style={{
                                    color: 'var(--text)',
                                    fontSize: '0.85rem',
                                    fontWeight: 500,
                                    margin: 0,
                                  }}
                                >
                                  {doc.original_filename}
                                </p>
                                <p
                                  style={{
                                    color: 'var(--muted)',
                                    fontSize: '0.75rem',
                                    margin: '2px 0 0',
                                  }}
                                >
                                  {doc.document_type.replace(/_/g, ' ')}
                                </p>
                              </div>
                              <StatusBadge status={doc.status} />
                              {doc.expiry_date && (
                                <span
                                  style={{
                                    color: 'var(--muted)',
                                    fontSize: '0.72rem',
                                  }}
                                >
                                  Expires: {formatDate(doc.expiry_date)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Feedback textarea (shown for reject / revision) */}
                    {isShowingFeedback && feedbackAction && (
                      <div style={{ marginBottom: '16px' }}>
                        <label
                          style={{
                            display: 'block',
                            color: 'var(--muted)',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            marginBottom: '8px',
                          }}
                        >
                          {feedbackAction === 'reject'
                            ? 'Rejection Reason'
                            : 'Revision Instructions'}
                        </label>
                        <textarea
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder={
                            feedbackAction === 'reject'
                              ? 'Explain why the application is being rejected...'
                              : 'Describe what changes or documents are needed...'
                          }
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '12px',
                            border: '1px solid var(--border)',
                            background: 'var(--surface)',
                            color: 'var(--text)',
                            resize: 'vertical',
                            minHeight: '80px',
                            fontSize: '0.85rem',
                            lineHeight: 1.5,
                            outline: 'none',
                            boxSizing: 'border-box',
                            fontFamily: 'inherit',
                          }}
                        />
                        <div
                          className="flex items-center gap-2"
                          style={{ marginTop: '10px' }}
                        >
                          <button
                            onClick={() => {
                              if (feedbackAction === 'reject') {
                                handleReject(tutor.id)
                              } else {
                                handleRequestRevision(tutor.id)
                              }
                            }}
                            disabled={isLoading || !feedback.trim()}
                            style={{
                              padding: '8px 20px',
                              borderRadius: '100px',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              border: 'none',
                              cursor: isLoading || !feedback.trim() ? 'not-allowed' : 'pointer',
                              opacity: isLoading || !feedback.trim() ? 0.5 : 1,
                              background:
                                feedbackAction === 'reject'
                                  ? 'rgba(226,75,74,0.15)'
                                  : 'rgba(186,117,23,0.15)',
                              color:
                                feedbackAction === 'reject' ? '#E24B4A' : '#BA7517',
                              transition: 'all 0.2s',
                            }}
                          >
                            {isLoading
                              ? 'Submitting...'
                              : feedbackAction === 'reject'
                                ? 'Confirm Rejection'
                                : 'Send Revision Request'}
                          </button>
                          <button
                            onClick={cancelFeedback}
                            style={{
                              padding: '8px 20px',
                              borderRadius: '100px',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              border: '1px solid var(--border)',
                              background: 'transparent',
                              color: 'var(--muted)',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    {!isShowingFeedback && (
                      <div
                        className="flex items-center gap-3 flex-wrap"
                        style={{ paddingTop: '4px' }}
                      >
                        <button
                          onClick={() => handleApprove(tutor.id)}
                          disabled={isLoading}
                          className="flex items-center gap-2"
                          style={{
                            padding: '8px 20px',
                            borderRadius: '100px',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            border: 'none',
                            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                            color: '#fff',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            opacity: isLoading ? 0.6 : 1,
                            transition: 'all 0.2s',
                          }}
                        >
                          <Check size={15} strokeWidth={2} />
                          Approve
                        </button>

                        <button
                          onClick={() => openFeedback(tutor.id, 'reject')}
                          disabled={isLoading}
                          className="flex items-center gap-2"
                          style={{
                            padding: '8px 20px',
                            borderRadius: '100px',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            border: 'none',
                            background: 'rgba(226,75,74,0.15)',
                            color: '#E24B4A',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            opacity: isLoading ? 0.6 : 1,
                            transition: 'all 0.2s',
                          }}
                        >
                          <X size={15} strokeWidth={2} />
                          Reject
                        </button>

                        <button
                          onClick={() => openFeedback(tutor.id, 'revision')}
                          disabled={isLoading}
                          className="flex items-center gap-2"
                          style={{
                            padding: '8px 20px',
                            borderRadius: '100px',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            border: 'none',
                            background: 'rgba(186,117,23,0.15)',
                            color: '#BA7517',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            opacity: isLoading ? 0.6 : 1,
                            transition: 'all 0.2s',
                          }}
                        >
                          <RotateCcw size={15} strokeWidth={2} />
                          Request Revision
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
