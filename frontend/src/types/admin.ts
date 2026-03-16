// Admin types for Phase 7

export interface AdminUser {
  id: number
  name: string
  email: string
  user_type: 'student' | 'tutor'
  created_at: string | null
  email_verified?: boolean
  guardian_id?: number | null
  is_minor?: boolean
  is_suspended?: boolean
  verification_status?: string
  avatar_url?: string | null
  rating_avg?: number
  total_sessions_completed?: number
  subject?: string
  booking_count?: number
  bio?: string
  qualification?: string
  institution?: string
  hourly_rate?: number
  documents?: VerificationDocument[]
}

export interface VerificationDocument {
  id: number
  document_type: string
  original_filename: string
  status: 'pending' | 'approved' | 'rejected' | 'revision_required'
  admin_notes?: string | null
  uploaded_at: string | null
  expiry_date: string | null
}

export interface VerificationTutor {
  id: number
  name: string
  email: string
  avatar_url: string | null
  subject: string
  qualification: string | null
  institution: string | null
  verification_status: string
  admin_feedback: string | null
  created_at: string | null
  documents: VerificationDocument[]
}

export interface ModerationReport {
  id: number
  reporter_id: number
  reporter_type: 'student' | 'tutor'
  reporter_name: string
  content_type: string
  content_id: number
  reason: string
  details: string | null
  status: 'pending' | 'reviewed' | 'dismissed'
  reviewed_by: string | null
  created_at: string | null
}

export interface AuditLogEntry {
  id: number
  admin_id: number | null
  admin_name: string | null
  action: string
  target_type: string | null
  target_id: number | null
  details: Record<string, unknown> | null
  ip_address: string | null
  created_at: string | null
}

export interface AdminBooking {
  id: number
  student: { id: number; name: string }
  tutor: { id: number; name: string; avatar_url: string | null }
  subject: string | null
  date: string | null
  start_time: string | null
  end_time: string | null
  status: string
  mode: string
  price: number
  booked_on: string | null
  cancelled_by: string | null
  cancellation_reason: string | null
}

export interface AnalyticsData {
  users: {
    total_students: number
    total_tutors: number
    new_students_30d: number
    new_tutors_30d: number
    verified_tutors: number
  }
  bookings: {
    total: number
    last_30_days: number
    completed_sessions: number
  }
  revenue: {
    total: number
    last_30_days: number
    platform_fees: number
  }
  reviews: {
    total: number
    average_rating: number
  }
  charts: {
    daily_signups: { date: string; students: number; tutors: number }[]
    daily_revenue: { date: string; revenue: number }[]
  }
}

export interface PlatformSetting {
  id: number
  key: string
  value: string
  description: string | null
  category: string
  updated_by: string | null
  updated_at: string | null
}
