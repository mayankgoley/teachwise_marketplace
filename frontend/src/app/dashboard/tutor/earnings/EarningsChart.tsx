'use client'

import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import SectionCard from '@/components/ui/SectionCard'
import type { MonthlyEarning } from '@/types/search'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface EarningsChartProps {
  data: MonthlyEarning[]
}

export default function EarningsChart({ data }: EarningsChartProps) {
  const chartData = {
    labels: data.map((d) => d.label),
    datasets: [
      {
        label: 'Gross',
        data: data.map((d) => d.gross),
        backgroundColor: 'rgba(79,142,255,0.6)',
        borderRadius: 4,
      },
      {
        label: 'Fee',
        data: data.map((d) => d.fee),
        backgroundColor: 'rgba(226,75,74,0.6)',
        borderRadius: 4,
      },
      {
        label: 'Payout',
        data: data.map((d) => d.payout),
        backgroundColor: 'rgba(99,153,34,0.8)',
        borderRadius: 4,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'rgba(255,255,255,0.6)',
          usePointStyle: true,
          pointStyle: 'rectRounded',
          padding: 16,
          font: { size: 12 },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.85)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => {
            const label = ctx.dataset.label ?? ''
            const value = ctx.parsed.y ?? 0
            return `${label}: $${value.toFixed(2)}`
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 11 } },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.06)' },
        ticks: {
          color: 'rgba(255,255,255,0.4)',
          font: { size: 11 },
          callback: (value: string | number) => `$${value}`,
        },
      },
    },
  }

  return (
    <SectionCard title="Earnings — Last 6 Months">
      <div style={{ height: '280px' }}>
        <Bar data={chartData} options={options} />
      </div>
    </SectionCard>
  )
}
