export interface RescheduleRequestData {
  id: number
  booking_id: number
  initiated_by: 'tutor' | 'student'
  tutor_name: string
  subject: string
  original_date: string
  original_start_time: string
  original_end_time: string
  proposed_date: string
  proposed_start_time: string
  proposed_end_time: string
  reason: string | null
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  expires_at: string
  action_required: boolean
}
