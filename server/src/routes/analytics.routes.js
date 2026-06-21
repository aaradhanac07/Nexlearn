import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { attachUser }  from '../middleware/attachUser.js'
import { getAnalytics } from '../controllers/analytics.controller.js'

const router = Router()
router.get('/', requireAuth, attachUser, getAnalytics)
export default router
