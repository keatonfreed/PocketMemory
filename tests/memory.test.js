import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { capture, edit } from '../server/memory.js'
import { search } from '../server/retrieval.js'
const migration = await readFile(new URL('../migrations/001_memory.sql', import.meta.url), 'utf8')
const fields = { title: 'Drink preference', content: 'Prefers tea', kind: 'preference', expiresAt: null, eventAt: null }
const message = text => ({ id: crypto.randomUUID(), text, createdAt: new Date().toISOString(), timezone: 'America/Los_Angeles', research: false })
const result = changes => ({ plan: { reply: 'Remembered.', changes, sources: [], reminders: [] }, webSources: [] })
const create = { ...fields, action: 'create', targetId: null, evidence: 'tea', reason: 'User preference' }
async function setup() {
  const database = new PGlite()
  await database.waitReady
  await database.exec('CREATE TABLE "user" (id text PRIMARY KEY); INSERT INTO "user" VALUES (\'u1\'), (\'u2\');')
  await database.exec(migration)
  await database.exec("INSERT INTO pm_consent(user_id,ai_enabled) VALUES ('u1',true),('u2',true)")
  return { database, transact: (_user, fn) => database.transaction(fn) }
}
test('capture replay creates one entry, one memory, and one revision', async () => {
  const { database, transact } = await setup()
  try {
    const input = message('I prefer tea'); let calls = 0
    const agent = async () => { calls++; return result([create]) }
    const saved = await capture('u1', input, { agent, transact }); await capture('u1', input, { agent, transact })
    assert.equal(saved.sources[0].action, 'create')
    assert.equal(saved.sources[0].title, create.title)
    assert.equal(calls, 1)
    for (const table of ['pm_entries', 'pm_knowledge', 'pm_revisions']) assert.equal((await database.query(`SELECT count(*) FROM ${table}`)).rows[0].count, 1)
    await assert.rejects(capture('u2', input, { agent, transact }), /already used/)
  } finally { await database.close() }
})
test('correction retains original history and versions; stale edits cannot overwrite', async () => {
  const { database, transact } = await setup()
  try {
    await capture('u1', message('I prefer tea'), { transact, agent: async () => result([create]) })
    const { rows: [record] } = await database.query('SELECT * FROM pm_knowledge')
    const corrected = await capture('u1', message('Now I prefer coffee'), { transact, agent: async () => result([{ ...create, action: 'update', targetId: record.id, content: 'Prefers coffee', evidence: 'coffee' }]) })
    assert.deepEqual(corrected.sources[0], { type: 'knowledge', id: record.id, action: 'update', title: create.title })
    const raw = { ...fields, id: record.id, requestId: crypto.randomUUID(), version: 1 }
    await assert.rejects(edit('u1', raw, transact), /changed elsewhere/)
    const request = { ...raw, version: 2, requestId: crypto.randomUUID(), content: 'Prefers decaf' }
    const first = await edit('u1', request, transact)
    const replay = await edit('u1', request, transact)
    assert.equal(first.version, 3); assert.deepEqual(first, replay)
    const versions = await database.query('SELECT snapshot FROM pm_revisions ORDER BY version')
    assert.deepEqual(versions.rows.map(r => r.snapshot.content), ['Prefers tea', 'Prefers coffee', 'Prefers decaf'])
    assert.equal((await database.query('SELECT count(*) FROM pm_entries')).rows[0].count, 2)
  } finally { await database.close() }
})
test('provider failure preserves original input and rolls back partial changes', async () => {
  const { database, transact } = await setup()
  try {
    const input = message('tea')
    await assert.rejects(capture('u1', input, { transact, agent: async () => { throw new Error('provider failed') } }), /provider failed/)
    const saved = (await database.query('SELECT * FROM pm_entries')).rows[0]
    assert.equal(saved.text, input.text); assert.equal(saved.status, 'failed')
    assert.equal((await database.query('SELECT count(*) FROM pm_knowledge')).rows[0].count, 0)
    await capture('u1', input, { transact, agent: async () => result([create]) })
    assert.equal((await database.query('SELECT status FROM pm_entries')).rows[0].status, 'done')
  } finally { await database.close() }
})
test('retrieval isolates accounts, supports real content and chronology', async () => {
  const { database, transact } = await setup()
  try {
    await capture('u1', message('I prefer tea'), { transact, agent: async () => result([create]) })
    assert.equal((await search(database, 'u2', 'entry', { query: 'tea', before: null, after: null })).length, 0)
    assert.equal((await search(database, 'u1', 'entry', { query: 'tea', before: null, after: null })).length, 1)
    assert.equal((await search(database, 'u1', 'entry', { query: '', before: '2000-01-01T00:00:00Z', after: null })).length, 0)
  } finally { await database.close() }
})
test('migration can run twice, account deletion cascades all memory data', async () => {
  const { database, transact } = await setup()
  try {
  await database.exec(migration)
    await capture('u1', message('tea'), { transact, agent: async () => result([create]) })
    await database.query('DELETE FROM "user" WHERE id=$1', ['u1'])
    for (const table of ['pm_entries', 'pm_knowledge', 'pm_revisions', 'pm_changes', 'pm_consent']) assert.equal((await database.query(`SELECT count(*) FROM ${table} WHERE user_id='u1'`)).rows[0].count, 0)
  } finally { await database.close() }
})

