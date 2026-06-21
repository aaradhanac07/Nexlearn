import mongoose from 'mongoose'
import { nanoid } from 'nanoid'

const classroomSchema = new mongoose.Schema({
  teacherId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name:       { type: String, required: true },
  inviteCode: { type: String, default: () => nanoid(8).toUpperCase(), unique: true },
  students:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  courses:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  deadlines:  { type: Map, of: Date, default: {} },  // courseId → deadline
}, { timestamps: true })

export const Classroom = mongoose.model('Classroom', classroomSchema)
