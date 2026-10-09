import { nextReminderAt, zonedParts } from './time.js'
export function effectiveReminders(data) {
  const result = { ...data.reminders }
  for (const op of data.outbox) {
    if (op.action === 'editReminder' && result[op.data.id]) result[op.data.id] = { ...result[op.data.id], ...op.data, completed: false }
    if (op.action === 'completeReminder' && result[op.data.id]) result[op.data.id] = { ...result[op.data.id], completed: op.data.completed }
    if (op.action === 'delete' && op.data.type === 'reminder') delete result[op.data.id]
  }
  return result
}
export function notificationPlan(reminders, now = Date.now()) {
  return Object.values(reminders).filter(r => !r.completed && (r.repeat || new Date(r.dueAt).getTime() > now))
    .map(r => ({ ...r, nextAt: nextReminderAt(r, now) }))
    .sort((a, b) => new Date(a.nextAt) - new Date(b.nextAt)).slice(0, 60)
    .map((r, index) => {
      let schedule = { at: new Date(r.nextAt) }
      if (r.repeat) {
        const parts = zonedParts(r.dueAt, r.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone)
        const on = { hour: parts.hour, minute: parts.minute, second: 0 }
        if (r.repeat === 'weekly') on.weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay() + 1
        // Native calendar repeats continue without reopening the app, in device local time.
        schedule = { on, repeats: true }
      }
      return { id: index + 1, title: r.title, body: r.body || r.title, schedule, extra: { reminderId: r.id, entryId: r.sourceId } }
    })
}
export const repeatLabel = repeat => repeat === 'daily' ? 'Every day' : repeat === 'weekly' ? 'Every week' : ''
export { nextReminderAt }
