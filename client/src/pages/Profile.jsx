import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser, useClerk } from '@clerk/clerk-react'
import { useAxios } from '../hooks/useAxios'
import { useTheme } from '../hooks/useTheme'
import './Profile.css'

const STAT_CARDS = [
  { key: 'courses',    label: 'Courses',       icon: '📚', color: '#6366f1' },
  { key: 'cards',      label: 'Flashcards',    icon: '🃏', color: '#10b981' },
  { key: 'avgMastery', label: 'Avg Mastery',   icon: '🎯', color: '#f59e0b', suffix: '%' },
  { key: 'streak',     label: 'Day Streak',    icon: '🔥', color: '#ef4444' },
]

export default function Profile() {
  const { user }       = useUser()
  const { signOut }    = useClerk()
  const api            = useAxios()
  const navigate       = useNavigate()
  const { theme, toggle } = useTheme()

  const [stats,   setStats]   = useState(null)
  const [isPro,   setIsPro]   = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      api.get('/api/analytics'),
      api.get('/api/billing/status'),
    ]).then(([analyticsRes, billingRes]) => {
      if (analyticsRes.status === 'fulfilled') {
        const d = analyticsRes.value.data || {}
        const s = d.summary || d   // handle both { summary: {...} } and flat shapes
        setStats({
          courses:    s.totalCourses   ?? 0,
          cards:      s.totalCards     ?? 0,
          avgMastery: s.avgMastery     ?? 0,
          streak:     s.maxStreak      ?? 0,
        })
      }
      if (billingRes.status === 'fulfilled') {
        setIsPro(billingRes.value.data?.plan === 'pro')
      }
    }).finally(() => setLoading(false))
  }, [])

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.emailAddresses?.[0]?.emailAddress?.split('@')[0]
    : 'User'
  const email    = user?.emailAddresses?.[0]?.emailAddress ?? ''
  const initials = displayName
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const joinDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  return (
    <div className="prof-root">
      {/* Back */}
      <div className="prof-topbar">
        <button className="fc-back" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>

      <div className="prof-body">

        {/* ── Hero card ─────────────────────── */}
        <div className="prof-hero glass">
          <div className="prof-hero-bg" />

          {/* Avatar */}
          <div className="prof-avatar-wrap">
            <div className="prof-avatar">
              {user?.imageUrl
                ? <img src={user.imageUrl} alt="avatar" />
                : <span>{initials}</span>
              }
            </div>
            {isPro && <div className="prof-pro-ring" />}
          </div>

          <div className="prof-hero-info">
            <h1 className="prof-name">{displayName}</h1>
            <p className="prof-email">{email}</p>
            <div className="prof-meta">
              {isPro ? (
                <span className="prof-badge prof-badge--pro">⭐ Pro Member</span>
              ) : (
                <span className="prof-badge prof-badge--free">Free Plan</span>
              )}
              {joinDate && (
                <span className="prof-badge prof-badge--date">📅 Joined {joinDate}</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Stats row ─────────────────────── */}
        {loading ? (
          <div className="prof-stats-loading">
            <div className="fc-spinner" />
          </div>
        ) : (
          <div className="prof-stats">
            {STAT_CARDS.map(s => (
              <div key={s.key} className="prof-stat glass">
                <div className="prof-stat-icon" style={{ color: s.color, background: `${s.color}18` }}>
                  {s.icon}
                </div>
                <div className="prof-stat-val">
                  {stats?.[s.key] ?? 0}{s.suffix ?? ''}
                </div>
                <div className="prof-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Settings ──────────────────────── */}
        <div className="prof-section glass">
          <h2 className="prof-section-title">Preferences</h2>

          <div className="prof-setting-row">
            <div className="prof-setting-info">
              <span className="prof-setting-label">Theme</span>
              <span className="prof-setting-sub">
                {theme === 'dark' ? '🌙 Dark mode' : '☀️ Light mode'}
              </span>
            </div>
            <button
              className={`prof-toggle ${theme === 'light' ? 'prof-toggle--on' : ''}`}
              onClick={toggle}
              aria-label="Toggle theme"
              id="theme-toggle-btn"
            >
              <span className="prof-toggle-knob" />
            </button>
          </div>
        </div>

        {/* ── Plan ─────────────────────────── */}
        {!isPro && (
          <div className="prof-upgrade glass">
            <div className="prof-upgrade-text">
              <h3>Upgrade to Pro</h3>
              <p>Unlimited courses, AI study buddy, priority responses &amp; more.</p>
            </div>
            <button
              className="prof-upgrade-btn"
              onClick={() => navigate('/upgrade')}
              id="profile-upgrade-btn"
            >
              ⭐ Upgrade — ₹299/mo
            </button>
          </div>
        )}

        {/* ── Danger zone ───────────────────── */}
        <div className="prof-section glass">
          <h2 className="prof-section-title prof-section-title--danger">Account</h2>
          <button
            className="prof-signout-btn"
            onClick={() => signOut({ redirectUrl: '/sign-in' })}
            id="profile-signout-btn"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            Sign out
          </button>
        </div>

      </div>
    </div>
  )
}
