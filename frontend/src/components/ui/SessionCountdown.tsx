'use client'

import { useEffect, useState } from 'react'
import { Clock, MapPin } from 'lucide-react'
import { formatDate, formatTime } from '@/lib/format'

interface SessionCountdownProps {
  date: string
  startTime: string
  sessionId: number
  mode: 'online' | 'in_person'
}

export default function SessionCountdown({
  date,
  startTime,
  sessionId,
  mode,
}: SessionCountdownProps) {
  const [msUntil, setMsUntil] = useState<number>(() => {
    const target = new Date(`${date}T${startTime}:00`)
    return target.getTime() - Date.now()
  })

  useEffect(() => {
    const interval = setInterval(() => {
      const target = new Date(`${date}T${startTime}:00`)
      setMsUntil(target.getTime() - Date.now())
    }, 60000)
    return () => clearInterval(interval)
  }, [date, startTime])

  const totalMinutes = Math.max(0, Math.floor(msUntil / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  // More than 24 hours away
  if (totalMinutes > 1440) {
    return (
      <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
        {formatDate(date)} at {formatTime(startTime)}
      </span>
    )
  }

  // Less than 24 hours, more than 15 minutes
  if (totalMinutes > 15) {
    return (
      <span
        className="flex items-center gap-1"
        style={{ color: '#BA7517', fontSize: '0.82rem' }}
      >
        <Clock size={12} strokeWidth={1.5} />
        Starting in {hours > 0 ? `${hours}h ` : ''}
        {minutes}m
      </span>
    )
  }

  // Within 15 minutes — online: show join button
  if (mode === 'online') {
    return (
      <a
        href={`/session/${sessionId}`}
        className="animate-pulse inline-flex items-center no-underline"
        style={{
          background: 'linear-gradient(135deg, #639922, #00e5ff)',
          color: '#fff',
          padding: '6px 16px',
          borderRadius: '100px',
          fontSize: '0.82rem',
          fontWeight: 600,
        }}
      >
        Join Now
      </a>
    )
  }

  // Within 15 minutes — in-person
  return (
    <span
      className="flex items-center gap-1"
      style={{ color: '#639922', fontSize: '0.82rem' }}
    >
      <MapPin size={12} strokeWidth={1.5} />
      Session starting soon
    </span>
  )
}
