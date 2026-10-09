// Wall-clock recurrence preserves the requested hour across daylight-saving changes.
export function zonedParts(value, timezone) {
  const fields = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value))
  return Object.fromEntries(fields.filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]))
}
export function zonedInstant(parts, timezone) {
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second || 0)
  let instant = wall
  for (let i = 0; i < 4; i++) {
    const actual = zonedParts(instant, timezone)
    const difference = wall - Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second)
    if (!difference) break
    instant += difference
  }
  return new Date(instant)
}
export function nextReminderAt(reminder, now = Date.now(), respectStart = true) {
  if (!reminder.repeat || respectStart && new Date(reminder.dueAt).getTime() > now) return reminder.dueAt
  const timezone = reminder.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  const seed = zonedParts(reminder.dueAt, timezone), current = zonedParts(now, timezone)
  let candidate = { ...current, hour: seed.hour, minute: seed.minute, second: seed.second }
  if (reminder.repeat === 'weekly') {
    const seedDay = new Date(Date.UTC(seed.year, seed.month - 1, seed.day)).getUTCDay()
    const currentDay = new Date(Date.UTC(current.year, current.month - 1, current.day)).getUTCDay()
    const day = new Date(Date.UTC(current.year, current.month - 1, current.day + (seedDay - currentDay + 7) % 7))
    candidate = { ...candidate, year: day.getUTCFullYear(), month: day.getUTCMonth() + 1, day: day.getUTCDate() }
  }
  for (let i = 0; i < 3; i++) {
    const instant = zonedInstant(candidate, timezone)
    if (instant.getTime() > now) return instant.toISOString()
    const day = new Date(Date.UTC(candidate.year, candidate.month - 1, candidate.day + (reminder.repeat === 'weekly' ? 7 : 1)))
    candidate = { ...candidate, year: day.getUTCFullYear(), month: day.getUTCMonth() + 1, day: day.getUTCDate() }
  }
  throw new Error('Could not resolve reminder schedule')
}
