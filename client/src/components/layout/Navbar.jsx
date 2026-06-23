import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { useAxios } from '../../hooks/useAxios'
import Sidebar from './Sidebar'
import NotificationBell from '../ui/NotificationBell'
import './Navbar.css'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/teacher',   label: 'Classroom'  },
  { to: '/upgrade',   label: 'Upgrade'   },
]

export default function Navbar() {
  const { user }    = useUser()
  const navigate    = useNavigate()
  const location    = useLocation()
  const api         = useAxios()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [streak,      setStreak]      = useState(null)
  const [isPro,       setIsPro]       = useState(false)

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  // Load streak + plan status
  useEffect(() => {
    Promise.allSettled([
      api.get('/api/analytics'),
      api.get('/api/billing/status'),
    ]).then(([analyticsRes, billingRes]) => {
      if (analyticsRes.status === 'fulfilled') {
        const d = analyticsRes.value.data || {}
        const maxStreak = d.summary?.maxStreak ?? d.maxStreak ?? 0
        if (maxStreak > 0) setStreak(maxStreak)
      }
      if (billingRes.status === 'fulfilled') {
        setIsPro(billingRes.value.data?.plan === 'pro')
      }
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Derive initials for avatar fallback
  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?'

  return (
    <>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <header className="nav-wrapper">
        <div className="nav-pill glass-strong">

          {/* ── Logo ─────────────────────────────── */}
          <button
            className="nav-logo"
            onClick={() => navigate('/dashboard')}
            aria-label="NexLearn home"
          >
            <div className="nav-logo-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"
                  fill="white"
                />
              </svg>
            </div>
            <span className="nav-logo-text">NexLearn</span>
          </button>

          {/* ── Center links ─────────────────────── */}
          <nav className="nav-links" role="navigation" aria-label="Main navigation">
            {NAV_LINKS.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* ── Right: streak + plan + notifications + avatar + menu ── */}
          <div className="nav-right">
            {streak !== null && (
              <div className="nav-streak" title="Current study streak">
                🔥 <span>{streak}</span>
              </div>
            )}

            {isPro ? (
              <div className="nav-pro-badge">⭐ Pro</div>
            ) : (
              <button
                className="nav-upgrade-btn"
                onClick={() => navigate('/upgrade')}
                id="nav-upgrade-btn"
              >
                ⭐ Go Pro
              </button>
            )}

            {/* Notification bell */}
            <NotificationBell />

            {/* Avatar → Profile */}
            <button
              className="nav-avatar-btn"
              onClick={() => navigate('/profile')}
              aria-label="Open profile"
              id="nav-avatar-btn"
            >
              {user?.imageUrl
                ? <img src={user.imageUrl} alt="avatar" />
                : <span>{initials}</span>
              }
            </button>

            {/* Hamburger → Sidebar */}
            <button
              className={`nav-hamburger${sidebarOpen ? ' nav-hamburger--open' : ''}`}
              onClick={() => setSidebarOpen(o => !o)}
              aria-label="Open menu"
              aria-expanded={sidebarOpen}
              id="nav-hamburger"
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>
    </>
  )
}
