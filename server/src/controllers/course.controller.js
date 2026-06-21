import { Course } from '../models/Course.js'
import { Card }   from '../models/Card.js'
import { ingestPDF, ingestYouTube, ingestText, ingestMerge, chatWithCourse } from '../services/ai.service.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SSE_HEADERS = {
  'Content-Type':    'text/event-stream',
  'Cache-Control':   'no-cache',
  'Connection':      'keep-alive',
  'X-Accel-Buffering': 'no',
}

function sseError(res, message) {
  res.write(`data: ${JSON.stringify({ stage: 'error', message })}\n\n`)
  res.end()
}

/**
 * Parse SSE events from a streamed Python response.
 * Calls onComplete(result) when stage === 'complete'.
 * Forwards all raw bytes to `res` except the complete event (re-serialised with extra fields).
 */
function proxySSEStream({ aiStream, res, req, onComplete }) {
  let leftover = ''

  aiStream.data.on('data', (chunk) => {
    const text = chunk.toString()
    leftover  += text

    // Try to parse any complete SSE lines in the buffer
    const lines = leftover.split('\n')
    leftover    = lines.pop() ?? ''   // keep partial last line

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) {
        res.write(line + '\n')
        continue
      }

      const payload = trimmed.slice(5).trim()
      if (!payload) { res.write(line + '\n'); continue }

      try {
        const parsed = JSON.parse(payload)
        if (parsed.stage === 'complete') {
          // Let caller augment the result, then forward
          onComplete(parsed.result).then(enriched => {
            res.write(`data: ${JSON.stringify({ stage: 'complete', result: enriched })}\n\n`)
          }).catch(() => {
            res.write(`data: ${JSON.stringify({ stage: 'complete', result: parsed.result })}\n\n`)
          })
        } else {
          res.write(line + '\n')
        }
      } catch {
        res.write(line + '\n')
      }
    }
  })

  aiStream.data.on('end', () => res.end())

  aiStream.data.on('error', (err) => {
    console.error('AI stream error:', err.message)
    sseError(res, 'Stream error from AI service')
  })

  req.on('close', () => {
    try { aiStream.data.destroy() } catch {}
  })
}

/**
 * Persist AI result into Mongo and return the enriched result object.
 */
async function persistResult(course, result, userId) {
  course.title           = result.metadata?.title       || course.title
  course.description     = result.metadata?.description || ''
  course.summary         = Array.isArray(result.metadata?.summary)
    ? result.metadata.summary.join('\n')
    : (result.metadata?.summary || '')
  course.concepts        = result.metadata?.concepts    || []
  course.vectorNamespace = course._id.toString()
  course.status          = 'ready'
  course.studyOrder      = result.studyOrder            || []
  course.sources         = result.sources               || []
  if (result.metadata?.crossReference) {
    course.crossReference = result.metadata.crossReference
  }
  await course.save()

  // Flashcards
  if (result.flashcards?.length) {
    const cards = result.flashcards.map(c => ({
      userId,
      courseId:   course._id,
      front:      c.front,
      back:       c.back,
      conceptTag: c.conceptTag || 'general',
    }))
    await Card.insertMany(cards)
    course.cardCount = cards.length
    await course.save()
  }

  return { ...result, courseId: course._id, course: course.toObject() }
}


// ─── PDF upload (existing — now with SSE-compat helper refactor) ──────────────

export const uploadCourse = async (req, res, next) => {
  try {
    console.log('[uploadCourse] Starting PDF upload...')

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    console.log(`[uploadCourse] File: ${req.file.originalname}, Size: ${req.file.size} bytes`)

    const course = await Course.create({
      userId:          req.user._id,
      title:           req.file.originalname,
      sourceType:      'pdf',
      status:          'processing',
      vectorNamespace: 'placeholder',
    })

    let result
    try {
      result = await ingestPDF(req.file.buffer, req.file.originalname, course._id.toString(), req.auth.userId)
    } catch (aiErr) {
      await Course.findByIdAndDelete(course._id)
      return res.status(502).json({
        error:  'AI service failed',
        detail: aiErr.response?.data?.detail || aiErr.message,
        hint:   'Ensure Python AI service is running on port 8000',
      })
    }

    course.title           = result.metadata?.title || req.file.originalname
    course.description     = result.metadata?.description || ''
    course.summary         = Array.isArray(result.metadata?.summary)
      ? result.metadata.summary.join('\n')
      : (result.metadata?.summary || '')
    course.concepts        = result.metadata?.concepts || []
    course.vectorNamespace = course._id.toString()
    course.status          = 'ready'
    course.sources         = [{ type: 'pdf', name: req.file.originalname }]
    await course.save()

    if (result.flashcards?.length) {
      const cards = result.flashcards.map(c => ({
        userId:     req.user._id,
        courseId:   course._id,
        front:      c.front,
        back:       c.back,
        conceptTag: c.conceptTag || 'general',
      }))
      await Card.insertMany(cards)
      course.cardCount = cards.length
      await course.save()
    }

    res.status(201).json(course)
  } catch (err) {
    console.error('[uploadCourse] Unexpected error:', err.message)
    next(err)
  }
}


// ─── YouTube SSE ingest ───────────────────────────────────────────────────────

