import test from 'node:test'
import assert from 'node:assert/strict'
import { publicError, appleExchangeError } from '../server/errors.js'
import { appStoreUrl } from '../shared/app-store.js'
test('server failures do not claim an entry was saved or expose internal errors', () => {
  const failure = publicError(new Error('secret database connection details'))
  assert.equal(failure.status, 500)
  assert.doesNotMatch(failure.error, /saved|secret|database/)
  for (const error of [{ code: '42P01' }, { message: 'Database schema mismatch: Missing tables user' }]) {
    assert.equal(publicError(error).code, 'DATABASE_SETUP_REQUIRED')
    assert.equal(publicError(error).status, 503)
  }
  assert.equal(publicError({ name: 'ZodError', message: 'raw user payload' }).code, 'INVALID_REQUEST')
  assert.equal(publicError({ status: 'BAD_REQUEST' }).status, 500)
})
test('Apple setup failures are distinct from expired authorization', () => {
  assert.equal(appleExchangeError('invalid_grant').status, 401)
  assert.equal(appleExchangeError('invalid_client').code, 'APPLE_SETUP_REQUIRED')
  assert.equal(appleExchangeError('server_error').status, 502)
})
test('store link accepts only real Apple listing URL shapes', () => {
  assert.equal(appStoreUrl('https://apps.apple.com/us/app/pocket/id1234567890'), 'https://apps.apple.com/us/app/pocket/id1234567890')
  for (const value of ['', undefined, 'javascript:alert(1)', 'https://apps.apple.com.evil.test/app/id123', 'https://apps.apple.com/']) assert.equal(appStoreUrl(value), null)
})
