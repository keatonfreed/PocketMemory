import { config } from 'dotenv'
import { readFile } from 'node:fs/promises'
config({ path: '.env.local', quiet: true })
const { auth } = await import('../server/auth.js')
const { db } = await import('../server/db.js')
try {
  await (await auth().$context).runMigrations()
  await db().query(await readFile(new URL('../migrations/001_memory.sql', import.meta.url), 'utf8'))
  console.log('Authentication and Pocket Memory migrations applied.')
} catch (error) {
  console.error(`Database setup did not complete (${error.code || 'database/setup error'}).`)
  console.error('Run npm run check:db to check connectivity without changing data. If it fails, check Neon status, VPN/firewall, or try another network. After connectivity is restored, rerun npm run db:migrate to finish setup. Do not reset the database to fix a connection failure.')
  process.exitCode = 1
} finally { await db().end() }
