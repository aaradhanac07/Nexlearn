import { Card }   from '../models/Card.js'
import { Course } from '../models/Course.js'
import axios      from 'axios'
import fs         from 'fs'

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000'

// GET /api/export/anki/:courseId
export const exportAnki = async (req, res, next) => {
  try {
    const course = await Course.findOne({ _id: req.params.courseId, userId: req.user._id })
    if (!course) return res.status(404).json({ error: 'Course not found' })

    const cards = await Card.find({ courseId: req.params.courseId, userId: req.user._id })
      .select('front back')
      .lean()

    if (!cards.length) {
      return res.status(400).json({ error: 'No flashcards found for this course' })
    }

    // Call Python AI service to generate .apkg
    const response = await axios.post(
      `${AI_URL}/export/anki`,
      {
        deckName: course.title,
        cards: cards.map(c => ({ front: c.front, back: c.back }))
      },
      { responseType: 'stream', timeout: 30000 }
    )

    const safeName = course.title.replace(/[^a-z0-9]/gi, '_')
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.apkg"`)
    response.data.pipe(res)

    response.data.on('error', err => {
      console.error('Anki stream error:', err)
      if (!res.headersSent) next(err)
    })
  } catch (err) { next(err) }
}
