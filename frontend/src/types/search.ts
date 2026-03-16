export interface TutorSearchResult {
  id: number
  name: string
  avatar_url: string | null
  subject: string
  subjects_additional: string[]
  hourly_rate: number
  rating_avg: number
  total_reviews: number
  total_sessions: number
  verification_status: string
  bio: string | null
  latitude: number | null
  longitude: number | null
  distance_km: number | null
  service_radius_km: number
  modes: string[]
  availability_next: string | null
  is_featured: boolean
}

export interface TutorProfile extends Omit<TutorSearchResult, 'bio'> {
  bio: string | null
  experience_years: number | null
  education: string | null
  languages: string[]
  is_favorite: boolean
  available_slots: AvailableSlot[]
  reviews: TutorReview[]
  rating_breakdown: Record<string, number>
}

export interface AvailableSlot {
  id: number
  date: string
  start_time: string
  end_time: string
  price: number
  mode: string
  subject: string
  spots_remaining: number
}

export interface TutorReview {
  id: number
  student_name: string
  student_avatar_url: string | null
  rating: number
  comment: string
  created_at: string
  tutor_response: string | null
  rating_knowledge: number | null
  rating_communication: number | null
  rating_punctuality: number | null
  rating_value: number | null
}

export interface SearchFilters {
  q: string
  subject: string
  lat: number | null
  lng: number | null
  radius_km: number
  min_price: string
  max_price: string
  min_rating: number
  mode: 'online' | 'in_person' | 'both'
  page: number
}

export interface SearchSuggestion {
  type: 'subject' | 'tutor'
  label: string
  value: string
  tutor_id?: number
}

export interface WalletTransaction {
  id: number
  type: 'topup' | 'booking_payment' | 'refund' | 'bonus'
  amount: number
  balance_after: number
  description: string
  created_at: string
}

export interface WalletData {
  balance: number
  currency: string
  transactions: WalletTransaction[]
}

export interface AppNotification {
  id: number
  type: string
  title: string
  message: string
  icon: string
  color: string
  url: string | null
  is_read: boolean
  created_at: string
  group_key: string | null
}

export interface StudentBooking {
  id: number
  tutor_name: string
  tutor_avatar_url: string | null
  subject: string
  date: string
  start_time: string
  end_time: string
  mode: string
  status: string
  amount: number
  jitsi_room_name: string | null
  can_reschedule: boolean
  can_cancel: boolean
  can_review: boolean
  guardian_approved: boolean
}

export interface TutorSlotData {
  id: number
  date: string
  start_time: string
  end_time: string
  subject: string
  price: number
  mode: string
  status: string
  max_students: number
  booking: {
    id: number
    student_name: string
    student_avatar_url: string | null
    status: string
    guardian_approved: boolean
  } | null
}

export interface EarningRecord {
  id: number
  student_name: string
  subject: string
  date: string
  gross_amount: number
  platform_fee: number
  payout: number
  status: string
}

export interface EarningsSummary {
  total_earned: number
  pending_payout: number
  this_month: number
  last_month: number
  stripe_account_connected: boolean
  stripe_onboarding_url: string | null
}

export interface MonthlyEarning {
  month: string
  label: string
  gross: number
  fee: number
  payout: number
}

export interface TutorStudent {
  id: number
  name: string
  avatar_url: string | null
  total_sessions: number
  last_session_date: string
  subjects: string[]
  total_spent: number
}
