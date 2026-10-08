import test from 'node:test'
import assert from 'node:assert/strict'
import { cors, body } from '../server/http.js'
function response() { return { code: null, headers: {}, setHeader(k, v) { this.headers[k] = v }, status(code) { this.code = code; return this }, json(data) { this.data = data }, end() {} } }
test('native CORS permits only configured origins and uses no-store', () => {
  const res = response()
  assert.equal(cors({ method: 'OPTIONS', headers: { origin: 'capacitor://localhost' } }, res), false)
  assert.equal(res.code, 204)
  assert.equal(res.headers['Access-Control-Allow-Origin'], 'capacitor://localhost')
  assert.equal(res.headers['Cache-Control'], 'no-store')
  const denied = response()
  assert.equal(cors({ method: 'POST', headers: { origin: 'https://untrusted.example' } }, denied), false)
  assert.equal(denied.code, 403)
  assert.equal(denied.headers['Access-Control-Allow-Origin'], undefined)
})
test('body parser rejects oversized requests before provider calls', () => {
  assert.throws(() => body({ body: { text: 'a'.repeat(65000) } }), /too large/)
  assert.deepEqual(body({ body: '{"text":"hello"}' }), { text: 'hello' })
})
