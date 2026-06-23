/**
 * Card — glassmorphism card primitive.
 *
 * Props:
 *   variant   — 'default' | 'strong'  (glass vs glass-strong)
 *   hover     — boolean, adds hover lift effect
 *   padding   — CSS padding string (default '1.5rem')
 *   onClick   — if provided, renders as clickable
 *   className — extra class
 */
export default function Card({
  children,
  variant   = 'default',
  hover     = false,
  padding   = '1.5rem',
  onClick,
  className = '',
  style: extraStyle = {},
}) {
  const glassClass = variant === 'strong' ? 'glass-strong' : 'glass'

  const style = {
    padding,
    cursor: onClick ? 'pointer' : 'default',
    transition: hover || onClick ? 'transform 0.18s ease, box-shadow 0.18s ease' : undefined,
    ...extraStyle,
  }

  const handleMouseEnter = e => {
    if (hover || onClick) {
      e.currentTarget.style.transform  = 'translateY(-2px)'
      e.currentTarget.style.boxShadow  = '0 8px 32px rgba(0,0,0,0.5)'
    }
  }
  const handleMouseLeave = e => {
    if (hover || onClick) {
      e.currentTarget.style.transform = ''
      e.currentTarget.style.boxShadow = ''
    }
  }

  return (
    <div
      className={`nx-card ${glassClass} ${className}`}
      style={style}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  )
}
