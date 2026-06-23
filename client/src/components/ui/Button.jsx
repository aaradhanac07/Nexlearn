/**
 * Button — reusable premium button.
 *
 * Variants: 'primary' | 'secondary' | 'ghost' | 'danger'
 * Sizes:    'sm' | 'md' | 'lg'
 */

const VARIANTS = {
  primary: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border: 'none',
    color: '#fff',
    boxShadow: '0 2px 16px rgba(99,102,241,0.35)',
  },
  secondary: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#f1f5f9',
    boxShadow: 'none',
  },
  ghost: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#94a3b8',
    boxShadow: 'none',
  },
  danger: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.25)',
    color: '#f87171',
    boxShadow: 'none',
  },
}

const SIZES = {
  sm: { padding: '0.35rem 0.85rem', fontSize: '0.8rem',   borderRadius: '8px'   },
  md: { padding: '0.55rem 1.25rem', fontSize: '0.875rem', borderRadius: '10px'  },
  lg: { padding: '0.75rem 1.75rem', fontSize: '1rem',     borderRadius: '12px'  },
}

export default function Button({
  children,
  variant = 'primary',
  size    = 'md',
  disabled = false,
  loading  = false,
  fullWidth = false,
  onClick,
  type = 'button',
  id,
  className = '',
  style: extraStyle = {},
}) {
  const v = VARIANTS[variant] ?? VARIANTS.primary
  const s = SIZES[size]       ?? SIZES.md

  const baseStyle = {
    ...v,
    ...s,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.45rem',
    fontFamily: 'inherit',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.2s',
    width: fullWidth ? '100%' : undefined,
    ...extraStyle,
  }

  return (
    <button
      id={id}
      type={type}
      className={`nx-btn ${className}`}
      style={baseStyle}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading
        ? <span className="quiz-spinner" />
        : children
      }
    </button>
  )
}
