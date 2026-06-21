import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { attachUser } from '../middleware/attachUser.js'
import { sync, getMe } from '../controllers/auth.controller.js'

const router = Router()

router.post('/sync', requireAuth, sync)
router.get('/me',   requireAuth, attachUser, getMe)

export default router