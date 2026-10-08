import test from 'node:test'
import assert from 'node:assert/strict'
import { runAgent } from '../server/agent.js'
const id = '759a860e-16a4-4b42-bebc-a1a77526bcdf'
const user = 'u1'
const classifier = async () => ({ intent: { choice: 'assist', confidence: .95 }, lifetime: { choice: 'none', confidence: .99 } })
const capture = { id, text: 'What did I say about tea?', timezone: 'America/Los_Angeles', createdAt: new Date().toISOString(), research: false }
const plan = { reply: 'You said tea.', changes: [], reminders: [], sources: [{ type: 'entry', id }] }
const row = { id, text: 'tea', created_at: new Date(), received_at: new Date(), status: 'done', sources: [], web_sources: [] }
const client = { query: async (_sql, params) => { assert.equal(params[0], user); return { rows: [row] } } }
test('agent reads full evidence through tools and disables web search without permission', async () => {
  const requests = []
  const ai = { responses: { create: async request => {
    requests.push(structuredClone(request))
    if (requests.length === 1) return { status: 'completed', output: [{ type: 'function_call', name: 'search_history', call_id: 'call1', arguments: JSON.stringify({ query: 'tea', before: null, after: null }) }] }
    return { status: 'completed', output: [], output_text: JSON.stringify(plan) }
  } } }
  const result = await runAgent(client, user, capture, { ai, classifier })
  assert.equal(result.plan.sources[0].id, id)
  assert.ok(requests.every(r => r.store === false && !r.tools.some(t => t.type === 'web_search')))
  assert.ok(requests[1].input.some(i => i.type === 'function_call_output' && i.output.includes('tea')))
})
test('agent never executes a tool outside its allowlist', async () => {
  const ai = { responses: { create: async () => ({ status: 'completed', output: [{ type: 'function_call', name: 'send_email', arguments: '{}', call_id: 'x' }] }) } }
  await assert.rejects(runAgent(client, user, capture, { ai, classifier }), /Unknown tool/)
})
test('agent stops repeated retrieval instead of looping indefinitely', async () => {
  let calls = 0
  const ai = { responses: { create: async () => { calls++; return { status: 'completed', output: [{ type: 'function_call', name: 'search_history', call_id: `x${calls}`, arguments: '{"query":"tea","before":null,"after":null}' }] } } } }
  await assert.rejects(runAgent(client, user, capture, { ai, classifier }), /step limit/)
  assert.equal(calls, 6)
})
test('incomplete structured output cannot be committed', async () => {
  const ai = { responses: { create: async () => ({ status: 'incomplete', output: [], output_text: JSON.stringify(plan) }) } }
  await assert.rejects(runAgent(client, user, capture, { ai, classifier }), /did not complete/)
})
