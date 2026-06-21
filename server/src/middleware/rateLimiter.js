import rateLimit from 'express-rate-limit'

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'TooManyRequests', message: 'Slow down — try again in 15 minutes' },
})