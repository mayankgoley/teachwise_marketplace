'use client'

import { Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Search, MapPin, LayoutGrid, Map, X, SlidersHorizontal, BookOpen, UserCircle, Loader2 } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import TutorCard from '@/components/features/TutorCard'
import TutorCardSkeleton from '@/components/features/TutorCardSkeleton'
import StarRating from '@/components/features/StarRating'
import EmptyState from '@/components/ui/EmptyState'
import dynamic from 'next/dynamic'
import type { TutorSearchResult, SearchFilters, SearchSuggestion } from '@/types/search'

const MapView = dynamic(() => import('@/components/features/MapView'), { ssr: false })

const SUBJECTS = [
  { id: '', label: 'All Subjects' },
  { id: 'academics', label: 'Academics & Tutoring' },
  { id: 'languages', label: 'Languages' },
  { id: 'music', label: 'Music' },
  { id: 'dance', label: 'Dance' },
  { id: 'sports', label: 'Sports & Athletics' },
  { id: 'martial_arts', label: 'Martial Arts & Self Defense' },
  { id: 'fitness', label: 'Fitness & Personal Training' },
  { id: 'yoga_wellness', label: 'Yoga & Wellness' },
  { id: 'cooking', label: 'Cooking & Culinary Arts' },
  { id: 'visual_arts', label: 'Visual Arts & Design' },
  { id: 'crafts', label: 'Crafts & Handmade' },
  { id: 'technology', label: 'Technology & Computer Science' },
  { id: 'business', label: 'Business & Professional Development' },
  { id: 'creative_media', label: 'Film, Video & Creative Media' },
  { id: 'life_skills', label: 'Life Skills & Personal Development' },
  { id: 'fashion_beauty', label: 'Fashion & Beauty' },
  { id: 'health_medical', label: 'Health & Medical Education' },
  { id: 'trades', label: 'Trades & Vocational Skills' },
  { id: 'games_strategy', label: 'Games & Strategy' },
  { id: 'religion_philosophy', label: 'Religion, Philosophy & Spirituality' },
  { id: 'aviation_nautical', label: 'Aviation & Nautical' },
  { id: 'event_planning', label: 'Event Planning & Hospitality' },
  { id: 'environmental', label: 'Environmental & Sustainability' },
  { id: 'legal', label: 'Legal Education' },
]

const DEFAULT_FILTERS: SearchFilters = {
  q: '',
  subject: '',
  lat: null,
  lng: null,
  radius_km: 25,
  min_price: '',
  max_price: '',
  min_rating: 0,
  mode: 'both',
  page: 1,
}

function parseFiltersFromParams(params: URLSearchParams): SearchFilters {
  return {
    q: params.get('q') || '',
    subject: params.get('subject') || '',
    lat: params.get('lat') ? parseFloat(params.get('lat')!) : null,
    lng: params.get('lng') ? parseFloat(params.get('lng')!) : null,
    radius_km: params.get('radius_km') ? parseInt(params.get('radius_km')!, 10) : 25,
    min_price: params.get('min_price') || '',
    max_price: params.get('max_price') || '',
    min_rating: params.get('min_rating') ? parseFloat(params.get('min_rating')!) : 0,
    mode: (params.get('mode') as SearchFilters['mode']) || 'both',
    page: params.get('page') ? parseInt(params.get('page')!, 10) : 1,
  }
}

function filtersToParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.subject) params.set('subject', filters.subject)
  if (filters.lat !== null) params.set('lat', String(filters.lat))
  if (filters.lng !== null) params.set('lng', String(filters.lng))
  if (filters.radius_km !== 25) params.set('radius_km', String(filters.radius_km))
  if (filters.min_price) params.set('min_price', filters.min_price)
  if (filters.max_price) params.set('max_price', filters.max_price)
  if (filters.min_rating > 0) params.set('min_rating', String(filters.min_rating))
  if (filters.mode !== 'both') params.set('mode', filters.mode)
  if (filters.page > 1) params.set('page', String(filters.page))
  return params
}

function hasActiveFilters(filters: SearchFilters): boolean {
  return (
    filters.q !== '' ||
    filters.subject !== '' ||
    filters.min_price !== '' ||
    filters.max_price !== '' ||
    filters.min_rating > 0 ||
    filters.mode !== 'both' ||
    filters.radius_km !== 25 ||
    filters.lat !== null ||
    filters.lng !== null
  )
}

