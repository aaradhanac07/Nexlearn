/**
 * Daily review queue job — runs at midnight UTC.
 * Logs how many cards are due (Node can serve the actual queue via API).
 * Also resets daily streak in Redis for users who didn't study today.
 */
import cron from 'node-cron'
import { Card }     from '../models/Card.js'
import { Progress } from '../models/Progress.js'

export function startReviewQueueJob() {
  // Runs every day at 00:00 UTC
  cron.schedule('0 0 * * *', async () => {
    try {
      const now = new Date()
      const dueCount = await Card.countDocuments({ nextReviewAt: { $lte: now } })
      console.log(`[ReviewQueue] ${new Date().toISOString()} — ${dueCount} cards due for review`)

      // Reset streak for any Progress docs whose lastStudyDate is not today
      const today = now.toISOString().slice(0, 10)
      const yesterday = new Date(now)
      yesterday.setUTCDate(yesterday.getUTCDate() - 1)
      const yStr = yesterday.toISOString().slice(0, 10)

      // Users who didn't study yesterday or today get streak reset
      const resetResult = await Progress.updateMany(
        {
          lastStudyDate: { $nin: [today, yStr, null] }
        },
        { $set: { streak: 0 } }
      )
      console.log(`[ReviewQueue] Streak reset for ${resetResult.modifiedCount} progress records`)

    } catch (err) {
      console.error('[ReviewQueue] Job error:', err.message)
    }
  }, { timezone: 'UTC' })

  console.log('[ReviewQueue] Daily review queue job scheduled (00:00 UTC)')
}
