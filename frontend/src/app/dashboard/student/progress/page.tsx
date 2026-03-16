'use client'

import { useState, useEffect, useCallback } from 'react'
import { Target, Plus, Loader2, Trash2, CheckCircle, PauseCircle, BarChart3, X, Download } from 'lucide-react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'
import Avatar from '@/components/ui/Avatar'
import { formatDate } from '@/lib/format'
import type { LearningGoal, ProgressEntry, ChartDataPoint } from '@/types/progress'

type FilterTab = 'all' | 'active' | 'completed' | 'paused'

function renderStars(rating: number | null, max = 5) {
  if (rating === null) return null
  return (
    <span style={{ letterSpacing: '1px' }}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ color: '#BA7517' }}>
          {i < rating ? '\u2605' : '\u2606'}
        </span>
      ))}
    </span>
  )
}

export default function StudentProgressPage() {
  const [goals, setGoals] = useState<LearningGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [expandedGoalId, setExpandedGoalId] = useState<number | null>(null)
  const [newEntryNote, setNewEntryNote] = useState('')
  const [newEntryRating, setNewEntryRating] = useState<number | null>(null)
  const [addingEntry, setAddingEntry] = useState(false)
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [newGoalTitle, setNewGoalTitle] = useState('')
  const [newGoalDescription, setNewGoalDescription] = useState('')
  const [newGoalTargetDate, setNewGoalTargetDate] = useState('')
  const [creatingGoal, setCreatingGoal] = useState(false)
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const toast = useToast()

  const fetchGoals = useCallback(async () => {
    try {
      const res = await apiGet<{ goals: LearningGoal[] }>(
        '/api/v1/student/goals?status=' + filter
      )
      if (res.success) {
        setGoals(res.data.goals)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    setLoading(true)
    fetchGoals()
  }, [fetchGoals])

  const handleToggleStatus = async (goalId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    const previous = [...goals]
    setGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, status: newStatus as LearningGoal['status'] } : g))
    )
    try {
      const res = await apiPatch('/api/v1/student/goals/' + goalId, { status: newStatus })
      if (!res.success) {
        setGoals(previous)
      }
    } catch {
      setGoals(previous)
    }
  }

  const handleComplete = async (goalId: number) => {
    const previous = [...goals]
    setGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, status: 'completed' as const } : g))
    )
    try {
      const res = await apiPatch('/api/v1/student/goals/' + goalId, { status: 'completed' })
      if (!res.success) {
        setGoals(previous)
      }
    } catch {
      setGoals(previous)
    }
  }

  const handleDelete = async (goalId: number) => {
    const previous = [...goals]
    setGoals((prev) => prev.filter((g) => g.id !== goalId))
    if (expandedGoalId === goalId) {
      setExpandedGoalId(null)
    }
    try {
      const res = await apiDelete('/api/v1/student/goals/' + goalId)
      if (!res.success) {
        setGoals(previous)
      }
    } catch {
      setGoals(previous)
    }
  }

  const handleAddEntry = async (goalId: number) => {
    if (!newEntryNote.trim()) return
    setAddingEntry(true)
    try {
      const res = await apiPost<{ entry: ProgressEntry }>(
        '/api/v1/goals/' + goalId + '/entries',
        { note: newEntryNote, rating: newEntryRating }
      )
      if (res.success) {
        setGoals((prev) =>
          prev.map((g) => {
            if (g.id !== goalId) return g
            const entries = g.entries ? [...g.entries, res.data.entry] : [res.data.entry]
            return {
              ...g,
              entries,
              entry_count: g.entry_count + 1,
              latest_rating: newEntryRating ?? g.latest_rating,
            }
          })
        )
        setNewEntryNote('')
        setNewEntryRating(null)
      }
    } catch {
    } finally {
      setAddingEntry(false)
    }
  }

  const handleToggleExpand = async (goalId: number) => {
    if (expandedGoalId === goalId) {
      setExpandedGoalId(null)
      return
    }
    setExpandedGoalId(goalId)
    const goal = goals.find((g) => g.id === goalId)
    if (goal && !goal.entries) {
      try {
        const res = await apiGet<{ entries: ProgressEntry[] }>(
          '/api/v1/goals/' + goalId + '/entries'
        )
        if (res.success) {
          setGoals((prev) =>
            prev.map((g) => (g.id === goalId ? { ...g, entries: res.data.entries } : g))
          )
        }
      } catch {
      }
    }
  }

  useEffect(() => {
    apiGet<{ chart: ChartDataPoint[] }>('/api/v1/student/progress/chart').then((res) => {
      if (res.success) setChartData(res.data.chart)
    })
  }, [])

  const handleCreateGoal = async () => {
    if (!newGoalTitle.trim()) return
    setCreatingGoal(true)
    try {
      const res = await apiPost<LearningGoal>('/api/v1/student/goals', {
        title: newGoalTitle.trim(),
        description: newGoalDescription.trim(),
        target_date: newGoalTargetDate || undefined,
      })
      if (res.success) {
        setGoals((prev) => [{ ...res.data, entries: [] }, ...prev])
        setNewGoalTitle('')
        setNewGoalDescription('')
        setNewGoalTargetDate('')
        setShowAddGoal(false)
      }
    } catch {
    } finally {
      setCreatingGoal(false)
    }
  }

  const chartMax = chartData.length > 0 ? 5 : 0

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2
          size={32}
          strokeWidth={1.5}
          className="animate-spin"
          style={{ color: 'var(--accent)' }}
        />
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '16px' }}>
          Loading progress...
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-start justify-between" style={{ marginBottom: '24px' }}>
        <div>
          <h1
            className="font-head font-bold text-[var(--text)]"
            style={{ fontSize: '1.8rem', margin: '0 0 4px' }}
          >
            Progress
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
            Track your learning goals
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                const res = await fetch(
                  (process.env.NEXT_PUBLIC_API_URL ?? '') + '/api/v1/student/progress/report',
                  { credentials: 'include' }
                )
                if (!res.ok) throw new Error('Failed to generate report')
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `progress-report-${new Date().toISOString().split('T')[0]}.pdf`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
              } catch {
                toast.error('Download failed', 'Could not generate report. Please try again.')
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '100px',
              padding: '10px 20px',
              color: 'var(--text)',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '0.875rem',
              whiteSpace: 'nowrap',
            }}
          >
            <Download size={16} strokeWidth={1.5} />
            Download Report
          </button>
          <button
            onClick={() => setShowAddGoal(true)}
            className="flex items-center gap-2"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              color: '#fff',
              borderRadius: '100px',
              padding: '10px 20px',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Plus size={16} strokeWidth={1.5} />
            Add Goal
          </button>
        </div>
      </div>

      {showAddGoal && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '20px 24px',
            marginBottom: '20px',
          }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
            <h3 className="font-head font-bold text-[var(--text)]" style={{ fontSize: '1rem', margin: 0 }}>
              New Goal
            </h3>
            <button
              onClick={() => setShowAddGoal(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
            >
              <X size={18} strokeWidth={1.5} style={{ color: 'var(--muted)' }} />
            </button>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
              Title
            </label>
            <input
              type="text"
              value={newGoalTitle}
              onChange={(e) => setNewGoalTitle(e.target.value)}
              placeholder="e.g. Master Algebra"
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '10px 14px',
                color: 'var(--text)',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
              Description (optional)
            </label>
            <textarea
              value={newGoalDescription}
              onChange={(e) => setNewGoalDescription(e.target.value)}
              rows={2}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '10px 14px',
                color: 'var(--text)',
                fontSize: '0.875rem',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
              Target Date (optional)
            </label>
            <input
              type="date"
              value={newGoalTargetDate}
              onChange={(e) => setNewGoalTargetDate(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '10px 14px',
                color: 'var(--text)',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
          </div>
          <button
            onClick={handleCreateGoal}
            disabled={creatingGoal || !newGoalTitle.trim()}
            className="flex items-center gap-2"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              color: '#fff',
              borderRadius: '100px',
              padding: '10px 20px',
              fontSize: '0.82rem',
              fontWeight: 600,
              border: 'none',
              cursor: creatingGoal || !newGoalTitle.trim() ? 'not-allowed' : 'pointer',
              opacity: creatingGoal || !newGoalTitle.trim() ? 0.5 : 1,
            }}
          >
            {creatingGoal ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin" /> : <Plus size={14} strokeWidth={1.5} />}
            Create Goal
          </button>
        </div>
      )}

      {chartData.length > 0 && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '20px 24px',
            marginBottom: '20px',
          }}
        >
          <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
            <BarChart3 size={18} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
            <h3 className="font-head font-bold text-[var(--text)]" style={{ fontSize: '1rem', margin: 0 }}>
              Rating History
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px' }}>
            {chartData.map((point, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  height: '100%',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    maxWidth: '32px',
                    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                    borderRadius: '4px 4px 0 0',
                    height: `${(point.rating / chartMax) * 100}%`,
                    minHeight: '4px',
                    transition: 'height 0.3s',
                  }}
                  title={`${point.date}: ${point.rating}/5`}
                />
                <span style={{ fontSize: '0.6rem', color: 'var(--muted)', marginTop: '4px', whiteSpace: 'nowrap' }}>
                  {point.date ? point.date.slice(5) : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className="flex items-center gap-2"
        style={{ marginBottom: '24px' }}
      >
        {(['all', 'active', 'completed', 'paused'] as const).map((tab) => {
          const isActive = filter === tab
          const label = tab.charAt(0).toUpperCase() + tab.slice(1)
          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                padding: '8px 18px',
                borderRadius: '100px',
                fontSize: '0.82rem',
                fontWeight: 600,
                border: isActive ? 'none' : '1px solid var(--border)',
                background: isActive
                  ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
                  : 'transparent',
                color: isActive ? '#fff' : 'var(--muted)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {goals.length === 0 ? (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
          }}
        >
          <EmptyState
            icon={<Target size={22} strokeWidth={1.5} />}
            title="No learning goals"
            description={
              filter === 'all'
                ? 'Create your first learning goal using the "Add Goal" button above.'
                : `No ${filter} goals found. Try switching filters.`
            }
          />
        </div>
      ) : (
        <div>
          {goals.map((goal) => (
            <div
              key={goal.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '20px 24px',
                marginBottom: '12px',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <h3
                  className="font-head font-bold text-[var(--text)]"
                  style={{ fontSize: '0.95rem', margin: 0 }}
                >
                  {goal.title}
                </h3>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {goal.status !== 'completed' && (
                    <button
                      onClick={() => handleComplete(goal.id)}
                      title="Mark completed"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <CheckCircle size={18} strokeWidth={1.5} color="#639922" />
                    </button>
                  )}
                  {goal.status !== 'completed' && (
                    <button
                      onClick={() => handleToggleStatus(goal.id, goal.status)}
                      title={goal.status === 'active' ? 'Pause goal' : 'Resume goal'}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <PauseCircle size={18} strokeWidth={1.5} color="var(--muted)" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(goal.id)}
                    title="Delete goal"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Trash2 size={18} strokeWidth={1.5} color="#E24B4A" />
                  </button>
                  <StatusBadge status={goal.status} />
                </div>
              </div>

              <div
                className="flex items-center gap-2"
                style={{ marginTop: '8px' }}
              >
                {goal.tutor_name && (
                  <div className="flex items-center gap-1.5">
                    <Avatar
                      name={goal.tutor_name}
                      avatarUrl={goal.tutor_avatar_url}
                      size="xs"
                    />
                    <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                      {goal.tutor_name}
                    </span>
                  </div>
                )}
                {goal.skill_tags.length > 0 && (
                  <div className="flex items-center gap-1.5" style={{ flexWrap: 'wrap' }}>
                    {goal.skill_tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          background: 'rgba(79,142,255,0.1)',
                          color: 'var(--accent)',
                          padding: '2px 8px',
                          borderRadius: '100px',
                          fontSize: '0.7rem',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div
                className="flex items-center gap-4 flex-wrap"
                style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--muted)' }}
              >
                {goal.target_date && (
                  <span>Target: {formatDate(goal.target_date)}</span>
                )}
                <span>
                  {goal.entry_count} {goal.entry_count === 1 ? 'entry' : 'entries'}
                </span>
                {goal.latest_rating !== null && (
                  <span className="flex items-center gap-1">
                    {renderStars(goal.latest_rating)}
                  </span>
                )}
              </div>

              <button
                onClick={() => handleToggleExpand(goal.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--accent)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  padding: '0',
                  marginTop: '10px',
                }}
              >
                {expandedGoalId === goal.id ? 'Hide entries' : 'Show entries'}
              </button>

              {expandedGoalId === goal.id && (
                <div style={{ marginTop: '16px' }}>
                  {goal.entries && goal.entries.length > 0 ? (
                    <div style={{ marginBottom: '16px' }}>
                      {goal.entries.map((entry) => (
                        <div
                          key={entry.id}
                          style={{
                            padding: '12px 16px',
                            background: 'rgba(255,255,255,0.02)',
                            borderRadius: '10px',
                            marginBottom: '8px',
                            border: '1px solid var(--border)',
                          }}
                        >
                          <p
                            style={{
                              fontSize: '0.88rem',
                              color: 'var(--text)',
                              margin: '0 0 6px',
                              lineHeight: 1.5,
                            }}
                          >
                            {entry.note}
                          </p>
                          <div
                            className="flex items-center gap-3 flex-wrap"
                            style={{ fontSize: '0.75rem', color: 'var(--muted)' }}
                          >
                            {entry.rating !== null && renderStars(entry.rating)}
                            <span
                              style={{
                                background:
                                  entry.created_by === 'tutor'
                                    ? 'rgba(127,119,221,0.15)'
                                    : 'rgba(79,142,255,0.15)',
                                color:
                                  entry.created_by === 'tutor' ? '#7F77DD' : '#4f8eff',
                                padding: '2px 8px',
                                borderRadius: '100px',
                                fontSize: '0.68rem',
                                fontWeight: 600,
                              }}
                            >
                              {entry.created_by === 'tutor' ? 'Tutor' : 'Student'}
                            </span>
                            {entry.created_at && (
                              <span>{formatDate(entry.created_at)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--muted)',
                        margin: '0 0 16px',
                      }}
                    >
                      No entries yet.
                    </p>
                  )}

                  <div
                    style={{
                      padding: '16px',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <textarea
                      value={newEntryNote}
                      onChange={(e) => setNewEntryNote(e.target.value)}
                      placeholder="Add a progress note..."
                      rows={3}
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        fontSize: '0.88rem',
                        color: 'var(--text)',
                        resize: 'vertical',
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                    <div
                      className="flex items-center justify-between flex-wrap gap-3"
                      style={{ marginTop: '10px' }}
                    >
                      <div className="flex items-center gap-1">
                        <span style={{ fontSize: '0.82rem', color: 'var(--muted)', marginRight: '4px' }}>
                          Rating:
                        </span>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() =>
                              setNewEntryRating(newEntryRating === star ? null : star)
                            }
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '2px',
                              fontSize: '1.2rem',
                              color: '#BA7517',
                              lineHeight: 1,
                            }}
                          >
                            {newEntryRating !== null && star <= newEntryRating
                              ? '\u2605'
                              : '\u2606'}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => handleAddEntry(goal.id)}
                        disabled={addingEntry || !newEntryNote.trim()}
                        className="flex items-center gap-1.5"
                        style={{
                          background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                          border: 'none',
                          borderRadius: '100px',
                          padding: '8px 18px',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: '#fff',
                          cursor:
                            addingEntry || !newEntryNote.trim()
                              ? 'not-allowed'
                              : 'pointer',
                          opacity: addingEntry || !newEntryNote.trim() ? 0.5 : 1,
                          transition: 'all 0.2s',
                        }}
                      >
                        {addingEntry ? (
                          <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
                        ) : (
                          <Plus size={14} strokeWidth={1.5} />
                        )}
                        Add Entry
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
