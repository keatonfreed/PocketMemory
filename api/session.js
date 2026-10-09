import { appleExchangeError } from '../server/errors.js'
import { z } from 'zod'
import { symmetricEncrypt } from 'better-auth/crypto'
import { auth, appleSecret } from '../server/auth.js'
import { db } from '../server/db.js'
import { endpoint, body, method, headers } from '../server/http.js'
const schema = z.object({ code: z.string().min(1).max(4096), nonce: z.string().min(16).max(256), firstName: z.string().max(100).nullish(), lastName: z.string().max(100).nullish() })
export default endpoint(async (req, res) => {
  method(req, 'POST')
  const input = schema.parse(body(req))
  // Check before consuming Apple's single-use code, so setup failures remain actionable.
  const requiredTables = ['user', 'session', 'account', 'verification', 'rateLimit', 'pm_apple_credentials', 'pm_entries', 'pm_knowledge', 'pm_consent']
  const readiness = await db().query("SELECT name FROM unnest($1::text[]) AS name WHERE to_regclass(format('public.%I', name)) IS NULL", [requiredTables])
  if (readiness.rows.length) return res.status(503).json({ code: 'DATABASE_SETUP_REQUIRED', error: 'Account setup is incomplete on the server. Please contact support; retrying sign-in will not fix this yet.' })
  const response = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    body: new URLSearchParams({ client_id: process.env.APPLE_BUNDLE_ID, client_secret: await appleSecret(), code: input.code, grant_type: 'authorization_code' }),
  })
  if (!response.ok) {
    const details = await response.json().catch(() => ({}))
    const failure = appleExchangeError(details.error)
    return res.status(failure.status).json(failure)
  }
  const tokens = await response.json()
  if (!tokens.id_token || !tokens.refresh_token) throw Object.assign(new Error('Apple did not finish authorizing this account. Please sign in again.'), { status: 502 })
  const result = await auth().api.signInSocial({ headers: headers(req), body: {
    provider: 'apple', idToken: { token: tokens.id_token, nonce: input.nonce, user: { name: { firstName: input.firstName || '', lastName: input.lastName || '' } } },
  } })
  await db().query('INSERT INTO pm_apple_credentials(user_id,token) VALUES ($1,$2) ON CONFLICT(user_id) DO UPDATE SET token=excluded.token', [result.user.id, await symmetricEncrypt({ key: process.env.BETTER_AUTH_SECRET, data: tokens.refresh_token })])
  res.json({ token: result.token, user: result.user })
}, { fallback: 'Sign-in could not finish because of a server problem. Please try again shortly or contact support.' })
