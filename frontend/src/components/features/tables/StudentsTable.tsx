'use client'

import { Users } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import Avatar from '@/components/ui/Avatar'
import { formatCurrency, formatDate } from '@/lib/format'
import type { TutorStudent } from '@/types/search'

interface StudentsTableProps {
  students: TutorStudent[]
}

const columns = [
  {
    key: 'name',
    label: 'Student',
    render: (_v: unknown, row: TutorStudent) => (
      <div className="flex items-center gap-3">
        <Avatar
          name={row.name}
          avatarUrl={row.avatar_url}
          size="sm"
        />
        <span style={{ fontWeight: 500 }}>{row.name}</span>
      </div>
    ),
  },
  {
    key: 'subjects',
    label: 'Subjects',
    render: (v: unknown) => {
      const subjects = v as string[]
      return (
        <div className="flex flex-wrap gap-1">
          {subjects.map((s) => (
            <span
              key={s}
              style={{
                fontSize: '0.72rem',
                padding: '3px 10px',
                borderRadius: '100px',
                background: 'rgba(79,142,255,0.12)',
                color: '#4f8eff',
                fontWeight: 500,
              }}
            >
              {s}
            </span>
          ))}
        </div>
      )
    },
  },
  {
    key: 'total_sessions',
    label: 'Sessions',
  },
  {
    key: 'last_session_date',
    label: 'Last Session',
    render: (v: unknown) => formatDate(v as string),
  },
  {
    key: 'total_spent',
    label: 'Total Spent',
    render: (v: unknown) => (
      <span style={{ fontWeight: 600, color: '#639922' }}>
        {formatCurrency(v as number)}
      </span>
    ),
  },
]

export default function StudentsTable({ students }: StudentsTableProps) {
  return (
    <DataTable<TutorStudent>
      columns={columns}
      rows={students}
      emptyMessage="No students found"
      emptyIcon={<Users size={22} strokeWidth={1.5} />}
    />
  )
}
