import { nextReminderAt } from '../shared/reminders.js'
import { editReminderSchema } from '../shared/contracts.js'
import { transaction, publish } from './db.js'
import { reminder } from './records.js'
export async function editReminder(userId, raw, { transact = transaction } = {}) {
  const data = editReminderSchema.parse(raw)
  if (data.repeat && data.timezone) data.dueAt = nextReminderAt(data, Date.now(), false)
  return transact(userId, async client => {
    const { rows } = await client.query('UPDATE pm_reminders SET title=$3,due_at=$4,body=COALESCE($5,body),repeat=CASE WHEN $7 THEN $6 ELSE repeat END,timezone=COALESCE($8,timezone),completed=false WHERE user_id=$1 AND id=$2 RETURNING *', [userId, data.id, data.title, data.dueAt, data.body ?? null, data.repeat ?? null, data.repeat !== undefined, data.timezone || null])
    if (!rows.length) throw Object.assign(new Error('This reminder is no longer available.'), { status: 404 })
    const record = reminder(rows[0])
    await publish(client, userId, 'reminder', record)
    return record
  })
}
