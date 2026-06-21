import mongoose from 'mongoose'

const cardSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  courseId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Course', index: true },
  front:        String,
  back:         String,
  conceptTag:   String,
  easeFactor:   { type: Number, default: 2.5 },
  interval:     { type: Number, default: 1 },
  repetitions:  { type: Number, default: 0 },
  nextReviewAt: { type: Date, default: Date.now, index: true },
  history:      [{ rating: Number, reviewedAt: Date }],
}, { timestamps: true })

export const Card = mongoose.model('Card', cardSchema)