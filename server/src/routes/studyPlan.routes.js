import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { attachUser }  from '../middleware/attachUser.js'
import {
  generatePlan,
  getPlan,
  updateSlot,
  reschedulePlan,
  deletePlan,
} from '../controllers/studyPlan.controller.js'

const router = Router()

// Generate (or replace) a study plan
router.post('/', requireAuth, attachUser, generatePlan)

// Get plan for a course (or "global" for course-independent)
router.get('/:courseId', requireAuth, attachUser, getPlan)

// Mark a slot done/skipped
router.patch('/:planId/days/:date/slots/:slotIdx', requireAuth, attachUser, updateSlot)

// Reschedule missed days
router.patch('/:planId/reschedule', requireAuth, attachUser, reschedulePlan)

// Delete a plan
router.delete('/:planId', requireAuth, attachUser, deletePlan)

export default router
