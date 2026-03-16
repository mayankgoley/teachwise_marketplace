const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

export interface ApiResponse<T> {
  success: boolean
  data: T
  meta?: { total: number; page: number; per_page: number }
  error?: { message: string; code: number; field?: string }
}

export class ApiError extends Error {
  code: number
  field?: string
  constructor(message: string, code: number, field?: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.field = field
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    const json: ApiResponse<T> = await res.json()
    if (res.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth:unauthorized'))
    }
    return json
  } catch {
    throw new ApiError('Network error. Check your connection.', 0)
  }
}

export const apiGet = <T>(path: string, options?: RequestInit) =>
  apiFetch<T>(path, { method: 'GET', ...options })

export const apiPost = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const apiPut = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) })

export const apiPatch = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) })

export const apiDelete = <T>(path: string) =>
  apiFetch<T>(path, { method: 'DELETE' })
