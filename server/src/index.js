import './config/env.js'
import http    from 'http'
import express from 'express'
import cors    from 'cors'
import helmet  from 'helmet'
import morgan  from 'morgan'
import { Server as SocketServer } from 'socket.io'

import { connectDB }           from './config/db.js'
import { rateLimiter }         from './middleware/rateLimiter.js'
import { errorHandler }        from './middleware/errorHandler.js'
import authRoutes              from './routes/auth.routes.js'
import courseRoutes            from './routes/course.routes.js'
import cardRoutes              from './routes/card.routes.js'
import quizRoutes              from './routes/quiz.routes.js'
import analyticsRoutes         from './routes/analytics.routes.js'
import classroomRoutes         from './routes/classroom.routes.js'
import exportRoutes            from './routes/export.routes.js'
import billingRoutes           from './routes/billing.routes.js'
import studyBuddyRoutes        from './routes/studyBuddy.routes.js'
import studyPlanRoutes         from './routes/studyPlan.routes.js'
import { startReviewQueueJob }  from './jobs/reviewQueue.js'
import { startWeeklyDigestJob } from './jobs/weeklyDigest.js'
import { initStudyRoomSocket }  from './sockets/studyRoom.js'

const app = express()

// Body parser
app.use(express.json({ limit: '10mb' }))

// CORS
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
]
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return cb(null, true)
    if (allowedOrigins.includes(origin)) return cb(null, true)
    // Allow any localhost origin during dev
    if (origin.match(/^http:\/\/localhost:\d+$/)) return cb(null, true)
    cb(new Error('Not allowed by CORS'))
  },
  credentials: true
}))

// Security
app.use(helmet())

// Logger
app.use(morgan('dev'))

// Rate limiter
app.use('/api', rateLimiter)

// Routes
app.use('/api/auth',       authRoutes)
app.use('/api/courses',    courseRoutes)
app.use('/api/cards',      cardRoutes)
app.use('/api/quiz',       quizRoutes)
app.use('/api/analytics',  analyticsRoutes)
app.use('/api/classroom',  classroomRoutes)
app.use('/api/export',     exportRoutes)
app.use('/api/billing',      billingRoutes)
app.use('/api/study-buddy',  studyBuddyRoutes)
app.use('/api/study-plan',   studyPlanRoutes)

// Health
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }))

// Error handler
app.use(errorHandler)

// Create HTTP server (needed for Socket.io)
const httpServer = http.createServer(app)

// Attach Socket.io
const io = new SocketServer(httpServer, {
  cors: {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      if (origin.match(/^http:\/\/localhost:\d+$/)) return cb(null, true)
      cb(new Error('Not allowed by CORS'))
    },
    methods: ['GET', 'POST']
  }
})
initStudyRoomSocket(io)

// Start
const start = async () => {
  await connectDB()
  startReviewQueueJob()
  startWeeklyDigestJob()
  const PORT = process.env.PORT || 5000
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    console.log(`Socket.io ready on /study namespace`)
  })
}

start()