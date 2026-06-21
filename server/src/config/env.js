import 'dotenv/config'

const required = [
  'MONGODB_URI',
  'CLERK_SECRET_KEY',
  'CLIENT_URL',
]

required.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`)
  }
})