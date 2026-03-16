// Guardian types for Phase 7

export interface GuardianChild {
  id: number
  name: string
  email: string
  date_of_birth: string | null
  is_minor: boolean
  grade_level: string | null
  major: string | null
  created_at: string | null
  booking_count: number
  total_spent: number
}

export interface ChildActivity {
  child: { id: number; name: string }
  bookings: {
    id: number
    tutor: {
      id: number
      name: string
      avatar_url: string | null
    }
    subject: string | null
    date: string | null
    start_time: string | null
    end_time: string | null
    status: string
    mode: string
    price: number
    booked_on: string | null
  }[]
  payments: {
    id: number
    amount: number
    status: string
    created_at: string | null
  }[]
}

export interface GuardianApproval {
  id: number
  child: { id: number; name: string }
  tutor: {
    id: number
    name: string
    avatar_url: string | null
    verification_status: string
  }
  subject: string | null
  date: string | null
  start_time: string | null
  end_time: string | null
  mode: string
  price: number
  guardian_approved: boolean | null
  booked_on: string | null
}

export interface SpendingData {
  total_spent: number
  weekly_spent: number
  monthly_spent: number
  weekly_limit: number | null
  monthly_limit: number | null
  by_child: {
    id: number
    name: string
    total_spent: number
    monthly_spent: number
  }[]
}

export interface GuardianMessageThread {
  tutor: {
    id: number
    name: string
    avatar_url: string | null
  }
  child: {
    id: number
    name: string
  }
  messages: GuardianMessage[]
  unread_count: number
}

export interface GuardianMessage {
  id: number
  guardian_id: number
  tutor_id: number
  student_id: number
  sender_type: 'guardian' | 'tutor'
  content: string
  is_read: boolean
  created_at: string | null
}
