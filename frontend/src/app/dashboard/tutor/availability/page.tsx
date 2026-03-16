'use client'

import { useState, useEffect, useCallback } from 'react'
import { CalendarDays, Plus, Loader2 } from 'lucide-react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { apiGet, apiDelete } from '@/lib/api'
import { formatCurrency } from '@/lib/format'
import EmptyState from '@/components/ui/EmptyState'
import CreateSlotModal from './CreateSlotModal'
import type { TutorSlotData } from '@/types/search'
import type { ApiResponse } from '@/lib/api'
import type { DateSelectArg, EventClickArg } from '@fullcalendar/core'

function slotColor(slot: TutorSlotData): string {
  const slotDate = new Date(`${slot.date}T${slot.end_time}`)
  if (slotDate < new Date()) return '#6b7280'
  if (slot.booking) return '#639922'
  return '#4f8eff'
}

export default function TutorAvailabilityPage() {
  const [slots, setSlots] = useState<TutorSlotData[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [initialDate, setInitialDate] = useState<string | undefined>()
  const [deleting, setDeleting] = useState<number | null>(null)

  const fetchSlots = useCallback(async () => {
    setLoading(true)
    try {
      const res: ApiResponse<{ slots: TutorSlotData[] }> = await apiGet('/api/v1/tutor/slots')
      if (res.success) setSlots(res.data?.slots ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSlots()
  }, [fetchSlots])

  const calendarEvents = (slots ?? []).map((slot) => ({
    id: String(slot.id),
    title: `${slot.subject} — ${formatCurrency(slot.price)}`,
    start: `${slot.date}T${slot.start_time}`,
    end: `${slot.date}T${slot.end_time}`,
    backgroundColor: slotColor(slot),
    borderColor: slotColor(slot),
    extendedProps: slot,
  }))

  const handleSelect = (info: DateSelectArg) => {
    const dateStr = info.startStr.slice(0, 10)
    setInitialDate(dateStr)
    setModalOpen(true)
  }

  const handleEventClick = async (info: EventClickArg) => {
    const slot = info.event.extendedProps as TutorSlotData
    if (slot.booking) return
    const slotDate = new Date(`${slot.date}T${slot.end_time}`)
    if (slotDate < new Date()) return
    if (!confirm('Delete this slot?')) return
    setDeleting(slot.id)
    try {
      const res = await apiDelete('/api/v1/tutor/slots/' + slot.id)
      if (res.success) {
        setSlots((prev) => prev.filter((s) => s.id !== slot.id))
      }
    } catch {
      // ignore
    } finally {
      setDeleting(null)
    }
  }

  const handleSlotCreated = (slot: TutorSlotData) => {
    setSlots((prev) => [...prev, slot])
    setModalOpen(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} strokeWidth={1.5} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="font-head font-bold text-[var(--text)]"
            style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
          >
            Availability
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
            Manage your teaching schedule
          </p>
        </div>
        <button
          onClick={() => {
            setInitialDate(undefined)
            setModalOpen(true)
          }}
          className="btn-gradient flex items-center gap-2 text-white"
          style={{
            padding: '10px 20px',
            borderRadius: '100px',
            fontSize: '0.875rem',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Plus size={18} strokeWidth={1.5} />
          Add Slot
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mb-4" style={{ fontSize: '0.8rem' }}>
        <div className="flex items-center gap-2">
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: '#4f8eff',
              display: 'inline-block',
            }}
          />
          <span style={{ color: 'var(--muted)' }}>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: '#639922',
              display: 'inline-block',
            }}
          />
          <span style={{ color: 'var(--muted)' }}>Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: '#6b7280',
              display: 'inline-block',
            }}
          />
          <span style={{ color: 'var(--muted)' }}>Past</span>
        </div>
      </div>

      {/* Calendar */}
      {slots.length === 0 ? (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
          }}
        >
          <EmptyState
            icon={<CalendarDays size={22} strokeWidth={1.5} />}
            title="No slots yet"
            description="Click 'Add Slot' to create your first availability slot"
          />
        </div>
      ) : (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            padding: '16px',
            overflow: 'hidden',
          }}
        >
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            selectable
            select={handleSelect}
            eventClick={handleEventClick}
            events={calendarEvents}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            height="auto"
            allDaySlot={false}
            nowIndicator
            eventDisplay="block"
          />
        </div>
      )}

      {/* Deleting overlay */}
      {deleting !== null && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)', zIndex: 100 }}
        >
          <Loader2 size={32} strokeWidth={1.5} className="animate-spin" style={{ color: '#fff' }} />
        </div>
      )}

      {/* Create Slot Modal */}
      <CreateSlotModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSlotCreated}
        initialDate={initialDate}
      />
    </div>
  )
}
