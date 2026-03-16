'use client'

import { DollarSign } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatCurrency, formatDate } from '@/lib/format'
import type { RecentEarning } from '@/types/dashboard'

interface RecentEarningsTableProps {
  earnings: RecentEarning[]
}

const columns = [
  { key: 'student_name', label: 'Student' },
  { key: 'subject', label: 'Subject' },
  {
    key: 'date',
    label: 'Date',
    render: (v: unknown) => formatDate(v as string),
  },
  {
    key: 'gross_amount',
    label: 'Gross',
    render: (v: unknown) => formatCurrency(v as number),
  },
  {
    key: 'platform_fee',
    label: 'Fee (15%)',
    render: (v: unknown) => formatCurrency(v as number),
  },
  {
    key: 'payout',
    label: 'Payout',
    render: (v: unknown) => (
      <span style={{ fontWeight: 600, color: '#639922' }}>
        {formatCurrency(v as number)}
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    render: (v: unknown) => <StatusBadge status={v as string} />,
  },
]

export default function RecentEarningsTable({ earnings }: RecentEarningsTableProps) {
  return (
    <DataTable<RecentEarning>
      columns={columns}
      rows={earnings}
      emptyMessage="No earnings yet"
      emptyIcon={<DollarSign size={22} strokeWidth={1.5} />}
    />
  )
}
