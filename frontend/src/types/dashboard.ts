export interface UpcomingSession {
  id: number
  tutor_name: string
  tutor_avatar_url: string | null
  subject: string
  date: string
  start_time: string
  end_time: string
  mode: 'online' | 'in_person'
  status: string
  jitsi_room_name: string | null
}

export interface RecentBooking {
  id: number
  tutor_name: string
  subject: string
  date: string
  status: string
  amount: number
}

export interface ActiveGoal {
  id: number
  title: string
  status: string
  target_date: string | null
  skill_tags: string[]
}

export interface PendingAssignment {
  id: number
  title: string
  tutor_name: string
  due_date: string | null
  status: string
}

export interface StudentDashboardData {
  stats: {
    total_bookings: number
    upcoming_sessions: number
    completed_sessions: number
    wallet_balance: number
    active_goals: number
    pending_assignments: number
  }
  upcoming_sessions: UpcomingSession[]
  recent_bookings: RecentBooking[]
  active_goals: ActiveGoal[]
  pending_assignments: PendingAssignment[]
}

export interface RecentEarning {
  id: number
  student_name: string
  subject: string
  date: string
  gross_amount: number
  platform_fee: number
  payout: number
  status: string
}

export interface PendingReview {
  id: number
  student_name: string
  rating: number
  comment: string
  created_at: string
  has_responded: boolean
}

export interface TutorDashboardData {
  stats: {
    total_students: number
    upcoming_sessions: number
    completed_sessions: number
    total_earnings: number
    pending_payout: number
    average_rating: number
    total_reviews: number
    verification_status: string
  }
  upcoming_sessions: UpcomingSession[]
  recent_earnings: RecentEarning[]
  pending_reviews: PendingReview[]
  unread_messages: number
}

export interface PendingVerification {
  id: number
  tutor_name: string
  email: string
  submitted_at: string
  document_count: number
}

export interface AdminRecentBooking {
  id: number
  student_name: string
  tutor_name: string
  subject: string
  date: string
  amount: number
  status: string
}

export interface RecentReport {
  id: number
  content_type: string
  reason: string
  reporter_name: string
  created_at: string
  status: string
}

export interface AdminDashboardData {
  stats: {
    total_students: number
    total_tutors: number
    total_bookings: number
    total_revenue: number
    pending_verifications: number
    open_reports: number
    active_sessions_now: number
  }
  pending_verifications: PendingVerification[]
  recent_bookings: AdminRecentBooking[]
  recent_reports: RecentReport[]
  revenue_last_7_days: { date: string; revenue: number }[]
}

export interface ChildSummary {
  id: number
  name: string
  avatar_url: string | null
  upcoming_sessions: number
  pending_assignments: number
  last_session_date: string | null
}

export interface PendingApproval {
  id: number
  child_name: string
  tutor_name: string
  subject: string
  date: string
  start_time: string
  amount: number
  booking_id: number
}

export interface RecentActivity {
  type: 'booking' | 'session' | 'payment'
  child_name: string
  description: string
  date: string
  amount: number | null
}

export interface GuardianDashboardData {
  stats: {
    linked_children: number
    pending_approvals: number
    this_month_spending: number
    monthly_limit: number | null
  }
  children: ChildSummary[]
  pending_approvals: PendingApproval[]
  recent_activity: RecentActivity[]
}

export interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  badge?: number
}
