import { useEffect, useState } from 'react'
import { useAxios } from '../hooks/useAxios'
import './TeacherDashboard.css'

export default function TeacherDashboard() {
  const api = useAxios()

  const [classrooms, setClassrooms] = useState([])
  const [selected,   setSelected]   = useState(null)
  const [detail,     setDetail]     = useState(null)
  const [newName,    setNewName]    = useState('')
  const [creating,   setCreating]   = useState(false)
  const [joinCode,   setJoinCode]   = useState('')
  const [joining,    setJoining]    = useState(false)
  const [joinMsg,    setJoinMsg]    = useState(null)
  const [copiedId,   setCopiedId]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [isTeacher,  setIsTeacher]  = useState(true)
  const [activeTab,  setActiveTab]  = useState('teacher')

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
    const text = `Join my "${classroom.name}" class on NexLearn!\n\nGo to: ${window.location.origin}/teacher\nEnter invite code: ${classroom.inviteCode}`
    navigator.clipboard.writeText(text)
      .then(() => { setCopiedId(classroom._id); setTimeout(() => setCopiedId(null), 2000) })
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
    <div className="page-loading"><div className="fc-spinner" /><span>Loading…</span></div>
  )

  const classAvg = detail?.classAvgMastery ?? 0

  return (
    <div className="td-root page-enter">

      {/* ── Page header ───────────────────── */}
      <div className="td-header">
        <h1 className="td-title">Teacher Dashboard</h1>
        <p className="td-sub">Build classrooms. Watch progress. Catch weak spots early.</p>
      </div>

      <div className="td-body">

        {/* ── Tab switcher pill ─────────────── */}
        <div className="td-tabs">
          <button
            className={`td-tab ${activeTab === 'teacher' ? 'td-tab--active' : ''}`}
            onClick={() => setActiveTab('teacher')}
            id="td-tab-teacher"
          >
            👩‍🏫 I'm A Teacher
          </button>
          <button
            className={`td-tab ${activeTab === 'student' ? 'td-tab--active' : ''}`}
            onClick={() => setActiveTab('student')}
            id="td-tab-student"
          >
            🎓 I'm A Student
          </button>
        </div>

        {/* ══ TEACHER PANEL ══════════════════ */}
        {activeTab === 'teacher' && (
          <>
            {/* How it works steps */}
            <div className="td-howto glass">
              {[
                { n: 1, title: 'Create a classroom', sub: 'Spin up a class in seconds.' },
                { n: 2, title: 'Share invite code',  sub: 'Students join with a 6-char code.' },
                { n: 3, title: 'Track everything',   sub: 'See progress, streaks and weak topics live.' },
              ].map((step, i) => (
                <>
                  <div key={step.n} className="td-step">
                    <div className="td-step-num">{step.n}</div>
                    <div>
                      <p className="td-step-title">{step.title}</p>
                      <p className="td-step-sub">{step.sub}</p>
                    </div>
                  </div>
                  {i < 2 && <div className="td-step-arrow">→</div>}
                </>
              ))}
            </div>

            {/* Create new classroom */}
            <div className="td-card glass">
              <h2 className="td-section-label">Create a new classroom</h2>
              <div className="td-create-row">
                <input
                  className="td-input"
                  placeholder="e.g. Physics — Section A"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createClass()}
                  id="td-class-name-input"
                />
                <button
                  className="btn-primary td-create-btn"
                  onClick={createClass}
                  disabled={creating || !newName.trim()}
                  id="td-create-btn"
                >
                  {creating ? <span className="quiz-spinner" /> : '+ Create'}
                </button>
              </div>
              {!isTeacher && (
                <div className="td-promote-banner">
                  <p>You need teacher role to create classes.</p>
                  <button className="btn-primary" onClick={becomeTeacher}>Become a Teacher</button>
                </div>
              )}
            </div>

            {/* Classroom list */}
            {classrooms.length > 0 && classrooms.map(c => (
              <div
                key={c._id}
                className={`td-classroom-card glass card-hover ${selected?._id === c._id ? 'td-classroom-card--active' : ''}`}
                onClick={() => loadDetail(c)}
              >
                <div className="td-classroom-top">
                  <div className="td-classroom-avatar">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="td-classroom-info">
                    <p className="td-classroom-name">{c.name}</p>
                    <p className="td-classroom-meta">{c.students?.length || 0} students · avg {c.avgMastery || 0}% mastery</p>
                  </div>
                  <div className="td-classroom-right">
                    <span className="td-invite-code">{c.inviteCode}</span>
                    <button
                      className="td-copy-btn"
                      onClick={e => { e.stopPropagation(); copyInvite(c) }}
                    >
                      {copiedId === c._id ? '✅' : '📋'}
                    </button>
                    <span className="td-chevron">›</span>
                  </div>
                </div>

                {/* Expanded detail */}
                {selected?._id === c._id && (
                  <div className="td-detail" onClick={e => e.stopPropagation()}>
                    <div className="td-detail-summary">
                      <span className="badge badge-green">Class avg: {classAvg}%</span>
                      {detail?.alerts?.length > 0 && (
                        <span className="badge badge-amber">
                          ⚠ Weak: {detail.alerts.map(a => a.tag).join(', ')}
                        </span>
                      )}
                    </div>

                    {!detail ? (
                      <div className="page-loading" style={{ minHeight: 80 }}>
                        <div className="fc-spinner" />
                      </div>
                    ) : detail.students.length === 0 ? (
                      <div className="td-empty">
                        <p>No students yet. Share code: <strong className="td-big-code">{c.inviteCode}</strong></p>
                      </div>
                    ) : (
                      <div className="td-student-table">
                        <div className="td-table-header">
                          <span>STUDENT</span>
                          <span>MASTERY</span>
                          <span>STREAK</span>
                          <span>WEAK CONCEPTS</span>
                        </div>
                        {detail.students.map(s => (
                          <div key={s.student._id} className="td-table-row">
                            <div className="td-student-cell">
                              <div className="td-avatar">
                                {s.student.name ? s.student.name.slice(0, 2).toUpperCase() : 'ST'}
                              </div>
                              <span className="td-student-name">{s.student.name || 'Student'}</span>
                            </div>
                            <div className="td-mastery-cell">
                              <div className="td-mini-bar">
                                <div
                                  className="td-mini-bar-fill"
                                  style={{
                                    width: `${s.avgMastery}%`,
                                    background: s.avgMastery >= 70 ? '#10b981' : s.avgMastery >= 40 ? '#f59e0b' : '#6366f1'
                                  }}
                                />
                              </div>
                              <span className="td-mastery-pct">{s.avgMastery}%</span>
                            </div>
                            <span className="td-streak">🔥 {s.maxStreak}</span>
                            <div className="td-weak-tags">
                              {s.weakConcepts.length === 0
                                ? <span className="badge badge-green">All clear</span>
                                : s.weakConcepts.slice(0, 2).map(w => (
                                    <span key={w.tag} className="badge badge-amber">{w.tag}</span>
                                  ))
                              }
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {classrooms.length === 0 && (
              <div className="td-empty-state glass">
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📚</div>
                <p className="td-empty-title">No classes yet</p>
                <p className="td-empty-desc">Create one above and share the invite code with your students.</p>
              </div>
            )}
          </>
        )}

        {/* ══ STUDENT PANEL ══════════════════ */}
        {activeTab === 'student' && (
          <div className="td-card glass">
            <h2 className="td-section-label">Join a Class</h2>
            <p className="td-join-desc">
              Your teacher will share an <strong>invite code</strong> (like <code>AB12CD</code>).
              Enter it below to enroll — your teacher can then track your progress.
            </p>
            <div className="td-create-row">
              <input
                className="td-input td-code-input"
                placeholder="Enter invite code e.g. AB12CD"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && joinClass()}
                maxLength={8}
                id="td-join-code-input"
              />
              <button
                className="btn-primary td-create-btn"
                onClick={joinClass}
                disabled={joining || joinCode.length < 6}
                id="td-join-btn"
              >
                {joining ? <span className="quiz-spinner" /> : 'Join Class'}
              </button>
            </div>
            {joinMsg && (
              <p className={`td-join-msg ${joinMsg.type === 'ok' ? 'td-join-ok' : 'td-join-err'}`}>
                {joinMsg.text}
              </p>
            )}
            <div className="td-student-note">
              <strong>Note:</strong> After joining, your teacher sees your quiz scores and flashcard mastery.
              Nothing else changes for you.
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
