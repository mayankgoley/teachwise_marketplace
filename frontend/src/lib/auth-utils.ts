import type { UserRole } from '@/types/auth'

export function dashboardPath(userType: UserRole): string {
  const map: Record<UserRole, string> = {
    student: '/dashboard/student',
    tutor: '/dashboard/tutor',
    admin: '/dashboard/admin',
    guardian: '/dashboard/guardian',
  }
  return map[userType]
}

export { calculateAge } from './format'

export function validatePassword(password: string): {
  valid: boolean
  score: number
  errors: string[]
} {
  const errors: string[] = []
  let score = 0
  if (password.length >= 12) score++
  else errors.push('At least 12 characters')
  if (/[A-Z]/.test(password)) score++
  else errors.push('At least one uppercase letter')
  if (/[0-9]/.test(password)) score++
  else errors.push('At least one number')
  if (/[^A-Za-z0-9]/.test(password)) score++
  else errors.push('At least one special character')
  return { valid: score === 4, score, errors }
}
