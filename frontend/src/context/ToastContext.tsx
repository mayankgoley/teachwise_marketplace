'use client'

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'

interface Toast {
  id: number
  type: 'success' | 'error'
  title: string
  message?: string
}

interface ToastContextValue {
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: Toast['type'], title: string, message?: string) => {
    const id = ++nextId
    setToasts((prev) => [...prev, { id, type, title, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const success = useCallback(
    (title: string, message?: string) => addToast('success', title, message),
    [addToast]
  )

  const error = useCallback(
    (title: string, message?: string) => addToast('error', title, message),
    [addToast]
  )

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}

      {/* Toast container */}
      {toasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxWidth: '380px',
          }}
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="flex items-start gap-3"
              style={{
                background: 'var(--surface)',
                border: `1px solid ${toast.type === 'success' ? 'rgba(99,153,34,0.3)' : 'rgba(226,75,74,0.3)'}`,
                borderRadius: '14px',
                padding: '14px 16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                opacity: 1,
                animation: 'toast-slide-in 0.25s ease-out forwards',
              }}
            >
              {toast.type === 'success' ? (
                <CheckCircle size={18} strokeWidth={1.5} color="#639922" style={{ flexShrink: 0, marginTop: '1px' }} />
              ) : (
                <XCircle size={18} strokeWidth={1.5} color="#E24B4A" style={{ flexShrink: 0, marginTop: '1px' }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                  {toast.title}
                </p>
                {toast.message && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: '2px 0 0' }}>
                    {toast.message}
                  </p>
                )}
              </div>
              <button
                onClick={() => dismiss(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <X size={14} strokeWidth={1.5} style={{ color: 'var(--muted)' }} />
              </button>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes toast-slide-in {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}
