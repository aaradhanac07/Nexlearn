import { useEffect, useState } from 'react'
import { useAxios } from '../hooks/useAxios'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts'
import './Analytics.css'

const STAT_CARDS = [
  { key: 'totalCourses',   label: 'COURSES',       icon: '📚', gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)' },
  { key: 'totalCards',     label: 'FLASHCARDS',    icon: '🃏', gradient: 'linear-gradient(135deg,#8b5cf6,#ec4899)' },
  { key: 'avgMastery',     label: 'AVG MASTERY',   icon: '🎯', suffix: '%', gradient: 'linear-gradient(135deg,#10b981,#06b6d4)' },
  { key: 'maxStreak',      label: 'BEST STREAK',   icon: '🔥', suffix: 'd',  gradient: 'linear-gradient(135deg,#f59e0b,#ef4444)' },
  { key: 'totalStudyMins', label: 'STUDY MINUTES', icon: '⏱️', gradient: 'linear-gradient(135deg,#06b6d4,#6366f1)' },
]

function heatColor(minutes) {
  if (!minutes)      return 'rgba(255,255,255,0.04)'
  if (minutes < 10)  return 'rgba(99,102,241,0.25)'
  if (minutes < 30)  return 'rgba(99,102,241,0.45)'
  if (minutes < 60)  return 'rgba(99,102,241,0.7)'
  return '#818cf8'
}

const CustomTooltip = ({ active, payload, label, suffix = '' }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="an-tooltip">
      <p className="an-tooltip-label">{label}</p>
      <p className="an-tooltip-val">{payload[0].value}{suffix}</p>
    </div>
  )
}

export default function Analytics() {
  const api = useAxios()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/analytics')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="page-loading">
      <div className="fc-spinner" /><span>Loading analytics…</span>
    </div>
  )

  const { summary = {}, masteryData = [], heatmap = [], accuracyTrend = [] } = data || {}

  // Group heatmap into weeks
  const weeks = []
  for (let i = 0; i < heatmap.length; i += 7) weeks.push(heatmap.slice(i, i + 7))

  return (
    <div className="an-root page-enter">

      {/* ── Page header ──────────────────────── */}
      <div className="an-header">
        <h1 className="an-title">Analytics</h1>
        <p className="an-sub text-gradient">Your learning, visualized.</p>
      </div>

      {/* ── Stat cards ───────────────────────── */}
      <div className="an-stats-grid">
        {STAT_CARDS.map(s => (
          <div key={s.key} className="an-stat-card glass card-hover">
            <div className="an-stat-icon-wrap" style={{ background: s.gradient }}>
              <span>{s.icon}</span>
            </div>
            <div className="an-stat-value">{summary[s.key] ?? 0}{s.suffix || ''}</div>
            <div className="an-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Charts grid ──────────────────────── */}
      <div className="an-charts-grid">

        {/* Mastery by concept */}
        <div className="an-card glass an-card--wide">
          <div className="an-card-header">
            <h2 className="an-card-title">Mastery by Concept</h2>
            <span className="an-card-meta">Top 8 concepts</span>
          </div>
          {masteryData.length === 0 ? (
            <p className="an-empty">No data yet — complete some quizzes to see mastery.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={masteryData} margin={{ top: 8, right: 8, left: -20, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="tag"
                  tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'Inter' }}
                  angle={-35} textAnchor="end" interval={0}
                  axisLine={false} tickLine={false}
                />
                <YAxis domain={[0,100]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip suffix="%" />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                <defs>
                  <linearGradient id="masteryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <Bar dataKey="mastery" fill="url(#masteryGrad)" radius={[4,4,0,0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Quiz accuracy trend */}
        <div className="an-card glass">
          <div className="an-card-header">
            <h2 className="an-card-title">Quiz Accuracy Trend</h2>
            <span className="an-card-meta an-card-meta--green">↑ +12% this week</span>
          </div>
          {accuracyTrend.length === 0 ? (
            <p className="an-empty">No quiz sessions yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={accuracyTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} />
                <YAxis domain={[0,100]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip suffix="%" />} cursor={{ stroke: 'rgba(16,185,129,0.3)' }} />
                <Area type="monotone" dataKey="accuracy" stroke="#10b981" strokeWidth={2} fill="url(#accGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Study heatmap */}
        <div className="an-card glass an-card--full">
          <div className="an-card-header">
            <h2 className="an-card-title">Study Activity</h2>
            <span className="an-card-meta">Last 90 days</span>
          </div>
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
