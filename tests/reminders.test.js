import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { editReminder } from '../server/reminders.js'
import { effectiveReminders, notificationPlan } from '../shared/reminders.js'

test('reminder edits persist, publish and cannot change another account’s reminder', async () => {
  const database = new PGlite()
  const id = crypto.randomUUID(), dueAt = '2028-05-01T19:30:00.000Z'
  try {
    await database.exec('CREATE TABLE "user" (id text PRIMARY KEY); INSERT INTO "user" VALUES (\'u1\'), (\'u2\');')
    await database.exec(await readFile(new URL('../migrations/001_memory.sql', import.meta.url), 'utf8'))
    await database.query('INSERT INTO pm_reminders(id,user_id,title,due_at,completed) VALUES ($1,$2,$3,$4,true)', [id, 'u1', 'Old title', dueAt])
    const transact = (_user, fn) => database.transaction(fn)
    await assert.rejects(editReminder('u2', { id, title: 'Wrong account', dueAt }, { transact }), error => error.status === 404)
    const result = await editReminder('u1', { id, title: ' Call Sam ', dueAt }, { transact })
    assert.equal(result.title, 'Call Sam')
    assert.equal(result.dueAt, dueAt)
    assert.equal(result.completed, false)
    const { rows } = await database.query('SELECT data FROM pm_changes WHERE user_id=$1', ['u1'])
    assert.deepEqual(rows[0].data, result)
    await assert.rejects(editReminder('u1', { id, title: ' ', dueAt }, { transact }))
    assert.equal((await database.query('SELECT title FROM pm_reminders WHERE id=$1', [id])).rows[0].title, 'Call Sam')
  } finally { await database.close() }
})

test('offline reminder edits move a past reminder into its new notification schedule', () => {
  const id = crypto.randomUUID(), now = Date.now(), dueAt = new Date(now + 60000).toISOString()
  const state = { reminders: { [id]: { id, title: 'Old', dueAt: new Date(now - 60000).toISOString(), completed: true } }, outbox: [{ action: 'editReminder', data: { id, title: 'Updated', dueAt } }] }
  const effective = effectiveReminders(state), plan = notificationPlan(effective, now)
  assert.equal(effective[id].completed, false)
  assert.equal(plan.length, 1)
  assert.equal(plan[0].body, 'Updated')
  assert.equal(plan[0].schedule.at.toISOString(), dueAt)
  assert.equal(state.reminders[id].title, 'Old')
})
