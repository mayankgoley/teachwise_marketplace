'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiGet, apiPost, ApiError } from '@/lib/api'
import { validatePassword } from '@/lib/auth-utils'
import AuthCard from '@/components/ui/AuthCard'
import PasswordStrengthMeter from '@/components/ui/PasswordStrengthMeter'
import { Eye, EyeOff } from 'lucide-react'

interface AcceptData {
  student_name: string
  guardian_email: string
  token_valid: boolean
}

function GuardianAcceptForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<
    'validating' | 'valid' | 'invalid' | 'success'
  >('validating')
  const [data, setData] = useState<AcceptData | null>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [invalidMessage, setInvalidMessage] = useState(
    'This invitation link is invalid or has expired.'
  )

  useEffect(() => {
    if (!token) {
      setInvalidMessage('No invitation token provided.')
      setStatus('invalid')
      return
    }

    let cancelled = false
    async function validate() {
      try {
        const res = await apiGet<AcceptData>(
          `/api/v1/guardian/accept?token=${encodeURIComponent(token!)}`
        )
        if (cancelled) return
        if (res.success && res.data) {
          setData(res.data)
          setStatus('valid')
        } else {
          setInvalidMessage(
            res.error?.message ??
              'This invitation link is invalid or has expired.'
          )
          setStatus('invalid')
        }
      } catch {
        if (!cancelled) setStatus('invalid')
      }
    }
    validate()
    return () => {
      cancelled = true
    }
  }, [token])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setFormError(null)

      if (!name.trim()) {
        setFormError('Name is required.')
        return
      }

      if (password !== confirmPassword) {
        setFormError('Passwords do not match.')
        return
      }

      const { valid, errors } = validatePassword(password)
      if (!valid) {
        setFormError(errors[0])
        return
      }

      setIsSubmitting(true)
      try {
        const res = await apiPost<null>('/api/v1/guardian/accept', {
          token,
          name: name.trim(),
          password,
        })
        if (res.success) {
          setStatus('success')
        } else {
          if (res.error) {
            throw new ApiError(
              res.error.message,
              res.error.code,
              res.error.field
            )
          }
          setFormError('Something went wrong. Please try again.')
        }
      } catch (err) {
        if (err instanceof ApiError) {
          setFormError(err.message)
        } else {
          setFormError('Something went wrong. Please try again.')
        }
      } finally {
        setIsSubmitting(false)
      }
    },
    [name, password, confirmPassword, token]
  )

  if (status === 'validating') {
    return (
      <AuthCard title="Verifying invitation...">
        <div className="flex justify-center py-8">
          <svg
            className="animate-spin text-accent"
            width="32"
            height="32"
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
        </div>
      </AuthCard>
    )
  }

  if (status === 'invalid') {
    return (
      <AuthCard title="Invitation expired">
        <p className="text-[var(--muted)] text-[0.9rem] mb-6">
          {invalidMessage}
        </p>
        <Link
          href="/login"
          className="text-accent text-[0.85rem] no-underline hover:underline"
        >
          Go to sign in
        </Link>
      </AuthCard>
    )
  }

  if (status === 'success') {
    return (
      <AuthCard title="Welcome aboard!">
        <p className="text-[var(--muted)] text-[0.9rem] mb-6">
          Your guardian account is set up. You can now sign in and monitor{' '}
          <strong className="text-[var(--text)]">{data?.student_name}</strong>
          &apos;s learning activity.
        </p>
        <Link
          href="/login"
          className="inline-block btn-gradient text-white py-3 px-6 rounded-pill font-semibold text-[0.95rem] transition-[opacity,box-shadow] duration-200 hover:shadow-glow text-center no-underline"
        >
          Sign in as Guardian
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard title={`You've been invited`}>
      <p className="text-[var(--muted)] text-[0.9rem] mb-6">
        You&apos;ve been invited to be{' '}
        <strong className="text-[var(--text)]">{data?.student_name}</strong>
        &apos;s guardian on Teachwise. Enter your name and set a password to create your account.
      </p>

      {/* Info card */}
      <div className="bg-[rgba(79,142,255,0.08)] border border-[rgba(79,142,255,0.2)] rounded-[12px] py-3 px-4 text-[0.85rem] text-[var(--muted)] mb-6">
        <p>{data?.guardian_email}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Name */}
        <div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            required
            className="w-full bg-[rgba(255,255,255,0.05)] border border-[var(--border)] rounded-[12px] py-3 px-4 text-[var(--text)] font-body text-[0.9rem] outline-none transition-[border-color] duration-200 focus:border-[rgba(79,142,255,0.5)] placeholder:text-[var(--muted)]"
          />
        </div>

        {/* Password */}
        <div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create password"
              required
              className="w-full bg-[rgba(255,255,255,0.05)] border border-[var(--border)] rounded-[12px] py-3 px-4 pr-12 text-[var(--text)] font-body text-[0.9rem] outline-none transition-[border-color] duration-200 focus:border-[rgba(79,142,255,0.5)] placeholder:text-[var(--muted)]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm"
            >
              {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
            </button>
          </div>
          <PasswordStrengthMeter password={password} />
        </div>

        {/* Confirm password */}
        <div>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            required
            className="w-full bg-[rgba(255,255,255,0.05)] border border-[var(--border)] rounded-[12px] py-3 px-4 text-[var(--text)] font-body text-[0.9rem] outline-none transition-[border-color] duration-200 focus:border-[rgba(79,142,255,0.5)] placeholder:text-[var(--muted)]"
          />
        </div>

        {/* Form error */}
        {formError && (
          <div className="bg-[rgba(226,75,74,0.1)] border border-[rgba(226,75,74,0.3)] rounded-[12px] py-3 px-4 text-[#E24B4A] text-[0.875rem]">
            {formError}
          </div>
        )}

        {/* Submit */}
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
          {isSubmitting ? 'Creating account...' : 'Accept & Create Account'}
        </button>
      </form>
    </AuthCard>
  )
}

export default function GuardianAcceptPage() {
  return (
    <Suspense>
      <GuardianAcceptForm />
    </Suspense>
  )
}
