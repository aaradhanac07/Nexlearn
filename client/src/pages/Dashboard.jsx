import { useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { useAxios } from '../hooks/useAxios'
import { useTheme } from '../hooks/useTheme'
import IngestForm from '../components/course/IngestForm'
import SmartIngest from '../components/course/SmartIngest'
import NotificationBell from '../components/ui/NotificationBell'
import './Dashboard.css'

export default function Dashboard() {
  const { user } = useUser()
  const api = useAxios()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const [courses, setCourses]   = useState([])
  const [progress, setProgress] = useState({})   // courseId → { masteryPct, streak }
  const [dueCount, setDueCount] = useState(0)
  const [plan, setPlan]         = useState('free')

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
        for (const p of progRes.value.data) {
          map[p.courseId] = p
        }
        setProgress(map)
      }
      if (dueRes.status === 'fulfilled') {
        setDueCount(dueRes.value.data.count)
      }
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    const syncUser = async () => {
      try { await api.post('/api/auth/sync') } catch {}
    }
    syncUser().then(() => {
      loadCourses()
      loadProgress()
    })
    // Load billing status (silent)
    api.get('/api/billing/status')
      .then(r => setPlan(r.data.plan))
      .catch(() => {})
  }, [])

  const maxStreak = Math.max(0, ...Object.values(progress).map(p => p.streak || 0))

  return (
    <div className="dash-root">
      {/* Top bar */}
      <div className="dash-topbar">
        <div className="dash-greeting">
          <h1 className="dash-hello">Hello, {user?.firstName || 'Learner'} 👋</h1>
          <p className="dash-sub">Your adaptive AI learning hub</p>
        </div>
        <div className="dash-topbar-right">
          {maxStreak > 0 && (
            <div className="dash-streak-badge">
              🔥 {maxStreak} day streak
            </div>
          )}
          {dueCount > 0 && (
            <div className="dash-due-badge">
              {dueCount} card{dueCount !== 1 ? 's' : ''} due
            </div>
          )}
          <button className="dash-nav-btn" onClick={() => navigate('/analytics')} title="Analytics">📊</button>
          <button className="dash-nav-btn" onClick={() => navigate('/teacher')} title="Teacher Dashboard">🏫</button>
          <button className="dash-nav-btn" onClick={toggle} title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {plan === 'pro' ? (
            <div className="dash-pro-badge" title="You are on Pro plan">⭐ Pro</div>
          ) : (
            <button className="dash-upgrade-btn" onClick={() => navigate('/upgrade')} title="Upgrade to Pro">
              ⚡ Upgrade
            </button>
          )}
          <NotificationBell />
        </div>
      </div>

      <div className="dash-body">
        {/* Upload form */}
        <div className="dash-section">
          <h2 className="dash-section-title">➕ Add Course</h2>
          <SmartIngest
            userPlan={plan}
            onSuccess={() => {
              // Reload the full course list so new course shows with all fields
              loadCourses()
              loadProgress()
            }}
          />
        </div>

        {/* Courses */}
        <div className="dash-section">
          <h2 className="dash-section-title">📚 Your Courses</h2>
          {courses.length === 0 ? (
            <div className="dash-empty">
              <div className="dash-empty-icon">🚀</div>
              <p>No courses yet. Add a YouTube video, upload a PDF, or paste your notes above!</p>
            </div>
          ) : (
            <div className="dash-courses-grid">
              {courses.map(c => {
                const prog    = progress[c._id]
                const mastery = prog?.masteryPct ?? 0
                const streak  = prog?.streak ?? 0
                const srcIcon = { youtube: '🎬', pdf: '📄', text: '📝', merge: '🔗' }[c.sourceType] || '📄'
                const conceptCount = c.concepts?.length || c.studyOrder?.length || 0
                return (
                  <div
                    key={c._id}
                    className="dash-course-card"
                    onClick={() => navigate(`/courses/${c._id}`)}
                  >
                    <div className="dash-course-header">
                      <div style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                        <span className={`dash-status dash-status--${c.status}`}>{c.status}</span>
                        <span className="dash-src-icon" title={c.sourceType}>{srcIcon}</span>
                      </div>
                      {streak > 0 && <span className="dash-course-streak">🔥 {streak}d</span>}
                    </div>
                    <h3 className="dash-course-title">{c.title}</h3>
                    <p className="dash-course-desc">{c.description || 'No description'}</p>

                    {/* Concept count if available */}
                    {conceptCount > 0 && (
                      <div className="dash-concept-row">
                        <span className="dash-concept-badge">🧠 {conceptCount} concept{conceptCount !== 1 ? 's' : ''}</span>
                        {c.cardCount > 0 && <span className="dash-concept-badge">🃏 {c.cardCount} cards</span>}
                      </div>
                    )}

                    {/* Mastery bar */}
                    <div className="dash-mastery">
                      <div className="dash-mastery-row">
                        <span>Mastery</span>
                        <span className="dash-mastery-pct">{mastery}%</span>
                      </div>
                      <div className="dash-mastery-track">
                        <div
                          className="dash-mastery-fill"
                          style={{
                            width: `${mastery}%`,
                            background: mastery >= 75 ? '#10b981' : mastery >= 40 ? '#f59e0b' : '#6366f1'
                          }}
                        />
                      </div>
                    </div>

                    <div className="dash-course-actions">
                      <button className="dash-action-btn" onClick={e => { e.stopPropagation(); navigate(`/courses/${c._id}/flashcards`) }}>
                        🃏 Review
                      </button>
                      <button className="dash-action-btn" onClick={e => { e.stopPropagation(); navigate(`/courses/${c._id}/quiz`) }}>
                        🧠 Quiz
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}