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

test('daily reminders keep a 6 AM wall-clock schedule across DST and native repeats persist', () => {
  const reminder = { id: 'daily', title: 'Morning stretch', body: 'Take five minutes to stretch.', dueAt: '2026-10-31T13:00:00.000Z', repeat: 'daily', timezone: 'America/Los_Angeles' }
  const now = new Date('2026-11-01T12:00:00.000Z').getTime()
  const plan = notificationPlan({ daily: reminder }, now)
  assert.equal(plan.length, 1)
  assert.equal(plan[0].title, 'Morning stretch')
  assert.equal(plan[0].body, 'Take five minutes to stretch.')
  assert.deepEqual(plan[0].schedule, { on: { hour: 6, minute: 0, second: 0 }, repeats: true })
})
test('weekly reminders keep the weekday and skip missed occurrences', async () => {
  const { nextReminderAt } = await import('../shared/reminders.js')
  const reminder = { id: 'weekly', title: 'Check in', body: 'Call Sam.', dueAt: '2026-10-05T13:00:00.000Z', repeat: 'weekly', timezone: 'America/Los_Angeles' }
  const now = new Date('2026-11-01T18:00:00.000Z').getTime()
  assert.equal(nextReminderAt(reminder, now), '2026-11-02T14:00:00.000Z')
  assert.deepEqual(notificationPlan({ weekly: reminder }, now)[0].schedule.on, { weekday: 2, hour: 6, minute: 0, second: 0 })
  assert.equal(notificationPlan({ weekly: { ...reminder, completed: true } }, now).length, 0)
})
test('daily next occurrence moves forward after delivery without changing the seed', async () => {
  const { nextReminderAt } = await import('../shared/reminders.js')
  const reminder = { dueAt: '2026-10-08T13:00:00.000Z', repeat: 'daily', timezone: 'America/Los_Angeles' }
  assert.equal(nextReminderAt(reminder, new Date('2026-10-08T14:00:00Z').getTime()), '2026-10-09T13:00:00.000Z')
  assert.equal(reminder.dueAt, '2026-10-08T13:00:00.000Z')
})
