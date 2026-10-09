export function effectiveReminders(data) {
  const result = { ...data.reminders }
  for (const op of data.outbox) {
    if (op.action === 'editReminder' && result[op.data.id]) result[op.data.id] = { ...result[op.data.id], title: op.data.title, dueAt: op.data.dueAt, completed: false }
    if (op.action === 'completeReminder' && result[op.data.id]) result[op.data.id] = { ...result[op.data.id], completed: op.data.completed }
    if (op.action === 'delete' && op.data.type === 'reminder') delete result[op.data.id]
  }
  return result
}
export function notificationPlan(reminders, now = Date.now()) {
  return Object.values(reminders).filter(r => !r.completed && new Date(r.dueAt).getTime() > now)
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt)).slice(0, 60)
    .map((r, index) => ({ id: index + 1, title: 'Pocket Memory', body: r.title, schedule: { at: new Date(r.dueAt) }, extra: { reminderId: r.id, entryId: r.sourceId } }))
}
