'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { formatDate, formatTime, formatCurrency, formatDuration } from '@/lib/format'
import { X, Trash2, Clock, BookOpen, Users, Video, MapPin, RefreshCw, Edit3, AlertCircle } from 'lucide-react'
import type { TutorSlotData } from '@/types/search'

interface SlotDetailPanelProps {
  slot: TutorSlotData
  onClose: () => void
  onDelete: (slotId: number) => void
  onEdit: (slot: TutorSlotData) => void
  onProposeReschedule: (slot: TutorSlotData) => void
  isDeleting: boolean
}

export default function SlotDetailPanel({ slot, onClose, onDelete, onEdit, onProposeReschedule, isDeleting }: SlotDetailPanelProps) {
  const isBooked = !!slot.booking
  const isPast = new Date(`${slot.date}T${slot.end_time}`) < new Date()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 998,
        }}
      />

      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 999,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '20px',
        padding: '28px',
        width: '380px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
            {slot.subject}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px' }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: '10px',
          marginBottom: '20px',
          padding: '16px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
            <Clock size={15} strokeWidth={1.5} color="var(--muted)" />
            <span style={{ color: 'var(--text)' }}>
              {formatDate(slot.date)} · {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
            <BookOpen size={15} strokeWidth={1.5} color="var(--muted)" />
            <span style={{ color: 'var(--text)' }}>
              {formatCurrency(slot.price)}/hr · {formatDuration(slot.start_time, slot.end_time)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
            {slot.mode === 'online'
              ? <Video size={15} strokeWidth={1.5} color="var(--muted)" />
              : <MapPin size={15} strokeWidth={1.5} color="var(--muted)" />
            }
            <span style={{ color: 'var(--text)', textTransform: 'capitalize' }}>
              {slot.mode.replace('_', ' ')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
            <Users size={15} strokeWidth={1.5} color="var(--muted)" />
            <span style={{ color: 'var(--text)' }}>
              Max {slot.max_students} student{slot.max_students > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {isBooked && slot.booking && (
          <>
            <div style={{
              background: 'rgba(99,153,34,0.08)',
              border: '1px solid rgba(99,153,34,0.2)',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '16px',
            }}>
              <div style={{ fontWeight: 600, color: '#639922', fontSize: '0.875rem' }}>
                Booked by {slot.booking.student_name}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '2px' }}>
                Status: {slot.booking.status}
                {slot.booking.guardian_approved === false && ' · Awaiting guardian approval'}
              </div>
            </div>

            {!isPast && (
              <Link href={`/session/${slot.id}`} style={{ textDecoration: 'none', display: 'block', marginBottom: '10px' }}>
                <button style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  width: '100%', padding: '13px',
                  background: 'linear-gradient(135deg, #4f8eff, #00e5ff)',
                  border: 'none', borderRadius: '12px',
                  color: '#fff', cursor: 'pointer',
                  fontWeight: 600, fontSize: '0.9rem',
                }}>
                  <Video size={16} strokeWidth={1.5} />
                  Join Session
                </button>
              </Link>
            )}

            {!isPast && (
              <button
                onClick={() => onProposeReschedule(slot)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  width: '100%', padding: '12px',
                  background: 'rgba(186,117,23,0.08)',
                  border: '1px solid rgba(186,117,23,0.25)',
                  borderRadius: '12px',
                  color: '#BA7517', cursor: 'pointer',
                  fontWeight: 500, fontSize: '0.9rem',
                  marginBottom: '10px',
                }}
              >
                <RefreshCw size={16} strokeWidth={1.5} />
                Propose New Time
              </button>
            )}

            <div style={{
              fontSize: '0.8rem', color: 'var(--muted)',
              textAlign: 'center', padding: '8px 12px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}>
              <AlertCircle size={13} strokeWidth={1.5} />
              Cannot delete — this slot has a booking
            </div>
          </>
        )}

        {!isBooked && !isPast && (
          <>
            <button
              onClick={() => onEdit(slot)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                width: '100%', padding: '12px',
                background: 'rgba(79,142,255,0.08)',
                border: '1px solid rgba(79,142,255,0.25)',
                borderRadius: '12px',
                color: 'var(--accent)', cursor: 'pointer',
                fontWeight: 500, fontSize: '0.9rem',
                marginBottom: '10px',
              }}
            >
              <Edit3 size={16} strokeWidth={1.5} />
              Edit Slot
            </button>

            <button
              onClick={() => onDelete(slot.id)}
              disabled={isDeleting}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                width: '100%', padding: '12px',
                background: 'rgba(226,75,74,0.08)',
                border: '1px solid rgba(226,75,74,0.25)',
                borderRadius: '12px',
                color: '#E24B4A',
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                fontWeight: 500, fontSize: '0.9rem',
                opacity: isDeleting ? 0.6 : 1,
              }}
            >
              <Trash2 size={16} strokeWidth={1.5} />
              {isDeleting ? 'Deleting...' : 'Delete Slot'}
            </button>
          </>
        )}

        {isPast && !isBooked && (
          <div style={{
            fontSize: '0.875rem', color: 'var(--muted)',
            textAlign: 'center', padding: '12px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '8px',
          }}>
            This slot has passed
          </div>
        )}

        {isPast && isBooked && (
          <div style={{
            fontSize: '0.875rem', color: 'var(--muted)',
            textAlign: 'center', padding: '12px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '8px',
          }}>
            Session has ended
          </div>
        )}
      </div>
    </>
  )
}
