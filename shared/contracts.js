import { z } from 'zod'
import { nextReminderAt } from './time.js'

export const text = z.string().trim().min(1).max(20000)
export const id = z.string().uuid()
export const knowledgeFields = z.object({
  title: z.string().trim().min(1).max(160),
  content: text,
  kind: z.enum(['fact', 'preference', 'person', 'event', 'plan', 'note', 'list']),
  expiresAt: z.string().datetime({ offset: true }).nullable(),
  eventAt: z.string().datetime({ offset: true }).nullable(),
})
export const captureSchema = z.object({
  id, text, createdAt: z.string().datetime({ offset: true }),
  timezone: z.string().max(100).refine(v => { try { new Intl.DateTimeFormat('en', { timeZone: v }); return true } catch { return false } }),
  research: z.boolean().default(false),
}).strict()
export const editSchema = z.object({ id, requestId: id, version: z.number().int().positive(), ...knowledgeFields.shape }).strict()
export const timezone = z.string().max(100).refine(v => { try { new Intl.DateTimeFormat('en', { timeZone: v }); return true } catch { return false } })
export const reminderFields = {
  title: z.string().trim().min(1).max(160), body: z.string().trim().max(500),
  dueAt: z.string().datetime({ offset: true }), repeat: z.enum(['daily', 'weekly']).nullable(), timezone,
}
export const editReminderSchema = z.object({ id, ...reminderFields, body: reminderFields.body.optional(), repeat: reminderFields.repeat.optional(), timezone: timezone.optional() }).strict()
export const planSchema = z.object({
  reply: z.string().max(16000),
  sources: z.array(z.object({ type: z.enum(['entry', 'knowledge']), id })).max(30),
  changes: z.array(z.object({
    action: z.enum(['create', 'update', 'delete']), targetId: id.nullable(),
    ...knowledgeFields.shape,
    reason: z.string().min(1).max(500),
    evidence: z.string().min(1).max(20000),
  })).max(12),
  reminders: z.array(z.object({
    action: z.enum(['create', 'update', 'delete']), targetId: id.nullable(), ...reminderFields,
    evidence: z.string().min(1).max(20000),
  })).max(8),
})

export function normalizeContent(value) { return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim() }

// The complete plan is validated before any mutation. A bad operation cannot leave a partial update.
export function validatePlan(raw, { input, known, evidenceIds, knownReminders = [], now = new Date() }) {
  const plan = planSchema.parse(raw)
  const targets = new Set()
  const contents = new Set(known.filter(k => !k.deletedAt && (!k.expiresAt || new Date(k.expiresAt) > now)).map(k => normalizeContent(k.content)))
  plan.changes = plan.changes.filter(change => {
    if (!input.includes(change.evidence)) throw new Error('Memory evidence must be copied from the original entry')
    if (change.action !== 'create') {
      if (!change.targetId || !known.some(k => k.id === change.targetId && !k.deletedAt)) throw new Error('Unknown memory update target')
      if (targets.has(change.targetId)) throw new Error('Multiple updates to the same memory')
      targets.add(change.targetId)
    } else {
      if (change.targetId !== null) throw new Error('New memory must not have a target ID')
      const key = normalizeContent(change.content)
      if (contents.has(key)) return false
      contents.add(key)
    }
    return true
  })
  for (const source of plan.sources) {
    if (!evidenceIds.has(`${source.type}:${source.id}`)) throw new Error('Answer references unseen evidence')
  }
  const reminderTargets = new Set()
  for (const reminder of plan.reminders) {
    if (!input.includes(reminder.evidence)) throw new Error('Reminder evidence must be copied from the original entry')
    if (reminder.action === 'create') {
      if (reminder.targetId !== null) throw new Error('New reminder must not have a target ID')
    } else {
      if (!reminder.targetId || !knownReminders.some(r => r.id === reminder.targetId)) throw new Error('Unknown reminder target')
      if (reminderTargets.has(reminder.targetId)) throw new Error('Multiple changes to the same reminder')
      reminderTargets.add(reminder.targetId)
    }
    if (reminder.action !== 'delete') {
      if (new Date(reminder.dueAt) <= now) throw new Error('Reminder must be in the future')
      if (reminder.repeat && Math.abs(new Date(nextReminderAt(reminder, now.getTime(), false)) - new Date(reminder.dueAt)) > 1000) throw new Error('Repeating reminder must start at the next matching daily or weekly occurrence')
    }
  }
  return plan
}

export const emptyState = () => ({ schema: 1, cursor: '0', entries: {}, knowledge: {}, reminders: {}, outbox: [], drafts: {}, consent: false })
export function applySync(state, changes, cursor) {
  const next = { ...state, entries: { ...state.entries }, knowledge: { ...state.knowledge }, reminders: { ...state.reminders }, cursor }
  for (const row of changes) {
    const bucket = { entry: 'entries', knowledge: 'knowledge', reminder: 'reminders' }[row.type]
    if (!bucket) throw new Error('Unknown sync record')
    if (row.deleted) delete next[bucket][row.id]
    else next[bucket][row.id] = row.data
  }
  return next
}
