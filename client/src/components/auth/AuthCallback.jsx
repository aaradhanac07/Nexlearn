import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'

/**
 * AuthCallback — handles the OAuth / SSO redirect.
 * Clerk processes the token automatically; we just wait
 * for isSignedIn to become true, then redirect to /dashboard.
 */
export default function AuthCallback() {
  const { isSignedIn, isLoaded } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate('/dashboard', { replace: true })
    }
  }, [isLoaded, isSignedIn, navigate])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      background: 'var(--bg)',
      color: 'var(--text-muted)',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div className="fc-spinner" />
      <p style={{ fontSize: '0.9rem' }}>Signing you in…</p>
    </div>
  )
}
