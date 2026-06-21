import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { attachUser }  from '../middleware/attachUser.js'
import {
  audioUpload,
  transcribeAudio,
  evaluateExplanation,
  getProgress,
  saveProgress,
} from '../controllers/studyBuddy.controller.js'

const router = Router()

// Transcribe audio via Groq Whisper
router.post('/transcribe', requireAuth, attachUser, audioUpload.single('audio'), transcribeAudio)

// Evaluate a concept explanation
router.post('/evaluate', requireAuth, attachUser, evaluateExplanation)

// Persist / retrieve which concepts the user has passed (Study Buddy)
router.get('/progress/:courseId',  requireAuth, attachUser, getProgress)
router.post('/progress/:courseId', requireAuth, attachUser, saveProgress)

export default router
