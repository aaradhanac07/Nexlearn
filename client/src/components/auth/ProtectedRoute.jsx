import { useAuth } from '@clerk/clerk-react'
import { Navigate, Outlet } from 'react-router-dom'

export default function ProtectedRoute() {
  const { isSignedIn, isLoaded } = useAuth()

  if (!isLoaded) {
    return (
      <div>
        Loading...
      </div>
    )
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }

  return <Outlet />
}