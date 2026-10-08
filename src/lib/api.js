import { native } from './storage'
let token = null
export function setToken(value) { token = value }
export const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
export async function request(path, { method = 'GET', data, timeout = 240000, authToken = token } = {}) {
  if (native && !/^https:\/\//.test(apiBase)) throw new Error('The app’s secure server address has not been configured.')
  const response = await fetch(`${apiBase}${path}`, {
    method, credentials: 'omit', signal: AbortSignal.timeout(timeout),
    headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(result.error || result.message || 'The server could not complete the request.'), { status: response.status, conflict: result.conflict })
  return result
}
