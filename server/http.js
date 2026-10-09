import { randomUUID } from 'node:crypto'
import { publicError, safeDiagnostics } from './errors.js'
import { auth } from './auth.js'
export function headers(req) {
  const result = new Headers()
  for (const [key, value] of Object.entries(req.headers)) if (value !== undefined) result.set(key, Array.isArray(value) ? value.join(',') : value)
  return result
}
export function cors(req, res) {
  const origin = req.headers.origin
  const allowed = new Set(['capacitor://localhost', process.env.BETTER_AUTH_URL, ...(process.env.DEV_ORIGINS || '').split(',').filter(Boolean)])
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Vary', 'Origin')
  if (origin && !allowed.has(origin)) { res.status(403).json({ error: 'Origin is not allowed' }); return false }
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept')
  res.setHeader('Access-Control-Expose-Headers', 'set-auth-token, X-Pocket-Memory-Request-Id, X-Pocket-Memory-Version')
  if (req.method === 'OPTIONS') { res.status(204).end(); return false }
  return true
}
export function body(req) {
  const value = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  if (Buffer.byteLength(JSON.stringify(value || {})) > 64000) throw Object.assign(new Error('Request is too large'), { status: 413 })
  return value || {}
}
export async function user(req) {
  const session = await auth().api.getSession({ headers: headers(req) })
  if (!session) throw Object.assign(new Error('Please sign in again. Your unsynced entries are still on this device.'), { status: 401 })
  return session.user
}
export const endpoint = (fn, { fallback } = {}) => async (req, res) => {
  req.requestId = randomUUID()
  res.setHeader('X-Pocket-Memory-Request-Id', req.requestId)
  res.setHeader('X-Pocket-Memory-Version', 'assistant-v2')
  if (!cors(req, res)) return
  try { await fn(req, res) } catch (e) {
    e.requestId = req.requestId
    const failure = publicError(e, fallback)
    // Log diagnostics, never user content, credentials, or provider bodies.
    console.error('request_failed', { requestId: req.requestId, status: failure.status, code: failure.code, ...safeDiagnostics(e) })
    res.status(failure.status).json(failure)
  }
}
export function method(req, expected) {
  if (req.method !== expected) throw Object.assign(new Error(`Use ${expected}`), { status: 405 })
}
