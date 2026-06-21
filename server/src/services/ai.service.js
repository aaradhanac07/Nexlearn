import FormData from 'form-data'
import axios    from 'axios'

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000'

// ─── Existing PDF ingest ──────────────────────────────────────────────────────

export const ingestPDF = async (fileBuffer, originalName, courseId, userId) => {
  console.log(`[ai.service] ingestPDF starting - courseId=${courseId}, file=${originalName}`)

  const form = new FormData()
  form.append('file', fileBuffer, { filename: originalName, contentType: 'application/pdf' })
  form.append('courseId', courseId)
  form.append('userId',   userId)

  const url = `${AI_URL}/ingest/pdf`
  console.log(`[ai.service] POST → ${url}`)

  try {
    const { data } = await axios.post(url, form, {
      headers:       form.getHeaders(),
      maxBodyLength: Infinity,
      timeout:       120000,
    })
    console.log('[ai.service] ingestPDF success')
    return data
  } catch (error) {
    console.error('[ai.service] ingestPDF failed:', {
      message:    error.message,
      code:       error.code,
      status:     error.response?.status,
      statusText: error.response?.statusText,
      url:        error.config?.url,
    })
    throw error
  }
}

// ─── YouTube SSE ingest ───────────────────────────────────────────────────────

export const ingestYouTube = async (youtubeUrl, courseId, userId) => {
  console.log(`[ai.service] ingestYouTube courseId=${courseId}`)

  const form = new FormData()
  form.append('youtubeUrl', youtubeUrl)
  form.append('courseId',   courseId)
  form.append('userId',     userId)

  return axios.post(`${AI_URL}/ingest/youtube`, form, {
    headers:       { ...form.getHeaders() },
    responseType:  'stream',
    timeout:       180000,    // 3 min — transcription can be slow
  })
}

// ─── Text / paste SSE ingest ──────────────────────────────────────────────────

export const ingestText = async (text, sourceName, courseId, userId) => {
  console.log(`[ai.service] ingestText courseId=${courseId}, chars=${text.length}`)

  const form = new FormData()
  form.append('text',       text)
  form.append('sourceName', sourceName || 'Pasted Notes')
  form.append('courseId',   courseId)
  form.append('userId',     userId)

  return axios.post(`${AI_URL}/ingest/text`, form, {
    headers:      { ...form.getHeaders() },
    responseType: 'stream',
    timeout:      120000,
  })
}

// ─── Multi-source Merge SSE ingest ────────────────────────────────────────────

export const ingestMerge = async (fileBuffer, fileName, youtubeUrl, courseId, userId) => {
  console.log(`[ai.service] ingestMerge courseId=${courseId}, hasPDF=${!!fileBuffer}, hasYT=${!!youtubeUrl}`)

  const form = new FormData()
  form.append('courseId',   courseId)
  form.append('userId',     userId)
  if (youtubeUrl) form.append('youtubeUrl', youtubeUrl)
  if (fileBuffer) form.append('file', fileBuffer, { filename: fileName, contentType: 'application/pdf' })

  return axios.post(`${AI_URL}/ingest/merge`, form, {
    headers:       { ...form.getHeaders() },
    maxBodyLength: Infinity,
    responseType:  'stream',
    timeout:       240000,    // 4 min — two sources to process
  })
}

// ─── Chat SSE ─────────────────────────────────────────────────────────────────

export const chatWithCourse = async (courseId, userId, question) => {
  console.log(`[ai.service] chat → courseId=${courseId} userId=${userId}`)

  const url = `${AI_URL}/chat`
  try {
    const response = await axios.post(
      url,
      { courseId, userId, question },
      { responseType: 'stream', timeout: 120000, headers: { 'Content-Type': 'application/json' } },
    )
    console.log('[ai.service] chat stream started')
    return response
  } catch (error) {
    console.error('[ai.service] chat failed:', {
      message:    error.message,
      code:       error.code,
      status:     error.response?.status,
      statusText: error.response?.statusText,
    })
    throw error
  }
}