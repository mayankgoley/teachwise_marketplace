import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import type { UserRole } from '@/types/auth'

interface MeResponse {
  success: boolean
  data?: {
    id: number
    user_type: UserRole
    name: string
    email: string
    avatar_url?: string | null
  }
}

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

  let user: MeResponse['data'] | null = null

  try {
    const res = await fetch(`${apiUrl}/api/v1/auth/me`, {
      headers: { Cookie: cookieStore.toString() },
      cache: 'no-store',
    })
    const json: MeResponse = await res.json()
    if (json.success && json.data) {
      user = json.data
    }
  } catch {
    // Fetch failed — middleware will handle redirect
  }

  if (!user) {
    redirect('/login')
  }

  return (
    <DashboardLayout
      role={user.user_type}
      userName={user.name}
      userEmail={user.email}
      userAvatar={user.avatar_url}
    >
      {children}
    </DashboardLayout>
  )
}
