'use client'

import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'

const ROLE_CONFIG = {
  student: {
    primary: { label: 'Find a Tutor \u2192', href: '/search' },
    secondary: { label: 'My Dashboard', href: '/dashboard/student' },
  },
  tutor: {
    primary: { label: 'My Dashboard \u2192', href: '/dashboard/tutor' },
    secondary: { label: 'Manage Availability', href: '/dashboard/tutor/availability' },
  },
  admin: {
    primary: { label: 'Admin Dashboard \u2192', href: '/dashboard/admin' },
    secondary: { label: 'View Analytics', href: '/dashboard/admin/analytics' },
  },
  guardian: {
    primary: { label: 'My Dashboard \u2192', href: '/dashboard/guardian' },
    secondary: { label: 'View Children', href: '/dashboard/guardian/children' },
  },
} as const

export default function HeroCTA() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex gap-4 flex-wrap justify-center animate-fade-up-3">
        <div
          className="animate-pulse"
          style={{
            width: 160,
            height: 52,
            borderRadius: '100px',
            background: 'rgba(255,255,255,0.06)',
          }}
        />
        <div
          className="animate-pulse"
          style={{
            width: 160,
            height: 52,
            borderRadius: '100px',
            background: 'rgba(255,255,255,0.04)',
          }}
        />
      </div>
    )
  }

  if (user) {
    const config = ROLE_CONFIG[user.user_type]
    return (
      <div className="flex gap-4 flex-wrap justify-center animate-fade-up-3">
        <Link
          href={config.primary.href}
          className="relative overflow-hidden btn-gradient text-white border-none py-4 px-9 rounded-pill font-body font-semibold text-base shadow-glow transition-[box-shadow,transform] duration-300 hover:shadow-glow-lg hover:-translate-y-0.5 no-underline"
        >
          {config.primary.label}
        </Link>
        <Link
          href={config.secondary.href}
          className="bg-transparent text-[var(--text)] border border-[rgba(255,255,255,0.15)] py-4 px-9 rounded-pill font-body font-medium text-base backdrop-blur-[8px] transition-[border-color,background,transform] duration-200 hover:border-accent hover:bg-[rgba(79,142,255,0.08)] hover:-translate-y-0.5 no-underline"
        >
          {config.secondary.label}
        </Link>
      </div>
    )
  }

  return (
    <div className="flex gap-4 flex-wrap justify-center animate-fade-up-3">
      <Link
        href="/search"
        className="relative overflow-hidden btn-gradient text-white border-none py-4 px-9 rounded-pill font-body font-semibold text-base shadow-glow transition-[box-shadow,transform] duration-300 hover:shadow-glow-lg hover:-translate-y-0.5 no-underline"
      >
        Find a Tutor &rarr;
      </Link>
      <Link
        href="/register-tutor"
        className="bg-transparent text-[var(--text)] border border-[rgba(255,255,255,0.15)] py-4 px-9 rounded-pill font-body font-medium text-base backdrop-blur-[8px] transition-[border-color,background,transform] duration-200 hover:border-accent hover:bg-[rgba(79,142,255,0.08)] hover:-translate-y-0.5 no-underline"
      >
        Become a Tutor
      </Link>
    </div>
  )
}
