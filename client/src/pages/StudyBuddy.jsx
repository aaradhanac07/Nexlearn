/**
 * AI Study Buddy — Voice-based concept practice
 * Students pick a concept, record a voice explanation,
 * get AI feedback + Socratic follow-up questions.
 * Progress (passed concepts) is persisted to the server so it
 * survives page reloads and revisits.
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAxios } from '../hooks/useAxios'
import '../styles/study-buddy.css'

export default function StudyBuddy() {
  const { id: courseId } = useParams()
  const navigate = useNavigate()
  const api = useAxios()

  const [course, setCourse]           = useState(null)
  const [concepts, setConcepts]       = useState([])
  const [selected, setSelected]       = useState(null)
  const [recording, setRecording]     = useState(false)
  const [processing, setProcessing]   = useState(false)
  const [transcript, setTranscript]   = useState('')
  const [result, setResult]           = useState(null)
  const [error, setError]             = useState('')
  const [recSeconds, setRecSeconds]   = useState(0)
  const [doneSet, setDoneSet]         = useState(new Set())
  const [loadingProgress, setLoadingProgress] = useState(true)

  const mediaRecRef  = useRef(null)
  const chunksRef    = useRef([])
  const timerRef     = useRef(null)

  // Load course info
  useEffect(() => {
    api.get(`/api/courses/${courseId}`)
      .then(r => {
        setCourse(r.data)
        // Extract concepts/topics from course
        const raw = r.data.concepts?.length
          ? r.data.concepts
          : r.data.studyOrder?.length
            ? r.data.studyOrder
            : ['Key Concepts']
        setConcepts(raw)
        setSelected(raw[0])
      })
      .catch(() => navigate('/'))
  }, [courseId])

  // ── Load persisted progress from server ────────────────────────────────────
  useEffect(() => {
    if (!courseId) return
    setLoadingProgress(true)
    api.get(`/api/study-buddy/progress/${courseId}`)
      .then(r => {
        const passed = r.data.concepts ?? []
        setDoneSet(new Set(passed))
      })
      .catch(() => {
        // Progress load failure is non-fatal — start fresh
        setDoneSet(new Set())
      })
      .finally(() => setLoadingProgress(false))
  }, [courseId])

  // Cleanup timer
  useEffect(() => () => clearInterval(timerRef.current), [])

  const startRecording = useCallback(async () => {
    setError('')
    setResult(null)
    setTranscript('')
    chunksRef.current = []

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('Microphone access denied. Please allow mic access in your browser settings.')
      return
    }

    const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    rec.onstop = () => { stream.getTracks().forEach(t => t.stop()) }
    rec.start(250)
    mediaRecRef.current = rec
    setRecording(true)
    setRecSeconds(0)
    timerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000)
  }, [])

  const stopRecording = useCallback(() => {
    if (!mediaRecRef.current) return
    mediaRecRef.current.stop()
    setRecording(false)
    clearInterval(timerRef.current)

    // Wait for onstop to finish collecting chunks
    setTimeout(() => submitAudio(), 300)
  }, [selected])

  const submitAudio = async () => {
    if (chunksRef.current.length === 0) {
      setError('No audio captured. Please try again.')
      return
    }

    setProcessing(true)
    setError('')

    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

      // Step 1: Transcribe
      const formData = new FormData()
      formData.append('audio', blob, 'recording.webm')
      const transRes = await api.post('/api/study-buddy/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      })
      const text = transRes.data.transcript || ''
      setTranscript(text)

      if (!text.trim()) {
        setError('No speech detected. Please try speaking more clearly.')
        setProcessing(false)
        return
      }

      // Step 2: Evaluate
      const evalRes = await api.post('/api/study-buddy/evaluate', {
        transcript: text,
        concept: selected,
        courseId,
      })
      setResult(evalRes.data)

      // Step 3: If passed, mark concept as done and persist to server
      if (evalRes.data.score >= 60) {
        setDoneSet(prev => new Set([...prev, selected]))
        // Fire-and-forget — failure is non-fatal
        api.post(`/api/study-buddy/progress/${courseId}`, { concept: selected })
          .catch(err => console.warn('[StudyBuddy] progress save failed:', err.message))
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'An error occurred. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  const handleRetry = () => {
    setResult(null)
    setTranscript('')
    setError('')
  }

  const handleNext = () => {
    const idx = concepts.indexOf(selected)
    const next = concepts[idx + 1]
    if (next) {
      setSelected(next)
      setResult(null)
      setTranscript('')
      setError('')
    }
  }

  const fmtTime = s => `${Math.floor(s / 60).toString().padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  const doneCount = doneSet.size
  const allDone = doneCount >= concepts.length && concepts.length > 0

  // Show spinner until both course and progress are loaded
  if (!course || loadingProgress) return (
    <div className="sb-root">
      <div className="sb-empty">
        <div className="fc-spinner" />
      </div>
    </div>
  )

  return (
    <div className="sb-root">
      {/* Header */}
      <div className="sb-header">
        <button className="fc-back" onClick={() => navigate(`/courses/${courseId}`)}>← Back</button>
        <div className="sb-header-info">
          <div className="sb-header-title">🎤 AI Study Buddy</div>
          <div className="sb-header-sub">{course?.title || 'Loading…'} — Voice-based concept practice</div>
        </div>
      </div>

      {allDone ? (
        <div className="sb-main" style={{ flex: 1 }}>
          <div className="sb-complete">
            <div className="sb-complete-icon">🎉</div>
            <div className="sb-complete-title">Session Complete!</div>
            <div className="sb-complete-sub">You mastered all {concepts.length} concept{concepts.length !== 1 ? 's' : ''}. Excellent work!</div>
            <button className="sb-btn-next" style={{ marginTop: '1rem', padding: '0.75rem 2rem', fontSize: '0.95rem' }}
              onClick={() => { setDoneSet(new Set()); setSelected(concepts[0]); setResult(null); setTranscript(''); }}>
              🔄 Practice Again
            </button>
          </div>
        </div>
      ) : (
        <div className="sb-body">
          {/* Concept sidebar */}
          <div className="sb-sidebar">
            <div className="sb-sidebar-title">Concepts</div>
            <div className="sb-progress-bar">
              <div className="sb-progress-fill" style={{ width: `${Math.round((doneCount / concepts.length) * 100)}%` }} />
            </div>
            <div className="sb-concepts">
              {concepts.map((c, i) => (
                <button
                  key={i}
                  className={`sb-concept-btn ${selected === c ? 'sb-concept-btn--active' : ''} ${doneSet.has(c) ? 'sb-concept-btn--done' : ''}`}
                  onClick={() => { setSelected(c); setResult(null); setTranscript(''); setError(''); }}
                >
                  {doneSet.has(c) && <span style={{ marginRight: '0.4rem' }}>✅</span>}
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Practice area */}
          <div className="sb-main">
            {/* Concept card */}
            <div className="sb-concept-card">
              <div className="sb-concept-label">Today's Concept</div>
              <div className="sb-concept-name">{selected}</div>
              <div className="sb-concept-hint">
                🎙️ Press the mic and explain this concept aloud in your own words.
                Speak for 30–60 seconds for the best evaluation.
              </div>
            </div>

            {/* Recorder */}
            {!result && (
              <div className="sb-recorder">
                <div className={`sb-mic-ring ${recording ? 'sb-mic-ring--recording' : ''}`}>
                  <button
                    className={`sb-mic-btn ${recording ? 'sb-mic-btn--recording' : ''}`}
                    onClick={recording ? stopRecording : startRecording}
                    disabled={processing}
                    title={recording ? 'Stop recording' : 'Start recording'}
                  >
                    {processing ? <span className="quiz-spinner" style={{ width: 28, height: 28, borderWidth: 3 }} /> : recording ? '⏹' : '🎤'}
                  </button>
                </div>
                <div className={`sb-rec-label ${recording ? 'sb-rec-label--recording' : ''}`}>
                  {processing ? 'Processing your answer…' : recording ? 'Recording — tap to stop' : 'Tap to start recording'}
                </div>
                {recording && <div className="sb-rec-timer">{fmtTime(recSeconds)}</div>}
              </div>
            )}

            {/* Transcript box */}
            {transcript && (
              <div className="sb-transcript-box">
                <strong style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>
                  Your answer:
                </strong>
                <p style={{ marginTop: '0.4rem' }}>{transcript}</p>
              </div>
            )}

            {/* Error */}
            {error && <div className="sb-error">⚠ {error}</div>}

            {/* Result */}
            {result && (
              <div className="sb-result">
                <div className="sb-score-row">
                  <div className={`sb-score-circle ${result.score >= 80 ? 'sb-score-circle--great' : result.score >= 60 ? 'sb-score-circle--ok' : 'sb-score-circle--low'}`}>
                    {result.score}
                  </div>
                  <div className="sb-score-info">
                    <div className="sb-score-title">
                      {result.score >= 80 ? '🌟 Excellent!' : result.score >= 60 ? '👍 Good job!' : '💪 Keep practicing!'}
                    </div>
                    <div className="sb-score-sub">
                      {result.isCorrect ? 'You understood the concept' : 'A few gaps to work on'}
                    </div>
                  </div>
                </div>

                {result.feedback && (
                  <div className="sb-result-section">
                    <div className="sb-result-label">Feedback</div>
                    <div className="sb-result-text">{result.feedback}</div>
                  </div>
                )}

                {result.whatWasGood && (
                  <div className="sb-result-section">
                    <div className="sb-result-label">✅ What was good</div>
                    <div className="sb-result-text">{result.whatWasGood}</div>
                  </div>
                )}

                {result.whatWasMissing && (
                  <div className="sb-result-section">
                    <div className="sb-result-label">🔍 What was missing</div>
                    <div className="sb-result-text">{result.whatWasMissing}</div>
                  </div>
                )}

                {result.followUpQuestion && (
                  <div className="sb-result-section">
                    <div className="sb-result-label">🤔 Think deeper…</div>
                    <div className="sb-follow-up">{result.followUpQuestion}</div>
                  </div>
                )}

                <div className="sb-result-actions">
                  <button className="sb-btn-retry" onClick={handleRetry}>🔄 Try again</button>
                  {concepts.indexOf(selected) < concepts.length - 1 && (
                    <button className="sb-btn-next" onClick={handleNext}>Next concept →</button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
