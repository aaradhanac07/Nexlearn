import { User } from '../models/User.js'

export const syncUser = async ({ clerkId, email, name, avatar }) => {
  return User.findOneAndUpdate(
    { clerkId },
    { email, name, avatar, lastSeen: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
}