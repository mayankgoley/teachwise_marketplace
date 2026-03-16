'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Wallet, Loader2 } from 'lucide-react'
import { apiPost } from '@/lib/api'

interface TopUpModalProps {
  isOpen: boolean
  onClose: () => void
}

const PRESET_AMOUNTS = [10, 25, 50, 100]
const MIN_AMOUNT = 5
const MAX_AMOUNT = 500

export default function TopUpModal({ isOpen, onClose }: TopUpModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<number | null>(25)
  const [customAmount, setCustomAmount] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setSelectedPreset(25)
      setCustomAmount('')
      setError('')
      setLoading(false)
    }
  }, [isOpen])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  const getAmount = (): number => {
    if (customAmount.trim() !== '') {
      return parseFloat(customAmount)
    }
    return selectedPreset ?? 0
  }

  const handlePresetClick = (amount: number) => {
    setSelectedPreset(amount)
    setCustomAmount('')
    setError('')
  }

  const handleCustomChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '')
    const parts = cleaned.split('.')
    const sanitized = parts.length > 2
      ? parts[0] + '.' + parts.slice(1).join('')
      : cleaned

    setCustomAmount(sanitized)
    setSelectedPreset(null)
    setError('')
  }

  const validate = (): boolean => {
    const amount = getAmount()
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount')
      return false
    }
    if (amount < MIN_AMOUNT) {
      setError(`Minimum top-up amount is $${MIN_AMOUNT}`)
      return false
    }
    if (amount > MAX_AMOUNT) {
      setError(`Maximum top-up amount is $${MAX_AMOUNT}`)
      return false
    }
    return true
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setLoading(true)
    setError('')

    try {
      const amount = getAmount()
      const res = await apiPost<{ checkout_url: string }>('/api/v1/student/wallet/topup', {
        amount,
      })

      if (res.success && res.data.checkout_url) {
        window.location.href = res.data.checkout_url
      } else {
        setError(res.error?.message ?? 'Failed to create checkout session. Please try again.')
        setLoading(false)
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const currentAmount = getAmount()
  const isValidAmount =
    !isNaN(currentAmount) &&
    currentAmount >= MIN_AMOUNT &&
    currentAmount <= MAX_AMOUNT

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '440px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(79,142,255,0.1)',
              }}
            >
              <Wallet size={18} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
            </div>
            <h3
              className="font-head font-bold text-[var(--text)]"
              style={{ fontSize: '1.1rem', margin: 0 }}
            >
              Top Up Wallet
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none'
            }}
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          {/* Preset amounts */}
          <label
            style={{
              display: 'block',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--muted)',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Select Amount
          </label>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '20px' }}>
            {PRESET_AMOUNTS.map((amount) => {
              const isSelected = selectedPreset === amount && customAmount.trim() === ''
              return (
                <button
                  key={amount}
                  onClick={() => handlePresetClick(amount)}
                  style={{
                    padding: '12px 8px',
                    borderRadius: '100px',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    border: isSelected ? 'none' : '1px solid var(--border)',
                    background: isSelected
                      ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
                      : 'transparent',
                    color: isSelected ? '#fff' : 'var(--text)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'var(--accent)'
                      e.currentTarget.style.background = 'rgba(79,142,255,0.06)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'var(--border)'
                      e.currentTarget.style.background = 'transparent'
                    }
                  }}
                >
                  ${amount}
                </button>
              )
            })}
          </div>

          {/* Custom amount */}
          <label
            style={{
              display: 'block',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--muted)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Or Enter Custom Amount
          </label>
          <div
            className="flex items-center"
            style={{
              border: '1px solid var(--border)',
              borderRadius: '12px',
              overflow: 'hidden',
              marginBottom: '8px',
              transition: 'border-color 0.2s',
            }}
          >
            <span
              style={{
                padding: '12px 0 12px 16px',
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--muted)',
              }}
            >
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Enter amount"
              value={customAmount}
              onChange={(e) => handleCustomChange(e.target.value)}
              style={{
                flex: 1,
                padding: '12px 16px 12px 8px',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '1rem',
                color: 'var(--text)',
              }}
            />
          </div>
          <p
            style={{
              fontSize: '0.75rem',
              color: 'var(--muted)',
              margin: '0 0 20px',
            }}
          >
            Min ${MIN_AMOUNT} &mdash; Max ${MAX_AMOUNT}
          </p>

          {/* Error */}
          {error && (
            <div
              style={{
                background: 'rgba(226,75,74,0.1)',
                border: '1px solid rgba(226,75,74,0.2)',
                borderRadius: '10px',
                padding: '10px 14px',
                marginBottom: '16px',
                fontSize: '0.82rem',
                color: '#E24B4A',
              }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || !isValidAmount}
            className="btn-gradient"
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#fff',
              border: 'none',
              cursor: loading || !isValidAmount ? 'not-allowed' : 'pointer',
              opacity: loading || !isValidAmount ? 0.5 : 1,
              transition: 'opacity 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {loading ? (
              <>
                <Loader2 size={18} strokeWidth={1.5} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Proceed to Payment
                {isValidAmount && (
                  <span style={{ opacity: 0.8 }}>
                    &mdash; ${currentAmount.toFixed(2)}
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
