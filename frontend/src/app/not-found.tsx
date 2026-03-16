import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg, #03040a)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '20px',
      fontFamily: 'var(--font-body, sans-serif)',
    }}>
      <div style={{
        fontFamily: 'var(--font-head, serif)',
        fontSize: '8rem',
        fontWeight: 700,
        background: 'linear-gradient(135deg, #4f8eff, #00e5ff)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        lineHeight: 1,
      }}>
        404
      </div>
      <h2 style={{
        color: 'var(--text, #e8eaf6)',
        fontFamily: 'var(--font-head, serif)',
        fontSize: '2rem',
        fontWeight: 700,
        margin: 0,
      }}>
        Page not found
      </h2>
      <p style={{
        color: 'var(--muted, rgba(232,234,246,0.68))',
        fontSize: '1rem',
        maxWidth: '360px',
        textAlign: 'center',
        margin: 0,
      }}>
        This page is still being built as part of the Teachwise migration.
      </p>
      <Link href="/" style={{
        background: 'linear-gradient(135deg, #4f8eff, #00e5ff)',
        color: '#fff',
        padding: '14px 32px',
        borderRadius: '100px',
        textDecoration: 'none',
        fontWeight: 600,
        fontSize: '0.95rem',
      }}>
        &larr; Back to Homepage
      </Link>
    </div>
  )
}
