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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Expose-Headers', 'set-auth-token')
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
export const endpoint = fn => async (req, res) => {
  if (!cors(req, res)) return
  try { await fn(req, res) } catch (e) {
    const status = e.name === 'ZodError' || e instanceof SyntaxError ? 400 : typeof e.status === 'number' ? e.status : e.statusCode || 500
    // Never log personal input, AI prompts, tokens, or provider response bodies.
    console.error('request_failed', { name: e.name, status })
    res.status(status).json({ conflict: Boolean(e.conflict), error: status < 500 || status === 503 ? e.message : 'This request could not finish. Your entry is saved; please retry.' })
  }
}
export function method(req, expected) {
  if (req.method !== expected) throw Object.assign(new Error(`Use ${expected}`), { status: 405 })
}
