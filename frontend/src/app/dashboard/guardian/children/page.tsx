'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Users, Loader2 } from 'lucide-react'
import { apiGet } from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate, formatCurrency } from '@/lib/format'
import type { GuardianChild } from '@/types/guardian'

export default function GuardianChildrenPage() {
  const [children, setChildren] = useState<GuardianChild[]>([])
  const [loading, setLoading] = useState(true)

  const fetchChildren = useCallback(async () => {
    try {
      const res = await apiGet<{ children: GuardianChild[] }>('/api/v1/guardian/children')
      if (res.success) {
        setChildren(res.data.children)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchChildren()
  }, [fetchChildren])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <Loader2
          size={32}
          strokeWidth={1.5}
          style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }}
        />
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '16px' }}>
          Loading children...
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1
          className="font-head font-bold text-[var(--text)]"
          style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
        >
          My Children
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Monitor your children&apos;s learning
        </p>
      </div>

      {children.length === 0 ? (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
          }}
        >
          <EmptyState
            icon={<Users size={22} strokeWidth={1.5} />}
            title="No children linked"
            description="Your linked children will appear here once they are added to your account."
          />
        </div>
      ) : (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
        >
          {children.map((child) => (
            <div
              key={child.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '20px',
                padding: '24px',
              }}
            >
              {/* Name & email */}
              <div style={{ marginBottom: '16px' }}>
                <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                  <h3
                    className="font-head font-bold text-[var(--text)]"
                    style={{ fontSize: '1.1rem', margin: 0 }}
                  >
                    {child.name}
                  </h3>
                  {child.is_minor && (
                    <span
                      style={{
                        background: 'rgba(127,119,221,0.15)',
                        color: '#7F77DD',
                        padding: '2px 8px',
                        borderRadius: '100px',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                      }}
                    >
                      Minor
                    </span>
                  )}
                </div>
                <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: 0 }}>
                  {child.email}
                </p>
              </div>

              {/* Details */}
              <div
                className="flex items-center gap-4 flex-wrap"
                style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '16px' }}
              >
                {child.grade_level && (
                  <span>Grade: {child.grade_level}</span>
                )}
                {child.date_of_birth && (
                  <span>DOB: {formatDate(child.date_of_birth)}</span>
                )}
              </div>

              {/* Stats */}
              <div
                className="flex items-center gap-6"
                style={{
                  padding: '12px 0',
                  borderTop: '1px solid var(--border)',
                  marginBottom: '12px',
                }}
              >
                <div>
                  <span
                    className="font-head font-bold text-[var(--text)]"
                    style={{ fontSize: '1.3rem' }}
                  >
                    {child.booking_count}
                  </span>
                  <span
                    style={{
                      color: 'var(--muted)',
                      fontSize: '0.72rem',
                      display: 'block',
                    }}
                  >
                    Bookings
                  </span>
                </div>
                <div>
                  <span
                    className="font-head font-bold text-[var(--text)]"
                    style={{ fontSize: '1.3rem' }}
                  >
                    {formatCurrency(child.total_spent)}
                  </span>
                  <span
                    style={{
                      color: 'var(--muted)',
                      fontSize: '0.72rem',
                      display: 'block',
                    }}
                  >
                    Spent
                  </span>
                </div>
              </div>

              {/* View Activity link */}
              <Link
                href={`/dashboard/guardian/children/${child.id}/activity`}
                style={{
                  color: 'var(--accent)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                View Activity
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
