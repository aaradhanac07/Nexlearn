import mongoose from 'mongoose'

const slotSchema = new mongoose.Schema({
  type:        { type: String, enum: ['new', 'review', 'break', 'exam-practice'], default: 'new' },
  topic:       { type: String, default: '' },
  durationMin: { type: Number, default: 30 },
  description: { type: String, default: '' },
  done:        { type: Boolean, default: false },
  skipped:     { type: Boolean, default: false },
  doneAt:      { type: Date, default: null },
}, { _id: false })

const daySchema = new mongoose.Schema({
  dayIndex:     { type: Number, required: true },
  date:         { type: String, required: true },  // 'YYYY-MM-DD'
  focus:        { type: String, default: '' },
  totalMinutes: { type: Number, default: 0 },
  slots:        [slotSchema],
}, { _id: false })

const studyPlanSchema = new mongoose.Schema({
  userId:              { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  courseId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Course', index: true },
  examDate:            { type: String, required: true },
  startDate:           { type: String, required: true },
  dailyHours:          { type: Number, default: 2 },
  topics:              [String],
  days:                [daySchema],
  generatedAt:         { type: Date, default: Date.now },
  lastRescheduledAt:   { type: Date, default: null },
}, { timestamps: true })

export const StudyPlan = mongoose.model('StudyPlan', studyPlanSchema)