export const uploadYoutube = async (req, res, next) => {
  try {
    console.log('[uploadYoutube] req.body:', req.body)
    const { youtubeUrl } = req.body
    if (!youtubeUrl) return res.status(400).json({ error: 'YouTube URL required' })
    console.log('[uploadYoutube] youtubeUrl:', youtubeUrl)

    const course = await Course.create({
      userId:          req.user._id,
      title:           'Processing YouTube…',
      sourceType:      'youtube',
      sourceUrl:       youtubeUrl,
      status:          'processing',
      vectorNamespace: 'placeholder',
    })

    Object.entries(SSE_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
    res.flushHeaders()

    let aiStream
    try {
      aiStream = await ingestYouTube(youtubeUrl, course._id.toString(), req.auth.userId)
    } catch (err) {
      console.error('[uploadYoutube] AI service call failed:', {
        message:    err.message,
        code:       err.code,
        status:     err.response?.status,
        url:        err.config?.url,
        data:       err.response?.data,
      })
      await Course.findByIdAndDelete(course._id)
      return sseError(res, `AI service error: ${err.message || 'Make sure Python is running on port 8000.'}`)
    }

    proxySSEStream({
      aiStream, res, req,
      onComplete: (result) => persistResult(course, result, req.user._id),
    })

  } catch (err) {
    console.error('[uploadYoutube]', err.message)
    if (!res.headersSent) return next(err)
    sseError(res, err.message)
  }
}


// ─── Text / paste SSE ingest ──────────────────────────────────────────────────

export const uploadText = async (req, res, next) => {
  try {
    const { text, sourceName } = req.body
    if (!text?.trim()) return res.status(400).json({ error: 'Text content required' })

    const course = await Course.create({
      userId:          req.user._id,
      title:           sourceName || 'Pasted Notes',
      sourceType:      'text',
      status:          'processing',
      vectorNamespace: 'placeholder',
    })

    Object.entries(SSE_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
    res.flushHeaders()

    let aiStream
    try {
      aiStream = await ingestText(text, sourceName, course._id.toString(), req.auth.userId)
    } catch (err) {
      await Course.findByIdAndDelete(course._id)
      return sseError(res, 'AI service unavailable.')
    }

    proxySSEStream({
      aiStream, res, req,
      onComplete: (result) => persistResult(course, result, req.user._id),
    })

  } catch (err) {
    console.error('[uploadText]', err.message)
    if (!res.headersSent) return next(err)
    sseError(res, err.message)
  }
}


// ─── Multi-source Merge SSE ingest ────────────────────────────────────────────

export const uploadMerge = async (req, res, next) => {
  try {
    const { youtubeUrl } = req.body
    const hasFile = !!req.file
    const hasYT   = !!youtubeUrl?.trim()

    if (!hasFile && !hasYT) {
      return res.status(400).json({ error: 'Provide at least one source (PDF or YouTube URL)' })
    }

    const course = await Course.create({
      userId:          req.user._id,
      title:           'Processing merged sources…',
      sourceType:      'merge',
      sourceUrl:       youtubeUrl || null,
      status:          'processing',
      vectorNamespace: 'placeholder',
    })

    Object.entries(SSE_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
    res.flushHeaders()

    let aiStream
    try {
      aiStream = await ingestMerge(
        hasFile ? req.file.buffer    : null,
        hasFile ? req.file.originalname : null,
        hasYT   ? youtubeUrl         : null,
        course._id.toString(),
        req.auth.userId,
      )
    } catch (err) {
      await Course.findByIdAndDelete(course._id)
      return sseError(res, 'AI service unavailable.')
    }

    proxySSEStream({
      aiStream, res, req,
      onComplete: (result) => persistResult(course, result, req.user._id),
    })

  } catch (err) {
    console.error('[uploadMerge]', err.message)
    if (!res.headersSent) return next(err)
    sseError(res, err.message)
  }
}


// ─── GET /api/courses ─────────────────────────────────────────────────────────

export const getCourses = async (req, res, next) => {
  try {
    const courses = await Course.find({ userId: req.user._id }).sort({ createdAt: -1 })
    res.json(courses)
  } catch (err) { next(err) }
}


// ─── GET /api/courses/:id ─────────────────────────────────────────────────────

export const getCourse = async (req, res, next) => {
  try {
    const course = await Course.findOne({ _id: req.params.id, userId: req.user._id })
    if (!course) return res.status(404).json({ error: 'Course not found' })
    res.json(course)
  } catch (err) { next(err) }
}


// ─── POST /api/courses/:id/chat (SSE proxy) ───────────────────────────────────

export const streamChat = async (req, res, next) => {
  try {
    const { question } = req.body
    if (!question) return res.status(400).json({ error: 'Question required' })

    Object.entries(SSE_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
    res.flushHeaders()

    let aiResponse
    try {
      aiResponse = await chatWithCourse(req.params.id, req.auth.userId, question)
    } catch (aiErr) {
      console.error('AI service unreachable:', aiErr.message)
      res.write(`data: ${JSON.stringify({ token: 'AI service is offline. Make sure Python is running on port 8000.' })}\n\n`)
      res.write('data: [DONE]\n\n')
      return res.end()
    }

    aiResponse.data.on('data', chunk => res.write(chunk))

    aiResponse.data.on('end', () => {
      res.write('data: [DONE]\n\n')
      res.end()
    })

    aiResponse.data.on('error', err => {
      console.error('Stream pipe error:', err.message)
      res.write(`data: ${JSON.stringify({ token: 'Stream error occurred.' })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
    })

    req.on('close', () => {
      try { aiResponse.data.destroy() } catch {}
    })

  } catch (err) {
    console.error('streamChat error:', err.message)
    if (!res.headersSent) return next(err)
    res.write(`data: ${JSON.stringify({ token: 'Unexpected server error.' })}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
  }
}
