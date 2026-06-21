import { Classroom } from '../models/Classroom.js'
import { User }      from '../models/User.js'
import { Progress }  from '../models/Progress.js'

// POST /api/classroom  — teacher creates a class
export const createClassroom = async (req, res, next) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can create classrooms' })
    }
    const { name } = req.body
    if (!name) return res.status(400).json({ error: 'Class name required' })

    const classroom = await Classroom.create({ teacherId: req.user._id, name })
    res.status(201).json(classroom)
  } catch (err) { next(err) }
}

// GET /api/classroom  — teacher lists their classrooms
export const getClassrooms = async (req, res, next) => {
  try {
    const classrooms = await Classroom.find({ teacherId: req.user._id })
      .populate('courses', 'title')
      .lean()
    res.json(classrooms)
  } catch (err) { next(err) }
}

// POST /api/classroom/join  — student joins via invite code
export const joinClassroom = async (req, res, next) => {
  try {
    const { inviteCode } = req.body
    if (!inviteCode) return res.status(400).json({ error: 'inviteCode required' })

    const classroom = await Classroom.findOne({ inviteCode: inviteCode.trim().toUpperCase() })
    if (!classroom) return res.status(404).json({ error: 'Invalid invite code' })

    const studentId = req.user._id
    if (classroom.students.some(s => s.equals(studentId))) {
      return res.json({ message: 'Already a member', classroom })
    }

    classroom.students.push(studentId)
    await classroom.save()
    res.json({ message: 'Joined successfully', classroom })
  } catch (err) { next(err) }
}

// GET /api/classroom/:id/students  — teacher gets per-student mastery
export const getStudentProgress = async (req, res, next) => {
  try {
    const classroom = await Classroom.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    }).populate('students', 'name email avatar')

    if (!classroom) return res.status(404).json({ error: 'Classroom not found' })

    // For each student, aggregate mastery per concept
    const studentData = await Promise.all(classroom.students.map(async student => {
      const progList = await Progress.find({ userId: student._id }).lean()

      // Overall avg mastery
      const avgMastery = progList.length
        ? Math.round(progList.reduce((a, p) => a + p.masteryPct, 0) / progList.length)
        : 0

      // Weakest concepts (< 40% mastery)
      const weak = progList
        .filter(p => p.masteryPct < 40)
        .sort((a, b) => a.masteryPct - b.masteryPct)
        .slice(0, 3)
        .map(p => ({ tag: p.conceptTag, mastery: p.masteryPct }))

      const maxStreak = progList.reduce((max, p) => Math.max(max, p.streak || 0), 0)

      return {
        student: { _id: student._id, name: student.name, email: student.email, avatar: student.avatar },
        avgMastery,
        maxStreak,
        weakConcepts: weak,
        totalConcepts: progList.length
      }
    }))

    // Class-level alerts: concepts where avg mastery < 40%
    const allProg = await Progress.find({
      userId: { $in: classroom.students.map(s => s._id) }
    }).lean()

    const tagMap = {}
    for (const p of allProg) {
      if (!tagMap[p.conceptTag]) tagMap[p.conceptTag] = []
      tagMap[p.conceptTag].push(p.masteryPct)
    }
    const alerts = Object.entries(tagMap)
      .map(([tag, vals]) => ({
        tag,
        avgMastery: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
      }))
      .filter(t => t.avgMastery < 40)
      .sort((a, b) => a.avgMastery - b.avgMastery)
      .slice(0, 5)

    res.json({
      classroom: { _id: classroom._id, name: classroom.name, inviteCode: classroom.inviteCode },
      students: studentData,
      classAvgMastery: studentData.length
        ? Math.round(studentData.reduce((a, s) => a + s.avgMastery, 0) / studentData.length)
        : 0,
      alerts
    })
  } catch (err) { next(err) }
}

// PATCH /api/classroom/:id — update name or add course/deadline
export const updateClassroom = async (req, res, next) => {
  try {
    const classroom = await Classroom.findOne({ _id: req.params.id, teacherId: req.user._id })
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' })

    const { name, courseId, deadline } = req.body
    if (name) classroom.name = name
    if (courseId && !classroom.courses.some(c => c.equals(courseId))) {
      classroom.courses.push(courseId)
    }
    if (courseId && deadline) {
      classroom.deadlines.set(courseId, new Date(deadline))
    }
    await classroom.save()
    res.json(classroom)
  } catch (err) { next(err) }
}

// PATCH /api/users/role — promote self to teacher (or admin promotes)
export const setTeacherRole = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { role: 'teacher' })
    res.json({ message: 'Role updated to teacher' })
  } catch (err) { next(err) }
}
