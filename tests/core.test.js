import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyState, applySync, validatePlan, captureSchema } from '../shared/contracts.js'
import { classificationSchema, classify } from '../server/classifier.js'
const id = '8e57e652-693a-4f44-aec0-05e58998a710'
const fields = { title: 'Coffee', content: 'I prefer tea', kind: 'preference', expiresAt: null, eventAt: null }
const change = { ...fields, action: 'create', targetId: null, reason: 'New preference', evidence: 'I prefer tea' }
const base = () => ({ reply: 'Remembered.', changes: [change], sources: [], reminders: [] })
const context = () => ({ input: 'I prefer tea', known: [], evidenceIds: new Set(), now: new Date('2026-10-07T10:00:00Z') })
test('deduplicates normalized content without fabricating a second memory', () => {
  const plan = validatePlan(base(), { ...context(), known: [{ id, content: ' I  PREFER TEA ' }] })
  assert.equal(plan.changes.length, 0)
})
test('rejects unsupported extraction and unknown correction targets', () => {
  assert.throws(() => validatePlan({ ...base(), changes: [{ ...change, evidence: 'I prefer coffee' }] }, context()), /evidence/)
  assert.throws(() => validatePlan({ ...base(), changes: [{ ...change, action: 'update', targetId: id }] }, context()), /Unknown/)
})
test('a correction retains its real target and exact original evidence', () => {
  const plan = validatePlan({ ...base(), changes: [{ ...change, action: 'update', targetId: id }] }, { ...context(), known: [{ id, content: 'I prefer coffee' }] })
  assert.equal(plan.changes[0].targetId, id)
})
test('rejects double updates, fabricated citations, and reminders in the past', () => {
  const update = { ...change, action: 'update', targetId: id }
  assert.throws(() => validatePlan({ ...base(), changes: [update, update] }, { ...context(), known: [{ id, content: 'coffee' }] }), /Multiple/)
  assert.throws(() => validatePlan({ ...base(), sources: [{ type: 'entry', id }] }, context()), /unseen/)
  assert.throws(() => validatePlan({ ...base(), reminders: [{ action: 'create', targetId: null, title: 'Call', body: '', repeat: null, timezone: 'UTC', evidence: 'I prefer tea', dueAt: '2026-10-06T10:00:00Z' }] }, context()), /future/)
})
test('sync handles deletion and replay without losing offline drafts or requests', () => {
  const state = { ...emptyState(), drafts: { [id]: 'my edit' }, outbox: [{ id }] }
  const changes = [{ type: 'knowledge', id, data: fields }, { type: 'knowledge', id, deleted: true }]
  const result = applySync(state, changes, '42')
  assert.deepEqual(result.knowledge, {})
  assert.deepEqual(result.drafts, state.drafts)
  assert.deepEqual(result.outbox, state.outbox)
  assert.deepEqual(applySync(result, changes, '42'), result)
})
test('validates timezone and rejects malformed JEV probabilities', () => {
  assert.equal(captureSchema.safeParse({ id, text: 'hello', createdAt: new Date().toISOString(), timezone: 'imaginary/place' }).success, false)
  assert.equal(classificationSchema.safeParse({ answers: { intent: { choice: 'remember', confidence: 1.5 } } }).success, false)
})
test('missing JEV key is explicit, not silently replaced by another provider', async () => {
  const before = process.env.TYPESAFE_API_KEY; delete process.env.TYPESAFE_API_KEY
  try { await assert.rejects(classify({ message: 'hello' }), /not configured/) } finally { if (before) process.env.TYPESAFE_API_KEY = before }
})

test('reminder schedule excludes completed/past items and respects iOS limit', async () => {
  const { notificationPlan, effectiveReminders } = await import('../shared/reminders.js')
  const now = Date.now()
  const records = Object.fromEntries(Array.from({ length: 70 }, (_, i) => [String(i), { id: String(i), title: `Reminder ${i}`, dueAt: new Date(now + (i + 1) * 60000).toISOString(), completed: false }]))
  const pending = effectiveReminders({ reminders: records, outbox: [{ action: 'completeReminder', data: { id: '0', completed: true } }, { action: 'delete', data: { type: 'reminder', id: '1' } }] })
  const schedule = notificationPlan(pending, now)
  assert.equal(schedule.length, 60)
  assert.equal(schedule[0].extra.reminderId, '2')
  assert.equal(new Set(schedule.map(r => r.id)).size, 60)
  assert.equal(notificationPlan(records, now + 100 * 60000).length, 0)
})

test('validates evidence and known targets for reminder edits and deletion', () => {
  const reminder = { action: 'update', targetId: id, title: 'Call', body: 'Call Sam', dueAt: '2026-10-07T17:00:00Z', repeat: 'daily', timezone: 'America/Los_Angeles', evidence: 'I prefer tea' }
  assert.throws(() => validatePlan({ ...base(), reminders: [reminder] }, context()), /Unknown reminder/)
  assert.throws(() => validatePlan({ ...base(), reminders: [{ ...reminder, evidence: 'invented' }] }, { ...context(), knownReminders: [{ id }] }), /Reminder evidence/)
  assert.equal(validatePlan({ ...base(), reminders: [reminder] }, { ...context(), knownReminders: [{ id }] }).reminders[0].repeat, 'daily')
})
