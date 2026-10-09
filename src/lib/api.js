import { readEventStream } from '../../shared/stream'
import { native } from './storage'
let token = null
export function setToken(value) { token = value }
export const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
export async function request(path, { method = 'GET', data, timeout = 240000, authToken = token, onEvent } = {}) {
  if (native && !/^https:\/\//.test(apiBase)) throw new Error('The app’s secure server address has not been configured.')
  let response
  try { response = await fetch(`${apiBase}${path}`, {
    method, credentials: 'omit', signal: AbortSignal.timeout(timeout),
    headers: { 'Content-Type': 'application/json', ...(onEvent ? { Accept: 'text/event-stream' } : {}), ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  }) } catch (error) {
    const signingIn = path === '/api/session'
    const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError'
    throw new Error(timedOut
      ? signingIn ? 'Sign-in timed out. Please tap Sign in with Apple again.' : 'The server took too long to respond. Please try again.'
      : signingIn ? 'Could not connect to sign in. Check your internet connection and try again.' : 'Could not connect to the server. Check your internet connection and try again.')
  }
  if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
    try { return await readEventStream(response, event => {
      if (['decision', 'complete'].includes(event.type)) console.info('[Pocket Memory] capture_status', { requestId: response.headers.get('X-Pocket-Memory-Request-Id'), event: event.type, ...(event.type === 'decision' ? { reply: event.reply, actions: event.actions, classificationMs: event.classificationMs, greeting: event.greeting } : {}) })
      onEvent?.(event)
    }) }
    catch (error) {
      if (['TimeoutError', 'AbortError'].includes(error.name)) throw new Error('The response timed out. Your entry is saved; please retry.')
      console.error('[Pocket Memory] server_error', { status: error.status, code: error.code, requestId: error.requestId || response.headers.get('X-Pocket-Memory-Request-Id'), stage: error.stage, diagnostics: error.diagnostics })
      throw error
    }
  }
  if (onEvent && response.ok) console.warn('[Pocket Memory] streaming_unavailable: deploy the updated backend', { version: response.headers.get('X-Pocket-Memory-Version') })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error('[Pocket Memory] server_error', { status: response.status, code: result.code, requestId: result.requestId, stage: result.stage, diagnostics: result.diagnostics })
    throw Object.assign(new Error(result.error || result.message || 'The server could not complete the request.'), { status: response.status, conflict: result.conflict, code: result.code, requestId: result.requestId, stage: result.stage, diagnostics: result.diagnostics })
  }
  if (response.ok && !response.headers.get('content-type')?.includes('application/json')) throw new Error('The app reached an unexpected server page. Please update the app or contact support.')
  return result
}
