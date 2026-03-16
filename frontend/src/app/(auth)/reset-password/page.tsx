'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiGet, apiPost, ApiError } from '@/lib/api'
import { validatePassword } from '@/lib/auth-utils'
import AuthCard from '@/components/ui/AuthCard'
import PasswordStrengthMeter from '@/components/ui/PasswordStrengthMeter'
import { Eye, EyeOff } from 'lucide-react'

interface ValidateData {
  email: string
}

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<
    'validating' | 'valid' | 'invalid' | 'success'
  >('validating')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [invalidMessage, setInvalidMessage] = useState(
    'This reset link is invalid or has expired.'
  )

  useEffect(() => {
    if (!token) {
      setInvalidMessage('No reset token provided.')
      setStatus('invalid')
      return
    }

    let cancelled = false
    async function validate() {
      try {
        const res = await apiGet<ValidateData>(
          `/api/v1/auth/reset-password/validate?token=${encodeURIComponent(token!)}`
        )
        if (cancelled) return
        if (res.success && res.data) {
          setEmail(res.data.email)
          setStatus('valid')
        } else {
          setInvalidMessage(
            res.error?.message ?? 'This reset link is invalid or has expired.'
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
        const res = await apiPost<null>('/api/v1/auth/reset-password', {
          token,
          new_password: password,
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
    [password, confirmPassword, token]
  )

  if (status === 'validating') {
    return (
      <AuthCard title="Verifying link...">
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
      <AuthCard title="Link expired">
        <p className="text-[var(--muted)] text-[0.9rem] mb-6">
          {invalidMessage}
        </p>
        <Link
          href="/forgot-password"
          className="text-accent text-[0.85rem] no-underline hover:underline"
        >
          Request a new reset link
        </Link>
      </AuthCard>
    )
  }

  if (status === 'success') {
    return (
      <AuthCard title="Password reset!">
        <p className="text-[var(--muted)] text-[0.9rem] mb-6">
          Your password has been successfully updated. You can now sign in with
          your new password.
        </p>
        <Link
          href="/login"
          className="inline-block btn-gradient text-white py-3 px-6 rounded-pill font-semibold text-[0.95rem] transition-[opacity,box-shadow] duration-200 hover:shadow-glow text-center no-underline"
        >
          Sign in
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Set new password"
      subtitle={`For ${email}`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* New password */}
        <div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              required
              className="w-full bg-[rgba(255,255,255,0.05)] border border-[var(--border)] rounded-[12px] py-3 px-4 pr-12 text-[var(--text)] font-body text-[0.9rem] outline-none transition-[border-color] duration-200 focus:border-[rgba(79,142,255,0.5)] placeholder:text-[var(--muted)]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
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
            placeholder="Confirm new password"
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
          {isSubmitting ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    </AuthCard>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
