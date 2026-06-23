import { useAuth } from '@clerk/clerk-react'
import { Navigate, Outlet } from 'react-router-dom'
import AppShell from '../layout/AppShell'

/**
 * ProtectedRoute — guards all authenticated routes.
 * Shows a full-screen loader while Clerk initialises,
 * redirects to /sign-in if unauthenticated,
 * and wraps the page with AppShell (Navbar + content area).
 */
export default function ProtectedRoute() {
  const { isSignedIn, isLoaded } = useAuth()

  if (!isLoaded) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        background: '#0a0a0f',
        color: '#64748b',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{
          width: 36,
          height: 36,
          border: '2.5px solid rgba(255,255,255,0.08)',
          borderTopColor: '#6366f1',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ fontSize: '0.85rem' }}>Loading NexLearn…</span>
      </div>
    )
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }

  return <AppShell />
}