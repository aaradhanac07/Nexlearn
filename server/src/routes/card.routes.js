import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { attachUser }  from '../middleware/attachUser.js'
import { getCards, getDueCount, reviewCard } from '../controllers/card.controller.js'

const router = Router()

router.get('/',          requireAuth, attachUser, getCards)
router.get('/due-count', requireAuth, attachUser, getDueCount)
router.post('/:id/review', requireAuth, attachUser, reviewCard)

export default router
