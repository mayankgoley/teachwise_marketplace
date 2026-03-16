'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  TrendingUp,
  MessageSquare,
  Bell,
  Users,
  DollarSign,
  FileText,
  BarChart3,
  CheckCircle,
  Shield,
  Settings,
  ScrollText,
  Target,
  Menu,
  LogOut,
  X,
  Wallet,
  UserCircle,
  CreditCard,
  RefreshCw,
  Video,
  Search,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import Avatar from '@/components/ui/Avatar'
import type { UserRole } from '@/types/auth'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  badge?: number
}

function getNavItems(role: UserRole): NavItem[] {
  switch (role) {
    case 'student':
      return [
        { label: 'Dashboard', href: '/dashboard/student', icon: <LayoutDashboard size={18} strokeWidth={1.5} /> },
        { label: 'Find Tutors', href: '/search', icon: <Search size={18} strokeWidth={1.5} /> },
        { label: 'Bookings', href: '/dashboard/student/bookings', icon: <CalendarDays size={18} strokeWidth={1.5} /> },
        { label: 'Assignments', href: '/dashboard/student/assignments', icon: <ClipboardList size={18} strokeWidth={1.5} /> },
        { label: 'Progress', href: '/dashboard/student/progress', icon: <Target size={18} strokeWidth={1.5} /> },
        { label: 'Messages', href: '/dashboard/student/messages', icon: <MessageSquare size={18} strokeWidth={1.5} /> },
        { label: 'Wallet', href: '/dashboard/student/wallet', icon: <Wallet size={18} strokeWidth={1.5} /> },
        { label: 'Notifications', href: '/dashboard/student/notifications', icon: <Bell size={18} strokeWidth={1.5} /> },
        { label: 'Profile', href: '/dashboard/student/profile', icon: <UserCircle size={18} strokeWidth={1.5} /> },
        { label: 'Settings', href: '/dashboard/student/settings', icon: <Settings size={18} strokeWidth={1.5} /> },
      ]
    case 'tutor':
      return [
        { label: 'Dashboard', href: '/dashboard/tutor', icon: <LayoutDashboard size={18} strokeWidth={1.5} /> },
        { label: 'Students', href: '/dashboard/tutor/students', icon: <Users size={18} strokeWidth={1.5} /> },
        { label: 'Availability', href: '/dashboard/tutor/availability', icon: <CalendarDays size={18} strokeWidth={1.5} /> },
        { label: 'Assignments', href: '/dashboard/tutor/assignments', icon: <ClipboardList size={18} strokeWidth={1.5} /> },
        { label: 'Earnings', href: '/dashboard/tutor/earnings', icon: <DollarSign size={18} strokeWidth={1.5} /> },
        { label: 'Messages', href: '/dashboard/tutor/messages', icon: <MessageSquare size={18} strokeWidth={1.5} /> },
        { label: 'Profile', href: '/dashboard/tutor/profile', icon: <UserCircle size={18} strokeWidth={1.5} /> },
        { label: 'Documents', href: '/dashboard/tutor/documents', icon: <FileText size={18} strokeWidth={1.5} /> },
        { label: 'Reschedule Requests', href: '/dashboard/tutor/reschedule-requests', icon: <RefreshCw size={18} strokeWidth={1.5} /> },
        { label: 'Notifications', href: '/dashboard/tutor/notifications', icon: <Bell size={18} strokeWidth={1.5} /> },
      ]
    case 'admin':
      return [
        { label: 'Dashboard', href: '/dashboard/admin', icon: <LayoutDashboard size={18} strokeWidth={1.5} /> },
        { label: 'Users', href: '/dashboard/admin/users', icon: <Users size={18} strokeWidth={1.5} /> },
        { label: 'Bookings', href: '/dashboard/admin/bookings', icon: <CalendarDays size={18} strokeWidth={1.5} /> },
        { label: 'Verification', href: '/dashboard/admin/verification', icon: <CheckCircle size={18} strokeWidth={1.5} /> },
        { label: 'Analytics', href: '/dashboard/admin/analytics', icon: <BarChart3 size={18} strokeWidth={1.5} /> },
        { label: 'Moderation', href: '/dashboard/admin/moderation', icon: <Shield size={18} strokeWidth={1.5} /> },
        { label: 'Recordings', href: '/dashboard/admin/recordings', icon: <Video size={18} strokeWidth={1.5} /> },
        { label: 'Audit Log', href: '/dashboard/admin/audit', icon: <ScrollText size={18} strokeWidth={1.5} /> },
        { label: 'Settings', href: '/dashboard/admin/settings', icon: <Settings size={18} strokeWidth={1.5} /> },
      ]
    case 'guardian':
      return [
        { label: 'Dashboard', href: '/dashboard/guardian', icon: <LayoutDashboard size={18} strokeWidth={1.5} /> },
        { label: 'Children', href: '/dashboard/guardian/children', icon: <Users size={18} strokeWidth={1.5} /> },
        { label: 'Approvals', href: '/dashboard/guardian/approvals', icon: <CheckCircle size={18} strokeWidth={1.5} /> },
        { label: 'Activity', href: '/dashboard/guardian/activity', icon: <TrendingUp size={18} strokeWidth={1.5} /> },
        { label: 'Spending', href: '/dashboard/guardian/spending', icon: <CreditCard size={18} strokeWidth={1.5} /> },
        { label: 'Messages', href: '/dashboard/guardian/messages', icon: <MessageSquare size={18} strokeWidth={1.5} /> },
        { label: 'Notifications', href: '/dashboard/guardian/notifications', icon: <Bell size={18} strokeWidth={1.5} /> },
      ]
  }
}

