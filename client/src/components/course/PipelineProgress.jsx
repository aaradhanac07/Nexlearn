/**
 * PipelineProgress — animated pipeline stage visualizer.
 * Shows live stages as the AI processes content.
 */

const STAGE_CONFIG = {
  fetching:   { icon: '🔍', label: 'Fetching',         order: 0 },
  chunking:   { icon: '✂️',  label: 'Chunking',         order: 1 },
  embedding:  { icon: '🧮', label: 'Embedding',        order: 2 },
  analyzing:  { icon: '🕸️', label: 'Knowledge Graph',  order: 3 },
  flashcards: { icon: '🎴', label: 'Flashcards',       order: 4 },
  complete:   { icon: '✅', label: 'Ready!',            order: 5 },
}

const STAGE_ORDER = ['fetching', 'chunking', 'embedding', 'analyzing', 'flashcards', 'complete']

export default function PipelineProgress({ currentStage, lastMessage, error }) {

  const getStatus = (stageName) => {
    if (error) return 'idle'
    const currentIdx = STAGE_ORDER.indexOf(currentStage)
    const stageIdx   = STAGE_ORDER.indexOf(stageName)
    if (currentStage === 'complete') return 'done'
    if (stageIdx < currentIdx)  return 'done'
    if (stageIdx === currentIdx) return 'active'
    return 'idle'
  }

  const progressPct = Math.round(
    ((STAGE_ORDER.indexOf(currentStage) + 1) / STAGE_ORDER.length) * 100
  )

  return (
    <div className="pp-root">
      {/* Stage track */}
      <div className="pp-track">
        {STAGE_ORDER.map((stageName, idx) => {
          const cfg    = STAGE_CONFIG[stageName]
          const status = getStatus(stageName)

          return (
            <div key={stageName} className={`pp-stage pp-stage--${status}`}>
              {/* Connector line */}
              {idx > 0 && (
                <div className={`pp-connector pp-connector--${getStatus(STAGE_ORDER[idx - 1])}`} />
              )}

              {/* Node */}
              <div className="pp-node">
                <div className={`pp-icon-wrap pp-icon-wrap--${status}`}>
                  {status === 'done'   && <span className="pp-check">✓</span>}
                  {status === 'active' && <span className="pp-spinner" />}
                  {status === 'idle'   && <span className="pp-stage-emoji">{cfg.icon}</span>}
                </div>
                <span className="pp-label">{cfg.label}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Live message */}
      {(lastMessage || error) && (
        <div className={`pp-message ${error ? 'pp-message--error' : ''}`}>
          <span className="pp-msg-dot" />
          <span>{error || lastMessage}</span>
        </div>
      )}

      {/* Progress bar */}
      {!error && currentStage && (
        <div className="pp-bar-track">
          <div
            className="pp-bar-fill"
            style={{ width: `${currentStage === 'complete' ? 100 : progressPct}%` }}
          />
        </div>
      )}
    </div>
  )
}
