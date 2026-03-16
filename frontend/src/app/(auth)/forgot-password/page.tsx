'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { apiPost } from '@/lib/api'
import AuthCard from '@/components/ui/AuthCard'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setIsSubmitting(true)
      try {
        const res = await apiPost<null>('/api/v1/auth/forgot-password', {
          email,
        })
        if (!res.success && res.error?.code === 429) {
          setRateLimited(true)
        } else {
          // Always show success regardless of whether email exists (security)
          setSubmitted(true)
        }
      } catch {
        // Still show success to avoid email enumeration
        setSubmitted(true)
      } finally {
        setIsSubmitting(false)
      }
    },
    [email]
  )

  if (rateLimited) {
    return (
      <AuthCard title="Too many requests">
        <p className="text-[var(--muted)] text-[0.9rem] mb-6">
          You&apos;ve made too many password reset requests. Please wait a few
          minutes before trying again.
        </p>
        <button
          onClick={() => {
            setRateLimited(false)
            setEmail('')
          }}
          className="text-accent text-[0.85rem] no-underline hover:underline"
        >
          Try again
        </button>
      </AuthCard>
    )
  }

  if (submitted) {
    return (
      <AuthCard title="Check your email">
        <p className="text-[var(--muted)] text-[0.9rem] mb-2">
          If an account exists for <strong className="text-[var(--text)]">{email}</strong>,
          we&apos;ve sent a password reset link.
        </p>
        <p className="text-[var(--muted)] text-[0.8rem] mb-6">
          The link will expire in 1 hour. Check your spam folder if you
          don&apos;t see it.
        </p>
        <Link
          href="/login"
          className="text-accent text-[0.85rem] no-underline hover:underline"
        >
          Back to sign in
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="w-full bg-[rgba(255,255,255,0.05)] border border-[var(--border)] rounded-[12px] py-3 px-4 text-[var(--text)] font-body text-[0.9rem] outline-none transition-[border-color] duration-200 focus:border-[rgba(79,142,255,0.5)] placeholder:text-[var(--muted)]"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full btn-gradient text-white py-3 px-6 rounded-pill font-semibold text-[0.95rem] transition-[opacity,box-shadow] duration-200 hover:shadow-glow disabled:opacity-60 flex items-center justify-center gap-2 border-none"
        >
          {isSubmitting && (
            <svg
              className="animate-spin"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
                strokeOpacity="0.3"
              />
              <path
                d="M12 2a10 10 0 0 1 10 10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          )}
          {isSubmitting ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <p className="text-center text-[var(--muted)] text-[0.875rem] mt-6">
        Remember your password?{' '}
        <Link
          href="/login"
          className="text-accent no-underline hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthCard>
  )
}
