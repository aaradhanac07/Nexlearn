import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middleware/requireAuth.js'
import { attachUser }  from '../middleware/attachUser.js'
import { planGate }    from '../middleware/planGate.js'
import {
  uploadCourse,
  uploadYoutube,
  uploadText,
  uploadMerge,
  getCourses,
  getCourse,
  streamChat,
} from '../controllers/course.controller.js'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 },   // 50 MB
})

// ─── Course listing ───────────────────────────────────────────────────────────
router.get('/',    requireAuth, attachUser, getCourses)
router.get('/:id', requireAuth, attachUser, getCourse)

// ─── Ingest: PDF (existing) ───────────────────────────────────────────────────
router.post('/upload',
  requireAuth, attachUser, planGate('course'),
  upload.single('file'),
  uploadCourse
)

// ─── Ingest: YouTube (SSE stream) ────────────────────────────────────────────
// upload.none() parses multipart/form-data from the browser so req.body.youtubeUrl is populated
router.post('/ingest-youtube',
  requireAuth, attachUser, planGate('course'),
  upload.none(),
  uploadYoutube
)

// ─── Ingest: Plain text / paste (SSE stream) ─────────────────────────────────
// upload.none() parses multipart/form-data from the browser so req.body.text is populated
router.post('/ingest-text',
  requireAuth, attachUser, planGate('course'),
  upload.none(),
  uploadText
)

// ─── Ingest: Multi-source Merge — PDF + YouTube (SSE stream, Pro only) ────────
router.post('/ingest-merge',
  requireAuth, attachUser, planGate('course'),
  upload.single('file'),
  uploadMerge
)

// ─── Chat with course (SSE stream) ───────────────────────────────────────────
router.post('/:id/chat', requireAuth, streamChat)

export default router