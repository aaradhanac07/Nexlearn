// // import { createClerkClient } from '@clerk/backend'

// // const clerk = createClerkClient({
// //   secretKey: process.env.CLERK_SECRET_KEY,
// // })

// // export const requireAuth = async (req, res, next) => {
// //   try {
// //     const authHeader = req.headers.authorization
// //     if (!authHeader || !authHeader.startsWith('Bearer ')) {
// //       return res.status(401).json({ error: 'Unauthorized', message: 'Missing token' })
// //     }
// //     const token = authHeader.split(' ')[1]
// //     const payload = await clerk.verifyToken(token)
// //     req.auth = { userId: payload.sub, sessionId: payload.sid }
// //     next()
// //   } catch (err) {
// //     if (err.message?.includes('expired')) {
// //       return res.status(401).json({ error: 'TokenExpired', message: 'JWT expired' })
// //     }
// //     res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' })
// //   }
// // }

// import { clerkClient } from '@clerk/clerk-sdk-node'

// export const requireAuth = async (req, res, next) => {

//   try {

//     const authHeader = req.headers.authorization

//     if (
//       !authHeader ||
//       !authHeader.startsWith('Bearer ')
//     ) {
//       return res.status(401).json({
//         error: 'Unauthorized',
//         message: 'Missing token'
//       })
//     }

//     const token = authHeader.split(' ')[1]

//     const session = await clerkClient.verifyToken(token)

//     req.auth = {
//       userId: session.sub
//     }

//     next()

//   } catch (err) {

//     console.error(err)

//     return res.status(401).json({
//       error: 'Unauthorized',
//       message: 'Invalid token'
//     })
//   }
// }
import { verifyToken } from '@clerk/backend'

export const requireAuth = async (req, res, next) => {

  try {

    const authHeader = req.headers.authorization

    if (
      !authHeader ||
      !authHeader.startsWith('Bearer ')
    ) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing token'
      })
    }

    const token = authHeader.split(' ')[1]

    const payload = await verifyToken(
      token,
      {
        secretKey: process.env.CLERK_SECRET_KEY
      }
    )

    req.auth = {
      userId: payload.sub
    }

    next()

  } catch (err) {

    console.log(err)

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token'
    })
  }
}

export default requireAuth
