'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  MessageSquare,
  Bell,
  User,
  Settings,
  Wallet,
  BarChart3,
  FileText,
  Clock,
  Users,
  Shield,
  DollarSign,
  Menu,
  X,
  LogOut,
  ChevronDown,
  GraduationCap,
  ClipboardList,
  FolderOpen,
  Eye,
  Video,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import Avatar from '@/components/ui/Avatar'
import type { UserRole } from '@/types/auth'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

const STUDENT_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard/student', icon: <LayoutDashboard size={18} strokeWidth={1.5} /> },
  { label: 'Bookings', href: '/dashboard/student/bookings', icon: <Calendar size={18} strokeWidth={1.5} /> },
  { label: 'Assignments', href: '/dashboard/student/assignments', icon: <FileText size={18} strokeWidth={1.5} /> },
  { label: 'Progress', href: '/dashboard/student/progress', icon: <TrendingUp size={18} strokeWidth={1.5} /> },
  { label: 'Messages', href: '/dashboard/student/messages', icon: <MessageSquare size={18} strokeWidth={1.5} /> },
  { label: 'Wallet', href: '/dashboard/student/wallet', icon: <Wallet size={18} strokeWidth={1.5} /> },
  { label: 'Notifications', href: '/dashboard/student/notifications', icon: <Bell size={18} strokeWidth={1.5} /> },
  { label: 'Profile', href: '/dashboard/student/profile', icon: <User size={18} strokeWidth={1.5} /> },
  { label: 'Settings', href: '/dashboard/student/settings', icon: <Settings size={18} strokeWidth={1.5} /> },
]

const TUTOR_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard/tutor', icon: <LayoutDashboard size={18} strokeWidth={1.5} /> },
  { label: 'Availability', href: '/dashboard/tutor/availability', icon: <Clock size={18} strokeWidth={1.5} /> },
  { label: 'Students', href: '/dashboard/tutor/students', icon: <Users size={18} strokeWidth={1.5} /> },
  { label: 'Assignments', href: '/dashboard/tutor/assignments', icon: <ClipboardList size={18} strokeWidth={1.5} /> },
  { label: 'Messages', href: '/dashboard/tutor/messages', icon: <MessageSquare size={18} strokeWidth={1.5} /> },
  { label: 'Earnings', href: '/dashboard/tutor/earnings', icon: <DollarSign size={18} strokeWidth={1.5} /> },
  { label: 'Documents', href: '/dashboard/tutor/documents', icon: <FolderOpen size={18} strokeWidth={1.5} /> },
  { label: 'Reschedule', href: '/dashboard/tutor/reschedule-requests', icon: <Calendar size={18} strokeWidth={1.5} /> },
  { label: 'Notifications', href: '/dashboard/tutor/notifications', icon: <Bell size={18} strokeWidth={1.5} /> },
  { label: 'Profile', href: '/dashboard/tutor/profile', icon: <User size={18} strokeWidth={1.5} /> },
]

const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard/admin', icon: <LayoutDashboard size={18} strokeWidth={1.5} /> },
  { label: 'Users', href: '/dashboard/admin/users', icon: <Users size={18} strokeWidth={1.5} /> },
  { label: 'Bookings', href: '/dashboard/admin/bookings', icon: <Calendar size={18} strokeWidth={1.5} /> },
  { label: 'Verification', href: '/dashboard/admin/verification', icon: <ShieldCheck size={18} strokeWidth={1.5} /> },
  { label: 'Analytics', href: '/dashboard/admin/analytics', icon: <BarChart3 size={18} strokeWidth={1.5} /> },
  { label: 'Moderation', href: '/dashboard/admin/moderation', icon: <Shield size={18} strokeWidth={1.5} /> },
  { label: 'Recordings', href: '/dashboard/admin/recordings', icon: <Video size={18} strokeWidth={1.5} /> },
  { label: 'Audit Log', href: '/dashboard/admin/audit', icon: <Eye size={18} strokeWidth={1.5} /> },
  { label: 'Settings', href: '/dashboard/admin/settings', icon: <Settings size={18} strokeWidth={1.5} /> },
]