test('a bad later operation rolls back an earlier memory creation', async () => {
  const { database, transact } = await setup()
  try {
    await assert.rejects(capture('u1', message('tea'), { transact, agent: async () => result([create, { ...create, action: 'update', targetId: crypto.randomUUID() }]) }), /changed before update/)
    assert.equal((await database.query('SELECT count(*) FROM pm_knowledge')).rows[0].count, 0)
    assert.equal((await database.query('SELECT count(*) FROM pm_revisions')).rows[0].count, 0)
    assert.equal((await database.query('SELECT status FROM pm_entries')).rows[0].status, 'failed')
  } finally { await database.close() }
})

test('AI reminder creation, updates and deletion persist atomically and replay once', async () => {
  const { database, transact } = await setup()
  try {
    const input = message('Remind me to stretch every day at 6am')
    const item = { action: 'create', targetId: null, title: 'Stretch', body: 'Take five minutes to stretch.', dueAt: '2028-05-01T13:00:00.000Z', repeat: 'daily', timezone: 'America/Los_Angeles', evidence: input.text }
    const agent = async () => ({ plan: { ...result([]).plan, reminders: [item] }, webSources: [] })
    await capture('u1', input, { transact, agent })
    await capture('u1', input, { transact, agent })
    const { rows: [record] } = await database.query('SELECT * FROM pm_reminders')
    assert.equal(record.repeat, 'daily')
    assert.equal(record.body, item.body)
    assert.equal((await database.query('SELECT count(*) FROM pm_reminders')).rows[0].count, 1)
    await capture('u1', message('Make it weekly'), { transact, agent: async () => ({ plan: { ...result([]).plan, reminders: [{ ...item, action: 'update', targetId: record.id, repeat: 'weekly' }] }, webSources: [] }) })
    assert.equal((await database.query('SELECT repeat FROM pm_reminders')).rows[0].repeat, 'weekly')
    await assert.rejects(capture('u2', message('Delete that reminder'), { transact, agent: async () => ({ plan: { ...result([]).plan, reminders: [{ ...item, action: 'delete', targetId: record.id }] }, webSources: [] }) }), /changed before deletion/)
    await capture('u1', message('Delete that reminder'), { transact, agent: async () => ({ plan: { ...result([]).plan, reminders: [{ ...item, action: 'delete', targetId: record.id }] }, webSources: [] }) })
    assert.equal((await database.query('SELECT count(*) FROM pm_reminders')).rows[0].count, 0)
    const changes = (await database.query("SELECT deleted FROM pm_changes WHERE type='reminder' AND record_id=$1", [record.id])).rows
    assert.deepEqual(changes, [{ deleted: true }])
  } finally { await database.close() }
})
test('AI memory deletion removes stale sync payloads and retains original messages', async () => {
  const { database, transact } = await setup()
  try {
    await capture('u1', message('I prefer tea'), { transact, agent: async () => result([create]) })
    const { rows: [record] } = await database.query('SELECT * FROM pm_knowledge')
    await capture('u1', message('Delete my tea preference'), { transact, agent: async () => result([{ ...create, action: 'delete', targetId: record.id }]) })
    assert.equal((await database.query('SELECT count(*) FROM pm_knowledge')).rows[0].count, 0)
    assert.equal((await database.query('SELECT count(*) FROM pm_entries')).rows[0].count, 2)
    assert.equal((await database.query('SELECT count(*) FROM pm_revisions')).rows[0].count, 0)
    assert.deepEqual((await database.query("SELECT deleted FROM pm_changes WHERE type='knowledge'", [])).rows, [{ deleted: true }])
  } finally { await database.close() }
})
