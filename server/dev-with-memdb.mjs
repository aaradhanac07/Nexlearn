/**
 * dev-with-memdb.mjs
 * 
 * Starts the full NexLearn server with an in-memory MongoDB.
 * Use this when Docker is not available:
 *   node dev-with-memdb.mjs
 */
import { MongoMemoryServer } from 'mongodb-memory-server'

async function main() {
  console.log('[MemDB] Downloading/starting in-memory MongoDB...')
  
  const mongod = await MongoMemoryServer.create({
    instance: { port: 27017, dbName: 'nexlearn' }
  })

  const uri = mongod.getUri('nexlearn')
  process.env.MONGODB_URI = uri
  console.log('[MemDB] MongoDB running at:', uri)

  // Now start the real server
  await import('./src/index.js')

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('\n[MemDB] Shutting down...')
    await mongod.stop()
    process.exit(0)
  })
}

main().catch(e => {
  console.error('[MemDB] Failed to start:', e.message)
  process.exit(1)
})
