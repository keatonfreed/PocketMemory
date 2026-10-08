import { z } from 'zod'
import { symmetricEncrypt } from 'better-auth/crypto'
import { auth, appleSecret } from '../server/auth.js'
import { db } from '../server/db.js'
import { endpoint, body, method, headers } from '../server/http.js'
const schema = z.object({ code: z.string().min(1).max(4096), nonce: z.string().min(16).max(256), firstName: z.string().max(100).nullable(), lastName: z.string().max(100).nullable() })
export default endpoint(async (req, res) => {
  method(req, 'POST')
  const input = schema.parse(body(req))
  const response = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    body: new URLSearchParams({ client_id: process.env.APPLE_BUNDLE_ID, client_secret: await appleSecret(), code: input.code, grant_type: 'authorization_code' }),
  })
  if (!response.ok) return res.status(401).json({ error: 'Apple sign-in expired. Please sign in again.' })
  const tokens = await response.json()
  if (!tokens.id_token || !tokens.refresh_token) throw new Error('Apple did not return required tokens')
  const result = await auth().api.signInSocial({ headers: headers(req), body: {
    provider: 'apple', idToken: { token: tokens.id_token, nonce: input.nonce, user: { name: { firstName: input.firstName || '', lastName: input.lastName || '' } } },
  } })
  await db().query('INSERT INTO pm_apple_credentials(user_id,token) VALUES ($1,$2) ON CONFLICT(user_id) DO UPDATE SET token=excluded.token', [result.user.id, await symmetricEncrypt({ key: process.env.BETTER_AUTH_SECRET, data: tokens.refresh_token })])
  res.json({ token: result.token, user: result.user })
})
