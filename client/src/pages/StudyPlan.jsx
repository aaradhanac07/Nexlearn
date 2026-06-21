/**
 * Auto Study Plan Generator — AI-built day-by-day schedule with SM-2 reviews.
 * Users set exam date + topics → AI generates a personalized plan.
 * Students can expand each day, tick off slots, skip slots, and reschedule.
 */
import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAxios } from '../hooks/useAxios'
import '../styles/study-plan.css'

// ── Topic chip input ──────────────────────────────────────────────────────────
function TopicInput({ topics, onChange }) {
  const [val, setVal] = useState('')

  const add = (raw) => {
    const trimmed = raw.trim()
    if (trimmed && !topics.includes(trimmed)) {
      onChange([...topics, trimmed])
    }
    setVal('')
  }

  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(val)
    } else if (e.key === 'Backspace' && !val && topics.length) {
      onChange(topics.slice(0, -1))
    }
  }

  return (
    <div className="sp-topics-wrap" onClick={() => document.getElementById('topic-chip-input')?.focus()}>
      {topics.map((t, i) => (
        <span key={i} className="sp-topic-chip">
          {t}
          <button type="button" onClick={() => onChange(topics.filter((_, j) => j !== i))}>×</button>
        </span>
      ))}
      <input
        id="topic-chip-input"
        className="sp-topics-input"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => val.trim() && add(val)}
        placeholder={topics.length ? '' : 'Type topic, press Enter…'}
      />
    </div>
  )
}

