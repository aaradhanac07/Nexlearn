import { useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { useAxios } from '../hooks/useAxios'
import SmartIngest from '../components/course/SmartIngest'
import './Dashboard.css'

const SRC_ICON = { youtube: '🎬', pdf: '📄', text: '📝', merge: '🔗' }

// Gradient strips per course slot
const CARD_GRADIENTS = [
  'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
  'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
  'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
]

function MasteryBar({ pct }) {
  const color = pct >= 75 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#6366f1'
  return (
    <div className="db-mastery">
      <div className="db-mastery-row">
        <span className="db-mastery-label">Mastery</span>
        <span className="db-mastery-pct" style={{ color }}>{pct}%</span>
      </div>
      <div className="db-mastery-track">
        <div className="db-mastery-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useUser()
  const api       = useAxios()
  const navigate  = useNavigate()

  const [courses,  setCourses]  = useState([])
  const [progress, setProgress] = useState({})
  const [dueCount, setDueCount] = useState(0)
  const [plan,     setPlan]     = useState('free')
  const [loading,  setLoading]  = useState(true)

  const loadCourses = async () => {
    try {
      const { data } = await api.get('/api/courses')
      setCourses(data)
    } catch (e) { console.error(e) }
  }

  const loadProgress = async () => {
    try {
      const [progRes, dueRes] = await Promise.allSettled([
        api.get('/api/quiz/progress'),
        api.get('/api/cards/due-count')
      ])
      if (progRes.status === 'fulfilled') {
        const map = {}
        for (const p of progRes.value.data) map[p.courseId] = p
        setProgress(map)
      }
      if (dueRes.status === 'fulfilled') setDueCount(dueRes.value.data.count)
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    const syncUser = async () => {
      try { await api.post('/api/auth/sync') } catch {}
    }
    syncUser().then(() => {
      Promise.all([loadCourses(), loadProgress()]).finally(() => setLoading(false))
    })
    api.get('/api/billing/status')
      .then(r => setPlan(r.data.plan))
      .catch(() => {})
  }, [])

  const maxStreak = Math.max(0, ...Object.values(progress).map(p => p.streak || 0))

  return (
    <div className="db-root page-enter">

      {/* ── Hero greeting ─────────────────────────── */}
      <div className="db-hero">
        <div className="db-greeting">
          <h1 className="db-hello">Hello, {user?.firstName || 'Learner'} 👋</h1>
          <p className="db-sub">You're on a roll. Keep the streak alive.</p>
        </div>

        <div className="db-stats-row">
          {maxStreak > 0 && (
            <div className="db-stat-chip db-stat-chip--fire">
              🔥 {maxStreak} day streak
            </div>
          )}
          {dueCount > 0 && (
            <div className="db-stat-chip db-stat-chip--indigo">
              🃏 {dueCount} due
            </div>
          )}
        </div>
      </div>

      <div className="db-body">

        {/* ── Smart Ingest panel ─────────────────── */}
        <section className="db-ingest-section">
          <div className="db-ingest-card glass">
            <div className="db-ingest-header">
              <span className="db-ingest-icon">✨</span>
              <h2 className="db-ingest-title">Smart Ingest — turn anything into a course</h2>
            </div>
            <SmartIngest
              userPlan={plan}
              onSuccess={() => {
                loadCourses()
                loadProgress()
              }}
            />
          </div>
        </section>

        {/* ── Courses grid ───────────────────────── */}
        <section className="db-courses-section">
          <div className="section-row">
            <h2 className="db-section-heading">Your Courses</h2>
            {courses.length > 0 && (
              <span className="db-course-count">{courses.length} active</span>
            )}
          </div>

          {loading ? (
            <div className="db-courses-grid">
              {[1,2,3].map(i => (
                <div key={i} className="db-course-card">
                  <div className="db-card-strip skeleton" style={{ height: 6 }} />
                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="skeleton" style={{ height: 12, width: '60%' }} />
                    <div className="skeleton" style={{ height: 10, width: '85%' }} />
                    <div className="skeleton" style={{ height: 10, width: '40%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="db-empty glass">
              <div className="db-empty-icon">🚀</div>
              <p className="db-empty-title">No courses yet</p>
              <p className="db-empty-desc">Add a YouTube video, upload a PDF, or paste your notes above!</p>
            </div>
          ) : (
            <div className="db-courses-grid">
              {courses.map((c, idx) => {
                const prog    = progress[c._id]
                const mastery = prog?.masteryPct ?? 0
                const streak  = prog?.streak ?? 0
                const icon    = SRC_ICON[c.sourceType] || '📄'
                const concepts = c.concepts?.length || c.studyOrder?.length || 0
                const gradient = CARD_GRADIENTS[idx % CARD_GRADIENTS.length]

                return (
                  <div
                    key={c._id}
                    className="db-course-card glass card-hover"
                    onClick={() => navigate(`/courses/${c._id}`)}
                  >
                    {/* Colour strip at top */}
                    <div className="db-card-strip" style={{ background: gradient }} />

                    <div className="db-card-body">
                      {/* Header row */}
                      <div className="db-card-header">
                        <span className="db-src-icon" title={c.sourceType}>{icon}</span>
                        <span className={`badge badge-${c.status === 'ready' ? 'green' : c.status === 'processing' ? 'amber' : 'red'}`}>
                          {c.status?.toUpperCase()}
                        </span>
                        {streak > 0 && (
                          <span className="db-card-streak">🔥 {streak}d</span>
                        )}
                      </div>

                      {/* Title + desc */}
                      <h3 className="db-card-title">{c.title}</h3>
                      <p className="db-card-desc">{c.description || 'No description'}</p>

                      {/* Meta chips */}
                      {concepts > 0 && (
                        <div className="db-meta-row">
                          <span className="db-meta-chip">🧠 {concepts} concepts</span>
                          {c.cardCount > 0 && (
                            <span className="db-meta-chip">🃏 {c.cardCount} cards</span>
                          )}
                          {streak > 0 && (
                            <span className="db-meta-chip db-meta-chip--fire">🔥 {streak}</span>
                          )}
                        </div>
                      )}

                      <MasteryBar pct={mastery} />

                      {/* Action buttons */}
                      <div className="db-card-actions">
                        <button
                          className="db-action-btn"
                          onClick={e => { e.stopPropagation(); navigate(`/courses/${c._id}/flashcards`) }}
                        >
                          🃏 Review
                        </button>
                        <button
                          className="db-action-btn"
                          onClick={e => { e.stopPropagation(); navigate(`/courses/${c._id}/quiz`) }}
                        >
                          🧠 Quiz
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}