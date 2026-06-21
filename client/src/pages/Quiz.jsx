import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAxios } from '../hooks/useAxios'
import '../styles/quiz.css'

export default function Quiz() {
  const { id: courseId } = useParams()
  const navigate = useNavigate()
  const api = useAxios()

  const [phase, setPhase]       = useState('setup')   // 'setup' | 'playing' | 'results'
  const [settings, setSettings] = useState({ count: 5, difficulty: 'mixed', topic: '' })
  const [questions, setQuestions] = useState([])
  const [current, setCurrent]   = useState(0)
  const [answers, setAnswers]   = useState([])
  const [userAnswer, setUserAnswer] = useState('')
  const [selectedOption, setSelectedOption] = useState(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [results, setResults]   = useState(null)
  const [error, setError]       = useState('')

  const startQuiz = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/api/quiz/generate', {
        courseId,
        topic:      settings.topic,
        count:      settings.count,
        difficulty: settings.difficulty
      })
      setQuestions(data.questions || [])
      setAnswers([])
      setCurrent(0)
      setPhase('playing')
    } catch (e) {
      const data = e.response?.data
      const msg = data?.detail || data?.error || e.message || 'Failed to generate quiz'
      const hint = data?.hint ? `\n${data.hint}` : ''
      setError(msg + hint)
    } finally {
      setLoading(false)
    }
  }

  const submitAnswer = async () => {
    const q = questions[current]
    let correct = false
    let userAns = userAnswer

    if (q.type === 'multiple_choice') {
      userAns = selectedOption
      correct = selectedOption === q.correctAnswer
    } else if (q.type === 'true_false') {
      userAns = userAnswer
      correct = String(userAnswer) === String(q.correctAnswer)
    } else if (q.type === 'short_answer') {
      // Score via keyword matching (frontend estimate)
      const keywords = q.keywords || []
      const matched = keywords.filter(kw => userAnswer.toLowerCase().includes(kw.toLowerCase()))
      correct = keywords.length === 0 ? userAnswer.length > 10 : matched.length >= Math.ceil(keywords.length * 0.5)
    }

    const ans = {
      questionIndex: current,
      conceptTag: q.conceptTag || 'general',
      correct,
      difficultyScore: q.difficultyScore || 0.5,
      userAnswer: userAns
    }

    setAnswers(prev => [...prev, ans])
    setShowExplanation(true)

    setTimeout(async () => {
      setShowExplanation(false)
      setSelectedOption(null)
      setUserAnswer('')

      if (current + 1 >= questions.length) {
        // Submit all answers
        const allAnswers = [...answers, ans]
        try {
          const { data } = await api.post('/api/quiz/submit', { courseId, answers: allAnswers })
          setResults({ ...data, answers: allAnswers, questions })
          setPhase('results')
        } catch (e) {
          console.error('Submit failed:', e)
          setResults({ score: 0, answers: allAnswers, questions })
          setPhase('results')
        }
      } else {
        setCurrent(c => c + 1)
      }
    }, 2000)
  }

  if (phase === 'setup') return (
    <SetupScreen
      settings={settings}
      setSettings={setSettings}
      onStart={startQuiz}
      onBack={() => navigate(`/courses/${courseId}`)}
      loading={loading}
      error={error}
    />
  )

  if (phase === 'playing') {
    const q = questions[current]
    const progress = ((current) / questions.length) * 100

    return (
      <div className="quiz-root">
        <div className="quiz-header">
          <span className="quiz-progress-label">{current + 1} / {questions.length}</span>
          <span className={`quiz-difficulty quiz-difficulty--${q.difficulty}`}>{q.difficulty}</span>
          {q.conceptTag && <span className="quiz-tag">{q.conceptTag}</span>}
        </div>
        <div className="quiz-progress-track">
          <div className="quiz-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="quiz-card">
          <div className={`quiz-type-badge quiz-type-badge--${q.type}`}>
            {q.type === 'multiple_choice' ? 'Multiple Choice' : q.type === 'true_false' ? 'True / False' : 'Short Answer'}
          </div>
          <h2 className="quiz-question">{q.question}</h2>

          {/* Multiple choice */}
          {q.type === 'multiple_choice' && (
            <div className="quiz-options">
              {q.options?.map((opt, i) => {
                let cls = 'quiz-option'
                if (showExplanation) {
                  if (opt === q.correctAnswer) cls += ' quiz-option--correct'
                  else if (opt === selectedOption) cls += ' quiz-option--wrong'
                } else if (opt === selectedOption) cls += ' quiz-option--selected'
                return (
                  <button key={i} className={cls} onClick={() => !showExplanation && setSelectedOption(opt)}>
                    <span className="quiz-option-letter">{String.fromCharCode(65 + i)}</span>
                    {opt}
                  </button>
                )
              })}
            </div>
          )}

          {/* True / False */}
          {q.type === 'true_false' && (
            <div className="quiz-tf-row">
              {['true', 'false'].map(v => {
                let cls = 'quiz-tf-btn'
                if (showExplanation) {
                  if (String(q.correctAnswer) === v) cls += ' quiz-option--correct'
                  else if (userAnswer === v) cls += ' quiz-option--wrong'
                } else if (userAnswer === v) cls += ' quiz-tf-btn--selected'
                return (
                  <button key={v} className={cls} onClick={() => !showExplanation && setUserAnswer(v)}>
                    {v === 'true' ? '✓ True' : '✗ False'}
                  </button>
                )
              })}
            </div>
          )}

          {/* Short answer */}
          {q.type === 'short_answer' && (
            <textarea
              className="quiz-textarea"
              placeholder="Type your answer here..."
              value={userAnswer}
              onChange={e => setUserAnswer(e.target.value)}
              disabled={showExplanation}
              rows={4}
            />
          )}

          {/* Explanation */}
          {showExplanation && (q.explanation || q.modelAnswer) && (
            <div className="quiz-explanation">
              <strong>💡 {q.type === 'short_answer' ? 'Model Answer' : 'Explanation'}</strong>
              <p>{q.explanation || q.modelAnswer}</p>
            </div>
          )}
        </div>

        <button
          className="quiz-submit-btn"
          onClick={submitAnswer}
          disabled={showExplanation || (q.type === 'multiple_choice' && !selectedOption) || (q.type === 'true_false' && !userAnswer) || (q.type === 'short_answer' && !userAnswer.trim())}
        >
          {showExplanation ? 'Next →' : 'Submit Answer'}
        </button>
      </div>
    )
  }

  if (phase === 'results') return (
    <ResultsScreen
      results={results}
      onRetry={startQuiz}
      onBack={() => navigate(`/courses/${courseId}`)}
    />
  )
}

