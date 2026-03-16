export interface SessionParticipant {
  id: number
  name: string
  avatar_url?: string | null
}

export interface RecordingConsent {
  student: boolean
  tutor: boolean
}

export interface SessionJoinData {
  slot_id: number
  room_name: string
  jitsi_domain: string
  subject: string | null
  date: string | null
  start_time: string | null
  end_time: string | null
  mode: string
  status: string
  tutor: SessionParticipant | null
  student: SessionParticipant | null
  user_role: 'student' | 'tutor'
  user_name: string
  recording_consent: RecordingConsent
}

export interface SessionNote {
  id: number
  content: string
  author_type: 'student' | 'tutor'
  is_private: boolean
  created_at: string | null
}

export interface SessionRecording {
  id: number
  duration_seconds: number | null
  is_consented: boolean
  created_at: string | null
}

export interface SessionBooking {
  id: number
  status: string
  booked_on: string | null
}

export interface SessionSummary {
  slot_id: number
  subject: string | null
  date: string | null
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
  mode: string
  status: string
  price: number
  tutor: SessionParticipant | null
  student: SessionParticipant | null
  notes: SessionNote[]
  recordings: SessionRecording[]
  booking: SessionBooking | null
}

export interface PaymentInfo {
  id: number
  amount: number
  status: string
  paid_at: string | null
}

export interface SessionPricing {
  session_price: number
  platform_fee: number
  tutor_payout: number
}

export interface SessionReceipt {
  slot_id: number
  subject: string | null
  date: string | null
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
  mode: string
  tutor: SessionParticipant | null
  student: SessionParticipant | null
  pricing: SessionPricing
  payment: PaymentInfo | null
  booking: { id: number; booked_on: string | null } | null
  generated_at: string
}
