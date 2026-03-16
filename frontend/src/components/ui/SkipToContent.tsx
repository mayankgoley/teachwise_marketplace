'use client'

export default function SkipToContent() {
  return (
    <a
      href="#main-content"
      style={{
        position: 'absolute',
        top: '-100%',
        left: '16px',
        background: 'var(--accent)',
        color: '#fff',
        padding: '8px 16px',
        borderRadius: '8px',
        fontWeight: 600,
        zIndex: 9999,
        textDecoration: 'none',
        transition: 'top 0.1s',
      }}
      onFocus={(e) => {
        e.currentTarget.style.top = '16px'
      }}
      onBlur={(e) => {
        e.currentTarget.style.top = '-100%'
      }}
    >
      Skip to main content
    </a>
  )
}
