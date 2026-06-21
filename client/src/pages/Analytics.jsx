import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAxios } from '../hooks/useAxios'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from 'recharts'
import './Analytics.css'

const STAT_CARDS = [
  { key: 'totalCourses',   label: 'Courses',       icon: '📚', color: '#6366f1' },
  { key: 'totalCards',     label: 'Flashcards',     icon: '🃏', color: '#10b981' },
  { key: 'avgMastery',     label: 'Avg Mastery',    icon: '🎯', suffix: '%', color: '#f59e0b' },
  { key: 'maxStreak',      label: 'Best Streak',    icon: '🔥', suffix: 'd',  color: '#ef4444' },
  { key: 'totalStudyMins', label: 'Study Minutes',  icon: '⏱️', color: '#8b5cf6' },
]

// GitHub-style heatmap cell colour
function heatColor(minutes) {
  if (!minutes) return 'var(--bg-hover)'
  if (minutes < 10)  return '#1e3a5f'
  if (minutes < 30)  return '#1d4ed8'
  if (minutes < 60)  return '#6366f1'
  return '#818cf8'
}

export default function Analytics() {
  const api      = useAxios()
  const navigate = useNavigate()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/analytics')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="an-loading">
      <div className="fc-spinner" />
      <p>Loading analytics...</p>
    </div>
  )

  const { summary = {}, masteryData = [], heatmap = [], accuracyTrend = [] } = data || {}

  // Group heatmap into weeks for the grid
  const weeks = []
  for (let i = 0; i < heatmap.length; i += 7) {
    weeks.push(heatmap.slice(i, i + 7))
  }

  return (
    <div className="an-root">
      {/* Header */}
      <div className="an-header">
        <button className="fc-back" onClick={() => navigate('/dashboard')}>← Dashboard</button>
        <div>
          <h1 className="an-title">📊 Analytics</h1>
          <p className="an-sub">Your learning progress at a glance</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="an-stats-grid">
        {STAT_CARDS.map(s => (
          <div key={s.key} className="an-stat-card">
            <div className="an-stat-icon" style={{ background: s.color + '22', color: s.color }}>
              {s.icon}
            </div>
            <div>
              <div className="an-stat-value" style={{ color: s.color }}>
                {summary[s.key] ?? 0}{s.suffix || ''}
              </div>
              <div className="an-stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="an-grid">

        {/* Mastery by concept */}
        <div className="an-card an-card--wide">
          <h2 className="an-card-title">🎯 Mastery by Concept</h2>
          {masteryData.length === 0 ? (
            <p className="an-empty">No data yet — complete some quizzes to see mastery.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={masteryData} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="tag"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}
                  formatter={v => [`${v}%`, 'Mastery']}
                />
                <Bar dataKey="mastery" radius={[4, 4, 0, 0]}
                  fill="url(#masteryGrad)" />
                <defs>
                  <linearGradient id="masteryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Quiz accuracy trend */}
        <div className="an-card">
          <h2 className="an-card-title">📈 Quiz Accuracy Trend</h2>
          {accuracyTrend.length === 0 ? (
            <p className="an-empty">No quiz sessions yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={accuracyTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}
                  formatter={v => [`${v}%`, 'Accuracy']}
                />
                <Area type="monotone" dataKey="accuracy" stroke="#10b981" fill="url(#accGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Study heatmap */}
        <div className="an-card an-card--full">
          <h2 className="an-card-title">🗓️ Study Activity — Last 90 Days</h2>
          <div className="an-heatmap">
            {weeks.map((week, wi) => (
              <div key={wi} className="an-heatmap-col">
                {week.map((day, di) => (
                  <div
                    key={di}
                    className="an-heatmap-cell"
                    style={{ background: heatColor(day.minutes) }}
                    title={`${day.date}: ${day.minutes} mins`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="an-heatmap-legend">
            <span className="an-legend-label">Less</span>
            {[0, 10, 30, 60, 90].map(m => (
              <div key={m} className="an-heatmap-cell" style={{ background: heatColor(m) }} />
            ))}
            <span className="an-legend-label">More</span>
          </div>
        </div>

      </div>
    </div>
  )
}
