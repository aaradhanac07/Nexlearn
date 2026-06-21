import { Card }     from '../models/Card.js'
import { Progress } from '../models/Progress.js'
import axios        from 'axios'

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000'

// GET /api/cards?courseId=&dueOnly=true
export const getCards = async (req, res, next) => {
  try {
    const { courseId, dueOnly } = req.query
    const filter = { userId: req.user._id }
    if (courseId) filter.courseId = courseId
    if (dueOnly === 'true') filter.nextReviewAt = { $lte: new Date() }

    const cards = await Card.find(filter).sort({ nextReviewAt: 1 })
    res.json(cards)
  } catch (err) { next(err) }
}

// GET /api/cards/due-count — count of cards due today across all courses
export const getDueCount = async (req, res, next) => {
  try {
    const count = await Card.countDocuments({
      userId:       req.user._id,
      nextReviewAt: { $lte: new Date() }
    })
    res.json({ count })
  } catch (err) { next(err) }
}

// POST /api/cards/:id/review
// body: { rating: 0|1|2|3 }
export const reviewCard = async (req, res, next) => {
  try {
    const { rating } = req.body
    if (rating === undefined) return res.status(400).json({ error: 'rating required' })

    const card = await Card.findOne({ _id: req.params.id, userId: req.user._id })
    if (!card) return res.status(404).json({ error: 'Card not found' })

    // Call AI service for SM-2 computation
    const { data: sm2 } = await axios.post(`${AI_URL}/cards/review`, {
      easeFactor:  card.easeFactor,
      interval:    card.interval,
      repetitions: card.repetitions,
      rating
    })

    // Update card
    card.easeFactor  = sm2.easeFactor
    card.interval    = sm2.interval
    card.repetitions = sm2.repetitions
    card.nextReviewAt = new Date(sm2.nextReviewAt)
    card.history.push({ rating, reviewedAt: new Date() })
    await card.save()

    // Update Progress — rolling accuracy (1 = rating >= 2, 0 = otherwise)
    await updateProgress(req.user._id, card.courseId, card.conceptTag, rating >= 2 ? 1 : 0)

    res.json(card)
  } catch (err) { next(err) }
}

// Helper: update rolling accuracy + mastery % + streak
async function updateProgress(userId, courseId, conceptTag, correct) {
  const today = new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD' UTC

  let prog = await Progress.findOne({ userId, courseId, conceptTag })
  if (!prog) {
    prog = new Progress({ userId, courseId, conceptTag })
  }

  // Rolling accuracy (last 10)
  prog.accuracy.push(correct)
  if (prog.accuracy.length > 10) prog.accuracy.shift()
  prog.recalcMastery()
  prog.lastStudied = new Date()

  // Streak: if last study date was yesterday or today, maintain/increment
  if (prog.lastStudyDate !== today) {
    const yesterday = new Date()
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const yStr = yesterday.toISOString().slice(0, 10)

    if (prog.lastStudyDate === yStr) {
      prog.streak += 1
    } else if (!prog.lastStudyDate) {
      prog.streak = 1
    } else {
      prog.streak = 1  // reset streak
    }
    prog.lastStudyDate = today
  }

  await prog.save()
}
