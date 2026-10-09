import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { emptyState, applySync } from '../shared/contracts.js'

function app() {
  const calls = []
  let now = 1_000_000
  const create = initializer => {
    let state = initializer()
    return { getState: () => state, setState: value => { state = { ...state, ...(typeof value === 'function' ? value(state) : value) } } }
  }
  const context = vm.createContext({
    create, emptyState, applySync, navigator: { onLine: true },
    Date: { now: () => now }, Promise, setTimeout: () => 1, clearTimeout() {},
    writeState: async () => {}, reconcileNotifications: async () => {}, effectiveReminders: data => Object.values(data.reminders),
    request: async (path, options) => {
      calls.push(path)
      if (path === '/api/account') return { consent: true }
      if (path.startsWith('/api/sync')) return { cursor: '1', changes: [], more: false }
      return { entry: { ...options.data.data, status: 'done', reply: 'Hello' } }
    },
  })
  const source = readFileSync(new URL('../src/state/memory.js', import.meta.url), 'utf8').replace(/^import .*$/gm, '').replace(/export /g, '')
  vm.runInContext(`${source}\nglobalThis.app = { sync, useMemory }`, context)
  context.app.useMemory.setState({ user: { id: 'u1' } })
  return { ...context.app, calls, advance: ms => { now += ms } }
}

test('duplicate foreground events reuse recent sync and account checks; later resumes still pull', async () => {
  const state = app()
  await state.sync()
  await state.sync({ passive: true })
  await state.sync({ passive: true })
  assert.deepEqual(state.calls, ['/api/account', '/api/sync?cursor=0'])
  state.advance(31_000)
  await state.sync({ passive: true })
  assert.equal(state.calls.filter(path => path === '/api/account').length, 1)
  assert.equal(state.calls.filter(path => path.startsWith('/api/sync')).length, 2)
  state.advance(300_000)
  await state.sync({ passive: true })
  assert.equal(state.calls.filter(path => path === '/api/account').length, 2)
})

test('fresh sync never delays queued captures and fetches committed state before discarding them', async () => {
  const state = app()
  await state.sync()
  state.calls.length = 0
  const entry = { id: 'entry-1', text: 'Hi', status: 'pending' }
  const data = state.useMemory.getState().data
  state.useMemory.setState({ data: { ...data, entries: { [entry.id]: entry }, outbox: [{ id: entry.id, action: 'capture', data: entry }] } })
  await state.sync({ passive: true })
  assert.deepEqual(state.calls, ['/api/memory', '/api/sync?cursor=1'])
  assert.equal(state.useMemory.getState().data.outbox.length, 0)
  assert.equal(state.useMemory.getState().data.entries[entry.id].status, 'done')
})
