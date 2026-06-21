import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAxios } from '../hooks/useAxios'
import '../styles/flashcards.css'

const RATINGS = [
  { value: 0, label: 'Again',  emoji: '❌', color: '#ef4444', desc: 'Forgot completely' },
  { value: 1, label: 'Hard',   emoji: '😰', color: '#f97316', desc: 'Very difficult' },
  { value: 2, label: 'Good',   emoji: '👍', color: '#3b82f6', desc: 'Got it right' },
  { value: 3, label: 'Easy',   emoji: '⚡', color: '#10b981', desc: 'Knew instantly' },
]

export default function Flashcards() {
  const { id: courseId } = useParams()
  const navigate = useNavigate()
  const api = useAxios()

  const [cards, setCards]           = useState([])
  const [current, setCurrent]       = useState(0)
  const [flipped, setFlipped]       = useState(false)
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [exporting, setExporting]   = useState(false)
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 })
  const [done, setDone]             = useState(false)
  const [error, setError]           = useState('')

  const exportAnki = async () => {
    setExporting(true)
    try {
      const response = await api.get(`/api/export/anki/${courseId}`, { responseType: 'blob' })
      const url  = URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `nexlearn_${courseId}.apkg`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert('Export failed. Make sure the AI service is running.')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    loadCards()
  }, [courseId])

  const loadCards = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/api/cards?courseId=${courseId}&dueOnly=true`)
      if (data.length === 0) {
        setDone(true)
      }
      setCards(data)
    } catch (e) {
      setError('Failed to load cards')
    } finally {
      setLoading(false)
    }
  }

  const handleFlip = () => setFlipped(f => !f)

  const handleRate = useCallback(async (rating) => {
    if (submitting || current >= cards.length) return
    setSubmitting(true)

    const card = cards[current]
    const ratingLabel = ['again', 'hard', 'good', 'easy'][rating]

    try {
      await api.post(`/api/cards/${card._id}/review`, { rating })
      setSessionStats(s => ({
        ...s,
        reviewed: s.reviewed + 1,
        [ratingLabel]: (s[ratingLabel] || 0) + 1
      }))
    } catch (e) {
      console.error('Review failed:', e)
    }

    setFlipped(false)
    setTimeout(() => {
      if (current + 1 >= cards.length) {
        setDone(true)
      } else {
        setCurrent(c => c + 1)
      }
      setSubmitting(false)
    }, 300)
  }, [submitting, current, cards, api])

  if (loading) return <LoadingScreen />

  if (error) return (
    <div className="fc-center">
      <p className="fc-error">{error}</p>
      <button className="fc-btn-primary" onClick={() => navigate(-1)}>← Back</button>
    </div>
  )

  if (done) return <SessionComplete stats={sessionStats} onRestart={() => { setDone(false); setCurrent(0); setFlipped(false); setSessionStats({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 }); loadCards() }} onBack={() => navigate(`/courses/${courseId}`)} />

  const card = cards[current]
  const progress = ((current) / cards.length) * 100

  return (
    <div className="fc-root">
      <div className="fc-header">
        <button className="fc-back" onClick={() => navigate(`/courses/${courseId}`)}>← Back</button>
        <div className="fc-meta">
          <span className="fc-count">{current + 1} / {cards.length}</span>
          {card?.conceptTag && <span className="fc-tag">{card.conceptTag}</span>}
        </div>
        <button
          className="fc-export-btn"
          onClick={exportAnki}
          disabled={exporting}
          title="Export to Anki"
        >
          {exporting ? '⏳' : '📤'} Anki
        </button>
      </div>

      {/* Progress bar */}
      <div className="fc-progress-track">
        <div className="fc-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Card */}
      <div className="fc-card-area">
        <div
          className={`fc-card ${flipped ? 'fc-card--flipped' : ''}`}
          onClick={handleFlip}
        >
          <div className="fc-card-inner">
            <div className="fc-card-front">
              <div className="fc-side-label">Question</div>
              <p className="fc-card-text">{card?.front}</p>
              <p className="fc-hint">Click to reveal answer</p>
            </div>
            <div className="fc-card-back">
              <div className="fc-side-label">Answer</div>
              <p className="fc-card-text">{card?.back}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Rating buttons — only shown after flip */}
      <div className={`fc-ratings ${flipped ? 'fc-ratings--visible' : ''}`}>
        <p className="fc-ratings-label">How well did you know this?</p>
        <div className="fc-ratings-row">
          {RATINGS.map(r => (
            <button
              key={r.value}
              className="fc-rating-btn"
              style={{ '--rating-color': r.color }}
              onClick={() => handleRate(r.value)}
              disabled={submitting}
            >
              <span className="fc-rating-emoji">{r.emoji}</span>
              <span className="fc-rating-label">{r.label}</span>
              <span className="fc-rating-desc">{r.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function SessionComplete({ stats, onRestart, onBack }) {
  const total = stats.reviewed
  return (
    <div className="fc-complete">
      <div className="fc-complete-card">
        <div className="fc-complete-icon">🎉</div>
        <h2 className="fc-complete-title">Session Complete!</h2>
        <p className="fc-complete-sub">You reviewed {total} card{total !== 1 ? 's' : ''}</p>
        <div className="fc-stats-grid">
          <StatBadge emoji="❌" label="Again" count={stats.again} color="#ef4444" />
          <StatBadge emoji="😰" label="Hard"  count={stats.hard}  color="#f97316" />
          <StatBadge emoji="👍" label="Good"  count={stats.good}  color="#3b82f6" />
          <StatBadge emoji="⚡" label="Easy"  count={stats.easy}  color="#10b981" />
        </div>
        <div className="fc-complete-actions">
          <button className="fc-btn-secondary" onClick={onBack}>Back to Course</button>
          {stats.again > 0 && (
            <button className="fc-btn-primary" onClick={onRestart}>Review Again</button>
          )}
        </div>
      </div>
    </div>
  )
}

function StatBadge({ emoji, label, count, color }) {
  return (
    <div className="fc-stat-badge" style={{ '--badge-color': color }}>
      <span>{emoji}</span>
      <span className="fc-stat-count">{count}</span>
      <span className="fc-stat-label">{label}</span>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="fc-center">
      <div className="fc-spinner" />
      <p>Loading flashcards...</p>
    </div>
  )
}
