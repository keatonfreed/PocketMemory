import { native } from './storage'
let token = null
export function setToken(value) { token = value }
export const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
export async function request(path, { method = 'GET', data, timeout = 240000, authToken = token } = {}) {
  if (native && !/^https:\/\//.test(apiBase)) throw new Error('The app’s secure server address has not been configured.')
  let response
  try { response = await fetch(`${apiBase}${path}`, {
    method, credentials: 'omit', signal: AbortSignal.timeout(timeout),
    headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  }) } catch (error) {
    const signingIn = path === '/api/session'
    const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError'
    throw new Error(timedOut
      ? signingIn ? 'Sign-in timed out. Please tap Sign in with Apple again.' : 'The server took too long to respond. Please try again.'
      : signingIn ? 'Could not connect to sign in. Check your internet connection and try again.' : 'Could not connect to the server. Check your internet connection and try again.')
  }
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(result.error || result.message || 'The server could not complete the request.'), { status: response.status, conflict: result.conflict, code: result.code })
  if (response.ok && !response.headers.get('content-type')?.includes('application/json')) throw new Error('The app reached an unexpected server page. Please update the app or contact support.')
  return result
}
