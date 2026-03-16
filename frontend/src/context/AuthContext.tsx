'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { apiGet, apiPost, ApiError } from '@/lib/api'
import type { User, UserRole, LoginCredentials } from '@/types/auth'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  refetch: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const loginEndpoints: Record<UserRole, string> = {
  student: '/api/v1/student/login',
  tutor: '/api/v1/tutor/login',
  admin: '/api/v1/admin/login',
  guardian: '/api/v1/guardian/login',
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refetch = useCallback(async () => {
    try {
      const res = await apiGet<User>('/api/v1/auth/me')
      if (res.success) {
        setUser(res.data)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    }
  }, [])

  // Fetch user on mount
  useEffect(() => {
    refetch().finally(() => setIsLoading(false))

    return () => {}
  }, [refetch])

  // Listen for unauthorized events
  useEffect(() => {
    const handler = () => setUser(null)
    window.addEventListener('auth:unauthorized', handler)
    return () => {
      window.removeEventListener('auth:unauthorized', handler)
    }
  }, [])

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const endpoint = loginEndpoints[credentials.role]
      const res = await apiPost<User>(endpoint, {
        email: credentials.email,
        password: credentials.password,
      })
      if (res.success) {
        await refetch()
        return
      }
      throw new ApiError(
        res.error?.message ?? 'Login failed',
        res.error?.code ?? 500,
        res.error?.field
      )
    },
    [refetch]
  )

  const logout = useCallback(async () => {
    try {
      await apiPost('/api/v1/auth/logout')
    } catch {
      // ignore logout errors
    }
    setUser(null)
    window.location.href = '/'
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refetch }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
