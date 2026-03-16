'use client'

import { useState } from 'react'
import TopUpModal from './TopUpModal'

export default function TopUpButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-gradient"
        style={{
          padding: '12px 32px',
          borderRadius: '100px',
          fontSize: '0.9rem',
          fontWeight: 600,
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.9'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1'
        }}
      >
        Top Up Wallet
      </button>

      <TopUpModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
