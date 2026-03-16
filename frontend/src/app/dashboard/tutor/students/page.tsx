import { cookies } from 'next/headers'
import { Users } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'
import StudentsTable from '@/components/features/tables/StudentsTable'
import type { TutorStudent } from '@/types/search'
import type { ApiResponse } from '@/lib/api'

export default async function TutorStudentsPage() {
  const cookieStore = await cookies()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

  let students: TutorStudent[] = []

  try {
    const res = await fetch(`${apiUrl}/api/v1/tutor/students`, {
      headers: { Cookie: cookieStore.toString() },
      cache: 'no-store',
    })
    const json: ApiResponse<{ students: TutorStudent[] }> = await res.json()
    if (json.success) students = json.data.students
  } catch {
    // Will show empty state
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1
          className="font-head font-bold text-[var(--text)]"
          style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
        >
          Students
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Students you&apos;ve tutored
        </p>
      </div>

      {students.length === 0 ? (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
          }}
        >
          <EmptyState
            icon={<Users size={22} strokeWidth={1.5} />}
            title="No students yet"
            description="Students will appear here after your first booking"
          />
        </div>
      ) : (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            overflow: 'hidden',
          }}
        >
          <StudentsTable students={students} />
        </div>
      )}
    </div>
  )
}