function countActiveFilters(filters: SearchFilters): number {
  let count = 0
  if (filters.subject) count++
  if (filters.min_price || filters.max_price) count++
  if (filters.min_rating > 0) count++
  if (filters.mode !== 'both') count++
  if (filters.lat !== null && filters.radius_km !== 25) count++
  return count
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <Loader2 size={32} strokeWidth={1.5} className="animate-spin" color="var(--accent)" />
      </div>
    }>
      <SearchPageInner />
    </Suspense>
  )
}

function SearchPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [filters, setFilters] = useState<SearchFilters>(() => parseFiltersFromParams(searchParams))
  const [tutors, setTutors] = useState<TutorSearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [favorites, setFavorites] = useState<Set<number>>(new Set())
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid')
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const isInitialMount = useRef(true)

  // Perform search
  const performSearch = useCallback(async (currentFilters: SearchFilters) => {
    setLoading(true)
    try {
      const params = filtersToParams(currentFilters)
      const paramString = params.toString()

      // Sync URL
      const url = paramString ? `/search?${paramString}` : '/search'
      router.replace(url, { scroll: false })

      const res = await apiGet<{ tutors: TutorSearchResult[] }>(
        `/api/v1/search/tutors${paramString ? `?${paramString}` : ''}`
      )
      if (res.success) {
        setTutors(res.data.tutors)
        setTotal(res.meta?.total ?? res.data.tutors.length)
        setTotalPages(res.meta ? Math.ceil(res.meta.total / res.meta.per_page) : 1)
      } else {
        setTutors([])
        setTotal(0)
        setTotalPages(1)
      }
    } catch {
      setTutors([])
      setTotal(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }, [router])

  // Fetch suggestions
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    try {
      const res = await apiGet<{ suggestions: SearchSuggestion[] }>(
        `/api/v1/search/suggestions?q=${encodeURIComponent(query)}`
      )
      if (res.success) {
        setSuggestions(res.data.suggestions)
        setShowSuggestions(res.data.suggestions.length > 0)
      }
    } catch {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [])

  // Debounced search on filter changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      performSearch(filters)
      return
    }

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      performSearch(filters)
    }, 400)

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [filters, performSearch])

  // Cleanup suggestion timer on unmount
  useEffect(() => {
    return () => {
      if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current)
    }
  }, [])

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close mobile drawer on escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMobileFiltersOpen(false)
        setShowSuggestions(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileFiltersOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileFiltersOpen])

  function updateFilter<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: key === 'page' ? (value as number) : 1 }))
  }

  function handleSearchInput(value: string) {
    updateFilter('q', value)
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current)
    suggestTimerRef.current = setTimeout(() => {
      fetchSuggestions(value)
    }, 300)
  }

  function selectSuggestion(suggestion: SearchSuggestion) {
    if (suggestion.type === 'subject') {
      setFilters((prev) => ({ ...prev, q: suggestion.value, page: 1 }))
    } else if (suggestion.type === 'tutor' && suggestion.tutor_id) {
      router.push(`/tutor/${suggestion.tutor_id}`)
    }
    setShowSuggestions(false)
  }

  function handleNearMe() {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFilters((prev) => ({
          ...prev,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          page: 1,
        }))
        setGeoLoading(false)
      },
      () => {
        setGeoLoading(false)
      },
      { timeout: 10000 }
    )
  }

  function clearLocation() {
    setFilters((prev) => ({
      ...prev,
      lat: null,
      lng: null,
      radius_km: 25,
      page: 1,
    }))
  }

  function clearAllFilters() {
    setFilters({ ...DEFAULT_FILTERS })
    if (searchInputRef.current) searchInputRef.current.value = ''
  }

  function handleFavoriteToggle(tutorId: number) {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(tutorId)) {
        next.delete(tutorId)
      } else {
        next.add(tutorId)
      }
      apiPost('/api/v1/student/favorites', { tutor_id: tutorId })
      return next
    })
  }

  function handleTutorMapClick(tutor: TutorSearchResult) {
    router.push(`/tutor/${tutor.id}`)
  }

  const filterBadgeCount = countActiveFilters(filters)

  // -- Render filter sidebar content (shared between desktop and mobile) --
  function renderFilters() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Subject filter */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Subject
          </label>
          <select
            value={filters.subject}
            onChange={(e) => updateFilter('subject', e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              color: 'var(--text)',
              fontSize: '0.875rem',
              outline: 'none',
              cursor: 'pointer',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
            }}
          >
            {SUBJECTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Session Type */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Session Type
          </label>
          <div className="flex gap-2">
            {([
              { value: 'both' as const, label: 'All' },
              { value: 'online' as const, label: 'Online' },
              { value: 'in_person' as const, label: 'In Person' },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateFilter('mode', opt.value)}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: '100px',
                  border: filters.mode === opt.value ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: filters.mode === opt.value ? 'rgba(79,142,255,0.12)' : 'transparent',
                  color: filters.mode === opt.value ? 'var(--accent)' : 'var(--muted)',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Price Range */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Price Range
          </label>
          <div className="flex items-center gap-2">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flex: 1,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '0 12px',
              }}
            >
              <span style={{ color: 'var(--muted)', fontSize: '0.875rem', marginRight: '4px' }}>$</span>
              <input
                type="number"
                placeholder="Min"
                value={filters.min_price}
                onChange={(e) => updateFilter('min_price', e.target.value)}
                min="0"
                style={{
                  width: '100%',
                  padding: '10px 0',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text)',
                  fontSize: '0.875rem',
                }}
              />
            </div>
            <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>to</span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flex: 1,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '0 12px',
              }}
            >
              <span style={{ color: 'var(--muted)', fontSize: '0.875rem', marginRight: '4px' }}>$</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.max_price}
                onChange={(e) => updateFilter('max_price', e.target.value)}
                min="0"
                style={{
                  width: '100%',
                  padding: '10px 0',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text)',
                  fontSize: '0.875rem',
                }}
              />
            </div>
          </div>
        </div>

        {/* Minimum Rating */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Minimum Rating
          </label>
          <div className="flex items-center gap-3">
            <StarRating
              rating={filters.min_rating}
              interactive
              onRate={(r) => updateFilter('min_rating', filters.min_rating === r ? 0 : r)}
              size={20}
            />
            {filters.min_rating > 0 && (
              <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                {filters.min_rating}+ stars
              </span>
            )}
          </div>
        </div>

        {/* Distance (only if location is set) */}
        {filters.lat !== null && filters.lng !== null && (
          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
              <label
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Distance
              </label>
              <span style={{ fontSize: '0.82rem', color: 'var(--accent)', fontWeight: 500 }}>
                {filters.radius_km} km
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={filters.radius_km}
              onChange={(e) => updateFilter('radius_km', parseInt(e.target.value, 10))}
              style={{
                width: '100%',
                accentColor: 'var(--accent)',
                cursor: 'pointer',
              }}
            />
            <div className="flex justify-between" style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '4px' }}>
              <span>5 km</span>
              <span>100 km</span>
            </div>
            <button
              onClick={clearLocation}
              className="flex items-center gap-1 mt-2"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                fontSize: '0.78rem',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <X size={12} strokeWidth={1.5} />
              Remove location
            </button>
          </div>
        )}

        {/* Clear all filters */}
        {hasActiveFilters(filters) && (
          <button
            onClick={clearAllFilters}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
              padding: '8px 0',
              textAlign: 'left',
            }}
          >
            Clear All Filters
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      {/* ── Search Header ──────────────────────────────────────────────── */}
      <div
        style={{
          paddingTop: '100px',
          paddingBottom: '32px',
          paddingLeft: '24px',
          paddingRight: '24px',
          textAlign: 'center',
        }}
      >
        <h1
          className="font-head"
          style={{
            fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
            fontWeight: 700,
            color: 'var(--text)',
            margin: '0 0 24px',
          }}
        >
          Find Your Perfect Tutor
        </h1>

        {/* Search bar container */}
        <div
          ref={suggestionsRef}
          style={{
            position: 'relative',
            maxWidth: '640px',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '4px 4px 4px 16px',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)'
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) {
                e.currentTarget.style.borderColor = 'var(--border)'
              }
            }}
          >
            <Search size={18} strokeWidth={1.5} color="var(--muted)" style={{ flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              aria-label="Search tutors"
              placeholder="Search by subject, topic, or tutor name..."
              value={filters.q}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true)
              }}
              style={{
                flex: 1,
                padding: '12px',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text)',
                fontSize: '0.95rem',
              }}
            />
            {filters.q && (
              <button
                onClick={() => {
                  updateFilter('q', '')
                  setSuggestions([])
                  setShowSuggestions(false)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} strokeWidth={1.5} color="var(--muted)" />
              </button>
            )}
            <button
              onClick={handleNearMe}
              disabled={geoLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                borderRadius: '12px',
                border: 'none',
                background: filters.lat !== null
                  ? 'rgba(79,142,255,0.15)'
                  : 'rgba(255,255,255,0.05)',
                color: filters.lat !== null ? 'var(--accent)' : 'var(--muted)',
                fontSize: '0.82rem',
                fontWeight: 500,
                cursor: geoLoading ? 'wait' : 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              <MapPin size={14} strokeWidth={1.5} />
              {geoLoading ? 'Locating...' : filters.lat !== null ? 'Near me' : 'Near me'}
            </button>
          </div>

          {/* Autocomplete dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                zIndex: 50,
                overflow: 'hidden',
                boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
              }}
            >
              {suggestions.map((suggestion, idx) => (
                <button
                  key={`${suggestion.type}-${suggestion.value}-${idx}`}
                  onClick={() => selectSuggestion(suggestion)}
                  className="flex items-center gap-3"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: idx < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                    color: 'var(--text)',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(79,142,255,0.06)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {suggestion.type === 'subject' ? (
                    <BookOpen size={16} strokeWidth={1.5} color="var(--accent)" />
                  ) : (
                    <UserCircle size={16} strokeWidth={1.5} color="var(--accent)" />
                  )}
                  <div>
                    <span style={{ fontWeight: 500 }}>{suggestion.label}</span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.75rem',
                        color: 'var(--muted)',
                        marginTop: '1px',
                        textTransform: 'capitalize',
                      }}
                    >
                      {suggestion.type}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Main content area ──────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: '32px',
          maxWidth: '1320px',
          margin: '0 auto',
          padding: '0 24px 60px',
        }}
      >
        {/* ── Desktop Sidebar ────────────────────────────────────────── */}
        <aside
          className="hidden lg:block"
          style={{
            width: '280px',
            flexShrink: 0,
            position: 'sticky',
            top: '88px',
            alignSelf: 'flex-start',
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '24px',
            }}
          >
            <h3
              className="font-head"
              style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: 'var(--text)',
                margin: '0 0 20px',
              }}
            >
              Filters
            </h3>
            {renderFilters()}
          </div>
        </aside>

        {/* ── Main content ───────────────────────────────────────────── */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {/* Header bar */}
          <div
            className="flex items-center justify-between flex-wrap gap-3"
            style={{ marginBottom: '20px' }}
          >
            <div className="flex items-center gap-3">
              {/* Mobile filter button */}
              <button
                className="lg:hidden flex items-center gap-2"
                onClick={() => setMobileFiltersOpen(true)}
                style={{
                  padding: '10px 16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <SlidersHorizontal size={16} strokeWidth={1.5} />
                Filters
                {filterBadgeCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      color: '#fff',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {filterBadgeCount}
                  </span>
                )}
              </button>

              <p
                style={{
                  margin: 0,
                  fontSize: '0.95rem',
                  color: 'var(--muted)',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{total}</span>{' '}
                {total === 1 ? 'tutor' : 'tutors'} found
              </p>
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode('grid')}
                title="Grid view"
                style={{
                  padding: '8px',
                  background: viewMode === 'grid' ? 'rgba(79,142,255,0.12)' : 'transparent',
                  border: '1px solid',
                  borderColor: viewMode === 'grid' ? 'var(--accent)' : 'var(--border)',
                  borderRadius: '10px',
                  color: viewMode === 'grid' ? 'var(--accent)' : 'var(--muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <LayoutGrid size={18} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => setViewMode('map')}
                title="Map view"
                style={{
                  padding: '8px',
                  background: viewMode === 'map' ? 'rgba(79,142,255,0.12)' : 'transparent',
                  border: '1px solid',
                  borderColor: viewMode === 'map' ? 'var(--accent)' : 'var(--border)',
                  borderRadius: '10px',
                  color: viewMode === 'map' ? 'var(--accent)' : 'var(--muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <Map size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* ── Grid view ──────────────────────────────────────────── */}
          {viewMode === 'grid' && (
            <>
              {loading ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '20px',
                  }}
                >
                  {Array.from({ length: 6 }, (_, i) => (
                    <TutorCardSkeleton key={i} />
                  ))}
                </div>
              ) : tutors.length === 0 ? (
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '40px 20px',
                  }}
                >
                  <EmptyState
                    icon={<Search size={24} strokeWidth={1.5} />}
                    title="No tutors found"
                    description="Try adjusting your search terms or filters to find available tutors."
                    action={
                      hasActiveFilters(filters)
                        ? { label: 'Clear Filters', href: '/search' }
                        : undefined
                    }
                  />
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '20px',
                  }}
                >
                  {tutors.map((tutor) => (
                    <TutorCard
                      key={tutor.id}
                      tutor={tutor}
                      isFavorite={favorites.has(tutor.id)}
                      onFavoriteToggle={handleFavoriteToggle}
                    />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {!loading && totalPages > 1 && (
                <div
                  className="flex items-center justify-center gap-2"
                  style={{ marginTop: '32px' }}
                >
                  <button
                    disabled={filters.page <= 1}
                    onClick={() => updateFilter('page', filters.page - 1)}
                    style={{
                      padding: '10px 18px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      color: filters.page <= 1 ? 'rgba(255,255,255,0.2)' : 'var(--text)',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      cursor: filters.page <= 1 ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Previous
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      if (totalPages <= 7) return true
                      if (page === 1 || page === totalPages) return true
                      if (Math.abs(page - filters.page) <= 1) return true
                      return false
                    })
                    .reduce<(number | 'ellipsis')[]>((acc, page, idx, arr) => {
                      if (idx > 0) {
                        const prev = arr[idx - 1]
                        if (page - prev > 1) acc.push('ellipsis')
                      }
                      acc.push(page)
                      return acc
                    }, [])
                    .map((item, idx) =>
                      item === 'ellipsis' ? (
                        <span
                          key={`ellipsis-${idx}`}
                          style={{
                            padding: '10px 6px',
                            color: 'var(--muted)',
                            fontSize: '0.85rem',
                          }}
                        >
                          ...
                        </span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => updateFilter('page', item as number)}
                          style={{
                            width: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '12px',
                            border: filters.page === item ? 'none' : '1px solid var(--border)',
                            background: filters.page === item
                              ? 'linear-gradient(135deg, #4f8eff, #00e5ff)'
                              : 'var(--surface)',
                            color: filters.page === item ? '#fff' : 'var(--text)',
                            fontSize: '0.85rem',
                            fontWeight: filters.page === item ? 700 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {item}
                        </button>
                      )
                    )}

                  <button
                    disabled={filters.page >= totalPages}
                    onClick={() => updateFilter('page', filters.page + 1)}
                    style={{
                      padding: '10px 18px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      color: filters.page >= totalPages ? 'rgba(255,255,255,0.2)' : 'var(--text)',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      cursor: filters.page >= totalPages ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── Map view ───────────────────────────────────────────── */}
          {viewMode === 'map' && (
            <>
              {loading ? (
                <div
                  style={{
                    height: 'calc(100vh - 280px)',
                    minHeight: '400px',
                    borderRadius: '16px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <div
                      className="animate-pulse"
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: 'rgba(79,142,255,0.15)',
                        margin: '0 auto 12px',
                      }}
                    />
                    <p style={{ color: 'var(--muted)', fontSize: '0.875rem', margin: 0 }}>
                      Loading map...
                    </p>
                  </div>
                </div>
              ) : tutors.length === 0 ? (
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '40px 20px',
                  }}
                >
                  <EmptyState
                    icon={<Map size={24} strokeWidth={1.5} />}
                    title="No tutors to show on map"
                    description="Try adjusting your search terms or filters to find available tutors."
                  />
                </div>
              ) : (
                <MapView
                  tutors={tutors}
                  onTutorClick={handleTutorMapClick}
                  center={
                    filters.lat !== null && filters.lng !== null
                      ? [filters.lat, filters.lng]
                      : undefined
                  }
                  zoom={
                    filters.lat !== null && filters.lng !== null
                      ? Math.max(8, 14 - Math.floor(filters.radius_km / 15))
                      : undefined
                  }
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* ── Mobile Filter Drawer Overlay ───────────────────────────────── */}
      {mobileFiltersOpen && (
        <div
          className="lg:hidden"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
          }}
        >
          {/* Backdrop */}
          <div
            onClick={() => setMobileFiltersOpen(false)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
            }}
          />

          {/* Drawer */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: '320px',
              maxWidth: '85vw',
              background: 'var(--bg)',
              borderLeft: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideInRight 0.25s ease-out',
            }}
          >
            {/* Drawer header */}
            <div
              className="flex items-center justify-between"
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <h3
                className="font-head"
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: 'var(--text)',
                  margin: 0,
                }}
              >
                Filters
              </h3>
              <button
                onClick={() => setMobileFiltersOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            {/* Drawer body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px',
              }}
            >
              {renderFilters()}
            </div>

            {/* Drawer footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border)',
              }}
            >
              <button
                onClick={() => setMobileFiltersOpen(false)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'linear-gradient(135deg, #4f8eff, #00e5ff)',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Show Results ({total})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline keyframe for mobile drawer animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
