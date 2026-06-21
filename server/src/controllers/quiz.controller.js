import { Course }         from '../models/Course.js'
import { Progress }        from '../models/Progress.js'
import { KnowledgeGraph }  from '../models/KnowledgeGraph.js'
import axios               from 'axios'

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000'

// POST /api/quiz/generate
// body: { courseId, topic?, count?, difficulty? }
export const generateQuiz = async (req, res, next) => {
  try {
    const { courseId, topic, count, difficulty } = req.body
    if (!courseId) return res.status(400).json({ error: 'courseId required' })

    const course = await Course.findOne({ _id: courseId, userId: req.user._id })
    if (!course) return res.status(404).json({ error: 'Course not found' })

    const { data } = await axios.post(`${AI_URL}/quiz/generate`, {
      courseId,
      userId: req.auth.userId,
      topic:      topic      || '',
      count:      count      || 5,
      difficulty: difficulty || 'mixed'
    }, { timeout: 60000 })

    res.json(data)
  } catch (err) {
    const detail = err.response?.data?.detail || ''
    const isQuota = detail.includes('429') || detail.includes('RESOURCE_EXHAUSTED')
    const isDown  = err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET'

    if (isQuota) {
      return res.status(503).json({
        error: 'Gemini API quota exhausted',
        detail: 'Your free-tier daily limit is used up. Get a new API key at aistudio.google.com or wait until midnight Pacific time.',
        hint: 'Update GEMINI_API_KEY in ai-service/.env then restart the AI service.'
      })
    }
    if (isDown) {
      return res.status(503).json({
        error: 'AI service not running',
        detail: 'Start it with: venv\\Scripts\\uvicorn app.main:app --port 8000'
      })
    }
    if (err.response?.data) {
      return res.status(502).json({ error: 'AI service error', detail })
    }
    next(err)
  }
}

// POST /api/quiz/submit
// body: { courseId, answers: [{ questionIndex, conceptTag, correct, difficultyScore }] }
export const submitQuiz = async (req, res, next) => {
  try {
    const { courseId, answers } = req.body
    if (!courseId || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'courseId and answers[] required' })
    }

    const totalCorrect = answers.filter(a => a.correct).length
    const score = Math.round((totalCorrect / answers.length) * 100)

    // Group by concept tag and update Progress
    const byTag = {}
    for (const ans of answers) {
      const tag = ans.conceptTag || 'general'
      if (!byTag[tag]) byTag[tag] = []
      byTag[tag].push(ans.correct ? 1 : 0)
    }

    const today = new Date().toISOString().slice(0, 10)

    for (const [tag, results] of Object.entries(byTag)) {
      let prog = await Progress.findOne({ userId: req.user._id, courseId, conceptTag: tag })
      if (!prog) prog = new Progress({ userId: req.user._id, courseId, conceptTag: tag })

      for (const r of results) {
        prog.accuracy.push(r)
        if (prog.accuracy.length > 10) prog.accuracy.shift()
      }
      prog.recalcMastery()
      prog.lastStudied = new Date()

      // Streak
      if (prog.lastStudyDate !== today) {
        const yesterday = new Date()
        yesterday.setUTCDate(yesterday.getUTCDate() - 1)
        const yStr = yesterday.toISOString().slice(0, 10)
        if (prog.lastStudyDate === yStr) prog.streak += 1
        else if (!prog.lastStudyDate)    prog.streak = 1
        else                             prog.streak = 1
        prog.lastStudyDate = today
      }

      await prog.save()
    }

    res.json({ score, totalCorrect, total: answers.length })
  } catch (err) { next(err) }
}

// GET /api/quiz/progress?courseId=
export const getProgress = async (req, res, next) => {
  try {
    const { courseId } = req.query
    const filter = { userId: req.user._id }
    if (courseId) filter.courseId = courseId

    const progList = await Progress.find(filter)

    // Aggregate overall mastery per course
    const byCoarse = {}
    for (const p of progList) {
      const cid = p.courseId.toString()
      if (!byCoarse[cid]) byCoarse[cid] = { masteries: [], streak: 0 }
      byCoarse[cid].masteries.push(p.masteryPct)
      byCoarse[cid].streak = Math.max(byCoarse[cid].streak, p.streak || 0)
    }

    const result = Object.entries(byCoarse).map(([cid, d]) => ({
      courseId:    cid,
      masteryPct:  Math.round(d.masteries.reduce((a, b) => a + b, 0) / d.masteries.length),
      streak:      d.streak
    }))

    res.json(result)
  } catch (err) { next(err) }
}

// GET /api/quiz/knowledge-graph/:courseId
export const getKnowledgeGraph = async (req, res, next) => {
  try {
    const course = await Course.findOne({ _id: req.params.courseId, userId: req.user._id })
    if (!course) return res.status(404).json({ error: 'Course not found' })

    let graph = await KnowledgeGraph.findOne({ courseId: req.params.courseId })

    if (!graph) {
      return res.status(404).json({
        error: 'Knowledge graph not generated yet',
        hint: 'POST /api/quiz/knowledge-graph/:courseId to generate'
      })
    }

    // Enrich nodes with mastery from Progress
    const progressList = await Progress.find({
      userId:   req.user._id,
      courseId: req.params.courseId
    })
    const masteryByTag = {}
    for (const p of progressList) {
      masteryByTag[p.conceptTag] = p.masteryPct
    }

    const enrichedNodes = graph.nodes.map(n => ({
      ...n.toObject(),
      masteryPct: masteryByTag[n.conceptTag] ?? masteryByTag[n.id] ?? 0
    }))

    res.json({ nodes: enrichedNodes, edges: graph.edges })
  } catch (err) { next(err) }
}

// POST /api/quiz/knowledge-graph/:courseId — generate + store the graph
export const buildKnowledgeGraph = async (req, res, next) => {
  try {
    const course = await Course.findOne({ _id: req.params.courseId, userId: req.user._id })
    if (!course) return res.status(404).json({ error: 'Course not found' })

    const { fullText } = req.body
    if (!fullText) return res.status(400).json({ error: 'fullText required' })

    const { data } = await axios.post(`${AI_URL}/cards/knowledge-graph`, {
      courseId: req.params.courseId,
      fullText
    }, { timeout: 60000 })

    // Upsert into MongoDB
    const graph = await KnowledgeGraph.findOneAndUpdate(
      { courseId: req.params.courseId },
      { nodes: data.nodes, edges: data.edges },
      { upsert: true, new: true }
    )

    res.json({ nodes: graph.nodes, edges: graph.edges })
  } catch (err) { next(err) }
}

// GET /api/quiz/time-to-mastery?courseId=
export const getTimeToMastery = async (req, res, next) => {
  try {
    const { courseId } = req.query
    const filter = { userId: req.user._id }
    if (courseId) filter.courseId = courseId

    const progList = await Progress.find(filter)

    const estimates = progList.map(p => {
      const mastery = p.masteryPct || 0
      const remaining = 100 - mastery

      // Linear regression estimate: assume ~5 sessions per 10% mastery gain
      // each session ~20 min
      const sessionsNeeded = Math.ceil((remaining / 10) * 5)
      const minutesNeeded  = sessionsNeeded * 20

      return {
        conceptTag:     p.conceptTag,
        currentMastery: mastery,
        estimatedDays:  Math.ceil(sessionsNeeded / 2), // 2 sessions/day
        estimatedMinutes: minutesNeeded
      }
    })

    res.json(estimates)
  } catch (err) { next(err) }
}
