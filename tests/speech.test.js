import test from 'node:test'
import assert from 'node:assert/strict'
import { beginDictation } from '../src/lib/speech.js'
function mocks(permission = 'granted') {
  const listeners = new Map(), removed = [], calls = []
  const addListener = async (name, fn) => { listeners.set(name, fn); return { remove: async () => { removed.push(name); listeners.delete(name) } } }
  const plugin = { available: async () => ({ available: true }), requestPermissions: async () => ({ speechRecognition: permission }), addListener, start: async () => calls.push('start'), stop: async () => { calls.push('stop'); listeners.get('listeningState')?.({ state: 'stopped' }) }, getLastPartialResult: async () => ({ available: true, text: 'Final thought' }) }
  return { plugin, lifecycle: { addListener }, listeners, removed, calls }
}
test('dictation delivers the final cached text and removes its listeners once', async () => {
  const m = mocks(), text = []; let ended = 0
  const session = await beginDictation({ onText: t => text.push(t), onEnd: () => ended++, onError: assert.fail }, m.plugin, m.lifecycle)
  m.listeners.get('partialResults')({ matches: ['Partial thought'] })
  await Promise.all([session.stop(), session.stop()])
  assert.deepEqual(text, ['Partial thought', 'Final thought'])
  assert.equal(ended, 1); assert.equal(m.removed.length, 4); assert.deepEqual(m.calls, ['start', 'stop'])
  assert.equal(session.active(), false)
})
test('denied microphone permission never starts recording', async () => {
  const m = mocks('denied')
  await assert.rejects(beginDictation({}, m.plugin, m.lifecycle), /iPhone Settings/)
  assert.deepEqual(m.calls, [])
})
test('backgrounding stops microphone capture', async () => {
  const m = mocks()
  const session = await beginDictation({ onText() {}, onEnd() {}, onError: assert.fail }, m.plugin, m.lifecycle)
  m.listeners.get('appStateChange')({ isActive: false })
  await session.stop()
  assert.deepEqual(m.calls, ['start', 'stop'])
})
