import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { attachUser }  from '../middleware/attachUser.js'
import {
  createClassroom, getClassrooms, joinClassroom,
  getStudentProgress, updateClassroom, setTeacherRole
} from '../controllers/classroom.controller.js'

const router = Router()
router.use(requireAuth, attachUser)

router.post('/',              createClassroom)
router.get('/',               getClassrooms)
router.post('/join',          joinClassroom)
router.get('/:id/students',   getStudentProgress)
router.patch('/:id',          updateClassroom)
router.patch('/me/role',      setTeacherRole)

export default router
