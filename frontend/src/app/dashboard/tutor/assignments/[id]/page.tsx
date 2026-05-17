'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, Download, FileText, Award } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import SectionCard from '@/components/ui/SectionCard'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate } from '@/lib/format'

type SubmissionFile = {
  name: string | null
  key: string | null
  content_type: string | null
  size: number | null
  uploader_role: string | null
  uploaded_at: string | null
}

type SubmissionDetail = {
  id: number
  text_response: string | null
  status: string
  submitted_at: string | null
  grade: string | null
  feedback: string | null
  is_late: boolean
  resubmission_count: number
  file_count: number
  files: SubmissionFile[]
}

type AssignmentDetail = {
  id: number
  title: string
  description: string | null
  subject: string | null
  due_date: string | null
  status: string
  student_name: string | null
  student_id: number
  reference_files: SubmissionFile[]
  submission: SubmissionDetail | null
}

export default function TutorAssignmentDetail() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params?.id)

  const [a, setA] = useState<AssignmentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchAssignment = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<AssignmentDetail>(
        `/api/v1/tutor/assignments/${id}`
      )
      if (res.success) setA(res.data)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) fetchAssignment()
  }, [id, fetchAssignment])

  const handleDownload = async (file: SubmissionFile) => {
    if (!file.key) return
    setError(null)
    setDownloading(file.key)
    try {
      const res = await apiPost<{ download_url: string; expires_in: number }>(
        '/api/v1/assignments/files/download-url',
        { object_key: file.key, file_name: file.name ?? 'download' }
      )
      if (!res.success) {
        setError(res.error?.message ?? 'Could not get download URL')
        return
      }
      // presigned URL has Content-Disposition: attachment, so browser saves it
      window.open(res.data.download_url, '_blank', 'noopener')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setDownloading(null)
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

  const submissionFiles = a.submission?.files ?? []
  const refFiles = a.reference_files ?? []

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
          For {a.student_name ?? 'student'}
          {a.due_date && ` · Due ${formatDate(a.due_date)}`}
          {a.subject && ` · ${a.subject}`}
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

      {refFiles.length > 0 && (
        <SectionCard
          title="Reference Files"
          subtitle="Materials you attached for this assignment"
          className="mb-6"
          noPadding
        >
          <FileList
            files={refFiles}
            downloading={downloading}
            onDownload={handleDownload}
          />
        </SectionCard>
      )}

      <SectionCard
        title="Student Submission"
        subtitle={
          a.submission
            ? `${a.submission.file_count} file(s) · status ${a.submission.status}`
            : 'No submission yet'
        }
        className="mb-6"
        noPadding
      >
        {!a.submission ? (
          <EmptyState
            icon={<FileText size={22} strokeWidth={1.5} />}
            title="Awaiting submission"
            description="The student hasn't submitted yet."
          />
        ) : (
          <>
            <div
              style={{
                padding: '16px 20px',
                borderBottom:
                  submissionFiles.length > 0 || a.submission.text_response
                    ? '1px solid var(--border)'
                    : 'none',
              }}
            >
              <div
                className="flex items-center gap-3 flex-wrap"
                style={{ fontSize: '0.78rem', color: 'var(--muted)' }}
              >
                {a.submission.submitted_at && (
                  <span>
                    Submitted {formatDate(a.submission.submitted_at)}
                  </span>
                )}
                <span
                  style={{
                    background:
                      a.submission.status === 'graded'
                        ? 'rgba(99,153,34,0.15)'
                        : 'rgba(79,142,255,0.15)',
                    color:
                      a.submission.status === 'graded' ? '#639922' : '#4f8eff',
                    padding: '2px 8px',
                    borderRadius: '100px',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                  }}
                >
                  {a.submission.status}
                </span>
                {a.submission.is_late && (
                  <span
                    style={{
                      background: 'rgba(226,75,74,0.12)',
                      color: '#E24B4A',
                      padding: '2px 8px',
                      borderRadius: '100px',
                      fontWeight: 600,
                    }}
                  >
                    Late
                  </span>
                )}
                {a.submission.resubmission_count > 0 && (
                  <span>
                    Resubmission #{a.submission.resubmission_count}
                  </span>
                )}
              </div>
            </div>
            {a.submission.text_response && (
              <div style={{ padding: '14px 20px' }}>
                <p
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--muted)',
                    margin: '0 0 6px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Notes
                </p>
                <p
                  style={{
                    fontSize: '0.88rem',
                    color: 'var(--text)',
                    margin: 0,
                    whiteSpace: 'pre-line',
                    lineHeight: 1.6,
                  }}
                >
                  {a.submission.text_response}
                </p>
              </div>
            )}
            {submissionFiles.length > 0 && (
              <FileList
                files={submissionFiles}
                downloading={downloading}
                onDownload={handleDownload}
              />
            )}
          </>
        )}
      </SectionCard>

      {a.submission?.grade && (
        <SectionCard title="Your Feedback" className="mb-6">
          <div className="flex items-center gap-3" style={{ marginBottom: '8px' }}>
            <Award size={18} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '0.95rem', color: 'var(--text)' }}>
              Grade: <strong>{a.submission.grade}</strong>
            </span>
          </div>
          {a.submission.feedback && (
            <p
              style={{
                fontSize: '0.88rem',
                color: 'var(--muted)',
                margin: 0,
                whiteSpace: 'pre-line',
              }}
            >
              {a.submission.feedback}
            </p>
          )}
        </SectionCard>
      )}

      {error && (
        <p style={{ color: '#E24B4A', fontSize: '0.82rem', margin: '8px 0 0' }}>
          {error}
        </p>
      )}
    </div>
  )
}

function FileList({
  files,
  downloading,
  onDownload,
}: {
  files: SubmissionFile[]
  downloading: string | null
  onDownload: (f: SubmissionFile) => void
}) {
  return (
    <div>
      {files.map((f, i) => {
        const isLoading = downloading === f.key
        const sizeKB = f.size ? `${(f.size / 1024).toFixed(0)} KB` : ''
        return (
          <div
            key={`${f.key}-${i}`}
            className="flex items-center gap-3"
            style={{
              padding: '12px 20px',
              borderBottom:
                i < files.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <FileText size={16} strokeWidth={1.5} color="var(--muted)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: '0.88rem',
                  color: 'var(--text)',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {f.name ?? '(unnamed)'}
              </p>
              <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: '2px 0 0' }}>
                {f.content_type ?? 'unknown'}
                {sizeKB && ` · ${sizeKB}`}
              </p>
            </div>
            <button
              onClick={() => onDownload(f)}
              disabled={isLoading || !f.key}
              className="flex items-center gap-1.5"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                borderRadius: '100px',
                padding: '6px 14px',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: 'var(--text)',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading ? (
                <>
                  <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                  <Loader2
                    size={12}
                    strokeWidth={1.5}
                    style={{ animation: 'spin 1s linear infinite' }}
                  />
                  Preparing...
                </>
              ) : (
                <>
                  <Download size={12} strokeWidth={1.5} />
                  Download
                </>
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
