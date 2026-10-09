import { config } from 'dotenv'
import { setTimeout } from 'node:timers/promises'
import { Pool } from 'pg'
config({ path: '.env.local', quiet: true })
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing in .env.local.'); process.exitCode = 1
} else {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000, query_timeout: 10000 })
  pool.on('error', () => console.error('An idle database connection closed.'))
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await pool.query('SELECT 1')
        console.log('Database connection OK. No tables or data were changed.'); break
      } catch (error) {
        console.error(`Connection check ${attempt}/3 failed (${error.code || 'connection timeout/closed'}).`)
        if (attempt === 3) {
          console.error('Check Neon project status and the connection string. Try another network or disconnect your VPN. PostgreSQL needs outbound port 5432; normal web browsing can work while that port is blocked.')
          process.exitCode = 1
        } else await setTimeout(1000)
      }
    }
  } finally { await pool.end() }
}
