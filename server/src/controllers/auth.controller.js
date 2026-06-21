import { createClerkClient } from '@clerk/backend'
import { syncUser } from '../services/user.service.js'

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

export const sync = async (req, res, next) => {
  try {
    const clerkUser = await clerk.users.getUser(req.auth.userId)
    const user = await syncUser({
      clerkId: clerkUser.id,
      email:   clerkUser.emailAddresses[0]?.emailAddress ?? '',
      name:    `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim(),
      avatar:  clerkUser.imageUrl ?? '',
    })
    res.status(user.createdAt === user.updatedAt ? 201 : 200).json(user)
  } catch (err) {
    next(err)
  }
}

export const getMe = (req, res) => {
  res.json({
    id:        req.user._id,
    name:      req.user.name,
    email:     req.user.email,
    avatar:    req.user.avatar,
    plan:      req.user.plan,
    streak:    req.user.streak,
    role:      req.user.role,
    createdAt: req.user.createdAt,
  })
}