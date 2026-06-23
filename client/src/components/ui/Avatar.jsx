/**
 * Avatar — shows user photo or gradient initials fallback.
 * Props:
 *   user       — Clerk user object (optional)
 *   size       — pixel size (default 36)
 *   className  — extra CSS class
 *   onClick    — click handler
 */
export default function Avatar({ user, size = 36, className = '', onClick }) {
  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() ||
      user.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || '?'
    : '?'

  const style = {
    width: size,
    height: size,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: size * 0.35,
    fontWeight: 700,
    color: '#fff',
    flexShrink: 0,
    overflow: 'hidden',
    cursor: onClick ? 'pointer' : 'default',
    userSelect: 'none',
  }

  return (
    <div
      className={`avatar ${className}`}
      style={style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {user?.imageUrl
        ? <img src={user.imageUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span>{initials}</span>
      }
    </div>
  )
}
