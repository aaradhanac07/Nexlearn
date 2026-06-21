import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { attachUser }  from '../middleware/attachUser.js'
import {
  generateQuiz,
  submitQuiz,
  getProgress,
  getKnowledgeGraph,
  buildKnowledgeGraph,
  getTimeToMastery
} from '../controllers/quiz.controller.js'

const router = Router()

router.post('/generate',                          requireAuth, attachUser, generateQuiz)
router.post('/submit',                            requireAuth, attachUser, submitQuiz)
router.get('/progress',                           requireAuth, attachUser, getProgress)
router.get('/time-to-mastery',                    requireAuth, attachUser, getTimeToMastery)
router.get('/knowledge-graph/:courseId',          requireAuth, attachUser, getKnowledgeGraph)
router.post('/knowledge-graph/:courseId',         requireAuth, attachUser, buildKnowledgeGraph)

export default router
