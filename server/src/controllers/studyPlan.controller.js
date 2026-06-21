/**
 * Study Plan Controller
 * CRUD operations for AI-generated study plans, including auto-reschedule.
 */
import axios from 'axios'
import { StudyPlan } from '../models/StudyPlan.js'

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000'


// ── POST /api/study-plan  (generate & save) ───────────────────────────────────

export const generatePlan = async (req, res, next) => {
  try {
    const { examDate, topics, dailyHours, startDate, courseId } = req.body
    if (!examDate || !topics?.length) {
      return res.status(400).json({ error: 'examDate and topics are required' })
    }

    // Call AI plan service
    let aiData
    try {
      const aiRes = await axios.post(`${AI_URL}/plan/generate`, {
        examDate,
        topics,
        dailyHours: dailyHours || 2,
        startDate:  startDate  || new Date().toISOString().slice(0, 10),
        courseId:   courseId   || '',
        userId:     req.auth.userId,
      }, { timeout: 120_000 })
      aiData = aiRes.data
    } catch (aiErr) {
      console.error('[generatePlan] AI service error:', aiErr.response?.data || aiErr.message)
      return res.status(502).json({
        error: 'AI service failed to generate plan',
        detail: aiErr.response?.data?.detail || aiErr.message,
      })
    }

    // Upsert: one plan per (user × course) — replace if exists
    const filter = {
      userId:   req.user._id,
      courseId: courseId || null,
    }

    const plan = await StudyPlan.findOneAndUpdate(
      filter,
      {
        ...filter,
        examDate:    aiData.examDate,
        startDate:   aiData.startDate,
        dailyHours:  aiData.dailyHours,
        topics:      aiData.topics,
        days:        aiData.days,
        generatedAt: new Date(),
        lastRescheduledAt: null,
      },
      { upsert: true, new: true, runValidators: true }
    )

    res.status(201).json(plan)
  } catch (err) {
    next(err)
  }
}


// ── GET /api/study-plan/:courseId ─────────────────────────────────────────────

export const getPlan = async (req, res, next) => {
  try {
    const query = {
      userId: req.user._id,
      ...(req.params.courseId && req.params.courseId !== 'global'
        ? { courseId: req.params.courseId }
        : { courseId: null }),
    }
    const plan = await StudyPlan.findOne(query)
    if (!plan) return res.status(404).json({ error: 'No study plan found' })
    res.json(plan)
  } catch (err) {
    next(err)
  }
}


// ── PATCH /api/study-plan/:planId/days/:date/slots/:slotIdx ──────────────────
// Mark a slot as done or skipped

export const updateSlot = async (req, res, next) => {
  try {
    const { planId, date, slotIdx } = req.params
    const { done, skipped }         = req.body

    const plan = await StudyPlan.findOne({ _id: planId, userId: req.user._id })
    if (!plan) return res.status(404).json({ error: 'Plan not found' })

    const day = plan.days.find(d => d.date === date)
    if (!day) return res.status(404).json({ error: 'Day not found' })

    const idx = parseInt(slotIdx, 10)
    if (isNaN(idx) || idx < 0 || idx >= day.slots.length) {
      return res.status(400).json({ error: 'Invalid slot index' })
    }

    if (done    !== undefined) day.slots[idx].done    = done
    if (skipped !== undefined) day.slots[idx].skipped = skipped
    if (done)                  day.slots[idx].doneAt  = new Date()

    plan.markModified('days')
    await plan.save()
    res.json({ success: true, slot: day.slots[idx] })
  } catch (err) {
    next(err)
  }
}


// ── PATCH /api/study-plan/:planId/reschedule ──────────────────────────────────
// Shift all PENDING future days forward by N days (called when user misses days)

export const reschedulePlan = async (req, res, next) => {
  try {
    const { planId }  = req.params
    const { shiftBy } = req.body   // number of days to shift (defaults to auto-detect)

    const plan = await StudyPlan.findOne({ _id: planId, userId: req.user._id })
    if (!plan) return res.status(404).json({ error: 'Plan not found' })

    const todayStr = new Date().toISOString().slice(0, 10)

    // Auto-detect shift: count past days that have incomplete slots
    let shift = parseInt(shiftBy, 10) || 0
    if (!shift) {
      shift = plan.days.filter(d =>
        d.date < todayStr && d.slots.some(s => !s.done && !s.skipped)
      ).length
    }
    if (shift <= 0) return res.json({ message: 'Nothing to reschedule', plan })

    // Shift pending future days
    plan.days = plan.days.map(d => {
      if (d.date >= todayStr && d.slots.some(s => !s.done && !s.skipped)) {
        const dt = new Date(d.date + 'T00:00:00Z')
        dt.setUTCDate(dt.getUTCDate() + shift)
        return { ...d.toObject(), date: dt.toISOString().slice(0, 10) }
      }
      return d
    })

    // Sort by date
    plan.days.sort((a, b) => a.date.localeCompare(b.date))
    plan.days.forEach((d, i) => { d.dayIndex = i })

    // Update exam date too
    const examDt = new Date(plan.examDate + 'T00:00:00Z')
    examDt.setUTCDate(examDt.getUTCDate() + shift)
    plan.examDate           = examDt.toISOString().slice(0, 10)
    plan.lastRescheduledAt  = new Date()

    plan.markModified('days')
    await plan.save()
    res.json(plan)
  } catch (err) {
    next(err)
  }
}


// ── DELETE /api/study-plan/:planId ────────────────────────────────────────────

export const deletePlan = async (req, res, next) => {
  try {
    await StudyPlan.deleteOne({ _id: req.params.planId, userId: req.user._id })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}
