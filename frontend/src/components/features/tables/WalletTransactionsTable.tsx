'use client'

import { CreditCard } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatCurrency, formatRelativeTime } from '@/lib/format'
import type { WalletTransaction } from '@/types/search'

interface WalletTransactionsTableProps {
  transactions: WalletTransaction[]
}

const columns = [
  {
    key: 'type',
    label: 'Type',
    width: '120px',
    render: (value: unknown) => <StatusBadge status={value as string} />,
  },
  {
    key: 'description',
    label: 'Description',
  },
  {
    key: 'amount',
    label: 'Amount',
    width: '120px',
    render: (value: unknown, row: WalletTransaction) => {
      const amount = value as number
      const isPositive = row.type === 'topup' || row.type === 'refund' || row.type === 'bonus'
      return (
        <span
          style={{
            color: isPositive ? '#639922' : '#E24B4A',
            fontWeight: 600,
            fontSize: '0.875rem',
          }}
        >
          {isPositive ? '+' : '-'}{formatCurrency(Math.abs(amount))}
        </span>
      )
    },
  },
  {
    key: 'balance_after',
    label: 'Balance After',
    width: '130px',
    render: (value: unknown) => formatCurrency(value as number),
  },
  {
    key: 'created_at',
    label: 'Date',
    width: '120px',
    render: (value: unknown) => (
      <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
        {formatRelativeTime(value as string)}
      </span>
    ),
  },
]

export default function WalletTransactionsTable({ transactions }: WalletTransactionsTableProps) {
  return (
    <DataTable<WalletTransaction>
      columns={columns}
      rows={transactions}
      emptyMessage="No transactions found"
      emptyIcon={<CreditCard size={22} strokeWidth={1.5} />}
    />
  )
}
