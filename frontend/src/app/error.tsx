'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureException(error, {
        tags: { errorDigest: error.digest ?? 'unknown' },
      })
    } else {
      console.error('Error boundary caught:', error)
    }
  }, [error])

  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ minHeight: '60vh', textAlign: 'center', padding: '32px' }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'rgba(226,75,74,0.12)',
          marginBottom: 20,
        }}
      >
        <AlertCircle size={26} strokeWidth={1.5} color="#E24B4A" />
      </div>
      <h2
        className="font-head font-bold text-[var(--text)]"
        style={{ fontSize: '1.3rem', margin: '0 0 8px' }}
      >
        Something went wrong
      </h2>
      <p
        style={{
          color: 'var(--muted)',
          fontSize: '0.9rem',
          margin: '0 0 24px',
          maxWidth: 400,
        }}
      >
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        className="flex items-center gap-2"
        style={{
          padding: '10px 24px',
          borderRadius: '100px',
          background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
          color: '#fff',
          border: 'none',
          fontSize: '0.88rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <RefreshCw size={16} strokeWidth={1.5} />
        Try Again
      </button>
    </div>
  )
}
