/**
 * Socket.io Study Room — AI-Powered Edition
 *
 * Events (client → server):
 *   join-room        { courseId, userId, userName }
 *   leave-room       { courseId }
 *   quiz-answer      { courseId, userId, userName, correct, score }
 *   webrtc-offer     { courseId, to, offer }       — relay offer to target socket
 *   webrtc-answer    { courseId, to, answer }       — relay answer to target socket
 *   webrtc-ice       { courseId, to, candidate }    — relay ICE candidate
 *   ai-question      { courseId, question, askedBy }— ask AI, broadcast answer to room
 *   start-live-quiz  { courseId }                  — generate + broadcast quiz to all
 *   live-quiz-answer { courseId, questionIndex, correct, score }
 *   end-session      { courseId }                  — generate session summary
 *
 * Events (server → client):
 *   room-users       [{ userId, userName, score, socketId }]
 *   user-joined      { userName, socketId }
 *   user-left        { userName }
 *   score-update     { userId, userName, score, correct }
 *   webrtc-offer     { from, offer }
 *   webrtc-answer    { from, answer }
 *   webrtc-ice       { from, candidate }
 *   ai-thinking      {}                            — AI is processing
 *   ai-answer        { question, answer, askedBy } — AI answer ready
 *   live-quiz-start  { questions }                 — quiz started, here are Qs
 *   live-quiz-result { results, leaderboard }      — after all answers
 *   session-summary  { summary, topicsCovered, reviewNeeded }
 */

import axios from 'axios'

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000'

// Active rooms: roomId → Map<socketId, { userId, userName, score }>
const rooms = new Map()

// Track quiz state per room
const quizState = new Map() // roomId → { questions, answers: Map<socketId, []> }

