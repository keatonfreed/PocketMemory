import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })
const required = ['DATABASE_URL', 'OPENAI_API_KEY', 'TYPESAFE_API_KEY', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL', 'APPLE_BUNDLE_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY', 'VITE_API_URL']
let missing = false
for (const key of required) { const present = Boolean(process.env[key]?.trim()); console.log(`${key}: ${present ? 'set' : 'missing'}`); missing ||= !present }
for (const key of ['BETTER_AUTH_URL', 'VITE_API_URL']) if (process.env[key] && !/^https:\/\//.test(process.env[key])) { console.log(`${key}: HTTPS required`); missing = true }
if (process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_SECRET.length < 32) { console.log('BETTER_AUTH_SECRET: use at least 32 random characters'); missing = true }
process.exitCode = missing ? 1 : 0
