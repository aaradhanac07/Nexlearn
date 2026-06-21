/**
 * Weekly Email Digest — runs every Monday at 09:00 IST (03:30 UTC)
 * Sends each user their: due flashcard count, streak, weakest concept, mastery %
 * Uses Resend API for email delivery.
 */
import cron    from 'node-cron'
import { Resend } from 'resend'
import { User }     from '../models/User.js'
import { Progress } from '../models/Progress.js'
import { Card }     from '../models/Card.js'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

async function buildDigestForUser(user) {
  const progList = await Progress.find({ userId: user._id }).lean()

  const avgMastery = progList.length
    ? Math.round(progList.reduce((a, p) => a + p.masteryPct, 0) / progList.length)
    : 0

  const maxStreak = progList.reduce((max, p) => Math.max(max, p.streak || 0), 0)

  const weakest = progList
    .filter(p => p.masteryPct < 60)
    .sort((a, b) => a.masteryPct - b.masteryPct)
    .slice(0, 3)
    .map(p => `<li>${p.conceptTag} — ${p.masteryPct}% mastery</li>`)
    .join('')

  // Cards due (createdAt + interval <= now — simple approximation)
  const dueCount = await Card.countDocuments({
    userId: user._id,
    nextReview: { $lte: new Date() }
  })

  return { avgMastery, maxStreak, weakest, dueCount }
}

function buildEmailHtml({ name, avgMastery, maxStreak, weakest, dueCount }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Inter, sans-serif; background: #0f172a; color: #f1f5f9; margin: 0; padding: 0; }
    .wrap { max-width: 600px; margin: 40px auto; padding: 0 20px; }
    .card { background: #1e293b; border-radius: 16px; padding: 32px; border: 1px solid #334155; }
    .logo { font-size: 1.5rem; font-weight: 900; color: #818cf8; margin-bottom: 24px; }
    h1 { font-size: 1.4rem; font-weight: 800; color: #f1f5f9; margin: 0 0 8px; }
    p { color: #94a3b8; font-size: 0.95rem; margin: 0 0 24px; }
    .stats { display: flex; gap: 16px; margin-bottom: 24px; }
    .stat { background: #0f172a; border-radius: 12px; padding: 16px 20px; flex: 1; text-align: center; }
    .stat-value { font-size: 1.75rem; font-weight: 800; color: #818cf8; }
    .stat-label { font-size: 0.75rem; color: #64748b; margin-top: 4px; }
    .section-title { font-size: 0.78rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
    ul { padding-left: 20px; color: #f87171; font-size: 0.9rem; }
    .cta { display: block; margin-top: 28px; background: #6366f1; color: #fff; text-decoration: none; text-align: center; padding: 14px; border-radius: 10px; font-weight: 700; font-size: 0.95rem; }
    .footer { text-align: center; color: #475569; font-size: 0.78rem; margin-top: 24px; }
  </style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="logo">⚡ NexLearn</div>
    <h1>Your weekly study digest, ${name}!</h1>
    <p>Here's how your learning is going this week.</p>
    <div class="stats">
      <div class="stat"><div class="stat-value">${avgMastery}%</div><div class="stat-label">Avg Mastery</div></div>
      <div class="stat"><div class="stat-value">🔥 ${maxStreak}</div><div class="stat-label">Day Streak</div></div>
      <div class="stat"><div class="stat-value">${dueCount}</div><div class="stat-label">Cards Due</div></div>
    </div>
    ${weakest ? `
    <div class="section-title">⚠️ Concepts to revisit</div>
    <ul>${weakest}</ul>
    ` : '<p style="color:#10b981">✓ Great work — no weak concepts this week!</p>'}
    <a class="cta" href="http://localhost:5173/dashboard">Resume Studying →</a>
  </div>
  <div class="footer">NexLearn · You're receiving this because you're an active learner.<br>Sent every Monday at 9am IST.</div>
</div>
</body>
</html>
  `
}

async function sendWeeklyDigest() {
  console.log('[WeeklyDigest] Starting...')
  const users = await User.find({ email: { $exists: true } }).lean()
  let sent = 0, failed = 0

  for (const user of users) {
    if (!user.email) continue
    try {
      const stats = await buildDigestForUser(user)
      const html  = buildEmailHtml({ name: user.name || 'Learner', ...stats })

      await resend.emails.send({
        from:    FROM,
        to:      user.email,
        subject: `📊 Your NexLearn weekly digest — ${stats.dueCount} cards due, ${stats.avgMastery}% mastery`,
        html
      })
      sent++
    } catch (err) {
      console.error(`[WeeklyDigest] Failed for ${user.email}:`, err.message)
      failed++
    }
  }
  console.log(`[WeeklyDigest] Done. Sent: ${sent}, Failed: ${failed}`)
}

export function startWeeklyDigestJob() {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'PASTE_KEY_HERE') {
    console.log('[WeeklyDigest] RESEND_API_KEY not set — digest emails disabled')
    return
  }
  // Every Monday at 03:30 UTC = 09:00 IST
  cron.schedule('30 3 * * 1', sendWeeklyDigest)
  console.log('[WeeklyDigest] Weekly email digest job scheduled (Mon 09:00 IST)')
}
