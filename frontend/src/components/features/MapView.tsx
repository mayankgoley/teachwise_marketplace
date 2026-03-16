'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { formatCurrency } from '@/lib/format'
import type { TutorSearchResult } from '@/types/search'

interface MapViewProps {
  tutors: TutorSearchResult[]
  onTutorClick: (tutor: TutorSearchResult) => void
  center?: [number, number]
  zoom?: number
}

export default function MapView({
  tutors,
  onTutorClick,
  center = [39.8283, -98.5795],
  zoom = 4,
}: MapViewProps) {
  const fixedRef = useRef(false)

  useEffect(() => {
    if (fixedRef.current) return
    fixedRef.current = true
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require('leaflet')
    delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      iconRetinaUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      shadowUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    })
  }, [])

  const geoTutors = tutors.filter((t) => t.latitude != null && t.longitude != null)

  return (
    <div
      style={{
        height: 'calc(100vh - 280px)',
        minHeight: '400px',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geoTutors.map((tutor) => (
          <Marker
            key={tutor.id}
            position={[tutor.latitude!, tutor.longitude!]}
          >
            <Popup>
              <div style={{ fontFamily: 'sans-serif', minWidth: '150px' }}>
                <p style={{ fontWeight: 600, margin: '0 0 4px' }}>{tutor.name}</p>
                <p style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#666' }}>
                  {tutor.rating_avg.toFixed(1)} stars &middot;{' '}
                  {formatCurrency(tutor.hourly_rate)}/hr
                </p>
                <button
                  onClick={() => onTutorClick(tutor)}
                  style={{
                    background: '#4f8eff',
                    color: '#fff',
                    border: 'none',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  View Profile
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