const roleTitles: Record<UserRole, string> = {
  student: 'Student',
  tutor: 'Tutor',
  admin: 'Admin',
  guardian: 'Guardian',
}

interface DashboardLayoutProps {
  children: React.ReactNode
  role: UserRole
  userName: string
  userEmail: string
  userAvatar?: string | null
}

export default function DashboardLayout({
  children,
  role,
  userName,
  userEmail,
  userAvatar,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { logout } = useAuth()
  const navItems = getNavItems(role)

  const isActive = (href: string) => {
    if (href === `/dashboard/${role}`) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          width: '240px',
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-2 px-5 flex-shrink-0"
          style={{
            height: '68px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Link
            href="/"
            className="flex items-center gap-2"
            style={{ textDecoration: 'none' }}
          >
            <span style={{ fontSize: '1.3rem' }}>🎓</span>
            <span
              className="font-head font-bold text-[var(--text)]"
              style={{ fontSize: '1.1rem' }}
            >
              Teachwise
            </span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="ml-auto lg:hidden"
            style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Nav links */}
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto py-3 px-3">
          {navItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 no-underline rounded-lg mb-1 transition-colors duration-150"
                style={{
                  padding: '10px 12px',
                  color: active ? 'var(--text)' : 'var(--muted)',
                  background: active ? 'rgba(79,142,255,0.08)' : 'transparent',
                  borderLeft: active
                    ? '2px solid var(--accent)'
                    : '2px solid transparent',
                  fontSize: '0.875rem',
                  fontWeight: active ? 500 : 400,
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                    e.currentTarget.style.color = 'var(--text)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'var(--muted)'
                  }
                }}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className="flex items-center justify-center text-white font-semibold"
                    style={{
                      background: 'var(--accent)',
                      borderRadius: '100px',
                      fontSize: '0.65rem',
                      minWidth: '20px',
                      height: '20px',
                      padding: '0 6px',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div
          className="flex items-center gap-3 px-4 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <Avatar name={userName} avatarUrl={userAvatar} size="md" />
          <div className="flex-1 min-w-0">
            <p
              className="text-[var(--text)] truncate"
              style={{ fontSize: '0.875rem', fontWeight: 500, margin: 0 }}
            >
              {userName}
            </p>
            <p
              className="text-[var(--muted)] truncate"
              style={{ fontSize: '0.75rem', margin: 0 }}
            >
              {userEmail}
            </p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
            className="flex-shrink-0 transition-colors duration-150"
            style={{
              color: 'var(--muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#E24B4A'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--muted)'
            }}
          >
            <LogOut size={18} strokeWidth={1.5} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div
        className="lg:ml-[240px] min-h-screen flex flex-col"
      >
        {/* Top header */}
        <header
          className="sticky top-0 z-10 flex items-center gap-4 px-6"
          style={{
            height: '68px',
            background: 'rgba(3,4,10,0.8)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
            className="lg:hidden"
            style={{
              color: 'var(--muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Menu size={20} strokeWidth={1.5} />
          </button>
          <h2
            className="font-head font-bold text-[var(--text)] flex-1"
            style={{ fontSize: '1.3rem', margin: 0 }}
          >
            {roleTitles[role]} Dashboard
          </h2>
          <div className="flex items-center gap-4">
            <Link
              href={`/dashboard/${role}/notifications`}
              aria-label="Notifications"
              style={{ color: 'var(--muted)' }}
            >
              <Bell size={20} strokeWidth={1.5} />
            </Link>
            <Avatar name={userName} avatarUrl={userAvatar} size="sm" />
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" role="main" style={{ padding: '32px', minHeight: 'calc(100vh - 68px)' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
