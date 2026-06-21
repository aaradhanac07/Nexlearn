import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  clerkId:           { type: String, required: true, unique: true, index: true },
  email:             { type: String, required: true, lowercase: true },
  name:              { type: String, default: '' },
  avatar:            { type: String, default: '' },
  plan:              { type: String, enum: ['free', 'pro'], default: 'free' },
  streak:            { type: Number, default: 0 },
  lastSeen:          { type: Date, default: Date.now },
  role:              { type: String, enum: ['student', 'teacher'], default: 'student' },
  razorpayPaymentId: { type: String, default: null },
}, { timestamps: true })

export const User = mongoose.model('User', userSchema)