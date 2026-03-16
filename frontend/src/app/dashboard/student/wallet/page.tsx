import { cookies } from 'next/headers'
import { Wallet, CreditCard } from 'lucide-react'
import WalletTransactionsTable from '@/components/features/tables/WalletTransactionsTable'
import EmptyState from '@/components/ui/EmptyState'
import SectionCard from '@/components/ui/SectionCard'
import { formatCurrency } from '@/lib/format'
import type { WalletData } from '@/types/search'
import type { ApiResponse } from '@/lib/api'
import TopUpButton from './TopUpButton'

interface WalletPageProps {
  searchParams: Promise<{ topup?: string }>
}

export default async function StudentWalletPage({ searchParams }: WalletPageProps) {
  const params = await searchParams
  const cookieStore = await cookies()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

  let walletData: WalletData | null = null

  try {
    const res = await fetch(`${apiUrl}/api/v1/student/wallet`, {
      headers: { Cookie: cookieStore.toString() },
      cache: 'no-store',
    })
    const json: ApiResponse<WalletData> = await res.json()
    if (json.success) walletData = json.data
  } catch {
    // Will show error state
  }

  if (!walletData) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          Failed to load wallet data. Please refresh the page.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Success banner */}
      {params.topup === 'success' && (
        <div
          style={{
            background: 'rgba(99,153,34,0.12)',
            border: '1px solid rgba(99,153,34,0.25)',
            borderRadius: '12px',
            padding: '14px 20px',
            marginBottom: '24px',
            fontSize: '0.9rem',
            color: '#639922',
            fontWeight: 500,
          }}
        >
          Wallet topped up successfully! Your balance has been updated.
        </div>
      )}

      {/* Page header */}
      <div style={{ marginBottom: '24px' }}>
        <h1
          className="font-head font-bold text-[var(--text)]"
          style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
        >
          Wallet
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Manage your balance and view transaction history
        </p>
      </div>

      {/* Balance hero card */}
      <div
        style={{
          position: 'relative',
          borderRadius: '20px',
          padding: '1px',
          background: 'linear-gradient(135deg, var(--accent), var(--accent2), var(--accent3))',
          marginBottom: '32px',
        }}
      >
        <div
          className="flex flex-col items-center justify-center"
          style={{
            background: 'var(--surface)',
            borderRadius: '19px',
            padding: '48px 24px',
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(79,142,255,0.1)',
              marginBottom: '20px',
            }}
          >
            <Wallet size={28} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
          </div>

          <p
            style={{
              color: 'var(--muted)',
              fontSize: '0.82rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              margin: '0 0 8px',
            }}
          >
            Available Balance
          </p>

          <div className="flex items-baseline gap-2" style={{ marginBottom: '8px' }}>
            <span
              className="font-head text-gradient"
              style={{
                fontSize: '3.5rem',
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {formatCurrency(walletData.balance)}
            </span>
          </div>

          <p
            style={{
              color: 'var(--muted)',
              fontSize: '0.82rem',
              margin: '0 0 28px',
            }}
          >
            {walletData.currency}
          </p>

          <TopUpButton />
        </div>
      </div>

      {/* Transaction history */}
      <SectionCard title="Transaction History" noPadding>
        {walletData.transactions.length === 0 ? (
          <EmptyState
            icon={<CreditCard size={22} strokeWidth={1.5} />}
            title="No transactions yet"
            description="Top up your wallet to get started with booking sessions"
          />
        ) : (
          <WalletTransactionsTable transactions={walletData.transactions} />
        )}
      </SectionCard>
    </div>
  )
}
