import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { useAxios } from '../hooks/useAxios'
import { connectStudyRoom, disconnectStudyRoom, getStudySocket } from '../services/socket'
import '../styles/study-room.css'

export default function StudyRoom() {
  const { id: courseId } = useParams()
  const navigate = useNavigate()
  const { user } = useUser()
  const api = useAxios()

  const [phase, setPhase]       = useState('lobby')  // 'lobby' | 'quiz' | 'done'
  const [members, setMembers]   = useState([])
  const [questions, setQuestions] = useState([])
  const [current, setCurrent]   = useState(0)
  const [myScore, setMyScore]   = useState(0)
  const [selected, setSelected] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [chat, setChat]         = useState([])
  const socketRef = useRef(null)

  const userName = user?.firstName || user?.username || 'Student'
  const userId   = user?.id || 'anon'

  useEffect(() => {
    const socket = connectStudyRoom(courseId, userId, userName)
    socketRef.current = socket

    socket.on('room-users',  (users) => setMembers(users))
    socket.on('user-joined', ({ userName: name }) => addChat(`${name} joined the room 👋`))
    socket.on('user-left',   ({ userName: name }) => addChat(`${name} left the room`))
    socket.on('score-update',({ userName: name, score, correct }) => {
      addChat(`${name} answered ${correct ? '✅ correctly' : '❌ incorrectly'} — ${score} pts`)
    })

    return () => {
      disconnectStudyRoom(courseId)
      socket.off('room-users')
      socket.off('user-joined')
      socket.off('user-left')
      socket.off('score-update')
    }
  }, [courseId])

  function addChat(msg) {
    setChat(c => [...c.slice(-50), { text: msg, ts: Date.now() }])
  }

  const startQuiz = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/api/quiz/generate', {
        courseId,
        count: 5,
        difficulty: 'mixed'
      })
      setQuestions(data.questions || [])
      setCurrent(0)
      setMyScore(0)
      setPhase('quiz')
    } catch (e) {
      setError('Failed to load quiz. Make sure Python AI service is running.')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = (option) => {
    if (showResult || !questions[current]) return
    setSelected(option)
    setShowResult(true)

    const q = questions[current]
    const correct = option === q.correctAnswer || String(option) === String(q.correctAnswer)
    const newScore = myScore + (correct ? 10 : 0)
    setMyScore(newScore)

    socketRef.current?.emit('quiz-answer', {
      courseId,
      userId,
      userName,
      correct,
      score: newScore
    })

    setTimeout(() => {
      setShowResult(false)
      setSelected(null)
      if (current + 1 >= questions.length) {
        setPhase('done')
      } else {
        setCurrent(c => c + 1)
      }
    }, 1800)
  }

  const sortedMembers = [...members].sort((a, b) => (b.score || 0) - (a.score || 0))

  return (
    <div className="sr-root">
      {/* Sidebar */}
      <div className="sr-sidebar">
        <button className="fc-back sr-back" onClick={() => navigate(`/courses/${courseId}`)}>← Exit</button>
        <h3 className="sr-sidebar-title">🏆 Leaderboard</h3>
        <div className="sr-members">
          {sortedMembers.map((m, i) => (
            <div key={m.userId} className={`sr-member ${m.userId === userId ? 'sr-member--me' : ''}`}>
              <span className="sr-rank">#{i + 1}</span>
              <span className="sr-name">{m.userName} {m.userId === userId ? '(you)' : ''}</span>
              <span className="sr-score">{m.score || 0} pts</span>
            </div>
          ))}
          {members.length === 0 && <p className="sr-empty">Waiting for players...</p>}
        </div>

        <div className="sr-chat">
          <h4 className="sr-chat-title">Activity</h4>
          <div className="sr-chat-feed">
            {chat.map((c, i) => <div key={i} className="sr-chat-msg">{c.text}</div>)}
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="sr-main">
        {phase === 'lobby' && (
          <div className="sr-lobby">
            <div className="sr-lobby-card">
              <div className="sr-lobby-icon">🎮</div>
              <h2 className="sr-lobby-title">Study Room</h2>
              <p className="sr-lobby-sub">{members.length} player{members.length !== 1 ? 's' : ''} in room</p>
              <p className="sr-lobby-hint">Start a shared quiz — everyone answers the same questions, scores update live.</p>
              {error && <p className="quiz-error">{error}</p>}
              <button className="quiz-start-btn" onClick={startQuiz} disabled={loading}>
                {loading ? <span className="quiz-spinner" /> : '🚀 Start Group Quiz'}
              </button>
            </div>
          </div>
        )}

        {phase === 'quiz' && questions[current] && (
          <QuizQuestion
            q={questions[current]}
            current={current}
            total={questions.length}
            myScore={myScore}
            selected={selected}
            showResult={showResult}
            onAnswer={handleAnswer}
          />
        )}

        {phase === 'done' && (
          <div className="sr-lobby">
            <div className="sr-lobby-card">
              <div className="sr-lobby-icon">🎉</div>
              <h2 className="sr-lobby-title">Quiz Over!</h2>
              <p className="sr-lobby-sub">Your score: <strong>{myScore} pts</strong></p>
              {sortedMembers[0] && <p className="sr-lobby-hint">🏆 Winner: {sortedMembers[0].userName} ({sortedMembers[0].score} pts)</p>}
              <div className="sr-lobby-actions">
                <button className="fc-btn-secondary" onClick={() => navigate(`/courses/${courseId}`)}>Back to Course</button>
                <button className="quiz-start-btn" onClick={startQuiz}>Play Again</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function QuizQuestion({ q, current, total, myScore, selected, showResult, onAnswer }) {
  const options = q.type === 'true_false'
    ? ['true', 'false']
    : (q.options || [])

  return (
    <div className="sr-quiz">
      <div className="sr-quiz-header">
        <span>Question {current + 1}/{total}</span>
        <span className="sr-my-score">⭐ {myScore} pts</span>
      </div>
      <div className="sr-quiz-progress">
        <div className="sr-quiz-progress-fill" style={{ width: `${((current)/total)*100}%` }} />
      </div>
      <div className="sr-question-card">
        <span className={`quiz-type-badge quiz-type-badge--${q.type}`}>
          {q.type === 'multiple_choice' ? 'Multiple Choice' : q.type === 'true_false' ? 'True / False' : 'Short Answer'}
        </span>
        <h2 className="quiz-question">{q.question}</h2>
        <div className="quiz-options">
          {options.map((opt, i) => {
            let cls = 'quiz-option'
            if (showResult) {
              if (String(opt) === String(q.correctAnswer)) cls += ' quiz-option--correct'
              else if (String(opt) === String(selected))   cls += ' quiz-option--wrong'
            } else if (String(opt) === String(selected)) cls += ' quiz-option--selected'

            return (
              <button key={i} className={cls} onClick={() => onAnswer(opt)} disabled={showResult}>
                {q.type !== 'true_false' && (
                  <span className="quiz-option-letter">{String.fromCharCode(65 + i)}</span>
                )}
                {q.type === 'true_false' ? (opt === 'true' ? '✓ True' : '✗ False') : opt}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
