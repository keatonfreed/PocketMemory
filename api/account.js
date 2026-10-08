import { z } from 'zod'
import { endpoint, body, user } from '../server/http.js'
import { db, transaction } from '../server/db.js'
export default endpoint(async (req, res) => {
  const account = await user(req)
  if (req.method === 'GET') {
    const { rows } = await db().query('SELECT ai_enabled FROM pm_consent WHERE user_id=$1', [account.id])
    return res.json({ user: account, consent: rows[0]?.ai_enabled || false })
  }
  if (req.method === 'POST') {
    const { consent } = z.object({ consent: z.boolean() }).strict().parse(body(req))
    await transaction(account.id, client => client.query('INSERT INTO pm_consent(user_id,ai_enabled) VALUES ($1,$2) ON CONFLICT(user_id) DO UPDATE SET ai_enabled=$2,updated_at=now()', [account.id, consent]))
    return res.json({ consent })
  }
  res.status(405).json({ error: 'Use GET or POST' })
})
