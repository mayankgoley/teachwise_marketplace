'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { apiPost, ApiError } from '@/lib/api'
import { calculateAge, validatePassword } from '@/lib/auth-utils'
import AuthCard from '@/components/ui/AuthCard'
import PasswordStrengthMeter from '@/components/ui/PasswordStrengthMeter'
import { CheckCircle } from 'lucide-react'
import type { RegisterResponse } from '@/types/auth'

type Role = 'student' | 'tutor'
type Step = 1 | 2 | 3

function StepDots({ current }: { current: Step }) {
  return (
    <div className="flex justify-center gap-2 mb-6">
      {([1, 2, 3] as const).map((s) => (
        <div
          key={s}
          className="w-2.5 h-2.5 rounded-full transition-colors duration-200"
          style={{
            background:
              s <= current
                ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
                : 'var(--border)',
          }}
        />
      ))}
    </div>
  )
}

export default function SignupPage() {
  const [step, setStep] = useState<Step>(1)
  const [role, setRole] = useState<Role>('student')

  // Step 1
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Step 2
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')

  // Step 3
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  // State
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)
  const [requiresGuardian, setRequiresGuardian] = useState(false)

  const age = dateOfBirth ? calculateAge(dateOfBirth) : null
  const { score: pwScore } = validatePassword(password)

  const validateStep1 = useCallback((): boolean => {
    const errors: Record<string, string> = {}
    if (!name.trim()) errors.name = 'Name is required'
    if (!email.trim()) errors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.email = 'Invalid email format'
    if (pwScore < 3) errors.password = 'Password is too weak'
    if (password !== confirmPassword)
      errors.confirmPassword = 'Passwords do not match'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }, [name, email, password, confirmPassword, pwScore])

  const validateStep2 = useCallback((): boolean => {
    const errors: Record<string, string> = {}
    if (!dateOfBirth) errors.dateOfBirth = 'Date of birth is required'
    else if (age !== null && age < 13)
      errors.dateOfBirth = 'You must be at least 13 years old to register'
    if (role === 'student' && age !== null && age < 16 && age >= 13) {
      if (!guardianEmail.trim())
        errors.guardianEmail = 'Guardian email is required for users under 16'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail))
        errors.guardianEmail = 'Invalid email format'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }, [dateOfBirth, age, role, guardianEmail])

  const handleNext1 = useCallback(() => {
    setFormError(null)
    if (validateStep1()) setStep(2)
  }, [validateStep1])

  const handleNext2 = useCallback(() => {
    setFormError(null)
    if (!validateStep2()) return
    setRequiresGuardian(role === 'student' && age !== null && age < 16)
    setStep(3)
  }, [validateStep2, role, age])

  const handleRegister = useCallback(async () => {
    setIsSubmitting(true)
    setFormError(null)
    try {
      const endpoint =
        role === 'student'
          ? '/api/v1/student/register'
          : '/api/v1/tutor/register'
      const res = await apiPost<RegisterResponse>(endpoint, {
        name,
        email,
        password,
        date_of_birth: dateOfBirth,
      })
      if (!res.success) {
        throw new ApiError(
          res.error?.message ?? 'Registration failed',
          res.error?.code ?? 500,
          res.error?.field
        )
      }
      // Send guardian invite if needed
      if (requiresGuardian && guardianEmail && res.data.id) {
        await apiPost('/api/v1/guardian/invite', {
          guardian_email: guardianEmail,
          student_name: name,
          student_id: res.data.id,
        })
      }
      setRegisteredEmail(email)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.field) {
          setFieldErrors({ [err.field]: err.message })
        } else {
          setFormError(err.message)
        }
        if (err.field === 'email') setStep(1)
        else if (err.field === 'date_of_birth') setStep(2)
      } else {
        setFormError('Something went wrong. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [role, name, email, password, dateOfBirth, requiresGuardian, guardianEmail])

  // Success state
  if (registeredEmail) {
    return (
      <AuthCard title="Account created!">
        <div className="text-center">
          <div className="mb-4 flex justify-center"><CheckCircle size={48} strokeWidth={1.5} className="text-[#639922]" /></div>
          <p className="text-[var(--text)] mb-2">
            We sent a verification link to{' '}
            <strong>{registeredEmail}</strong>. Click it to activate your
            account.
          </p>
          {requiresGuardian && guardianEmail && (
            <p className="text-[var(--muted)] text-[0.9rem] mt-3">
              We also sent a guardian approval request to{' '}
              <strong>{guardianEmail}</strong>. Your account will be activated
              once your guardian approves.
            </p>
          )}
          <Link
            href="/login"
            className="inline-block mt-6 text-accent font-medium no-underline hover:underline"
          >
            Sign in →
          </Link>
        </div>
      </AuthCard>
    )
  }

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <AuthCard
      title="Create your account"
      subtitle="Join 24,000+ learners on Teachwise"
    >
      <StepDots current={step} />

      {/* ── Step 1: Personal Info ─────────────────────────── */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          {/* Role tabs */}
          <div className="flex gap-2 mb-2">
            {(['student', 'tutor'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className="py-[6px] px-5 rounded-pill text-[0.85rem] font-medium transition-all duration-200 border capitalize"
                style={
                  role === r
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
                {r}
              </button>
            ))}
          </div>

          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full bg-[rgba(255,255,255,0.05)] border rounded-[12px] py-3 px-4 text-[var(--text)] font-body text-[0.9rem] outline-none transition-[border-color] duration-200 focus:border-[rgba(79,142,255,0.5)] placeholder:text-[var(--muted)]"
              style={{
                borderColor: fieldErrors.name ? '#E24B4A' : 'var(--border)',
              }}
            />
            {fieldErrors.name && (
              <p className="text-[#E24B4A] text-[0.8rem] mt-1">
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-[rgba(255,255,255,0.05)] border rounded-[12px] py-3 px-4 text-[var(--text)] font-body text-[0.9rem] outline-none transition-[border-color] duration-200 focus:border-[rgba(79,142,255,0.5)] placeholder:text-[var(--muted)]"
              style={{
                borderColor: fieldErrors.email ? '#E24B4A' : 'var(--border)',
              }}
            />
            {fieldErrors.email && (
              <p className="text-[#E24B4A] text-[0.8rem] mt-1">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (12+ chars)"
              className="w-full bg-[rgba(255,255,255,0.05)] border rounded-[12px] py-3 px-4 text-[var(--text)] font-body text-[0.9rem] outline-none transition-[border-color] duration-200 focus:border-[rgba(79,142,255,0.5)] placeholder:text-[var(--muted)]"
              style={{
                borderColor: fieldErrors.password ? '#E24B4A' : 'var(--border)',
              }}
            />
            <PasswordStrengthMeter password={password} />
            {fieldErrors.password && (
              <p className="text-[#E24B4A] text-[0.8rem] mt-1">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <div>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="w-full bg-[rgba(255,255,255,0.05)] border border-[var(--border)] rounded-[12px] py-3 px-4 text-[var(--text)] font-body text-[0.9rem] outline-none transition-[border-color] duration-200 focus:border-[rgba(79,142,255,0.5)] placeholder:text-[var(--muted)]"
            />
            {fieldErrors.confirmPassword && (
              <p className="text-[#E24B4A] text-[0.8rem] mt-1">
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleNext1}
            className="w-full btn-gradient text-white py-3 rounded-pill font-semibold text-[0.95rem] border-none transition-opacity duration-200 hover:shadow-glow"
          >
            Next →
          </button>

          <p className="text-center text-[var(--muted)] text-[0.875rem]">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-accent no-underline hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      )}

      {/* ── Step 2: Date of Birth ────────────────────────── */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-[var(--muted)] text-[0.85rem] mb-2">
              Date of Birth
            </label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              max={todayStr}
              className="w-full bg-[rgba(255,255,255,0.05)] border rounded-[12px] py-3 px-4 text-[var(--text)] font-body text-[0.9rem] outline-none transition-[border-color] duration-200 focus:border-[rgba(79,142,255,0.5)]"
              style={{
                borderColor: fieldErrors.dateOfBirth
                  ? '#E24B4A'
                  : 'var(--border)',
                colorScheme: 'dark',
              }}
            />
            {fieldErrors.dateOfBirth && (
              <p className="text-[#E24B4A] text-[0.8rem] mt-1">
                {fieldErrors.dateOfBirth}
              </p>
            )}
          </div>

          {/* Under 16 info box */}
          {role === 'student' &&
            age !== null &&
            age < 16 &&
            age >= 13 && (
              <div
                style={{
                  background: 'rgba(186,117,23,0.1)',
                  border: '1px solid rgba(186,117,23,0.3)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  fontSize: '0.875rem',
                  color: '#EF9F27',
                }}
              >
                Since you&apos;re under 16, a parent or guardian must approve
                your account before you can book sessions.
              </div>
            )}

          {/* Guardian email (for under 16) */}
          {role === 'student' &&
            age !== null &&
            age < 16 &&
            age >= 13 && (
              <div>
                <label className="block text-[var(--muted)] text-[0.85rem] mb-2">
                  Guardian Email
                </label>
                <input
                  type="email"
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                  placeholder="guardian@email.com"
                  className="w-full bg-[rgba(255,255,255,0.05)] border rounded-[12px] py-3 px-4 text-[var(--text)] font-body text-[0.9rem] outline-none transition-[border-color] duration-200 focus:border-[rgba(79,142,255,0.5)] placeholder:text-[var(--muted)]"
                  style={{
                    borderColor: fieldErrors.guardianEmail
                      ? '#E24B4A'
                      : 'var(--border)',
                  }}
                />
                {fieldErrors.guardianEmail && (
                  <p className="text-[#E24B4A] text-[0.8rem] mt-1">
                    {fieldErrors.guardianEmail}
                  </p>
                )}
              </div>
            )}

          {/* Under 13 hard block */}
          {age !== null && age < 13 && (
            <div className="bg-[rgba(226,75,74,0.1)] border border-[rgba(226,75,74,0.3)] rounded-[12px] py-3 px-4 text-[#E24B4A] text-[0.875rem]">
              You must be at least 13 years old to register.
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setFieldErrors({})
                setStep(1)
              }}
              className="flex-1 bg-transparent text-[var(--text)] border border-[var(--border)] py-3 rounded-pill font-medium text-[0.95rem] transition-[border-color] duration-200 hover:border-accent"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleNext2}
              disabled={age !== null && age < 13}
              className="flex-1 btn-gradient text-white py-3 rounded-pill font-semibold text-[0.95rem] border-none disabled:opacity-40 transition-opacity duration-200 hover:shadow-glow"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Review & Submit ──────────────────────── */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          {/* Summary card */}
          <div className="bg-[rgba(255,255,255,0.03)] border border-[var(--border)] rounded-[12px] p-4">
            <div className="flex flex-col gap-2 text-[0.9rem]">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Name</span>
                <span className="text-[var(--text)]">{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Email</span>
                <span className="text-[var(--text)]">{email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Role</span>
                <span className="text-[var(--text)] capitalize">{role}</span>
              </div>
              {age !== null && (
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Age</span>
                  <span className="text-[var(--text)]">{age}</span>
                </div>
              )}
            </div>
          </div>

          {requiresGuardian && guardianEmail && (
            <div className="text-[var(--muted)] text-[0.875rem]">
              Guardian approval will be sent to:{' '}
              <strong className="text-[var(--text)]">{guardianEmail}</strong>
            </div>
          )}

          {/* Terms */}
          <label className="flex items-start gap-3 text-[0.875rem] text-[var(--muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-1 accent-[var(--accent)]"
            />
            <span>
              I agree to the{' '}
              <Link href="/terms" className="text-accent no-underline hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy"
                className="text-accent no-underline hover:underline"
              >
                Privacy Policy
              </Link>
            </span>
          </label>

          {/* Form error */}
          {formError && (
            <div className="bg-[rgba(226,75,74,0.1)] border border-[rgba(226,75,74,0.3)] rounded-[12px] py-3 px-4 text-[#E24B4A] text-[0.875rem]">
              {formError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setFieldErrors({})
                setFormError(null)
                setStep(2)
              }}
              className="flex-1 bg-transparent text-[var(--text)] border border-[var(--border)] py-3 rounded-pill font-medium text-[0.95rem] transition-[border-color] duration-200 hover:border-accent"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleRegister}
              disabled={isSubmitting || !agreedToTerms}
              className="flex-1 btn-gradient text-white py-3 rounded-pill font-semibold text-[0.95rem] border-none disabled:opacity-40 flex items-center justify-center gap-2 transition-opacity duration-200 hover:shadow-glow"
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
              {isSubmitting ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </div>
      )}
    </AuthCard>
  )
}
