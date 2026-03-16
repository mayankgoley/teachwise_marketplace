'use client'

import { CalendarDays } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatCurrency, formatDate } from '@/lib/format'
import type { RecentBooking } from '@/types/dashboard'

interface RecentBookingsTableProps {
  bookings: RecentBooking[]
}

const columns = [
  { key: 'tutor_name', label: 'Tutor' },
  { key: 'subject', label: 'Subject' },
  {
    key: 'date',
    label: 'Date',
    render: (v: unknown) => formatDate(v as string),
  },
  {
    key: 'amount',
    label: 'Amount',
    render: (v: unknown) => formatCurrency(v as number),
  },
  {
    key: 'status',
    label: 'Status',
    render: (v: unknown) => <StatusBadge status={v as string} />,
  },
]

export default function RecentBookingsTable({ bookings }: RecentBookingsTableProps) {
  return (
    <DataTable<RecentBooking>
      columns={columns}
      rows={bookings}
      emptyMessage="No bookings yet"
      emptyIcon={<CalendarDays size={22} strokeWidth={1.5} />}
    />
  )
}
