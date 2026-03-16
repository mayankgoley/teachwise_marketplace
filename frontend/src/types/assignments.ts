export interface AssignmentFile {
  name: string
  key: string
  encryption_key: string
}

export interface Submission {
  id: number
  assignment_id: number
  student_id: number
  text_response: string | null
  file_count: number
  submitted_at: string | null
  grade: string | null
  feedback: string | null
  reviewed_at: string | null
  status: 'draft' | 'submitted' | 'graded' | 'returned'
  rubric_scores: RubricScore[] | null
  is_late: boolean
  resubmission_count: number
}

export interface RubricCriterion {
  criterion: string
  max_points: number
  description?: string
}

export interface RubricScore {
  criterion: string
  score: number
  max_points: number
}

export interface Assignment {
  id: number
  title: string
  description: string | null
  subject: string | null
  due_date: string | null
  status: 'assigned' | 'submitted' | 'reviewed' | 'overdue' | 'returned'
  created_at: string | null
  tutor_id: number
  tutor_name: string | null
  tutor_avatar_url: string | null
  student_id: number
  student_name: string | null
  file_count: number
  rubric: RubricCriterion[] | null
  allow_late_submission: boolean
  grace_period_hours: number
  late_penalty_percent: number
  allow_resubmission: boolean
  max_resubmissions: number
  submission?: Submission | null
  files?: AssignmentFile[]
}