export function initStudyRoomSocket(io) {
  const studyNS = io.of('/study')

  studyNS.on('connection', (socket) => {
    let currentRoom = null

    // ── JOIN ──────────────────────────────────────────────────────────────────
    socket.on('join-room', ({ courseId, userId, userName }) => {
      if (!courseId || !userId) return

      currentRoom = courseId
      socket.join(courseId)

      if (!rooms.has(courseId)) rooms.set(courseId, new Map())
      rooms.get(courseId).set(socket.id, { userId, userName, score: 0, socketId: socket.id })

      // Notify others and send current member list to everyone
      socket.to(courseId).emit('user-joined', { userName, socketId: socket.id })
      broadcastMembers(studyNS, courseId)

      console.log(`[StudyRoom] ${userName} joined room ${courseId}`)
    })

    // ── QUIZ ANSWER (legacy / quick quiz) ─────────────────────────────────────
    socket.on('quiz-answer', ({ courseId, userId, userName, correct, score }) => {
      if (!courseId) return

      const room = rooms.get(courseId)
      if (room?.has(socket.id)) {
        const member = room.get(socket.id)
        member.score = score ?? (member.score + (correct ? 10 : 0))
      }

      studyNS.to(courseId).emit('score-update', {
        userId, userName,
        score: rooms.get(courseId)?.get(socket.id)?.score ?? 0,
        correct,
      })
      broadcastMembers(studyNS, courseId)
    })

    // ── WEBRTC SIGNALLING RELAY ───────────────────────────────────────────────
    socket.on('webrtc-offer', ({ courseId, to, offer }) => {
      studyNS.to(to).emit('webrtc-offer', { from: socket.id, offer })
    })

    socket.on('webrtc-answer', ({ courseId, to, answer }) => {
      studyNS.to(to).emit('webrtc-answer', { from: socket.id, answer })
    })

    socket.on('webrtc-ice', ({ courseId, to, candidate }) => {
      studyNS.to(to).emit('webrtc-ice', { from: socket.id, candidate })
    })

    // ── AI QUESTION ───────────────────────────────────────────────────────────
    socket.on('ai-question', async ({ courseId, question, askedBy }) => {
      if (!courseId || !question?.trim()) return

      // Tell everyone the AI is thinking
      studyNS.to(courseId).emit('ai-thinking', { question, askedBy })

      try {
        // Collect full streamed response from AI
        const aiRes = await axios.post(
          `${AI_URL}/chat`,
          { question, courseId, userId: 'room' },
          { timeout: 30_000, responseType: 'text' }
        )

        // Parse SSE text → extract tokens
        const raw = typeof aiRes.data === 'string' ? aiRes.data : JSON.stringify(aiRes.data)
        const answer = parseSSETokens(raw)

        studyNS.to(courseId).emit('ai-answer', { question, answer, askedBy })
      } catch (err) {
        console.error('[StudyRoom] AI question error:', err.message)
        studyNS.to(courseId).emit('ai-answer', {
          question,
          answer: 'Sorry, the AI tutor is unavailable right now. Please try again.',
          askedBy,
        })
      }
    })

    // ── LIVE QUIZ ─────────────────────────────────────────────────────────────
    socket.on('start-live-quiz', async ({ courseId }) => {
      if (!courseId) return

      try {
        const { data } = await axios.post(`${AI_URL}/quiz/generate`, {
          courseId, count: 5, difficulty: 'mixed',
        }, { timeout: 30_000 })

        const questions = data.questions || []

        // Store quiz state for this room
        quizState.set(courseId, { questions, answers: new Map(), startedAt: Date.now() })

        // Broadcast questions to all members
        studyNS.to(courseId).emit('live-quiz-start', { questions })
        console.log(`[StudyRoom] Live quiz started in room ${courseId} — ${questions.length} Qs`)
      } catch (err) {
        console.error('[StudyRoom] live-quiz error:', err.message)
        socket.emit('live-quiz-error', { error: 'Failed to generate quiz. Make sure AI service is running.' })
      }
    })

    socket.on('live-quiz-answer', ({ courseId, questionIndex, correct, score }) => {
      if (!courseId) return

      // Update member score
      const room = rooms.get(courseId)
      const member = room?.get(socket.id)
      if (member) member.score = score

      const state = quizState.get(courseId)
      if (!state) return

      // Track this member's answer
      if (!state.answers.has(socket.id)) state.answers.set(socket.id, [])
      state.answers.get(socket.id).push({ questionIndex, correct })

      // Check if all members answered this question
      const totalMembers = rooms.get(courseId)?.size ?? 0
      const answeredCount = [...state.answers.values()].filter(a => a.some(x => x.questionIndex === questionIndex)).length

      // Broadcast live score update
      broadcastMembers(studyNS, courseId)
    })

    // ── SESSION SUMMARY ───────────────────────────────────────────────────────
    socket.on('end-session', async ({ courseId }) => {
      if (!courseId) return

      const members = [...(rooms.get(courseId)?.values() ?? [])]
      const quiz = quizState.get(courseId)

      try {
        // Build summary prompt based on room activity
        const memberList = members.map(m => `${m.userName}: ${m.score} pts`).join(', ')
        const topicsCovered = quiz?.questions?.map(q => q.question?.slice(0, 60)).join('; ') || 'General study session'

        const summaryPrompt = `Summarize this group study session in 3-4 sentences.
Members: ${memberList}.
Topics discussed: ${topicsCovered}.
Provide: (1) overall session summary, (2) who performed best, (3) topics to review.
Respond as JSON: {"summary":"...","topicsCovered":["..."],"reviewNeeded":["..."]}
Only respond with valid JSON, no other text.`

        const aiRes = await axios.post(
          `${AI_URL}/chat`,
          { question: summaryPrompt, courseId, userId: 'room-summary' },
          { timeout: 30_000, responseType: 'text' }
        )

        const raw = typeof aiRes.data === 'string' ? aiRes.data : JSON.stringify(aiRes.data)
        const fullText = parseSSETokens(raw)

        let parsed
        try {
          // Extract JSON from response
          const jsonMatch = fullText.match(/\{[\s\S]*\}/)
          parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null
        } catch { parsed = null }

        const summary = parsed ?? {
          summary: `Study session completed. ${members.length} participant${members.length !== 1 ? 's' : ''} joined. Keep up the great work!`,
          topicsCovered: quiz?.questions?.map(q => q.question?.slice(0, 40)) ?? ['General concepts'],
          reviewNeeded: [],
        }

        studyNS.to(courseId).emit('session-summary', summary)

        // Cleanup quiz state
        quizState.delete(courseId)
      } catch (err) {
        console.error('[StudyRoom] session summary error:', err.message)
        studyNS.to(courseId).emit('session-summary', {
          summary: `Session complete! ${members.length} participant${members.length !== 1 ? 's' : ''} studied together.`,
          topicsCovered: [],
          reviewNeeded: [],
        })
      }
    })

    // ── LEAVE / DISCONNECT ────────────────────────────────────────────────────
    socket.on('leave-room', ({ courseId }) => {
      handleLeave(socket, studyNS, courseId)
    })

    socket.on('disconnect', () => {
      if (currentRoom) handleLeave(socket, studyNS, currentRoom)
    })
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function broadcastMembers(ns, courseId) {
  const members = [...(rooms.get(courseId)?.values() ?? [])]
  ns.to(courseId).emit('room-users', members)
}

function handleLeave(socket, ns, courseId) {
  const room = rooms.get(courseId)
  if (!room) return

  const member = room.get(socket.id)
  if (member) {
    ns.to(courseId).emit('user-left', { userName: member.userName })
    room.delete(socket.id)
    if (room.size === 0) rooms.delete(courseId)
    else broadcastMembers(ns, courseId)
    console.log(`[StudyRoom] ${member.userName} left room ${courseId}`)
  }
  socket.leave(courseId)
}

/** Parse SSE text stream → concatenated token string */
function parseSSETokens(raw) {
  return raw
    .split('\n')
    .filter(l => l.startsWith('data:'))
    .map(l => {
      const payload = l.slice(5).trim()
      if (payload === '[DONE]') return ''
      try {
        const evt = JSON.parse(payload)
        return evt.token ?? ''
      } catch { return '' }
    })
    .join('')
    .trim()
}
