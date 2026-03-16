import { cookies } from 'next/headers'
import { DollarSign, Wallet, TrendingUp, BarChart3 } from 'lucide-react'
import StatCard from '@/components/ui/StatCard'
import SectionCard from '@/components/ui/SectionCard'
import EarningsHistoryTable from '@/components/features/tables/EarningsHistoryTable'
import EmptyState from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/format'
import ConnectStripeButton from './ConnectStripeButton'
import EarningsChart from './EarningsChart'
import type { EarningRecord, MonthlyEarning } from '@/types/search'
import type { ApiResponse } from '@/lib/api'

interface EarningsResponse {
  summary: { total_earned: number; pending_payout: number; this_month: number; last_month: number }
  stripe: { connected: boolean; onboarding_url: string | null }
  earnings: EarningRecord[]
  monthly_chart: MonthlyEarning[]
}

export default async function TutorEarningsPage() {
  const cookieStore = await cookies()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

  let data: EarningsResponse | null = null

  try {
    const res = await fetch(`${apiUrl}/api/v1/tutor/earnings`, {
      headers: { Cookie: cookieStore.toString() },
      cache: 'no-store',
    })
    const json: ApiResponse<EarningsResponse> = await res.json()
    if (json.success) data = json.data
  } catch {
    // Will show error state
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          Failed to load earnings data. Please refresh the page.
        </p>
      </div>
    )
  }

  const { summary, stripe, earnings: history, monthly_chart: monthly } = data

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1
          className="font-head font-bold text-[var(--text)]"
          style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
        >
          Earnings
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Track your income and payouts
        </p>
      </div>

      {/* Stripe Connect Banner */}
      {!stripe.connected && stripe.onboarding_url && (
        <div
          className="flex items-center justify-between mb-6"
          style={{
            background: 'rgba(79,142,255,0.08)',
            border: '1px solid rgba(79,142,255,0.25)',
            borderRadius: '14px',
            padding: '20px 24px',
          }}
        >
          <div>
            <p
              className="text-[var(--text)]"
              style={{ fontWeight: 600, margin: '0 0 4px', fontSize: '0.95rem' }}
            >
              Connect your payout account
            </p>
            <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: 0 }}>
              Set up Stripe to receive your earnings directly to your bank account.
            </p>
          </div>
          <ConnectStripeButton onboardingUrl={stripe.onboarding_url!} />
        </div>
      )}

      {/* Stats grid */}
      <div
        className="grid gap-4 mb-8"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        }}
      >
        <StatCard
          label="Total Earned"
          value={formatCurrency(summary.total_earned)}
          icon={<DollarSign size={22} strokeWidth={1.5} />}
          color="green"
        />
        <StatCard
          label="Pending Payout"
          value={formatCurrency(summary.pending_payout)}
          icon={<Wallet size={22} strokeWidth={1.5} />}
          color="amber"
        />
        <StatCard
          label="This Month"
          value={formatCurrency(summary.this_month)}
          icon={<TrendingUp size={22} strokeWidth={1.5} />}
          color="blue"
        />
        <StatCard
          label="Last Month"
          value={formatCurrency(summary.last_month)}
          icon={<BarChart3 size={22} strokeWidth={1.5} />}
          color="purple"
        />
      </div>

      {/* Chart */}
      {monthly.length > 0 && (
        <div className="mb-6">
          <EarningsChart data={monthly} />
        </div>
      )}

      {/* Earnings History Table */}
      <SectionCard title="Earnings History" noPadding>
        {history.length === 0 ? (
          <EmptyState
            icon={<DollarSign size={22} strokeWidth={1.5} />}
            title="No earnings yet"
            description="Your completed session earnings will appear here"
          />
        ) : (
          <EarningsHistoryTable earnings={history} />
        )}
      </SectionCard>
    </div>
  )
}
