import { config } from 'dotenv'
import { readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'
config({ path: '.env.local', quiet: true })
// Explicit allowlist, no DROP SCHEMA and no CASCADE into unrelated application tables.
export const resetTables = ['pm_apple_credentials', 'pm_consent', 'pm_operations', 'pm_changes', 'pm_reminders', 'pm_revisions', 'pm_knowledge', 'pm_entries', 'session', 'account', 'verification', 'rateLimit', 'user', 'notification_schedules', 'push_subscriptions']
export const dropSql = `DROP TABLE IF EXISTS ${resetTables.map(name => `public."${name}"`).join(', ')} RESTRICT`
async function main() {
  const url = new URL(process.env.DATABASE_URL || '')
  const target = `${url.hostname}${url.pathname}`
  console.log(`Target: ${target}\nRemoves all Pocket Memory accounts, sessions, content, reminders, and old web-push data. Recreates empty auth/app tables.\nTables: ${resetTables.join(', ')}`)
  if (!process.argv.includes('--execute')) { console.log('Preview only; no database connection made. Run with --execute to confirm interactively.'); return }
  if (!process.stdin.isTTY) throw new Error('Run this command in an interactive terminal.')
  const prompt = createInterface({ input: process.stdin, output: process.stdout })
  const confirmation = await prompt.question(`Type RESET ${target} to permanently reset this database: `); prompt.close()
  if (confirmation !== `RESET ${target}`) throw new Error('Cancelled; database unchanged.')
  const { auth } = await import('../server/auth.js')
  const instance = auth() // validate required auth configuration BEFORE deletion
  const { db } = await import('../server/db.js')
  try {
    await db().query(dropSql)
    await (await instance.$context).runMigrations()
    await db().query(await readFile(new URL('../migrations/001_memory.sql', import.meta.url), 'utf8'))
    console.log('Reset complete. Empty authentication and app tables are ready. Old data was not migrated.')
  } finally { await db().end() }
}
if (process.argv[1]?.endsWith('reset-database.mjs')) main().catch(() => { console.error('Reset failed or cancelled. Check configuration and database availability; if deletion already succeeded, run npm run db:migrate to finish creating empty tables. Credentials are not printed.'); process.exitCode = 1 })
