'use client'

import { DollarSign } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatCurrency, formatDate } from '@/lib/format'
import type { EarningRecord } from '@/types/search'

interface EarningsHistoryTableProps {
  earnings: EarningRecord[]
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
    render: (v: unknown) => (
      <span style={{ color: 'var(--muted)' }}>
        {formatCurrency(v as number)}
      </span>
    ),
  },
  {
    key: 'platform_fee',
    label: 'Fee',
    render: (v: unknown) => (
      <span style={{ color: '#E24B4A' }}>
        -{formatCurrency(v as number)}
      </span>
    ),
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

export default function EarningsHistoryTable({ earnings }: EarningsHistoryTableProps) {
  return (
    <DataTable<EarningRecord>
      columns={columns}
      rows={earnings}
      emptyMessage="No earnings found"
      emptyIcon={<DollarSign size={22} strokeWidth={1.5} />}
    />
  )
}