function SetupScreen({ settings, setSettings, onStart, onBack, loading, error }) {
  return (
    <div className="quiz-setup">
      <div className="quiz-setup-card">
        <button className="fc-back" onClick={onBack}>← Back</button>
        <h1 className="quiz-setup-title">🧠 Generate Quiz</h1>
        <p className="quiz-setup-sub">AI will create questions from your course content</p>

        <div className="quiz-setup-fields">
          <label className="quiz-label">
            Topic (optional)
            <input
              className="quiz-input"
              placeholder="e.g. Neural Networks, Photosynthesis..."
              value={settings.topic}
              onChange={e => setSettings(s => ({ ...s, topic: e.target.value }))}
            />
          </label>

          <label className="quiz-label">
            Number of Questions
            <div className="quiz-count-row">
              {[3, 5, 8, 10].map(n => (
                <button
                  key={n}
                  className={`quiz-count-btn ${settings.count === n ? 'quiz-count-btn--active' : ''}`}
                  onClick={() => setSettings(s => ({ ...s, count: n }))}
                >{n}</button>
              ))}
            </div>
          </label>

          <label className="quiz-label">
            Difficulty
            <div className="quiz-diff-row">
              {['easy', 'medium', 'hard', 'mixed'].map(d => (
                <button
                  key={d}
                  className={`quiz-diff-btn quiz-diff-btn--${d} ${settings.difficulty === d ? 'active' : ''}`}
                  onClick={() => setSettings(s => ({ ...s, difficulty: d }))}
                >{d}</button>
              ))}
            </div>
          </label>
        </div>

        {error && <p className="quiz-error">{error}</p>}

        <button className="quiz-start-btn" onClick={onStart} disabled={loading}>
          {loading ? <span className="quiz-spinner" /> : '🚀 Start Quiz'}
        </button>
      </div>
    </div>
  )
}

function ResultsScreen({ results, onRetry, onBack }) {
  const score = results?.score ?? 0
  const total = results?.total ?? 0
  const correct = results?.totalCorrect ?? 0

  const emoji = score >= 80 ? '🏆' : score >= 60 ? '👍' : score >= 40 ? '📚' : '💪'

  return (
    <div className="quiz-results">
      <div className="quiz-results-card">
        <div className="quiz-results-emoji">{emoji}</div>
        <h2 className="quiz-results-score">{score}%</h2>
        <p className="quiz-results-sub">{correct} of {total} correct</p>

        <div className="quiz-results-breakdown">
          {results?.questions?.map((q, i) => {
            const ans = results.answers?.[i]
            return (
              <div key={i} className={`quiz-result-row ${ans?.correct ? 'correct' : 'wrong'}`}>
                <span>{ans?.correct ? '✓' : '✗'}</span>
                <span className="quiz-result-q">{q.question}</span>
                <span className={`quiz-diff-chip quiz-difficulty--${q.difficulty}`}>{q.difficulty}</span>
              </div>
            )
          })}
        </div>

        <div className="quiz-results-actions">
          <button className="fc-btn-secondary" onClick={onBack}>Back to Course</button>
          <button className="quiz-start-btn" onClick={onRetry}>Try Again</button>
        </div>
      </div>
    </div>
  )
}
