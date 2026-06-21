import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAxios } from '../hooks/useAxios'
import './TeacherDashboard.css'

export default function TeacherDashboard() {
  const api      = useAxios()
  const navigate = useNavigate()

  const [classrooms, setClassrooms] = useState([])
  const [selected,   setSelected]   = useState(null)
  const [detail,     setDetail]     = useState(null)
  const [newName,    setNewName]    = useState('')
  const [creating,   setCreating]   = useState(false)
  const [joinCode,   setJoinCode]   = useState('')
  const [joining,    setJoining]    = useState(false)
  const [joinMsg,    setJoinMsg]    = useState(null)  // { type: 'ok'|'err', text }
  const [copiedId,   setCopiedId]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [isTeacher,  setIsTeacher]  = useState(true)
  const [activeTab,  setActiveTab]  = useState('teacher') // 'teacher' | 'student'

  useEffect(() => {
    api.get('/api/classroom')
      .then(r => { setClassrooms(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const createClass = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const { data } = await api.post('/api/classroom', { name: newName.trim() })
      setClassrooms(c => [data, ...c])
      setNewName('')
    } catch (e) {
      if (e.response?.status === 403) setIsTeacher(false)
    } finally { setCreating(false) }
  }

  const becomeTeacher = async () => {
    await api.patch('/api/classroom/me/role')
    setIsTeacher(true)
    createClass()
  }

  const loadDetail = async (classroom) => {
    setSelected(classroom)
    setDetail(null)
    try {
      const { data } = await api.get(`/api/classroom/${classroom._id}/students`)
      setDetail(data)
    } catch {}
  }

  const copyInvite = (classroom) => {
    const text = `Join my "${classroom.name}" class on NexLearn!\n\n` +
      `Go to: ${window.location.origin}/teacher\n` +
      `Enter invite code: ${classroom.inviteCode}`
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedId(classroom._id)
        setTimeout(() => setCopiedId(null), 2000)
      })
  }

  const joinClass = async () => {
    if (!joinCode.trim()) return
    setJoining(true)
    setJoinMsg(null)
    try {
      await api.post('/api/classroom/join', { inviteCode: joinCode.toUpperCase() })
      setJoinMsg({ type: 'ok', text: '✅ Joined successfully! The teacher can now see your progress.' })
      setJoinCode('')
    } catch (e) {
      setJoinMsg({ type: 'err', text: '❌ ' + (e.response?.data?.error || 'Invalid code. Check with your teacher.') })
    } finally { setJoining(false) }
  }

  if (loading) return (
    <div className="td-loading"><div className="fc-spinner"/><p>Loading...</p></div>
  )

  return (
    <div className="td-root">
      <div className="td-header">
        <button className="fc-back" onClick={() => navigate('/dashboard')}>← Dashboard</button>
        <div>
          <h1 className="td-title">🏫 Teacher Dashboard</h1>
          <p className="td-sub">Create classes and track student progress — or join a class as a student</p>
        </div>
      </div>

      <div className="td-body">

        {/* ── Tab switcher ─────────────────────── */}
        <div className="td-tabs">
          <button
            className={`td-tab ${activeTab === 'teacher' ? 'td-tab--active' : ''}`}
            onClick={() => setActiveTab('teacher')}
          >
            👩‍🏫 I'm a Teacher
          </button>
          <button
            className={`td-tab ${activeTab === 'student' ? 'td-tab--active' : ''}`}
            onClick={() => setActiveTab('student')}
          >
            🎓 I'm a Student
          </button>
        </div>

        {/* ══ TEACHER PANEL ══════════════════════ */}
        {activeTab === 'teacher' && (
          <>
            {/* How it works banner */}
            <div className="td-howto">
              <div className="td-howto-step"><span className="td-howto-num">1</span><p>Create a class below</p></div>
              <div className="td-howto-arrow">→</div>
              <div className="td-howto-step"><span className="td-howto-num">2</span><p>Share the invite code with students</p></div>
              <div className="td-howto-arrow">→</div>
              <div className="td-howto-step"><span className="td-howto-num">3</span><p>See student mastery &amp; weak spots here</p></div>
            </div>

            {/* Create classroom */}
            <div className="td-card td-create">
              <h2 className="td-section-title">Create a New Class</h2>
              <div className="td-create-row">
                <input
                  className="td-input"
                  placeholder="Class name e.g. Physics 101"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createClass()}
                />
                <button className="td-btn-primary" onClick={createClass} disabled={creating || !newName.trim()}>
                  {creating ? '...' : '+ Create'}
                </button>
              </div>
              {!isTeacher && (
                <div className="td-promote-banner">
                  <p>You need teacher role to create classes.</p>
                  <button className="td-btn-primary" onClick={becomeTeacher}>Become a Teacher</button>
                </div>
              )}
            </div>

            {/* Classroom list */}
            {classrooms.length > 0 && (
              <div className="td-card">
                <h2 className="td-section-title">Your Classes ({classrooms.length})</h2>
                <div className="td-class-list">
                  {classrooms.map(c => (
                    <div
                      key={c._id}
                      className={`td-class-item ${selected?._id === c._id ? 'td-class-item--active' : ''}`}
                      onClick={() => loadDetail(c)}
                    >
                      <div className="td-class-info">
                        <span className="td-class-name">{c.name}</span>
                        <span className="td-class-meta">{c.students?.length || 0} students enrolled</span>
                      </div>
                      <div className="td-class-actions">
                        <div className="td-invite-block">
                          <span className="td-invite-label">Invite Code</span>
                          <span className="td-invite-code">{c.inviteCode}</span>
                        </div>
                        <button
                          className="td-copy-btn"
                          onClick={e => { e.stopPropagation(); copyInvite(c) }}
                          title="Copy invite message"
                        >
                          {copiedId === c._id ? '✅ Copied!' : '📋 Copy Invite'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {classrooms.length === 0 && (
              <div className="td-empty-state">
                <div className="td-empty-icon">📚</div>
                <p>No classes yet. Create one above and share the invite code with your students.</p>
              </div>
            )}

            {/* Class detail */}
            {selected && (
              <div className="td-card">
                <h2 className="td-section-title">
                  📊 {selected.name}
                  {detail && <span className="td-avg-badge">Class avg: {detail.classAvgMastery}%</span>}
                </h2>

                {detail?.alerts?.length > 0 && (
                  <div className="td-alerts">
                    <h3 className="td-alert-title">⚠️ Weak Concepts (class avg &lt; 40%)</h3>
                    {detail.alerts.map(a => (
                      <div key={a.tag} className="td-alert-row">
                        <span>{a.tag}</span>
                        <div className="td-alert-bar-track">
                          <div className="td-alert-bar-fill" style={{ width: `${a.avgMastery}%` }} />
                        </div>
                        <span className="td-alert-pct">{a.avgMastery}%</span>
                      </div>
                    ))}
                  </div>
                )}

                {!detail ? (
                  <div className="td-loading-sm"><div className="fc-spinner"/></div>
                ) : detail.students.length === 0 ? (
                  <div className="td-empty-state">
                    <p>No students yet. Share this code with your students:</p>
                    <div className="td-big-code">{selected.inviteCode}</div>
                    <p className="td-hint">Students go to <strong>/teacher</strong> → "I'm a Student" tab → enter this code</p>
                  </div>
                ) : (
                  <div className="td-student-table">
                    <div className="td-table-header">
                      <span>Student</span>
                      <span>Mastery</span>
                      <span>Streak</span>
                      <span>Weak Concepts</span>
                    </div>
                    {detail.students.map(s => (
                      <div key={s.student._id} className="td-table-row">
                        <div className="td-student-info">
                          {s.student.avatar && <img src={s.student.avatar} alt="" className="td-avatar" />}
                          <div>
                            <p className="td-student-name">{s.student.name || 'Student'}</p>
                            <p className="td-student-email">{s.student.email}</p>
                          </div>
                        </div>
                        <div className="td-mastery-cell">
                          <div className="td-mini-bar-track">
                            <div className="td-mini-bar-fill" style={{
                              width: `${s.avgMastery}%`,
                              background: s.avgMastery >= 70 ? 'var(--green)' : s.avgMastery >= 40 ? 'var(--yellow)' : 'var(--red)'
                            }} />
                          </div>
                          <span className="td-mastery-pct">{s.avgMastery}%</span>
                        </div>
                        <span className="td-streak">🔥 {s.maxStreak}d</span>
                        <div className="td-weak-tags">
                          {s.weakConcepts.length === 0
                            ? <span className="td-strong">✓ Strong</span>
                            : s.weakConcepts.map(w => (
                              <span key={w.tag} className="td-weak-tag">{w.tag} ({w.mastery}%)</span>
                            ))
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ══ STUDENT PANEL ══════════════════════ */}
        {activeTab === 'student' && (
          <div className="td-card">
            <div className="td-student-howto">
              <h2 className="td-section-title">Join a Class</h2>
              <p className="td-howto-desc">
                Your teacher will share an <strong>8-character invite code</strong> with you
                (like <code>AB12CD34</code>). Enter it below to enroll — your teacher will
                then be able to see your learning progress and help you with weak topics.
              </p>
              <div className="td-create-row">
                <input
                  className="td-input td-code-input"
                  placeholder="Enter code e.g. AB12CD34"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && joinClass()}
                  maxLength={8}
                />
                <button
                  className="td-btn-primary"
                  onClick={joinClass}
                  disabled={joining || joinCode.length < 6}
                >
                  {joining ? '...' : 'Join Class'}
                </button>
              </div>
              {joinMsg && (
                <p className={`td-join-msg ${joinMsg.type === 'ok' ? 'td-join-ok' : 'td-join-err'}`}>
                  {joinMsg.text}
                </p>
              )}
              <div className="td-student-note">
                <strong>Note:</strong> This is NOT a video call. After joining:
                <ul>
                  <li>Your teacher sees your quiz scores and flashcard mastery</li>
                  <li>They get alerts when you're struggling with a topic</li>
                  <li>You keep studying normally — nothing else changes for you</li>
                </ul>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
