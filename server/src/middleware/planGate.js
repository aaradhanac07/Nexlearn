/**
 * planGate middleware — enforces freemium limits for non-Pro users.
 *
 * Free plan limits:
 *   - Max 3 courses
 *   - Max 50 flashcards (across all courses)
 *
 * Usage: router.post('/', requireAuth, attachUser, planGate('course'), createCourse)
 */
import { Course } from '../models/Course.js'
import { Card }   from '../models/Card.js'

const FREE_LIMITS = {
  course: 3,
  card:   50,
}

export const planGate = (resource) => async (req, res, next) => {
  try {
    // Pro users have no limits
    if (req.user?.plan === 'pro') return next()

    const userId = req.user._id
    const limit  = FREE_LIMITS[resource]

    let count = 0
    if (resource === 'course') {
      count = await Course.countDocuments({ userId })
    } else if (resource === 'card') {
      count = await Card.countDocuments({ userId })
    }

    if (count >= limit) {
      return res.status(403).json({
        error:    'Free plan limit reached',
        resource,
        limit,
        current:  count,
        upgrade:  true,
        message:  `Free plan allows ${limit} ${resource}s. Upgrade to Pro for unlimited access.`,
        hint:     'Visit /upgrade to get NexLearn Pro for ₹299/month'
      })
    }

    next()
  } catch (err) { next(err) }
}
