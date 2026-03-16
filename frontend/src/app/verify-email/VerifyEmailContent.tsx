'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, AlertCircle, Loader2, Mail } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'

type Status = 'loading' | 'success' | 'error'
type ResendStatus = 'idle' | 'sending' | 'sent' | 'rate-limited'

export default function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<Status>('loading')
  const [resendStatus, setResendStatus] = useState<ResendStatus>('idle')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      return
    }

    apiGet('/api/v1/auth/verify-email?token=' + token)
      .then((res) => {
        setStatus(res.success ? 'success' : 'error')
      })
      .catch(() => {
        setStatus('error')
      })
  }, [token])

  const handleResend = async () => {
    setResendStatus('sending')
    try {
      const res = await apiPost('/api/v1/auth/resend-verification')
      if (res.success) {
        setResendStatus('sent')
      } else if (res.error?.code === 429) {
        setResendStatus('rate-limited')
      } else {
        setResendStatus('rate-limited')
      }
    } catch {
      setResendStatus('rate-limited')
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {status === 'loading' && (
          <>
            <Loader2
              size={64}
              strokeWidth={1.5}
              style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }}
            />
            <p style={styles.loadingText}>Verifying your email...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle size={64} strokeWidth={1.5} style={{ color: '#22c55e' }} />
            <h1 style={styles.heading}>Email Verified!</h1>
            <p style={styles.muted}>
              Your account is now active. You can sign in.
            </p>
            <Link href="/login" style={styles.gradientButton}>
              Sign In &rarr;
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle size={64} strokeWidth={1.5} style={{ color: '#ef4444' }} />
            <h1 style={styles.heading}>Link Expired</h1>
            <p style={styles.muted}>
              This verification link has expired or already been used.
            </p>

            {resendStatus === 'idle' && (
              <button onClick={handleResend} style={styles.gradientButton}>
                Resend Verification Email
              </button>
            )}

            {resendStatus === 'sending' && (
              <button disabled style={{ ...styles.gradientButton, opacity: 0.7, cursor: 'not-allowed' }}>
                Sending...
              </button>
            )}

            {resendStatus === 'sent' && (
              <p style={styles.successMessage}>
                <Mail size={16} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Verification email sent! Check your inbox.
              </p>
            )}

            {resendStatus === 'rate-limited' && (
              <p style={styles.errorMessage}>
                Too many attempts. Try again later.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 24,
    padding: 48,
    maxWidth: 480,
    width: '100%',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  heading: {
    fontFamily: 'var(--font-head)',
    fontSize: '2rem',
    margin: 0,
  },
  muted: {
    color: 'var(--text-muted, #888)',
    fontSize: '0.95rem',
    margin: 0,
    lineHeight: 1.5,
  },
  loadingText: {
    color: 'var(--text-muted, #888)',
    fontSize: '0.95rem',
    margin: 0,
  },
  gradientButton: {
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    color: '#fff',
    borderRadius: 100,
    padding: '14px 32px',
    fontSize: '0.9rem',
    fontWeight: 600,
    textDecoration: 'none',
    display: 'inline-block',
    border: 'none',
    cursor: 'pointer',
    marginTop: 8,
  },
  successMessage: {
    color: '#22c55e',
    fontSize: '0.9rem',
    margin: 0,
    marginTop: 8,
  },
  errorMessage: {
    color: '#ef4444',
    fontSize: '0.9rem',
    margin: 0,
    marginTop: 8,
  },
}