// ── Day card ──────────────────────────────────────────────────────────────────
function DayCard({ day, today, planId, onSlotUpdate }) {
  const [open, setOpen] = useState(day.date === today)

  const isToday  = day.date === today
  const isPast   = day.date < today
  const doneSlotsCount = day.slots.filter(s => s.done || s.skipped).length
  const totalSlots     = day.slots.length

  const dateLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric'
  })

  let cardCls = 'sp-day-card'
  if (isToday) cardCls += ' sp-day-card--today'
  else if (isPast) cardCls += ' sp-day-card--past'
  else cardCls += ' sp-day-card--future'

  return (
    <div className={cardCls}>
      <div className="sp-day-header" onClick={() => setOpen(o => !o)}>
        <span className={`sp-day-badge ${isToday ? 'sp-day-badge--today' : isPast ? 'sp-day-badge--past' : ''}`}>
          {isToday ? '📅 Today' : isPast ? '✓ Day ' + (day.dayIndex + 1) : 'Day ' + (day.dayIndex + 1)}
        </span>
        <span className="sp-day-focus">{day.focus || 'Study session'}</span>
        <span className="sp-day-date">{dateLabel}</span>
        {totalSlots > 0 && (
          <span className="sp-day-done-count">{doneSlotsCount}/{totalSlots}</span>
        )}
        <span className={`sp-day-chevron ${open ? 'sp-day-chevron--open' : ''}`}>▶</span>
      </div>

      {open && (
        <div className="sp-slots">
          {day.slots.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.5rem 0' }}>
              No sessions scheduled for this day.
            </p>
          )}
          {day.slots.map((slot, idx) => (
            <SlotRow
              key={idx}
              slot={slot}
              idx={idx}
              day={day}
              planId={planId}
              onUpdate={onSlotUpdate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Slot row ──────────────────────────────────────────────────────────────────
function SlotRow({ slot, idx, day, planId, onUpdate }) {
  const [saving, setSaving] = useState(false)
  const api = useAxios()

  const typeIcon = {
    new:           '🔵',
    review:        '🟡',
    break:         '🟢',
    'exam-practice': '🔴',
  }[slot.type] || '⚪'

  const patch = async (patch) => {
    if (!planId) return
    setSaving(true)
    try {
      await api.patch(`/api/study-plan/${planId}/days/${day.date}/slots/${idx}`, patch)
      onUpdate(day.date, idx, patch)
    } catch (e) {
      console.error('Slot update error:', e)
    } finally {
      setSaving(false)
    }
  }

  let cls = 'sp-slot'
  if (slot.done)    cls += ' sp-slot--done'
  if (slot.skipped) cls += ' sp-slot--skipped'

  return (
    <div className={cls}>
      <button
        className="sp-slot-check"
        disabled={saving}
        onClick={() => patch({ done: !slot.done, skipped: false })}
        title={slot.done ? 'Mark undone' : 'Mark done'}
      >
        {slot.done ? '✓' : ''}
      </button>
      <div className="sp-slot-info">
        <div className="sp-slot-topic">
          {typeIcon} {slot.topic}
        </div>
        {slot.description && <div className="sp-slot-desc">{slot.description}</div>}
        <div className="sp-slot-meta" style={{ marginTop: '0.35rem' }}>
          <span className={`sp-slot-type sp-slot-type--${slot.type}`}>{slot.type}</span>
          <span className="sp-slot-dur">⏱ {slot.durationMin} min</span>
          {slot.doneAt && (
            <span className="sp-slot-dur" style={{ color: 'var(--green)' }}>
              ✅ {new Date(slot.doneAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      {!slot.done && (
        <button
          className="sp-slot-skip"
          onClick={() => patch({ skipped: !slot.skipped, done: false })}
          disabled={saving}
        >
          {slot.skipped ? 'Undo skip' : 'Skip'}
        </button>
      )}
    </div>
  )
}

// ── Generator Modal ───────────────────────────────────────────────────────────
function GeneratorModal({ courseId, courseConcepts, onClose, onGenerated }) {
  const api = useAxios()
  const today = new Date().toISOString().slice(0, 10)
  const [topics, setTopics]     = useState(courseConcepts.slice(0, 8))
  const [examDate, setExamDate] = useState('')
  const [hours, setHours]       = useState('2')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const submit = async () => {
    if (!examDate) return setError('Please select an exam date.')
    if (topics.length === 0) return setError('Add at least one topic.')
    if (new Date(examDate) <= new Date()) return setError('Exam date must be in the future.')
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/api/study-plan', {
        examDate,
        topics,
        dailyHours: parseFloat(hours) || 2,
        courseId,
      })
      onGenerated(data)
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to generate plan. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="sp-gen-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sp-gen-modal">
        <div className="sp-gen-title">📅 Generate Study Plan</div>

        <div className="sp-gen-field">
          <label className="sp-gen-label">Topics to Master</label>
          <TopicInput topics={topics} onChange={setTopics} />
          <div className="sp-gen-hint">Type a topic and press Enter to add. Backspace to remove last.</div>
        </div>

        <div className="sp-gen-row">
          <div className="sp-gen-field">
            <label className="sp-gen-label">Exam Date</label>
            <input
              type="date"
              className="sp-gen-input"
              min={today}
              value={examDate}
              onChange={e => setExamDate(e.target.value)}
            />
          </div>
          <div className="sp-gen-field">
            <label className="sp-gen-label">Daily Study Hours</label>
            <input
              type="number"
              className="sp-gen-input"
              min="0.5"
              max="12"
              step="0.5"
              value={hours}
              onChange={e => setHours(e.target.value)}
            />
          </div>
        </div>

        {error && <div className="sp-error">{error}</div>}

        <div className="sp-gen-actions">
          <button className="sp-btn" onClick={onClose}>Cancel</button>
          <button
            className="sp-btn sp-btn--primary"
            onClick={submit}
            disabled={loading}
          >
            {loading ? <><span className="quiz-spinner" /> Generating…</> : '✨ Generate Plan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StudyPlan() {
  const { id: courseId } = useParams()
  const navigate = useNavigate()
  const api = useAxios()

  const [course, setCourse]           = useState(null)
  const [plan, setPlan]               = useState(null)
  const [loading, setLoading]         = useState(true)
  const [showGen, setShowGen]         = useState(false)
  const [rescheduling, setRescheduling] = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [error, setError]             = useState('')

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    Promise.allSettled([
      api.get(`/api/courses/${courseId}`),
      api.get(`/api/study-plan/${courseId}`)
    ]).then(([courseRes, planRes]) => {
      if (courseRes.status === 'fulfilled') setCourse(courseRes.value.data)
      else navigate('/')
      if (planRes.status === 'fulfilled') setPlan(planRes.value.data)
      setLoading(false)
    })
  }, [courseId])

  const handleGenerated = (newPlan) => {
    setPlan(newPlan)
    setShowGen(false)
  }

  const handleSlotUpdate = useCallback((date, slotIdx, patch) => {
    setPlan(prev => {
      if (!prev) return prev
      const days = prev.days.map(d => {
        if (d.date !== date) return d
        const slots = d.slots.map((s, i) => i === slotIdx ? { ...s, ...patch } : s)
        return { ...d, slots }
      })
      return { ...prev, days }
    })
  }, [])

  const reschedule = async () => {
    if (!plan) return
    setRescheduling(true)
    setError('')
    try {
      const { data } = await api.patch(`/api/study-plan/${plan._id}/reschedule`, {})
      setPlan(data)
    } catch (err) {
      setError(err.response?.data?.error || 'Reschedule failed.')
    } finally {
      setRescheduling(false)
    }
  }

  const deletePlan = async () => {
    if (!plan || !window.confirm('Delete this study plan?')) return
    setDeleting(true)
    try {
      await api.delete(`/api/study-plan/${plan._id}`)
      setPlan(null)
    } catch {
      setError('Failed to delete plan.')
    } finally {
      setDeleting(false)
    }
  }

  // Compute stats
  const stats = (() => {
    if (!plan) return { total: 0, done: 0, remaining: 0, pct: 0 }
    const allSlots   = plan.days.flatMap(d => d.slots)
    const done       = allSlots.filter(s => s.done).length
    const total      = allSlots.length
    const remaining  = allSlots.filter(s => !s.done && !s.skipped).length
    const todaySlots = plan.days.find(d => d.date === today)?.slots.filter(s => !s.done && !s.skipped).length || 0
    return { total, done, remaining, todaySlots, pct: total ? Math.round((done / total) * 100) : 0 }
  })()

  const daysUntilExam = plan
    ? Math.max(0, Math.ceil((new Date(plan.examDate + 'T00:00:00') - new Date()) / 86400000))
    : null

  const courseConcepts = course?.concepts?.length
    ? course.concepts.slice(0, 15)
    : course?.studyOrder?.length
      ? course.studyOrder.slice(0, 15)
      : []

  return (
    <div className="sp-root">
      {/* Header */}
      <div className="sp-header">
        <button className="fc-back" onClick={() => navigate(`/courses/${courseId}`)}>← Back</button>
        <div className="sp-header-info">
          <div className="sp-header-title">📅 Study Plan</div>
          <div className="sp-header-sub">{course?.title || 'Loading…'} — AI-generated day-by-day schedule</div>
        </div>
        <div className="sp-header-actions">
          {plan && (
            <>
              <button className="sp-btn" onClick={reschedule} disabled={rescheduling}>
                {rescheduling ? <><span className="quiz-spinner" /> …</> : '⏩ Reschedule missed'}
              </button>
              <button className="sp-btn sp-btn--danger" onClick={deletePlan} disabled={deleting}>
                🗑 Delete
              </button>
            </>
          )}
          <button className="sp-btn sp-btn--primary" onClick={() => setShowGen(true)}>
            {plan ? '🔄 Regenerate' : '✨ Generate Plan'}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {plan && (
        <>
          <div className="sp-summary">
            <div className={`sp-stat sp-stat--green`}>
              <span className="sp-stat-val">{stats.done}</span>
              <span className="sp-stat-lbl">Completed</span>
            </div>
            <div className={`sp-stat sp-stat--accent`}>
              <span className="sp-stat-val">{stats.todaySlots}</span>
              <span className="sp-stat-lbl">Due Today</span>
            </div>
            <div className={`sp-stat`}>
              <span className="sp-stat-val">{stats.remaining}</span>
              <span className="sp-stat-lbl">Remaining</span>
            </div>
            <div className={`sp-stat`}>
              <span className="sp-stat-val">{plan.days.length}</span>
              <span className="sp-stat-lbl">Total Days</span>
            </div>
            {daysUntilExam !== null && (
              <div className="sp-exam-badge">
                🎯 Exam in <strong style={{ marginLeft: 4 }}>{daysUntilExam} day{daysUntilExam !== 1 ? 's' : ''}</strong>
              </div>
            )}
          </div>
          <div className="sp-overall-bar">
            <div className="sp-overall-label">
              <span>Overall progress</span>
              <span>{stats.pct}%</span>
            </div>
            <div className="sp-overall-track">
              <div className="sp-overall-fill" style={{ width: `${stats.pct}%` }} />
            </div>
          </div>
        </>
      )}

      {error && <div className="sp-error" style={{ margin: '1rem 2rem' }}>⚠ {error}</div>}

      {/* Body */}
      <div className="sp-body">
        {loading ? (
          <div className="sp-loading">
            <div className="fc-spinner" />
            <span>Loading…</span>
          </div>
        ) : !plan ? (
          <div className="sp-empty">
            <div className="sp-empty-icon">📅</div>
            <div className="sp-empty-title">No Study Plan Yet</div>
            <div className="sp-empty-sub">
              Generate an AI-powered day-by-day schedule tailored to your exam date and topics.
              It uses spaced repetition (SM-2) to schedule optimal review sessions.
            </div>
            <button className="sp-btn sp-btn--primary" style={{ marginTop: '0.5rem', padding: '0.75rem 2rem', fontSize: '0.95rem' }}
              onClick={() => setShowGen(true)}>
              ✨ Generate My Study Plan
            </button>
          </div>
        ) : plan.days.length === 0 ? (
          <div className="sp-empty">
            <div className="sp-empty-icon">🤔</div>
            <div className="sp-empty-title">Empty Plan</div>
            <div className="sp-empty-sub">This plan has no days. Try regenerating it.</div>
          </div>
        ) : (
          plan.days.map((day, i) => (
            <DayCard
              key={i}
              day={day}
              today={today}
              planId={plan._id}
              onSlotUpdate={handleSlotUpdate}
            />
          ))
        )}
      </div>

      {/* Generator Modal */}
      {showGen && (
        <GeneratorModal
          courseId={courseId}
          courseConcepts={courseConcepts}
          onClose={() => setShowGen(false)}
          onGenerated={handleGenerated}
        />
      )}
    </div>
  )
}
