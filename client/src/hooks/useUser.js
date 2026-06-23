import { useUser as useClerkUser } from '@clerk/clerk-react'

/**
 * useUser — thin wrapper over Clerk's useUser that exposes
 * commonly needed derived fields (initials, displayName, etc.)
 */
export function useUser() {
  const { user, isLoaded, isSignedIn } = useClerkUser()

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.emailAddresses?.[0]?.emailAddress?.split('@')[0] ||
      'User'
    : 'User'

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() ||
      user.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || '?'
    : '?'

  const email = user?.emailAddresses?.[0]?.emailAddress ?? ''
  const avatar = user?.imageUrl ?? null

  return {
    user,
    isLoaded,
    isSignedIn,
    displayName,
    initials,
    email,
    avatar,
  }
}
