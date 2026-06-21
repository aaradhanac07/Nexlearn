import mongoose from 'mongoose'

const progressSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  clerkUserId:   { type: String, index: true },   // Clerk user ID (string)
  courseId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Course', index: true },
  conceptTag:    String,
  accuracy:      [Number],        // rolling array of last 10 results (1=correct, 0=wrong)
  masteryPct:    { type: Number, default: 0 },
  studyMinutes:  { type: Number, default: 0 },
  lastStudied:   Date,
  // Streak tracking
  streak:        { type: Number, default: 0 },
  lastStudyDate: { type: String, default: null },  // 'YYYY-MM-DD' UTC
  // Analytics: per-session history
  studySessions: [{
    date:    { type: Date, default: Date.now },
    minutes: { type: Number, default: 0 },
    score:   { type: Number, default: 0 }   // 0-100
  }],
  // Study Buddy: concepts the user has passed (score >= 60)
  studyBuddyConcepts: { type: [String], default: [] }
}, { timestamps: true })

// Update mastery % when accuracy array changes
progressSchema.methods.recalcMastery = function () {
  if (!this.accuracy.length) { this.masteryPct = 0; return }
  const recent = this.accuracy.slice(-10)
  this.masteryPct = Math.round((recent.reduce((a, b) => a + b, 0) / recent.length) * 100)
}

export const Progress = mongoose.model('Progress', progressSchema)