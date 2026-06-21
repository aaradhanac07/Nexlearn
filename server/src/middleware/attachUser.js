import { User } from '../models/User.js'

export const attachUser = async (req, res, next) => {
  try {
    const user = await User.findOne({ clerkId: req.auth.userId })
    if (!user) {
      return res.status(404).json({ error: 'UserNotFound', message: 'Call /auth/sync first' })
    }
    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}