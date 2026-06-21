/**
 * CourseStructureModal — post-ingestion overlay showing AI-proposed course structure.
 * Displays concepts in study order, summary, cross-reference, and action buttons.
 */
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export default function CourseStructureModal({ result, onClose }) {
  const navigate = useNavigate()
  const panelRef = useRef(null)

  const course     = result?.course   || {}
  const courseId   = course._id || result?.courseId
  const studyOrder = result?.studyOrder || course.studyOrder || course.concepts || []
  const sources    = result?.sources  || course.sources || []

  // crossReference can come from either result.metadata or course directly
  const crossRef = result?.metadata?.crossReference || course.crossReference || null

  // title / description from AI result (richer) or from Mongo course obj
  const title       = result?.metadata?.title       || course.title       || 'Course Ready!'
  const description = result?.metadata?.description || course.description || ''

  // summary can be array (from AI pipeline) or newline-string (from Mongo)
  const summaryLines = (() => {
    const s = result?.metadata?.summary || course.summary
    if (!s) return []
    if (Array.isArray(s)) return s.filter(Boolean).slice(0, 5)
    return s.split('\n').filter(Boolean).map(l => l.replace(/^[-•*]\s*/, '')).slice(0, 5)
  })()

  // Entrance animation
  useEffect(() => {
    requestAnimationFrame(() => {
      if (panelRef.current) panelRef.current.classList.add('csm-panel--visible')
    })
  }, [])

  const hasSources   = sources.length > 0
  const sourceIcons  = { pdf: '📄', youtube: '🎬', text: '📝' }

  const go = (path) => {
    onClose()
    navigate(path)
  }

  return (
    <div className="csm-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="csm-panel" ref={panelRef}>

        {/* Header */}
        <div className="csm-header">
          <div className="csm-success-ring">
            <span className="csm-success-icon">🎉</span>
          </div>
          <h2 className="csm-title">Course Ready!</h2>
          <p className="csm-subtitle">{title}</p>
          <button className="csm-close" onClick={onClose}>✕</button>
        </div>

        {/* Sources */}
        {hasSources && (
          <div className="csm-sources">
            {sources.map((s, i) => (
              <span key={i} className={`csm-source-chip csm-source-chip--${s.type}`}>
                {sourceIcons[s.type] || '📎'} {s.name || s.url?.slice(0, 40) || s.type}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {description && (
          <p className="csm-desc">{description}</p>
        )}

        {/* Study Order */}
        {studyOrder.length > 0 && (
          <div className="csm-concepts">
            <div className="csm-concepts-header">
              <span className="csm-concepts-label">
                🧠 Suggested Study Order — {studyOrder.length} concepts
              </span>
            </div>
            <div className="csm-concept-flow">
              {studyOrder.map((concept, i) => (
                <div key={i} className="csm-concept-item">
                  <div className="csm-concept-badge">
                    <span className="csm-concept-num">{i + 1}</span>
                    <span className="csm-concept-name">{concept}</span>
                  </div>
                  {i < studyOrder.length - 1 && (
                    <span className="csm-arrow">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cross-reference note for merged sources */}
        {crossRef && (
          <div className="csm-crossref">
            <span className="csm-crossref-icon">🔗</span>
            <p>{crossRef}</p>
          </div>
        )}

        {/* Summary bullets */}
        {summaryLines.length > 0 && (
          <div className="csm-summary">
            <p className="csm-summary-label">📋 What you'll learn</p>
            <ul className="csm-summary-list">
              {summaryLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Action buttons */}
        <div className="csm-actions">
          {courseId && (
            <>
              <button className="csm-btn csm-btn--primary" onClick={() => go(`/courses/${courseId}`)}>
                💬 Start Learning
              </button>
              <button className="csm-btn csm-btn--secondary" onClick={() => go(`/courses/${courseId}/flashcards`)}>
                🃏 Flashcards
              </button>
              <button className="csm-btn csm-btn--secondary" onClick={() => go(`/courses/${courseId}/quiz`)}>
                🧠 Quiz Me
              </button>
            </>
          )}
          <button className="csm-btn csm-btn--ghost" onClick={onClose}>
            Stay on Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
