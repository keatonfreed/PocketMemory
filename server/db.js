import { Pool } from 'pg'
let pool
export function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured')
  // Neon connection strings include sslmode; do not disable certificate validation.
  return pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 20000 })
}
export async function transaction(userId, fn) {
  const client = await db().connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query('SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS locked', [userId])
    if (!rows[0].locked) throw Object.assign(new Error('Another update is finishing. Please retry.'), { status: 409 })
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}
export async function publish(client, userId, type, data, deleted = false) {
  await client.query('INSERT INTO pm_changes (user_id, type, record_id, data, deleted) VALUES ($1,$2,$3,$4,$5)', [userId, type, data.id, deleted ? null : data, deleted])
}
