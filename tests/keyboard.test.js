import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

test('keyboard dismissal restores height during a held gesture and clamps only after release', async () => {
  const events = {}, touches = {}, classes = new Set(), properties = new Map(), scrolls = []
  const pane = { scrollHeight: 200, clientHeight: 200, scrollTop: 80, scrollTo: value => { scrolls.push(value.top); pane.scrollTop = value.top } }
  const listener = async (name, fn) => { events[name] = fn; return { remove() {} } }
  const context = vm.createContext({
    native: true, App: { addListener: listener }, Keyboard: { addListener: listener }, LocalNotifications: { addListener: listener },
    Network: { getStatus: async () => ({ connected: true }), addListener: listener },
    useMemory: { setState() {} }, sync() {}, softHaptic() {},
    document: { body: { style: { setProperty: (key, value) => properties.set(key, value), removeProperty: key => properties.delete(key) }, classList: { add: key => classes.add(key), remove: key => classes.delete(key), contains: key => classes.has(key) } }, querySelectorAll: () => [pane], addEventListener: (name, fn) => { touches[name] = fn }, removeEventListener() {} },
    window: { scrollX: 0, scrollY: 0 }, requestAnimationFrame: fn => fn(), setTimeout: () => 1, clearTimeout() {}, matchMedia: () => ({ matches: true }),
  })
  const source = readFileSync(new URL('../src/lib/lifecycle.js', import.meta.url), 'utf8').replace(/^import .*$/gm, '').replace(/export /g, '')
  vm.runInContext(`${source}\nglobalThis.start = startLifecycle`, context)
  await context.start(() => {})
  events.keyboardWillShow({ keyboardHeight: 300 })
  touches.touchstart({ touches: [{ clientX: 50, clientY: 50 }], target: {} })
  events.keyboardWillHide()
  assert.equal(classes.has('keyboard-open'), false)
  assert.equal(properties.has('--keyboard-height'), false)
  assert.equal(scrolls.length, 0)
  events.keyboardDidHide()
  assert.equal(scrolls.length, 0)
  touches.touchend({ touches: [] })
  assert.deepEqual(scrolls, [0])
  events.keyboardDidHide()
  assert.equal(scrolls.length, 1, 'An in-bounds position should not be scrolled')
})
