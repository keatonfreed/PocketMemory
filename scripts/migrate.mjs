import { config } from 'dotenv'
import { readFile } from 'node:fs/promises'
config({ path: '.env.local', quiet: true })
const { auth } = await import('../server/auth.js')
const { db } = await import('../server/db.js')
try {
  await (await auth().$context).runMigrations()
  await db().query(await readFile(new URL('../migrations/001_memory.sql', import.meta.url), 'utf8'))
  console.log('Authentication and Pocket Memory migrations applied.')
} finally { await db().end() }
