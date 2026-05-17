'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Pencil, Eraser, MousePointer, Trash2, Download } from 'lucide-react'
import type { Socket } from 'socket.io-client'
import { apiGet, apiPost } from '@/lib/api'

interface WhiteboardProps {
  slotId: number
  socket: Socket | null
  isActive: boolean
  // Kept for backward compat with older callers; not used in payloads.
  roomName?: string
}

type PeerCursor = {
  user_id: number
  name: string
  x: number
  y: number
  ts: number
}

const CURSOR_THROTTLE_MS = 50          // 20 Hz
const AUTO_SAVE_INTERVAL_MS = 30_000   // 30-second auto-save
const PEER_CURSOR_TIMEOUT_MS = 2_500   // hide cursor after 2.5s inactivity

export default function Whiteboard({
  slotId,
  socket,
  isActive,
}: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricRef = useRef<any>(null)
  const [tool, setTool] = useState<'pen' | 'eraser' | 'select'>('pen')
  const [brushColor, setBrushColor] = useState('#4f8eff')
  const [brushSize, setBrushSize] = useState(3)
  const [peers, setPeers] = useState<Map<number, PeerCursor>>(new Map())

  // Set on every local mutation; auto-save reads and resets it.
  const dirtyRef = useRef(false)
  const lastCursorEmitRef = useRef(0)

  useEffect(() => {
    if (!isActive || !canvasRef.current) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let canvas: any = null
    let cancelled = false

    const initCanvas = async () => {
      const fabricModule = await import('fabric')

      canvas = new fabricModule.Canvas(canvasRef.current!, {
        width: canvasContainerRef.current?.offsetWidth ?? 800,
        height: canvasContainerRef.current?.offsetHeight ?? 500,
        backgroundColor: '#1a1b2e',
        isDrawingMode: true,
      })
      canvas.freeDrawingBrush.color = brushColor
      canvas.freeDrawingBrush.width = brushSize
      fabricRef.current = canvas

      try {
        const res = await apiGet<{ state: string | null }>(
          `/api/whiteboard/${slotId}/load`
        )
        if (!cancelled && res.success && res.data.state) {
          canvas.loadFromJSON(res.data.state, () => canvas.renderAll())
        }
      } catch {
        // network error on load is non-fatal; start blank
      }
    }

    initCanvas()

    return () => {
      cancelled = true
      if (canvas) {
        canvas.dispose()
        fabricRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, slotId])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    if (tool === 'pen') {
      canvas.isDrawingMode = true
      canvas.freeDrawingBrush.color = brushColor
      canvas.freeDrawingBrush.width = brushSize
    } else if (tool === 'eraser') {
      canvas.isDrawingMode = true
      canvas.freeDrawingBrush.color = '#1a1b2e'
      canvas.freeDrawingBrush.width = brushSize * 4
    } else {
      canvas.isDrawingMode = false
    }
  }, [tool, brushColor, brushSize])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || !socket) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onPathCreated = (e: any) => {
      const pathData = e?.path?.toObject?.()
      if (pathData) {
        dirtyRef.current = true
        socket.emit('whiteboard_draw', {
          slot_id: slotId,
          path: pathData,
        })
      }
    }

    canvas.on('path:created', onPathCreated)
    return () => canvas.off('path:created', onPathCreated)
  }, [socket, slotId])

  useEffect(() => {
    if (!socket) return

    socket.emit('join_whiteboard', { slot_id: slotId })

    const handleDraw = async (data: { path: object }) => {
      const canvas = fabricRef.current
      if (!canvas) return
      try {
        const fabricModule = await import('fabric')
        const pathObj = await fabricModule.Path.fromObject(
          data.path as Record<string, unknown>
        )
        canvas.add(pathObj)
        canvas.renderAll()
      } catch {
        // ignore deserialization errors
      }
    }

    const handleClear = () => {
      const canvas = fabricRef.current
      if (!canvas) return
      canvas.clear()
      canvas.setBackgroundColor('#1a1b2e', () => canvas.renderAll())
    }

    const handleFullState = (data: { canvas_json: string | null }) => {
      const canvas = fabricRef.current
      if (!canvas || !data.canvas_json) return
      canvas.loadFromJSON(data.canvas_json, () => canvas.renderAll())
    }

    const handleCursor = (data: {
      user_id: number
      name: string
      x: number
      y: number
    }) => {
      setPeers((prev) => {
        const next = new Map(prev)
        next.set(data.user_id, {
          user_id: data.user_id,
          name: data.name,
          x: data.x,
          y: data.y,
          ts: Date.now(),
        })
        return next
      })
    }

    const handlePeerLeft = (data: { user_id: number }) => {
      setPeers((prev) => {
        const next = new Map(prev)
        next.delete(data.user_id)
        return next
      })
    }

    socket.on('whiteboard_draw', handleDraw)
    socket.on('whiteboard_clear', handleClear)
    socket.on('whiteboard_full_state', handleFullState)
    socket.on('whiteboard_cursor', handleCursor)
    socket.on('whiteboard_peer_left', handlePeerLeft)

    return () => {
      socket.off('whiteboard_draw', handleDraw)
      socket.off('whiteboard_clear', handleClear)
      socket.off('whiteboard_full_state', handleFullState)
      socket.off('whiteboard_cursor', handleCursor)
      socket.off('whiteboard_peer_left', handlePeerLeft)
      socket.emit('leave_whiteboard', { slot_id: slotId })
    }
  }, [socket, slotId])

  useEffect(() => {
    const id = setInterval(() => {
      setPeers((prev) => {
        const cutoff = Date.now() - PEER_CURSOR_TIMEOUT_MS
        let changed = false
        const next = new Map(prev)
        for (const [k, v] of prev) {
          if (v.ts < cutoff) {
            next.delete(k)
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!isActive) return
    const id = setInterval(async () => {
      const canvas = fabricRef.current
      if (!canvas || !dirtyRef.current) return
      try {
        const state = JSON.stringify(canvas.toJSON())
        await apiPost(`/api/whiteboard/${slotId}/save`, { state })
        dirtyRef.current = false
      } catch {
        // ignore; next interval will retry
      }
    }, AUTO_SAVE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [isActive, slotId])

  // navigator.sendBeacon survives page unload, so unsaved state is flushed reliably.
  useEffect(() => {
    if (!isActive) return
    const handler = () => {
      const canvas = fabricRef.current
      if (!canvas || !dirtyRef.current) return
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const url = `${apiUrl}/api/whiteboard/${slotId}/save`
      const body = JSON.stringify({ state: JSON.stringify(canvas.toJSON()) })
      const blob = new Blob([body], { type: 'application/json' })
      const ok = navigator.sendBeacon?.(url, blob)
      if (ok) dirtyRef.current = false
    }
    window.addEventListener('beforeunload', handler)
    window.addEventListener('pagehide', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
      window.removeEventListener('pagehide', handler)
    }
  }, [isActive, slotId])

  useEffect(() => {
    if (!socket || !canvasContainerRef.current) return
    const container = canvasContainerRef.current

    const onMove = (e: MouseEvent) => {
      const now = Date.now()
      if (now - lastCursorEmitRef.current < CURSOR_THROTTLE_MS) return
      lastCursorEmitRef.current = now
      const rect = container.getBoundingClientRect()
      socket.emit('whiteboard_cursor', {
        slot_id: slotId,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }

    container.addEventListener('mousemove', onMove)
    return () => container.removeEventListener('mousemove', onMove)
  }, [socket, slotId])

  const handleClear = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    canvas.clear()
    canvas.setBackgroundColor('#1a1b2e', () => canvas.renderAll())
    dirtyRef.current = true
    socket?.emit('whiteboard_clear', { slot_id: slotId })
  }, [socket, slotId])

  const handleDownload = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const dataURL = canvas.toDataURL({ format: 'png', quality: 1 })
    if (dataURL) {
      const a = document.createElement('a')
      a.href = dataURL
      a.download = `whiteboard-${Date.now()}.png`
      a.click()
    }
  }, [])

  const handleSaveSnapshot = useCallback(async () => {
    const canvas = fabricRef.current
    if (!canvas) return
    const dataURL = canvas.toDataURL({ format: 'png', quality: 1 })
    if (!dataURL) return
    try {
      await apiPost(`/api/whiteboard/${slotId}/snapshot`, { image: dataURL })
    } catch {
      // non-fatal
    }
  }, [slotId])

  const COLORS = ['#4f8eff', '#00e5ff', '#ff4fd8', '#639922', '#E24B4A', '#ffffff', '#888780']

  const toolBtnStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--muted)',
    transition: 'all 0.15s',
  })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 16px',
          background: 'rgba(255,255,255,0.05)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button onClick={() => setTool('pen')} style={toolBtnStyle(tool === 'pen')} title="Pen">
          <Pencil size={16} strokeWidth={1.5} />
        </button>
        <button onClick={() => setTool('eraser')} style={toolBtnStyle(tool === 'eraser')} title="Eraser">
          <Eraser size={16} strokeWidth={1.5} />
        </button>
        <button onClick={() => setTool('select')} style={toolBtnStyle(tool === 'select')} title="Select">
          <MousePointer size={16} strokeWidth={1.5} />
        </button>

        <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />

        {COLORS.map((color) => (
          <button
            key={color}
            onClick={() => { setBrushColor(color); setTool('pen') }}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: color,
              border:
                brushColor === color && tool === 'pen'
                  ? '2px solid white'
                  : '2px solid transparent',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
        ))}

        <input
          type="range"
          min="1"
          max="20"
          value={brushSize}
          onChange={(e) => setBrushSize(parseInt(e.target.value))}
          style={{ width: '80px', accentColor: 'var(--accent)' }}
        />

        <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />

        <button
          onClick={handleClear}
          style={{
            ...toolBtnStyle(false),
            width: 'auto',
            padding: '0 10px',
            gap: '4px',
            fontSize: '0.78rem',
          }}
          title="Clear canvas"
        >
          <Trash2 size={16} strokeWidth={1.5} />
        </button>

        <button
          onClick={handleSaveSnapshot}
          style={{
            ...toolBtnStyle(false),
            width: 'auto',
            padding: '0 10px',
            gap: '4px',
            fontSize: '0.78rem',
          }}
          title="Save snapshot (PNG, kept on server)"
        >
          Snap
        </button>

        <button
          onClick={handleDownload}
          style={{
            ...toolBtnStyle(false),
            width: 'auto',
            padding: '0 10px',
            gap: '4px',
            fontSize: '0.78rem',
          }}
          title="Download as PNG"
        >
          <Download size={16} strokeWidth={1.5} />
        </button>

        {/* Peer presence */}
        {peers.size > 0 && (
          <div
            style={{
              marginLeft: 'auto',
              fontSize: '0.72rem',
              color: 'var(--muted)',
            }}
          >
            {peers.size} other{peers.size > 1 ? 's' : ''} drawing
          </div>
        )}
      </div>

      <div
        ref={canvasContainerRef}
        style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
      >
        <canvas ref={canvasRef} />

        {/* Remote cursors */}
        {Array.from(peers.values()).map((p) => (
          <div
            key={p.user_id}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              transform: 'translate(-2px, -2px)',
              pointerEvents: 'none',
              zIndex: 10,
              transition: 'left 80ms linear, top 80ms linear',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path
                d="M2 2 L12 7 L7 8 L6 12 Z"
                fill="#ff4fd8"
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            <span
              style={{
                position: 'absolute',
                left: '14px',
                top: '12px',
                background: '#ff4fd8',
                color: '#fff',
                fontSize: '0.65rem',
                padding: '1px 5px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
              }}
            >
              {p.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
