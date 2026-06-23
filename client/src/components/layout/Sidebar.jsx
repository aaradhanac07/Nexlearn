import { NavLink, useNavigate } from 'react-router-dom'
import { useUser, useClerk } from '@clerk/clerk-react'
import './Sidebar.css'

const NAV = [
  { to: '/dashboard',  icon: '🏠', label: 'Dashboard'  },
  { to: '/analytics',  icon: '📊', label: 'Analytics'  },
  { to: '/teacher',    icon: '🏫', label: 'Classroom'  },
  { to: '/upgrade',    icon: '⭐', label: 'Upgrade'    },
  { to: '/profile',    icon: '👤', label: 'Profile'    },
]

export default function Sidebar({ open, onClose }) {
  const { user }    = useUser()
  const { signOut } = useClerk()
  const navigate    = useNavigate()

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || user.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase()
    : '?'

  return (
    <>
      {/* Overlay */}
      {open && <div className="sb-overlay" onClick={onClose} />}

      {/* Drawer */}
      <aside className={`sb-drawer glass-strong ${open ? 'sb-drawer--open' : ''}`}>
        {/* Logo */}
        <div className="sb-logo">
          <div className="sb-logo-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" fill="white"/>
            </svg>
          </div>
          <span className="sb-logo-text">NexLearn</span>
          <button className="sb-close-btn" onClick={onClose} aria-label="Close menu">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="sb-nav">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) => `sb-link ${isActive ? 'sb-link--active' : ''}`}
            >
              <span className="sb-link-icon">{item.icon}</span>
              <span className="sb-link-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="sb-footer">
          <div className="sb-user" onClick={() => { navigate('/profile'); onClose() }}>
            <div className="sb-avatar">
              {user?.imageUrl
                ? <img src={user.imageUrl} alt="avatar" />
                : initials
              }
            </div>
            <div className="sb-user-info">
              <span className="sb-user-name">
                {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}` : 'User'}
              </span>
              <span className="sb-user-email">
                {user?.emailAddresses?.[0]?.emailAddress}
              </span>
            </div>
          </div>
          <button
            className="sb-signout-btn"
            onClick={() => signOut({ redirectUrl: '/sign-in' })}
            aria-label="Sign out"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
          </button>
        </div>
      </aside>
    </>
  )
}
