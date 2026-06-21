/**
 * Study Buddy Controller
 * Secure Node proxy that:
 *  1. Forwards audio → AI /voice/transcribe
 *  2. Forwards transcript + auth info → AI /voice/evaluate
 *  3. Persists + retrieves which concepts a user has passed per course
 *
 * The client never calls the AI service directly; all requests
 * flow through here so we can attach the authenticated userId.
 */
import axios from 'axios'
import FormData from 'form-data'
import multer from 'multer'
import mongoose from 'mongoose'
import { Progress } from '../models/Progress.js'

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000'

// In-memory multer (no disk writes)
export const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB (Groq Whisper limit)
})

// ── POST /api/study-buddy/transcribe ─────────────────────────────────────────

export const transcribeAudio = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file provided' })

    const form = new FormData()
    form.append('audio', req.file.buffer, {
      filename:    req.file.originalname || 'recording.webm',
      contentType: req.file.mimetype     || 'audio/webm',
    })

    const aiRes = await axios.post(`${AI_URL}/voice/transcribe`, form, {
      headers: { ...form.getHeaders() },
      timeout: 30_000,
    })

    res.json(aiRes.data)
  } catch (err) {
    console.error('[transcribeAudio] error:', err.response?.data || err.message)
    const status  = err.response?.status || 500
    const message = err.response?.data?.detail
      || err.response?.data?.error
      || err.message
      || 'Transcription failed'
    res.status(status).json({ error: message })
  }
}


// ── POST /api/study-buddy/evaluate ───────────────────────────────────────────

export const evaluateExplanation = async (req, res, next) => {
  try {
    const { transcript, concept, courseId } = req.body
    if (!transcript?.trim()) return res.status(400).json({ error: 'Transcript is required' })

    const aiRes = await axios.post(`${AI_URL}/voice/evaluate`, {
      transcript,
      concept:  concept  || '',
      courseId: courseId || '',
      userId:   req.auth.userId,
    }, { timeout: 20_000 })

    res.json(aiRes.data)
  } catch (err) {
    console.error('[evaluateExplanation] error:', err.response?.data || err.message)
    const status  = err.response?.status || 500
    const message = err.response?.data?.detail
      || err.response?.data?.error
      || err.message
      || 'Evaluation failed'
    res.status(status).json({ error: message })
  }
}


// ── GET /api/study-buddy/progress/:courseId ───────────────────────────────────
// Returns the list of concepts the authenticated user has already passed.

export const getProgress = async (req, res) => {
  try {
    const { courseId } = req.params
    const userId = req.auth.userId

    // userId from Clerk is a string like 'user_xxx'; store as-is in a dedicated field
    const prog = await Progress.findOne({ clerkUserId: userId, courseId })
    const concepts = prog?.studyBuddyConcepts ?? []
    res.json({ concepts })
  } catch (err) {
    console.error('[getProgress] error:', err.message)
    res.status(500).json({ error: 'Failed to load progress' })
  }
}


// ── POST /api/study-buddy/progress/:courseId ──────────────────────────────────
// Body: { concept: string }  — marks one concept as passed for this user+course.

export const saveProgress = async (req, res) => {
  try {
    const { courseId } = req.params
    const { concept }  = req.body
    const userId = req.auth.userId

    if (!concept?.trim()) return res.status(400).json({ error: 'concept required' })

    await Progress.findOneAndUpdate(
      { clerkUserId: userId, courseId },
      { $addToSet: { studyBuddyConcepts: concept.trim() } },
      { upsert: true, new: true }
    )

    res.json({ ok: true })
  } catch (err) {
    console.error('[saveProgress] error:', err.message)
    res.status(500).json({ error: 'Failed to save progress' })
  }
}
