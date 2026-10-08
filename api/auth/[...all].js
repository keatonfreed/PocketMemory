import { toNodeHandler } from 'better-auth/node'
import { auth } from '../../server/auth.js'
import { cors } from '../../server/http.js'
export default async function handler(req, res) {
  if (!cors(req, res)) return
  // All creation of sessions goes through the single-use native authorization-code exchange.
  const path = new URL(req.url, 'https://localhost').pathname
  if (!['/api/auth/get-session', '/api/auth/sign-out', '/api/auth/delete-user'].includes(path)) return res.status(404).json({ error: 'Not found' })
  return toNodeHandler(auth())(req, res)
}
