/**
 * SmartIngest — Smart Content Processor
 * Tabs: PDF | YouTube | Text | Merge (Pro)
 * All tabs stream live pipeline progress via SSE.
 */
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import PipelineProgress from './PipelineProgress'
import CourseStructureModal from './CourseStructureModal'
import './SmartIngest.css'

const TABS = [
  { id: 'pdf', icon: '📄', label: 'PDF', sub: 'Upload a PDF file' },
  { id: 'youtube', icon: '🎬', label: 'YouTube', sub: 'Paste a video URL' },
  { id: 'text', icon: '📝', label: 'Text', sub: 'Paste notes or text' },
  { id: 'merge', icon: '🔗', label: 'Multi-Source', sub: 'PDF + YouTube  •  ⭐ Pro' },
]

const API = import.meta.env.VITE_API_URL || ''

export default function SmartIngest({ onSuccess, userPlan = 'free' }) {
  const { getToken } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('pdf')
  const [processing, setProcessing] = useState(false)
  const [currentStage, setCurrentStage] = useState(null)
  const [lastMessage, setLastMessage] = useState('')
  const [pipelineError, setPipelineError] = useState('')
  const [modalResult, setModalResult] = useState(null)

  // PDF tab
  const [pdfFile, setPdfFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  // YouTube tab
  const [ytUrl, setYtUrl] = useState('')

  // Text tab
  const [textContent, setTextContent] = useState('')
  const [sourceName, setSourceName] = useState('')

  // Merge tab
  const [mergeFile, setMergeFile] = useState(null)
  const [mergeYtUrl, setMergeYtUrl] = useState('')

  const abortRef = useRef(null)

  // ── SSE stream helper ──────────────────────────────────────────────────────

  const streamIngest = async (endpoint, body /* FormData */) => {
    setProcessing(true)
    setCurrentStage('fetching')
    setLastMessage('')
    setPipelineError('')

    const token = await getToken()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
        signal: ctrl.signal,
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        if (res.status === 403 && json?.upgrade) { navigate('/upgrade'); return }
        throw new Error(json.error || json.detail || `Server error ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (!payload) continue

          try {
            const evt = JSON.parse(payload)
            if (evt.stage === 'error') {
              setPipelineError(evt.message)
              setProcessing(false)
              return
            }
            if (evt.stage === 'complete') {
              setCurrentStage('complete')
              setLastMessage('All done!')
              setProcessing(false)
              // Show course structure modal
              setModalResult(evt.result)
              // Always reload dashboard — SSE routes always return courseId + course
              if (onSuccess) onSuccess()
              // Reset inputs
              setPdfFile(null); setYtUrl(''); setTextContent(''); setMergeFile(null); setMergeYtUrl('')
              return
            }
            setCurrentStage(evt.stage)
            setLastMessage(evt.message || '')
          } catch { /* malformed SSE line */ }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setPipelineError(err.message || 'Upload failed. Please try again.')
      }
      setProcessing(false)
    }
  }

  // ── Submit handlers ────────────────────────────────────────────────────────

  // PDF uses a plain JSON POST (the server route returns 201 JSON, not SSE)
  const submitPdf = async () => {
    if (!pdfFile) return
    setProcessing(true)
    setCurrentStage('fetching')
    setLastMessage('')
    setPipelineError('')

    try {
      const token = await getToken()
      const fd = new FormData()
      fd.append('file', pdfFile)

      const res = await fetch(`${API}/api/courses/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        if (res.status === 403 && json?.upgrade) { navigate('/upgrade'); return }
        throw new Error(json.error || json.detail || `Server error ${res.status}`)
      }

      const course = await res.json()

      // Normalise into the same shape CourseStructureModal expects
      const modalShape = {
        courseId:   course._id,
        course,
        sources:    course.sources    || [{ type: 'pdf', name: pdfFile.name }],
        studyOrder: course.studyOrder || course.concepts || [],
        metadata: {
          title:       course.title,
          description: course.description,
          summary:     course.summary,
        },
      }

      setCurrentStage('complete')
      setLastMessage('All done!')
      setProcessing(false)
      setModalResult(modalShape)
      if (onSuccess) onSuccess()
      setPdfFile(null)
    } catch (err) {
      setPipelineError(err.message || 'Upload failed. Please try again.')
      setProcessing(false)
    }
  }

  const submitYouTube = () => {
    if (!ytUrl.trim()) return
    const fd = new FormData()
    fd.append('youtubeUrl', ytUrl.trim())
    streamIngest('/api/courses/ingest-youtube', fd)
  }

  const submitText = () => {
    if (!textContent.trim()) return
    const fd = new FormData()
    fd.append('text', textContent.trim())
    fd.append('sourceName', sourceName.trim() || 'Pasted Notes')
    streamIngest('/api/courses/ingest-text', fd)
  }

  const submitMerge = () => {
    if (!mergeFile && !mergeYtUrl.trim()) return
    if (userPlan !== 'pro') { navigate('/upgrade'); return }
    const fd = new FormData()
    if (mergeFile) fd.append('file', mergeFile)
    if (mergeYtUrl.trim()) fd.append('youtubeUrl', mergeYtUrl.trim())
    streamIngest('/api/courses/ingest-merge', fd)
  }

  const cancel = () => {
    abortRef.current?.abort()
    setProcessing(false)
    setCurrentStage(null)
    setPipelineError('')
  }

  // ── File drop helper ───────────────────────────────────────────────────────
  const handleDrop = (e, setter) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f?.type === 'application/pdf') setter(f)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const showPipeline = processing || currentStage || pipelineError

  return (
    <>
      <div className="si-root">
        {/* Header */}
        <div className="si-header">
          <div className="si-header-icon">⚡</div>
          <div>
            <h3 className="si-title">Smart Content Processor</h3>
            <p className="si-subtitle">AI turns any content into a personalized course</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="si-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`si-tab ${activeTab === tab.id ? 'si-tab--active' : ''} ${tab.id === 'merge' && userPlan !== 'pro' ? 'si-tab--pro' : ''}`}
              onClick={() => { if (!processing) { setActiveTab(tab.id); setCurrentStage(null); setPipelineError('') } }}
              disabled={processing}
            >
              <span className="si-tab-icon">{tab.icon}</span>
              <span className="si-tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {!showPipeline && (
          <div className="si-body">

            {/* ── PDF tab ── */}
            {activeTab === 'pdf' && (
              <div
                className={`si-dropzone ${dragOver ? 'si-dropzone--over' : ''} ${pdfFile ? 'si-dropzone--filled' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => handleDrop(e, setPdfFile)}
              >
                {pdfFile ? (
                  <div className="si-file-chosen">
                    <span className="si-file-icon">📎</span>
                    <div>
                      <p className="si-file-name">{pdfFile.name}</p>
                      <p className="si-file-size">{(pdfFile.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button className="si-remove" onClick={() => setPdfFile(null)}>✕</button>
                  </div>
                ) : (
                  <>
                    <span className="si-drop-icon">📄</span>
                    <p className="si-drop-main">Drop a PDF here or <label className="si-browse">browse<input type="file" accept=".pdf" className="si-hidden-input" onChange={e => setPdfFile(e.target.files[0])} /></label></p>
                    <p className="si-drop-sub">Max 50 MB · PDF only</p>
                  </>
                )}
              </div>
            )}

            {/* ── YouTube tab ── */}
            {activeTab === 'youtube' && (
              <div className="si-yt-wrap">
                <div className="si-yt-preview">
                  <span className="si-yt-icon">▶</span>
                  <div className="si-field-wrap">
                    <label className="si-field-label">YouTube URL</label>
                    <input
                      className="si-input"
                      type="url"
                      placeholder="https://youtube.com/watch?v=..."
                      value={ytUrl}
                      onChange={e => setYtUrl(e.target.value)}
                      onPaste={e => setYtUrl(e.clipboardData.getData('text'))}
                    />
                  </div>
                </div>
                <p className="si-yt-note">
                  💡 Works with any YouTube video that has captions (auto-generated or manual).
                  Timestamp-linked Q&amp;A will be enabled automatically.
                </p>
              </div>
            )}

            {/* ── Text tab ── */}
            {activeTab === 'text' && (
              <div className="si-text-wrap">
                <div className="si-field-wrap">
                  <label className="si-field-label">Source Name (optional)</label>
                  <input
                    className="si-input"
                    placeholder="e.g. 'Chapter 5 Notes' or 'Article'"
                    value={sourceName}
                    onChange={e => setSourceName(e.target.value)}
                  />
                </div>
                <div className="si-field-wrap">
                  <label className="si-field-label">Paste your notes or text</label>
                  <textarea
                    className="si-textarea"
                    placeholder="Paste any text — lecture notes, articles, book excerpts, Wikipedia pages…&#10;&#10;Minimum 100 characters recommended for best results."
                    value={textContent}
                    onChange={e => setTextContent(e.target.value)}
                    rows={8}
                  />
                  <p className="si-char-count">{textContent.length.toLocaleString()} characters</p>
                </div>
              </div>
            )}

            {/* ── Merge tab ── */}
            {activeTab === 'merge' && (
              <div className="si-merge-wrap">
                {userPlan !== 'pro' ? (
                  <div className="si-pro-gate">
                    <span className="si-pro-icon">⭐</span>
                    <h4>Multi-Source Merge is a Pro feature</h4>
                    <p>Combine a PDF and YouTube video into one unified knowledge base.</p>
                    <button className="si-upgrade-btn" onClick={() => navigate('/upgrade')}>
                      Upgrade to Pro →
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      className={`si-dropzone si-dropzone--sm ${mergeFile ? 'si-dropzone--filled' : ''}`}
                      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={e => handleDrop(e, setMergeFile)}
                    >
                      {mergeFile ? (
                        <div className="si-file-chosen">
                          <span className="si-file-icon">📎</span>
                          <span className="si-file-name">{mergeFile.name}</span>
                          <button className="si-remove" onClick={() => setMergeFile(null)}>✕</button>
                        </div>
                      ) : (
                        <>
                          <span>📄</span>
                          <label className="si-browse">Add PDF (optional)<input type="file" accept=".pdf" className="si-hidden-input" onChange={e => setMergeFile(e.target.files[0])} /></label>
                        </>
                      )}
                    </div>
                    <div className="si-merge-divider"><span>+</span></div>
                    <div className="si-field-wrap">
                      <label className="si-field-label">YouTube URL (optional)</label>
                      <input
                        className="si-input"
                        type="url"
                        placeholder="https://youtube.com/watch?v=..."
                        value={mergeYtUrl}
                        onChange={e => setMergeYtUrl(e.target.value)}
                      />
                    </div>
                    <p className="si-merge-note">
                      🔗 Both sources will be cross-referenced into one unified knowledge base.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pipeline progress */}
        {showPipeline && (
          <div className="si-pipeline-wrap">
            <PipelineProgress
              currentStage={currentStage}
              lastMessage={lastMessage}
              error={pipelineError}
            />
          </div>
        )}

        {/* Submit / Cancel */}
        <div className="si-footer">
          {processing ? (
            <button className="si-btn si-btn--cancel" onClick={cancel}>
              ✕ Cancel
            </button>
          ) : pipelineError ? (
            <button className="si-btn si-btn--retry" onClick={() => { setPipelineError(''); setCurrentStage(null) }}>
              ↺ Try Again
            </button>
          ) : !showPipeline ? (
            <button
              className="si-btn si-btn--submit"
              onClick={activeTab === 'pdf' ? submitPdf : activeTab === 'youtube' ? submitYouTube : activeTab === 'text' ? submitText : submitMerge}
              disabled={
                (activeTab === 'pdf' && !pdfFile) ||
                (activeTab === 'youtube' && !ytUrl.trim()) ||
                (activeTab === 'text' && textContent.trim().length < 50) ||
                (activeTab === 'merge' && !mergeFile && !mergeYtUrl.trim())
              }
            >
              ⚡ Process with AI
            </button>
          ) : null}
        </div>
      </div>

      {/* Course structure modal */}
      {modalResult && (
        <CourseStructureModal
          result={modalResult}
          onClose={() => { setModalResult(null); setCurrentStage(null) }}
        />
      )}
    </>
  )
}