const GUARDIAN_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard/guardian', icon: <LayoutDashboard size={18} strokeWidth={1.5} /> },
  { label: 'Children', href: '/dashboard/guardian/children', icon: <GraduationCap size={18} strokeWidth={1.5} /> },
  { label: 'Approvals', href: '/dashboard/guardian/approvals', icon: <ShieldCheck size={18} strokeWidth={1.5} /> },
  { label: 'Spending', href: '/dashboard/guardian/spending', icon: <DollarSign size={18} strokeWidth={1.5} /> },
  { label: 'Messages', href: '/dashboard/guardian/messages', icon: <MessageSquare size={18} strokeWidth={1.5} /> },
  { label: 'Notifications', href: '/dashboard/guardian/notifications', icon: <Bell size={18} strokeWidth={1.5} /> },
]

const NAV_MAP: Record<UserRole, NavItem[]> = {
  student: STUDENT_NAV,
  tutor: TUTOR_NAV,
  admin: ADMIN_NAV,
  guardian: GUARDIAN_NAV,
}

interface DashboardLayoutProps {
  role: UserRole
  userName: string
  userEmail: string
  userAvatar?: string | null
  children: React.ReactNode
}

export default function DashboardLayout({
  role,
  userName,
  userEmail,
  userAvatar,
  children,
}: DashboardLayoutProps) {
  const pathname = usePathname()
  const { logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const navItems = NAV_MAP[role] ?? []

  function isActive(href: string) {
    if (href === `/dashboard/${role}`) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 md:sticky md:top-0 md:z-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={{
          width: '260px',
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          transition: 'transform 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          flexShrink: 0,
          overflowY: 'auto',
        }}
      >
        {/* Sidebar header */}
        <div
          style={{
            padding: '20px 20px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link
            href="/"
            className="font-head"
            style={{
              fontWeight: 800,
              fontSize: '1.1rem',
              color: 'var(--text)',
              textDecoration: 'none',
            }}
          >
            Teachwise
          </Link>
          <button
            className="md:hidden"
            onClick={() => setSidebarOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {navItems.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3"
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    fontWeight: active ? 600 : 500,
                    color: active ? 'var(--text)' : 'var(--muted)',
                    background: active ? 'rgba(79,142,255,0.1)' : 'transparent',
                    textDecoration: 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ color: active ? 'var(--accent)' : 'var(--muted)', display: 'flex' }}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* User section */}
        <div
          style={{
            padding: '16px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-3"
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '10px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <Avatar name={userName} avatarUrl={userAvatar} size="sm" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {userName}
              </div>
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {userEmail}
              </div>
            </div>
            <ChevronDown
              size={16}
              strokeWidth={1.5}
              style={{
                color: 'var(--muted)',
                transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
                flexShrink: 0,
              }}
            />
          </button>

          {userMenuOpen && (
            <div style={{ marginTop: '8px' }}>
              <button
                onClick={async () => {
                  await logout()
                  window.location.href = '/login'
                }}
                className="flex items-center gap-3"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#E24B4A',
                  textAlign: 'left',
                }}
              >
                <LogOut size={18} strokeWidth={1.5} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar (mobile) */}
        <header
          className="md:hidden"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            height: '56px',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text)',
              cursor: 'pointer',
              padding: '4px',
            }}
            aria-label="Open menu"
          >
            <Menu size={24} strokeWidth={1.5} />
          </button>
          <span
            className="font-head"
            style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}
          >
            Teachwise
          </span>
          <div style={{ width: '32px' }} />
        </header>

        {/* Page content */}
        <main
          style={{
            flex: 1,
            padding: '32px 24px',
            maxWidth: '1100px',
            width: '100%',
            margin: '0 auto',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
