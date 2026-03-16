'use client'

import { useEffect, useState } from 'react'

export default function LoadingScreen() {
  const [visible, setVisible] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    const hide = () => setVisible(false)

    // Strategy 1: already loaded
    if (document.readyState === 'complete') {
      const t = setTimeout(hide, 400)  // short delay so bar animation shows
      return () => clearTimeout(t)
    }

    // Strategy 2: wait for load event
    window.addEventListener('load', hide, { once: true })

    // Strategy 3: absolute hard fallback — ALWAYS hides after 1.5s max
    const hardFallback = setTimeout(hide, 1500)

    return () => {
      window.removeEventListener('load', hide)
      clearTimeout(hardFallback)
    }
  }, [])

  if (!visible && mounted) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#03040a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: visible ? 'all' : 'none',
      }}
    >
      {/* Logo */}
      <div style={{
        fontFamily: 'var(--font-head, serif)',
        fontSize: '2.8rem',
        fontWeight: 700,
        background: 'linear-gradient(90deg, #4f8eff, #00e5ff, #ff4fd8)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        backgroundSize: '200%',
        animation: 'tw-shimmer 2s infinite linear',
        letterSpacing: '-0.02em',
      }}>
        🎓 Teachwise
      </div>

      {/* Progress bar */}
      <div style={{
        width: '160px',
        height: '2px',
        background: 'rgba(255,255,255,0.08)',
        borderRadius: '100px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          background: 'linear-gradient(90deg, #4f8eff, #00e5ff)',
          borderRadius: '100px',
          animation: 'tw-loadbar 1.2s cubic-bezier(0.4,0,0.2,1) forwards',
        }} />
      </div>

      {/* Label */}
      <div style={{
        fontSize: '0.72rem',
        color: 'rgba(232,234,246,0.45)',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        animation: 'tw-blink 1.4s infinite',
      }}>
        Initializing your experience
      </div>

      <style>{`
        @keyframes tw-shimmer {
          0% { background-position: 0% }
          100% { background-position: 200% }
        }
        @keyframes tw-loadbar {
          0%   { width: 0% }
          50%  { width: 70% }
          100% { width: 100% }
        }
        @keyframes tw-blink {
          0%, 100% { opacity: 0.3 }
          50%       { opacity: 1 }
        }
      `}</style>
    </div>
  )
}
