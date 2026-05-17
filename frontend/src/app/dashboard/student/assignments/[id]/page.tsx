'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, Send } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import SectionCard from '@/components/ui/SectionCard'
import PresignedAssignmentUploader, {
  type AttachedFile,
} from '@/components/features/PresignedAssignmentUploader'
import { formatDate } from '@/lib/format'

type AssignmentDetail = {
  id: number
  title: string
  description: string | null
  subject: string | null
  due_date: string | null
  status: string
  tutor_name: string | null
  file_count: number
  submission?: {
    id: number
    text_response: string | null
    file_count: number
    submitted_at: string | null
    grade: string | null
    feedback: string | null
    status: string
  }
}

export default function StudentAssignmentDetail() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params?.id)

  const [a, setA] = useState<AssignmentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [files, setFiles] = useState<AttachedFile[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const fetchAssignment = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<AssignmentDetail>(
        `/api/v1/student/assignments/${id}`
      )
      if (res.success) {
        setA(res.data)
        setText(res.data.submission?.text_response ?? '')
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) fetchAssignment()
  }, [id, fetchAssignment])

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    setSuccess(false)
    try {
      // The presigned PUT flow already attached the files server-side via
      // /attach. We just need to mark the submission as submitted and
      // record the text response.
      const fd = new FormData()
      fd.append('text_response', text)
      fd.append('is_draft', 'false')

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(
        `${apiUrl}/api/v1/student/assignments/${id}/submit`,
        {
          method: 'POST',
          body: fd,
          credentials: 'include',
        }
      )
      const body = await res.json().catch(() => null)
      if (res.ok && body?.success) {
        setSuccess(true)
        await fetchAssignment()
      } else {
        setError(body?.error?.message ?? 'Submission failed')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <Loader2
          size={32}
          strokeWidth={1.5}
          style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }}
        />
      </div>
    )
  }

  if (!a) {
    return (
      <p style={{ color: 'var(--muted)' }}>
        Assignment not found.{' '}
        <button onClick={() => router.back()} style={{ color: 'var(--accent)' }}>
          Back
        </button>
      </p>
    )
  }

  const alreadyGraded = a.submission?.status === 'graded'

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1
          className="font-head font-bold text-[var(--text)]"
          style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
        >
          {a.title}
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          From {a.tutor_name ?? 'your tutor'}
          {a.due_date && ` · Due ${formatDate(a.due_date)}`}
        </p>
      </div>

      {a.description && (
        <SectionCard title="Instructions" className="mb-6">
          <p
            style={{
              fontSize: '0.9rem',
              color: 'var(--text)',
              whiteSpace: 'pre-line',
              margin: 0,
              lineHeight: 1.7,
            }}
          >
            {a.description}
          </p>
        </SectionCard>
      )}

      <SectionCard
        title={alreadyGraded ? 'Your Submission' : 'Submit Your Work'}
        subtitle={
          alreadyGraded
            ? 'This submission has been graded; further changes are disabled.'
            : 'Upload files and add notes for your tutor'
        }
        className="mb-6"
      >
        <label
          style={{
            display: 'block',
            fontSize: '0.82rem',
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: '8px',
          }}
        >
          Notes / response
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          disabled={alreadyGraded || submitting}
          placeholder="Add any notes for your tutor here..."
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '10px 14px',
            color: 'var(--text)',
            fontSize: '0.875rem',
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            marginBottom: '16px',
          }}
        />

        <PresignedAssignmentUploader
          assignmentId={a.id}
          onChange={setFiles}
          disabled={alreadyGraded}
        />

        <div className="flex items-center gap-3" style={{ marginTop: '20px' }}>
          <button
            onClick={handleSubmit}
            disabled={submitting || alreadyGraded}
            className="flex items-center gap-2"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              color: '#fff',
              borderRadius: '100px',
              padding: '10px 20px',
              fontSize: '0.82rem',
              fontWeight: 600,
              border: 'none',
              cursor: submitting || alreadyGraded ? 'not-allowed' : 'pointer',
              opacity: submitting || alreadyGraded ? 0.5 : 1,
            }}
          >
            {submitting ? (
              <>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                <Loader2
                  size={14}
                  strokeWidth={1.5}
                  style={{ animation: 'spin 1s linear infinite' }}
                />
                Submitting...
              </>
            ) : (
              <>
                <Send size={14} strokeWidth={1.5} />
                {a.submission?.status === 'submitted'
                  ? 'Resubmit'
                  : 'Submit Assignment'}
              </>
            )}
          </button>
          {success && (
            <span style={{ color: '#639922', fontSize: '0.82rem' }}>
              Submitted!
            </span>
          )}
          {error && (
            <span style={{ color: '#E24B4A', fontSize: '0.82rem' }}>{error}</span>
          )}
        </div>

        {files.length === 0 && a.submission?.file_count ? (
          <p
            style={{
              fontSize: '0.78rem',
              color: 'var(--muted)',
              marginTop: '12px',
            }}
          >
            {a.submission.file_count} file(s) already on this submission.
          </p>
        ) : null}
      </SectionCard>

      {a.submission?.grade && (
        <SectionCard title="Tutor Feedback" className="mb-6">
          <p style={{ fontSize: '0.95rem', color: 'var(--text)', margin: 0 }}>
            Grade: <strong>{a.submission.grade}</strong>
          </p>
          {a.submission.feedback && (
            <p
              style={{
                fontSize: '0.9rem',
                color: 'var(--muted)',
                margin: '12px 0 0',
                whiteSpace: 'pre-line',
              }}
            >
              {a.submission.feedback}
            </p>
          )}
        </SectionCard>
      )}
    </div>
  )
}
