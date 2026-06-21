import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { attachUser }  from '../middleware/attachUser.js'
import { exportAnki }  from '../controllers/export.controller.js'

const router = Router()
router.get('/anki/:courseId', requireAuth, attachUser, exportAnki)
export default router
