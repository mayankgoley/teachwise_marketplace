export type UserRole = 'student' | 'tutor' | 'admin' | 'guardian'

export interface BaseUser {
  id: number
  user_type: UserRole
  name: string
  email: string
  avatar_url?: string
  is_verified: boolean
}

export interface StudentUser extends BaseUser {
  user_type: 'student'
  date_of_birth?: string
  guardian_id?: number
  requires_guardian_approval?: boolean
  wallet_balance?: number
  timezone?: string
}

export interface TutorUser extends BaseUser {
  user_type: 'tutor'
  verification_status:
    | 'pending_documents'
    | 'documents_submitted'
    | 'under_review'
    | 'verified'
    | 'rejected'
    | 'revision_required'
    | 'verification_expired'
  subject?: string
  hourly_rate?: number
  rating_avg?: number
  stripe_account_id?: string
}

export interface AdminUser extends BaseUser {
  user_type: 'admin'
  role: 'reviewer' | 'verification_officer' | 'admin' | 'superadmin'
}

export interface GuardianUser extends BaseUser {
  user_type: 'guardian'
  weekly_spending_limit?: number
  monthly_spending_limit?: number
}

export type User = StudentUser | TutorUser | AdminUser | GuardianUser

export interface LoginCredentials {
  email: string
  password: string
  role: UserRole
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
  date_of_birth: string
}

export interface RegisterResponse {
  id: number
  email: string
  requires_guardian_approval?: boolean
  verification_status?: string
}
