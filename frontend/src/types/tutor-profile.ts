export interface TutorEditableProfile {
  id: number
  name: string
  email: string
  bio: string | null
  subject: string
  subjects_additional: string[]
  hourly_rate: number
  experience_years: number | null
  education: string | null
  languages: string[]
  latitude: number | null
  longitude: number | null
  service_radius_km: number
  offers_online: boolean
  offers_in_person: boolean
  avatar_url: string | null
  verification_status: string
  stripe_account_connected: boolean
  notification_prefs: Record<string, boolean>
}

export interface TutorDocument {
  id: number
  document_type: string
  original_filename: string
  status: string
  uploaded_at: string
  expiry_date: string | null
  rejection_reason: string | null
  download_url: string
}

export interface TutorDocumentsData {
  documents: TutorDocument[]
  verification_status: string
  required_documents: string[]
  can_submit_for_review: boolean
}

export interface RescheduleSlot {
  id: number
  date: string
  start_time: string
  end_time: string
  subject: string | null
  mode: string
  price: number
}

export interface RescheduleRequest {
  id: number
  booking_id: number
  student_name: string
  subject: string
  original_date: string
  original_start_time: string
  proposed_date: string
  proposed_start_time: string
  reason: string | null
  expires_at: string
  status: string
}

export interface AdminRecording {
  id: number
  slot_id: number
  student_name: string
  tutor_name: string
  subject: string | null
  session_date: string | null
  duration_minutes: number | null
  quality: string | null
  file_size_mb: number | null
  student_consent: boolean
  tutor_consent: boolean
  expires_at: string | null
  created_at: string | null
  is_expired: boolean
}
