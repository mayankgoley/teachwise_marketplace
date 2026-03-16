export interface ProgressEntry {
  id: number
  goal_id: number
  note: string
  rating: number | null
  created_by: 'student' | 'tutor'
  created_at: string | null
  slot_id: number | null
}

export interface LearningGoal {
  id: number
  title: string
  description: string | null
  status: 'active' | 'completed' | 'paused'
  target_date: string | null
  skill_tags: string[]
  created_at: string | null
  tutor_id: number
  tutor_name: string | null
  tutor_avatar_url: string | null
  student_id: number
  entry_count: number
  latest_rating: number | null
  entries?: ProgressEntry[]
}

export interface ChartDataPoint {
  date: string | null
  rating: number
  goal_id: number
  note: string | null
}

export interface GoalSummary {
  id: number
  title: string
  status: string
  entry_count: number
  average_rating: number | null
  latest_rating: number | null
  target_date: string | null
  skill_tags: string[]
}

export interface ProgressReport {
  student_name: string
  total_goals: number
  completed_goals: number
  active_goals: number
  paused_goals: number
  goals: GoalSummary[]
  generated_at: string
}
