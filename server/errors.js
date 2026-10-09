function describeError(error, fallback = 'The server could not finish this request. Please try again.') {
  const code = error.code || error.cause?.code
  if (code === '42P01' || code === '42703' || /database schema mismatch|missing tables/i.test(error.message || '')) return { status: 503, code: 'DATABASE_SETUP_REQUIRED', error: 'The server database needs an update. Run npm run db:migrate with the server database configuration, then retry. Existing records are preserved.' }
  if (['ECONNRESET', 'EPIPE', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', '08006', '57P03'].includes(code)) return { status: 503, code: 'SERVICE_UNAVAILABLE', error: 'The service is temporarily unavailable. Please try again shortly.' }
  if (error.name === 'ZodError' || error instanceof SyntaxError) return { status: 400, code: 'INVALID_REQUEST', error: 'Some required information was missing or invalid. Please try again. If this continues, update the app.' }
  const candidate = typeof error.status === 'number' ? error.status : error.statusCode
  const status = Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : 500
  return { status, code: typeof code === 'string' && /^[A-Z_]+$/.test(code) ? code : 'REQUEST_FAILED', conflict: Boolean(error.conflict), error: status < 500 || status === 503 ? error.message : fallback }
}
export function appleExchangeError(code) {
  if (code === 'invalid_grant') return { status: 401, code: 'APPLE_AUTH_EXPIRED', error: 'This Apple authorization expired or was already used. Tap Sign in with Apple again.' }
  if (['invalid_client', 'unauthorized_client', 'invalid_request'].includes(code)) return { status: 503, code: 'APPLE_SETUP_REQUIRED', error: 'Sign in with Apple is not configured correctly on the server. Please contact support.' }
  return { status: 502, code: 'APPLE_UNAVAILABLE', error: 'Apple sign-in is temporarily unavailable. Please try again shortly.' }
}

// Structural diagnostics only: never include SQL, inputs, credentials, or provider bodies.
export function safeDiagnostics(error) {
  const cause = error.cause || error
  const validationMessages = new Set([
    'Memory evidence must be copied from the original entry', 'Reminder evidence must be copied from the original entry',
    'Unknown memory update target', 'Unknown reminder target', 'Answer references unseen evidence',
    'Multiple updates to the same memory', 'Multiple changes to the same reminder',
    'New memory must not have a target ID', 'New reminder must not have a target ID',
    'Reminder must be in the future', 'Repeating reminder must start at the next matching daily or weekly occurrence',
    'Read full memory before updating or deleting it', 'Read full reminder before updating or deleting it',
  ])
  return {
    ...(validationMessages.has(cause.message) ? { validationReason: cause.message } : {}),
    name: error.name,
    stage: error.stage || 'request',
    ...(cause.code && /^[A-Za-z0-9_]+$/.test(cause.code) ? { causeCode: cause.code } : {}),
    ...(typeof cause.param === 'string' && /^[a-zA-Z0-9_.[\]-]{1,180}$/.test(cause.param) ? { parameter: cause.param } : {}),
    ...(cause.issues ? { issues: cause.issues.slice(0, 8).map(issue => ({ code: issue.code, path: issue.path.filter(part => typeof part === 'number' || /^[a-zA-Z_]+$/.test(part)).join('.') })) } : {}),
    ...(cause.stack?.match(/(?:server|shared|api)\/[\w.-]+\.js:\d+:\d+/)?.[0] ? { location: cause.stack.match(/(?:server|shared|api)\/[\w.-]+\.js:\d+:\d+/)[0] } : {}),
  }
}
export function publicError(error, fallback) {
  return { ...describeError(error, fallback), ...(error.requestId ? { requestId: error.requestId } : {}), stage: error.stage || 'request', diagnostics: safeDiagnostics(error) }
}
