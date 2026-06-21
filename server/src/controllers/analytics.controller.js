import { Progress } from '../models/Progress.js'
import { Card }     from '../models/Card.js'
import { Course }   from '../models/Course.js'

// GET /api/analytics
export const getAnalytics = async (req, res, next) => {
  try {
    const userId = req.user._id

    // All progress records for this user
    const progList = await Progress.find({ userId }).lean()

    // --- Mastery by concept tag ---
    const masteryByTag = {}
    for (const p of progList) {
      const tag = p.conceptTag || 'general'
      if (!masteryByTag[tag]) masteryByTag[tag] = []
      masteryByTag[tag].push(p.masteryPct)
    }
    const masteryData = Object.entries(masteryByTag).map(([tag, values]) => ({
      tag,
      mastery: Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    })).sort((a, b) => b.mastery - a.mastery).slice(0, 12)

    // --- Study activity heatmap (last 90 days) ---
    const now = new Date()
    const ninetyDaysAgo = new Date(now)
    ninetyDaysAgo.setDate(now.getDate() - 90)

    // Build day→minutes map from studySessions
    const heatmap = {}
    for (const p of progList) {
      for (const session of (p.studySessions || [])) {
        const day = new Date(session.date).toISOString().slice(0, 10)
        heatmap[day] = (heatmap[day] || 0) + (session.minutes || 0)
      }
    }
    // Fill last 90 days with 0 if missing
    const heatmapArray = []
    for (let d = 0; d < 90; d++) {
      const date = new Date(now)
      date.setDate(now.getDate() - (89 - d))
      const key = date.toISOString().slice(0, 10)
      heatmapArray.push({ date: key, minutes: heatmap[key] || 0 })
    }

    // --- Quiz accuracy trend (last 30 sessions, aggregated by day) ---
    const accuracyByDay = {}
    for (const p of progList) {
      for (const session of (p.studySessions || [])) {
        const day = new Date(session.date).toISOString().slice(0, 10)
        if (!accuracyByDay[day]) accuracyByDay[day] = []
        if (session.score !== undefined) accuracyByDay[day].push(session.score)
      }
    }
    const accuracyTrend = Object.entries(accuracyByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, scores]) => ({
        date,
        accuracy: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      }))

    // --- Summary stats ---
    const totalCards     = await Card.countDocuments({ userId })
    const totalCourses   = await Course.countDocuments({ userId })
    const avgMastery     = masteryData.length
      ? Math.round(masteryData.reduce((a, b) => a + b.mastery, 0) / masteryData.length)
      : 0
    const maxStreak      = progList.reduce((max, p) => Math.max(max, p.streak || 0), 0)
    const totalStudyMins = heatmapArray.reduce((a, b) => a + b.minutes, 0)

    res.json({
      summary: { totalCards, totalCourses, avgMastery, maxStreak, totalStudyMins },
      masteryData,
      heatmap: heatmapArray,
      accuracyTrend
    })
  } catch (err) { next(err) }
}
