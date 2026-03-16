'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const NAV_LINKS = [
  { label: 'Search', href: '/search' },
  { label: 'Categories', href: '/categories' },
  { label: 'Features', href: '/features' },
] as const

export default function NavBar() {
  const { user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const dashboardHref = user ? `/dashboard/${user.user_type}` : null

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(var(--bg-rgb, 10,10,18), 0.8)',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          className="font-head"
          style={{
            fontWeight: 800,
            fontSize: '1.2rem',
            color: 'var(--text)',
            textDecoration: 'none',
          }}
        >
          Teachwise
        </Link>

        {/* Desktop nav */}
        <div
          className="hidden md:flex items-center"
          style={{ gap: '32px' }}
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                color: 'var(--muted)',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: 500,
                transition: 'color 0.2s',
              }}
            >
              {link.label}
            </Link>
          ))}

          {user ? (
            <Link
              href={dashboardHref!}
              className="btn-gradient"
              style={{
                padding: '8px 20px',
                borderRadius: '100px',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#fff',
                textDecoration: 'none',
              }}
            >
              Dashboard
            </Link>
          ) : (
            <div className="flex items-center" style={{ gap: '12px' }}>
              <Link
                href="/login"
                style={{
                  color: 'var(--muted)',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="btn-gradient"
                style={{
                  padding: '8px 20px',
                  borderRadius: '100px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#fff',
                  textDecoration: 'none',
                }}
              >
                Sign up
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text)',
            cursor: 'pointer',
            padding: '4px',
          }}
          aria-label="Toggle menu"
        >
          {menuOpen ? (
            <X size={24} strokeWidth={1.5} />
          ) : (
            <Menu size={24} strokeWidth={1.5} />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="md:hidden"
          style={{
            padding: '16px 24px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              style={{
                color: 'var(--muted)',
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: 500,
              }}
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <Link
              href={dashboardHref!}
              onClick={() => setMenuOpen(false)}
              style={{
                color: 'var(--accent)',
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                style={{
                  color: 'var(--muted)',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                }}
              >
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={() => setMenuOpen(false)}
                style={{
                  color: 'var(--accent)',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                }}
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
