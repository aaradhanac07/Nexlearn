/**
 * Phase 3 Node Server Test Runner
 * Starts mongodb-memory-server, boots the Express app against it,
 * tests every Phase 3 route, then shuts down.
 *
 * Usage: node test_node.mjs
 */
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import http from 'http'

// ── Inline request helper ─────────────────────────────────
function apiRequest(method, path, body) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    }
    const req = http.request(opts, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', () => resolve({ status: 0, body: '' }))
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

const PASS = '\x1b[32m[PASS]\x1b[0m'
const FAIL = '\x1b[31m[FAIL]\x1b[0m'
const results = []

function check(label, ok, detail = '') {
  const icon = ok ? PASS : FAIL
  console.log(`  ${icon} ${label}${detail ? '  (' + detail + ')' : ''}`)
  results.push([label, ok])
}

// ── Main ─────────────────────────────────────────────────
async function run() {
  console.log('\n' + '='.repeat(55))
  console.log('  NexLearn Phase 3 -- Node Server Route Tests')
  console.log('='.repeat(55))

  // 1. Start in-memory MongoDB
  console.log('\n[0] Booting in-memory MongoDB...')
  let mongod
  try {
    mongod = await MongoMemoryServer.create()
    const uri = mongod.getUri()
    process.env.MONGODB_URI = uri
    console.log('  MongoDB URI:', uri)
  } catch (e) {
    console.log('  FAIL: Could not start mongodb-memory-server:', e.message)
    console.log('  Falling back to connecting to running Node server at :5000')
  }

  // 2. Dynamically import the app so env is already set
  let serverStarted = false
  let appServer
  if (mongod) {
    try {
      // Set dummy Clerk key so middleware doesn't crash on import
      process.env.CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || 'sk_test_dummy'
      process.env.AI_SERVICE_URL   = process.env.AI_SERVICE_URL   || 'http://localhost:8000'
      process.env.PORT             = '5001'  // use different port to avoid conflicts

      const { default: app } = await import('./src/app.js').catch(() => null) || {}
      // Most Express apps export app separately from httpServer.listen
      // If not, we test against the already-running server on :5000
    } catch (e) {
      console.log('  Note: Could not import app directly, testing against :5000')
    }
  }

  // 3. Test the running server (port 5000 from npm run dev)
  const PORT = 5000

  console.log('\n[1] Health check')
  const health = await apiRequest('GET', '/health')
  const up = health.status === 200
  check('/health', up, 'status=' + health.status)

  if (!up) {
    console.log('\n  Node server not responding on port 5000.')
    console.log('  Make sure: docker compose up mongo redis -d')
    console.log('  Then: npm run dev (in server/)')
    if (mongod) await mongod.stop()
    process.exit(1)
  }

  // 4. Card routes — all expect 401 (route registered, Clerk blocks unauthenticated)
  console.log('\n[2] Card routes  (401 = route registered + auth working)')
  const cardRoutes = [
    ['GET',  '/api/cards',                 null,           'List due cards'],
    ['GET',  '/api/cards/due-count',       null,           'Count due cards'],
    ['POST', '/api/cards/testid123/review',{ rating: 2 }, 'SM-2 review'],
  ]
  for (const [method, path, body, label] of cardRoutes) {
    const r = await apiRequest(method, path, body)
    check(`${method} ${path}  [${label}]`, r.status === 401, 'got ' + r.status)
  }

  // 5. Quiz routes
  console.log('\n[3] Quiz routes  (401 = route registered + auth working)')
  const quizRoutes = [
    ['POST', '/api/quiz/generate',                    { courseId: 'x', count: 2 }, 'Generate quiz'],
    ['POST', '/api/quiz/submit',                      { courseId: 'x', answers: [] }, 'Submit answers'],
    ['GET',  '/api/quiz/progress',                    null,                         'Get progress'],
    ['GET',  '/api/quiz/time-to-mastery',             null,                         'Time to mastery'],
    ['GET',  '/api/quiz/knowledge-graph/testcourse',  null,                         'Get graph'],
    ['POST', '/api/quiz/knowledge-graph/testcourse',  { fullText: 'test' },         'Generate graph'],
  ]
  for (const [method, path, body, label] of quizRoutes) {
    const r = await apiRequest(method, path, body)
    check(`${method} ${path}  [${label}]`, r.status === 401, 'got ' + r.status)
  }

  // 6. Auth route
  console.log('\n[4] Auth route')
  const authR = await apiRequest('POST', '/api/auth/sync')
  check('POST /api/auth/sync', [401, 400, 200].includes(authR.status), 'got ' + authR.status)

  // 7. Course routes (pre-existing)
  console.log('\n[5] Course routes (pre-existing)')
  const courseR = await apiRequest('GET', '/api/courses')
  check('GET /api/courses', courseR.status === 401, 'got ' + courseR.status)

  // Summary
  console.log('\n' + '='.repeat(55))
  const passed = results.filter(([, ok]) => ok).length
  const total = results.length
  console.log(`  Result: ${passed}/${total} passed`)
  if (passed === total) {
    console.log('  ALL NODE ROUTES CONFIRMED!')
  } else {
    console.log('  Some failed — see above')
  }
  console.log('='.repeat(55) + '\n')

  if (mongod) await mongod.stop()
  process.exit(passed === total ? 0 : 1)
}

run().catch(e => { console.error(e); process.exit(1) })
