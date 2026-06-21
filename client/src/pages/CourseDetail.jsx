import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAxios } from '../hooks/useAxios'
import { useAuth } from '@clerk/clerk-react'
import './CourseDetail.css'

const TABS = [
  { id: 'chat',         label: '💬 Chat',             path: '' },
  { id: 'flashcards',   label: '🃏 Flashcards',       path: 'flashcards' },
  { id: 'quiz',         label: '🧠 Quiz',              path: 'quiz' },
  { id: 'graph',        label: '🕸️ Knowledge Graph',   path: 'graph' },
  { id: 'study-buddy',  label: '🎤 Study Buddy',       path: 'study-buddy' },
  { id: 'study-plan',   label: '📅 Study Plan',        path: 'study-plan' },
  { id: 'study-room',   label: '🎮 Study Room',        path: 'study-room' },
]

/** Format seconds → M:SS */
const fmtTs = (s) => {
  const sec = Math.floor(s || 0)
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/** Extract YouTube videoId from course.sources or course.sourceUrl */
function getYouTubeVideoId(course) {
  if (!course) return null
  // Check sources array first
  const ytSource = course.sources?.find(s => s.type === 'youtube' && s.videoId)
  if (ytSource) return ytSource.videoId
  // Fallback: parse sourceUrl
  if (course.sourceUrl) {
    const m = course.sourceUrl.match(/(?:v=|youtu\.be\/|\/embed\/)([A-Za-z0-9_-]{11})/)
    if (m) return m[1]
  }
  return null
}

export default function CourseDetail() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const api        = useAxios()
  const { getToken } = useAuth()

  const [course, setCourse]         = useState(null)
  const [messages, setMessages]     = useState([])
  const [question, setQuestion]     = useState('')
  const [streaming, setStreaming]   = useState(false)
  const [activeTab, setActiveTab]   = useState('chat')
  const [stats, setStats]           = useState({ dueCards: 0, masteryPct: 0, streak: 0 })
  const [error, setError]           = useState('')
  const [playerTs, setPlayerTs]     = useState(null)   // current seek timestamp
  const [playerOpen, setPlayerOpen] = useState(true)

  const bottomRef  = useRef(null)
  const iframeRef  = useRef(null)

  useEffect(() => {
    api.get(`/api/courses/${id}`)
      .then(r => setCourse(r.data))
      .catch(() => navigate('/'))
  }, [id])

  useEffect(() => {
    Promise.allSettled([
      api.get('/api/cards/due-count'),
      api.get(`/api/quiz/progress?courseId=${id}`)
    ]).then(([dueRes, progRes]) => {
      const due      = dueRes.status === 'fulfilled' ? dueRes.value.data.count : 0
      const progList = progRes.status === 'fulfilled' ? progRes.value.data : []
      const prog     = progList.find(p => p.courseId === id)
      setStats({ dueCards: due, masteryPct: prog?.masteryPct ?? 0, streak: prog?.streak ?? 0 })
    }).catch(() => {})
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleTabClick = (tab) => {
    if (tab.path) {
      navigate(`/courses/${id}/${tab.path}`)
    } else {
      setActiveTab(tab.id)
    }
  }

  // Jump YouTube player to a timestamp
  const seekTo = (timestamp) => {
    setPlayerTs(timestamp)
    setPlayerOpen(true)
    // Changing the src causes the iframe to reload at that timestamp
    if (iframeRef.current) {
      const videoId = getYouTubeVideoId(course)
      iframeRef.current.src = `https://www.youtube.com/embed/${videoId}?start=${Math.floor(timestamp)}&autoplay=1`
    }
  }

  const sendQuestion = async () => {
    if (!question.trim() || streaming) return
    const q = question.trim()
    setQuestion('')
    setError('')
    setMessages(m => [...m, { role: 'user', text: q }, { role: 'ai', text: '', sources: [] }])
    setStreaming(true)

    try {
      const token = await getToken()
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/courses/${id}/chat`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ question: q }),
        }
      )

      if (!res.ok) throw new Error(`Server error ${res.status}`)
      if (!res.body) throw new Error('No response body')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''
      let   done    = false

      while (!done) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (payload === '[DONE]') { done = true; break }
          if (!payload) continue

          try {
            const evt = JSON.parse(payload)
            // Token → append to last AI message
            if (evt.token) {
              setMessages(m => {
                const copy = [...m]
                copy[copy.length - 1] = {
                  ...copy[copy.length - 1],
                  text: copy[copy.length - 1].text + evt.token,
                }
                return copy
              })
            }
            // Sources → attach to last AI message for timestamp chips
            if (evt.sources) {
              setMessages(m => {
                const copy = [...m]
                copy[copy.length - 1] = { ...copy[copy.length - 1], sources: evt.sources }
                return copy
              })
            }
          } catch { /* malformed chunk */ }
        }
      }
    } catch (err) {
      setError(err.message)
      setMessages(m => {
        const copy = [...m]
        copy[copy.length - 1] = { ...copy[copy.length - 1], text: '⚠ ' + err.message }
        return copy
      })
    } finally {
      setStreaming(false)
    }
  }

  if (!course) return (
    <div className="cd-loading">
      <div className="fc-spinner" />
      <p>Loading course...</p>
    </div>
  )

  const videoId = getYouTubeVideoId(course)
  const isYouTube = !!videoId

  return (
    <div className="cd-root">
      {/* Header */}
      <div className="cd-header">
        <button className="fc-back" onClick={() => navigate('/')}>← Dashboard</button>
        <div className="cd-course-info">
          <h1 className="cd-title">{course.title}</h1>
          <p className="cd-desc">{course.description}</p>
          {/* Source badges */}
          {course.sources?.length > 0 && (
            <div className="cd-source-badges">
              {course.sources.map((s, i) => (
                <span key={i} className={`cd-source-badge cd-source-badge--${s.type}`}>
                  {s.type === 'youtube' ? '🎬' : s.type === 'pdf' ? '📄' : '📝'}
                  {s.name || s.url?.slice(0, 30) || s.type}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="cd-stats">
          <div className="cd-stat">
            <span className="cd-stat-value">{stats.masteryPct}%</span>
            <span className="cd-stat-label">Mastery</span>
          </div>
          <div className="cd-stat cd-stat--streak">
            <span className="cd-stat-value">🔥 {stats.streak}</span>
            <span className="cd-stat-label">Day streak</span>
          </div>
          {stats.dueCards > 0 && (
            <div className="cd-stat cd-stat--due">
              <span className="cd-stat-value">{stats.dueCards}</span>
              <span className="cd-stat-label">Cards due</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="cd-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`cd-tab ${activeTab === tab.id && !tab.path ? 'cd-tab--active' : ''}`}
            onClick={() => handleTabClick(tab)}
          >
            {tab.label}
            {tab.id === 'flashcards' && stats.dueCards > 0 && (
              <span className="cd-tab-badge">{stats.dueCards}</span>
            )}
          </button>
        ))}
      </div>

      {/* Chat layout: optional YouTube player sidebar */}
      <div className={`cd-chat-layout ${isYouTube ? 'cd-chat-layout--with-player' : ''}`}>

        {/* YouTube embedded player (only for YT courses) */}
        {isYouTube && (
          <div className={`cd-player-panel ${playerOpen ? 'cd-player-panel--open' : 'cd-player-panel--closed'}`}>
            <div className="cd-player-header">
              <span className="cd-player-label">🎬 Video Source</span>
              <button className="cd-player-toggle" onClick={() => setPlayerOpen(o => !o)}>
                {playerOpen ? '▲ Hide' : '▼ Show'}
              </button>
            </div>
            {playerOpen && (
              <div className="cd-player-embed">
                <iframe
                  ref={iframeRef}
                  src={`https://www.youtube.com/embed/${videoId}?start=${Math.floor(playerTs || 0)}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="YouTube video source"
                />
              </div>
            )}
          </div>
        )}

        {/* Chat */}
        <div className="cd-chat">
          <div className="cd-messages">
            {messages.length === 0 && (
              <div className="cd-empty-chat">
                <span>💭</span>
                <p>Ask anything about this course...</p>
                <div className="cd-suggestions">
                  {['Summarize the key concepts', 'What are the most important topics?', 'Give me 3 practice questions'].map(s => (
                    <button key={s} className="cd-suggestion" onClick={() => setQuestion(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`cd-message cd-message--${m.role}`}>
                <div className="cd-message-bubble">
                  {m.text || (streaming && i === messages.length - 1 ? '▍' : '')}
                </div>

                {/* Timestamp source chips for YouTube */}
                {m.role === 'ai' && m.sources?.some(s => s.videoId) && (
                  <div className="cd-source-chips">
                    <span className="cd-source-chips-label">Sources:</span>
                    {m.sources
                      .filter(s => s.videoId)
                      .slice(0, 3)
                      .map((s, j) => (
                        <button
                          key={j}
                          className="cd-ts-chip"
                          onClick={() => seekTo(s.startTimestamp)}
                          title={s.textPreview}
                        >
                          ▶ {fmtTs(s.startTimestamp)}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {error && <p className="quiz-error" style={{ textAlign: 'center', padding: '0 1rem' }}>{error}</p>}

          <div className="cd-input-row">
            <input
              className="cd-input"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendQuestion()}
              placeholder="Ask a question about your course..."
              disabled={streaming}
            />
            <button
              className="cd-send-btn"
              onClick={sendQuestion}
              disabled={streaming || !question.trim()}
            >
              {streaming ? <span className="quiz-spinner" /> : '→'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}