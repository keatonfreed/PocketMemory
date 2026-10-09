import test from 'node:test'
import assert from 'node:assert/strict'
import { runAgent } from '../server/agent.js'
const id = '759a860e-16a4-4b42-bebc-a1a77526bcdf'
const user = 'u1'
const classifier = async () => ({ intent: { choice: 'assist', confidence: .95 }, lifetime: { choice: 'none', confidence: .99 } })
const capture = { id, text: 'What did I say about tea?', timezone: 'America/Los_Angeles', createdAt: new Date().toISOString(), research: false }
const plan = { reply: 'You said tea.', changes: [], reminders: [], sources: [{ type: 'entry', id }] }
const row = { id, text: 'tea', created_at: new Date(), received_at: new Date(), status: 'done', sources: [], web_sources: [] }
const client = { query: async (_sql, params) => { assert.equal(params[0], user); return { rows: _sql.includes('pm_knowledge') || _sql.includes('pm_reminders') ? [] : [row] } } }
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

const memoryId = '8e57e652-693a-4f44-aec0-05e58998a710'
test('quiet capture routes to memory model, keeps extraction and removes routine acknowledgement', async () => {
  const requests = []
  const quietClassifier = async () => ({ intent: { choice: 'remember', confidence: .99 }, lifetime: { choice: 'durable', confidence: .99 }, response: { choice: 'accept', confidence: .99 } })
  const ai = { responses: { create: async request => {
    requests.push(request)
    return { status: 'completed', output: [], output_text: JSON.stringify({ reply: 'Remembered.', sources: [], reminders: [], changes: [{ action: 'create', targetId: null, title: 'Tea', content: 'Prefers tea', kind: 'preference', expiresAt: null, eventAt: null, reason: 'Preference', evidence: 'I prefer tea' }] }) }
  } } }
  const result = await runAgent(client, user, { ...capture, text: 'I prefer tea' }, { ai, classifier: quietClassifier })
  assert.equal(result.plan.reply, '')
  assert.equal(result.plan.changes.length, 1)
  assert.equal(requests[0].model, process.env.MEMORY_MODEL || 'gpt-4.1-mini')
  assert.equal(JSON.parse(requests[0].input[1].content).responseMode, 'accept')
})
test('agent starts with personal memories and reminders and can cite supplied memories', async () => {
  const contextClient = { query: async (sql, params) => {
    assert.equal(params[0], user)
    return { rows: sql.includes('pm_knowledge') ? [{ id: memoryId, title: 'Tea', content: 'Prefers tea', kind: 'preference' }] : sql.includes('pm_reminders') ? [{ id, title: 'Call Mom', due_at: new Date(Date.now() + 3600000) }] : [row] }
  } }
  const ai = { responses: { create: async request => {
    const context = JSON.parse(request.input[1].content)
    assert.equal(context.memories[0].content, 'Prefers tea')
    assert.equal(context.reminders[0].title, 'Call Mom')
    return { status: 'completed', output: [], output_text: JSON.stringify({ ...plan, sources: [{ type: 'knowledge', id: memoryId }] }) }
  } } }
  const result = await runAgent(contextClient, user, capture, { ai, classifier })
  assert.equal(result.plan.sources[0].id, memoryId)
})
test('quiet classification does not hide a clarification discovered during processing', async () => {
  const classifier = async () => ({ intent: { choice: 'remember', confidence: .99 }, response: { choice: 'accept', confidence: .99 } })
  const ai = { responses: { create: async () => ({ status: 'completed', output: [], output_text: JSON.stringify({ ...plan, reply: 'Which Alex do you mean?' }) }) } }
  const result = await runAgent(client, user, capture, { ai, classifier })
  assert.equal(result.plan.reply, 'Which Alex do you mean?')
})
