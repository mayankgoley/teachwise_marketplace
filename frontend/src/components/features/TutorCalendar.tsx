'use client'

import { useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DateSelectArg } from '@fullcalendar/core'

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  backgroundColor: string
  borderColor: string
  extendedProps: Record<string, unknown>
}

interface TutorCalendarProps {
  events: CalendarEvent[]
  onSelect: (info: DateSelectArg) => void
  onEventClick: (info: { event: { extendedProps: Record<string, unknown> } }) => void
}

export default function TutorCalendar({ events, onSelect, onEventClick }: TutorCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null)

  return (
    <FullCalendar
      ref={calendarRef}
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      initialView="timeGridWeek"
      headerToolbar={{
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay',
      }}
      buttonText={{
        today: 'Today',
        month: 'Month',
        week: 'Week',
        day: 'Day',
      }}
      selectable
      select={onSelect}
      eventClick={onEventClick}
      events={events}
      slotMinTime="06:00:00"
      slotMaxTime="22:00:00"
      height="auto"
      allDaySlot={false}
      nowIndicator
      eventDisplay="block"
    />
  )
}
