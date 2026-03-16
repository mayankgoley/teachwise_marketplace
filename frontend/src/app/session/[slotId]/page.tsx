'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  PhoneOff,
  Loader2,
  Clock,
  AlertCircle,
  Shield,
  Video,
} from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import { formatTime } from '@/lib/format'
import type { SessionJoinData } from '@/types/session'

interface JitsiApi {
  dispose: () => void
  executeCommand: (command: string, ...args: unknown[]) => void
  addEventListener: (event: string, listener: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: new (
      domain: string,
      options: Record<string, unknown>
    ) => JitsiApi
  }
}

export default function SessionRoomPage() {
  const params = useParams()
  const router = useRouter()
  const slotId = params.slotId as string

  const [data, setData] = useState<SessionJoinData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ending, setEnding] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [consentStep, setConsentStep] = useState(true)
  const [consentSubmitting, setConsentSubmitting] = useState(false)
  const jitsiRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<JitsiApi | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadSession = useCallback(async () => {
    try {
      const res = await apiGet<SessionJoinData>(`/api/v1/session/${slotId}/join`)
      if (res.success) {
        setData(res.data)
      } else {
        setError(res.error?.message ?? 'Failed to load session')
      }
    } catch {
      setError('Failed to load session')
    } finally {
      setLoading(false)
    }
  }, [slotId])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  const handleEndSession = useCallback(async () => {
    if (ending) return
    setEnding(true)

    if (apiRef.current) {
      apiRef.current.dispose()
      apiRef.current = null
    }

    if (data?.user_role === 'tutor') {
      try {
        await apiPost(`/api/v1/session/${slotId}/end`)
      } catch {
        // Continue to summary even if end call fails
      }
    }

    router.push(`/session/${slotId}/summary`)
  }, [ending, data?.user_role, slotId, router])

  const handleConsent = async (consent: boolean) => {
    setConsentSubmitting(true)
    try {
      await apiPost(`/api/v1/session/${slotId}/recording/consent`, { consent })
    } catch {
      // Continue regardless
    } finally {
      setConsentSubmitting(false)
      setConsentStep(false)
    }
  }

  useEffect(() => {
    if (!data || !jitsiRef.current || consentStep) return

    const script = document.createElement('script')
    script.src = `https://${data.jitsi_domain}/external_api.js`
    script.async = true
    script.onload = () => {
      if (!jitsiRef.current || !window.JitsiMeetExternalAPI) return

      const api = new window.JitsiMeetExternalAPI(data.jitsi_domain, {
        roomName: data.room_name,
        parentNode: jitsiRef.current,
        userInfo: {
          displayName: data.user_name,
        },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          prejoinPageEnabled: false,
          disableDeepLinking: true,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          TOOLBAR_BUTTONS: [
            'microphone',
            'camera',
            'desktop',
            'fullscreen',
            'chat',
            'raisehand',
            'tileview',
            'settings',
          ],
        },
      })

      api.addEventListener('readyToClose', () => {
        handleEndSession()
      })

      apiRef.current = api
    }
    document.head.appendChild(script)

    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)

    return () => {
      if (apiRef.current) {
        apiRef.current.dispose()
        apiRef.current = null
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      const existingScript = document.querySelector(
        `script[src="https://${data.jitsi_domain}/external_api.js"]`
      )
      if (existingScript) {
        existingScript.remove()
      }
    }
  }, [data, handleEndSession, consentStep])

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ minHeight: '100vh', background: 'var(--bg)' }}
      >
        <Loader2
          size={40}
          strokeWidth={1.5}
          className="animate-spin"
          style={{ color: 'var(--accent)' }}
        />
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '16px' }}>
          Joining session...
        </p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ minHeight: '100vh', background: 'var(--bg)' }}
      >
        <AlertCircle size={40} strokeWidth={1.5} style={{ color: '#E24B4A' }} />
        <p style={{ color: 'var(--text)', fontSize: '1rem', marginTop: '16px', fontWeight: 500 }}>
          {error ?? 'Unable to join session'}
        </p>
        <button
          onClick={() => router.back()}
          style={{
            marginTop: '16px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border)',
            borderRadius: '100px',
            padding: '10px 24px',
            color: 'var(--accent)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Go Back
        </button>
      </div>
    )
  }

  if (consentStep) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ minHeight: '100vh', background: 'var(--bg)' }}
      >
        <div
          style={{
            maxWidth: '520px',
            width: '100%',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '24px',
            padding: '40px 32px',
            textAlign: 'center',
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(79,142,255,0.12)',
              margin: '0 auto 24px',
            }}
          >
            <Video size={28} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
          </div>
          <h2
            className="font-head font-bold text-[var(--text)]"
            style={{ fontSize: '1.4rem', margin: '0 0 12px' }}
          >
            Recording Consent
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 8px' }}>
            This session may be recorded for quality and safety purposes. Recordings are
            stored securely and only accessible to TeachWise administrators in case of a dispute.
          </p>
          <div
            className="flex items-center gap-2 justify-center"
            style={{
              margin: '16px 0 28px',
              padding: '10px 16px',
              background: 'rgba(99,153,34,0.08)',
              borderRadius: '12px',
            }}
          >
            <Shield size={16} strokeWidth={1.5} style={{ color: '#639922', flexShrink: 0 }} />
            <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
              Recordings are never shared with other users
            </span>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleConsent(true)}
              disabled={consentSubmitting}
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                color: '#fff',
                border: 'none',
                borderRadius: '100px',
                padding: '14px 28px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: consentSubmitting ? 'not-allowed' : 'pointer',
                opacity: consentSubmitting ? 0.6 : 1,
              }}
            >
              {consentSubmitting ? 'Joining...' : 'I Consent to Recording'}
            </button>
            <button
              onClick={() => handleConsent(false)}
              disabled={consentSubmitting}
              style={{
                background: 'transparent',
                color: 'var(--muted)',
                border: '1px solid var(--border)',
                borderRadius: '100px',
                padding: '14px 28px',
                fontSize: '0.9rem',
                fontWeight: 500,
                cursor: consentSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              Join Without Recording Consent
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
      <div
        className="flex items-center justify-between"
        style={{
          padding: '12px 24px',
          background: 'rgba(0,0,0,0.6)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#639922',
              boxShadow: '0 0 8px rgba(99,153,34,0.6)',
            }}
          />
          <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem' }}>
            {data.subject || 'Tutoring Session'}
          </span>
          <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
            with {data.user_role === 'student' ? data.tutor?.name : data.student?.name}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Clock size={14} strokeWidth={1.5} style={{ color: 'var(--muted)' }} />
            <span style={{ color: 'var(--muted)', fontSize: '0.82rem', fontFamily: 'monospace' }}>
              {formatElapsed(elapsed)}
            </span>
          </div>
          {data.start_time && data.end_time && (
            <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
              {formatTime(data.start_time)} - {formatTime(data.end_time)}
            </span>
          )}
          <button
            onClick={handleEndSession}
            disabled={ending}
            className="flex items-center gap-2"
            style={{
              background: '#E24B4A',
              color: '#fff',
              border: 'none',
              borderRadius: '100px',
              padding: '8px 20px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: ending ? 'not-allowed' : 'pointer',
              opacity: ending ? 0.6 : 1,
            }}
          >
            <PhoneOff size={16} strokeWidth={1.5} />
            {ending ? 'Ending...' : 'End Session'}
          </button>
        </div>
      </div>

      <div ref={jitsiRef} style={{ flex: 1 }} />
    </div>
  )
}
