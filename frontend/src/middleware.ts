import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect dashboard routes
  const isProtected = pathname.startsWith('/dashboard')
  const isAuthPage = pathname === '/login' || pathname === '/signup'

  const sessionCookie = request.cookies.get('session')

  // No session cookie on protected route → redirect to login
  if (isProtected && !sessionCookie) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Role protection: ensure user accesses only their own dashboard
  const dashboardRoles = ['student', 'tutor', 'admin', 'guardian'] as const
  const dashboardRoleMatch = isProtected
    ? dashboardRoles.find((role) => pathname.startsWith(`/dashboard/${role}`))
    : null

  if (dashboardRoleMatch && sessionCookie) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'
      const meRes = await fetch(`${apiUrl}/api/v1/auth/me`, {
        headers: { Cookie: request.headers.get('cookie') ?? '' },
        cache: 'no-store',
      })

      if (meRes.ok) {
        const me = await meRes.json()
        if (me.success && me.data?.user_type && me.data.user_type !== dashboardRoleMatch) {
          const correctDashboard = `/dashboard/${me.data.user_type}`
          return NextResponse.redirect(new URL(correctDashboard, request.url))
        }
      }
    } catch {
      // If auth check fails, let the dashboard layout handle it
    }
  }

  // Has session + on auth page → check with Flask then redirect
  if (isAuthPage && sessionCookie) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'
      const meRes = await fetch(`${apiUrl}/api/v1/auth/me`, {
        headers: { Cookie: request.headers.get('cookie') ?? '' },
        cache: 'no-store',
      })

      if (meRes.ok) {
        const me = await meRes.json()
        if (me.success && me.data?.user_type) {
          const dashboards: Record<string, string> = {
            student: '/dashboard/student',
            tutor: '/dashboard/tutor',
            admin: '/dashboard/admin',
            guardian: '/dashboard/guardian',
          }
          const dest = dashboards[me.data.user_type] ?? '/'
          return NextResponse.redirect(new URL(dest, request.url))
        }
      }
    } catch {
      // If auth check fails, just let them through — don't crash
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$|.*\\.ico$|.*\\.webp$|.*\\.gif$).*)',
  ],
}
