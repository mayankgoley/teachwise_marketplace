'use client'

import { Suspense, useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api'
import { dashboardPath } from '@/lib/auth-utils'
import AuthCard from '@/components/ui/AuthCard'
import { Eye, EyeOff } from 'lucide-react'
import type { UserRole } from '@/types/auth'

const ROLES: { label: string; value: UserRole }[] = [
  { label: 'Student', value: 'student' },
  { label: 'Tutor', value: 'tutor' },
  { label: 'Admin', value: 'admin' },
  { label: 'Guardian', value: 'guardian' },
]

function LoginForm() {
  const { login, refetch } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [selectedRole, setSelectedRole] = useState<UserRole>('student')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (isSubmitting) return
      setIsSubmitting(true)
      setFormError(null)
      setFieldErrors({})

      try {
        await login({ email, password, role: selectedRole })
        await refetch()

        const next = searchParams.get('next')
        const destination = next && next.startsWith('/')
          ? next
          : dashboardPath(selectedRole)

        router.replace(destination)
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.field) {
            setFieldErrors({ [err.field]: err.message })
          } else if (err.code === 401) {
            setFormError('Invalid email or password')
          } else if (err.code === 403) {
            setFieldErrors({ email: err.message })
          } else if (err.code === 423) {
            setFormError(err.message)
          } else if (err.code === 500) {
            setFormError('Server error. Please try again in a moment.')
          } else if (err.code === 0) {
            setFormError('Connection error. Please check your internet.')
          } else {
            setFormError(err.message)
          }
        } else {
          setFormError('Something went wrong. Please try again.')
        }
      } finally {
        setIsSubmitting(false)
      }
    },
    [email, password, selectedRole, login, refetch, router, searchParams, isSubmitting]
  )

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your Teachwise account">
      {/* Role tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {ROLES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setSelectedRole(r.value)}
            className="py-[6px] px-4 rounded-pill text-[0.85rem] font-medium transition-all duration-200 border"
            style={
              selectedRole === r.value
                ? {
                    background:
                      'linear-gradient(135deg, var(--accent), var(--accent2))',
                    color: '#fff',
                    borderColor: 'transparent',
                  }
                : {
                    background: 'transparent',
                    color: 'var(--muted)',
                    borderColor: 'var(--border)',
                  }
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Email */}
        <div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email address"
            placeholder="your@email.com"
            required
            className="w-full bg-[rgba(255,255,255,0.05)] border rounded-[12px] py-3 px-4 text-[var(--text)] font-body text-[0.9rem] outline-none transition-[border-color] duration-200 focus:border-[rgba(79,142,255,0.5)] placeholder:text-[var(--muted)]"
            style={{
              borderColor: fieldErrors.email
                ? '#E24B4A'
                : 'var(--border)',
            }}
          />
          {fieldErrors.email && (
            <p className="text-[#E24B4A] text-[0.8rem] mt-1">
              {fieldErrors.email}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="Password"
              placeholder="Password"
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
        </div>

        {/* Forgot password link */}
        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-accent text-[0.85rem] no-underline hover:underline"
          >
            Forgot password?
          </Link>
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
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      {/* Bottom link */}
      <p className="text-center text-[var(--muted)] text-[0.875rem] mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-accent no-underline hover:underline">
          Sign up →
        </Link>
      </p>
    </AuthCard>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
