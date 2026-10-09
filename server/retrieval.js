import { entry, knowledge, reminder } from './records.js'
import { z } from 'zod'
const querySchema = z.object({ query: z.string().max(500), before: z.string().datetime({ offset: true }).nullable(), after: z.string().datetime({ offset: true }).nullable() }).strict()
export async function search(client, userId, type, args) {
  const { query, before, after } = querySchema.parse(args)
  const isKnowledge = type === 'knowledge'
  const table = isKnowledge ? 'pm_knowledge' : 'pm_entries'
  const text = isKnowledge ? "title || ' ' || content" : 'text'
  const date = isKnowledge ? 'updated_at' : 'created_at'
  const { rows } = await client.query(`SELECT * FROM ${table} WHERE user_id=$1
    AND ($2='' OR to_tsvector('english', ${text}) @@ websearch_to_tsquery('english',$2) OR ${text} ILIKE '%' || $5 || '%' ESCAPE '\\')
    AND ($3::timestamptz IS NULL OR ${date} < $3) AND ($4::timestamptz IS NULL OR ${date} >= $4)
    ORDER BY ${date} DESC, id DESC LIMIT 20`, [userId, query, before, after, query.replace(/[\\%_]/g, '\\$&')])
  return rows.map(isKnowledge ? knowledge : entry)
}
export function createRetriever(client, userId) {
  const known = new Map(), evidence = new Set(), fullyRead = new Set(), knownReminders = new Map()
  function remember(type, records) {
    records.forEach(row => { evidence.add(`${type}:${row.id}`); if (type === 'knowledge') known.set(row.id, row); if (type === 'reminder') knownReminders.set(row.id, row) })
    return records
  }
  return {
    known, knownReminders, evidence, fullyRead, remember,
    async context(capture) {
      // Preserve exact recent messages and replies; only older history is previewed.
      const { rows: historyRows } = await client.query('SELECT * FROM pm_entries WHERE user_id=$1 AND id<>$2 ORDER BY created_at DESC, id DESC LIMIT 301', [userId, capture.id])
      let historyBudget = 120000
      const history = []
      for (const [index, row] of historyRows.slice(0, 300).entries()) {
        const original = entry(row)
        const record = index < 20 ? original : previewRecord(original)
        const compact = { id: record.id, text: record.text, reply: record.reply, createdAt: record.createdAt, timezone: record.timezone, ...(record.truncated ? { truncated: true } : {}) }
        const size = JSON.stringify(compact).length
        if (size > historyBudget && history.length) break
        historyBudget -= size
        history.push(compact)
      }
      remember('entry', history)
      history.reverse()
      const { rows } = await client.query('SELECT * FROM pm_knowledge WHERE user_id=$1 AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > now()) ORDER BY updated_at DESC, id DESC LIMIT 301', [userId])
      let budget = 100000
      const memories = []
      for (const row of rows.slice(0, 300)) {
        const record = previewRecord(knowledge(row))
        const size = JSON.stringify(record).length
        if (size > budget) break
        budget -= size
        memories.push(record)
      }
      remember('knowledge', memories)
      const { rows: reminderRows } = await client.query('SELECT * FROM pm_reminders WHERE user_id=$1 ORDER BY completed, due_at LIMIT 201', [userId])
      const reminders = remember('reminder', reminderRows.slice(0, 200).map(reminder))
      return { history, historyTruncated: history.length < historyRows.length, memories, memoriesTruncated: memories.length < rows.length, reminders, remindersTruncated: reminders.length < reminderRows.length }
    },
    async execute(name, args) {
      if (name === 'search_history' || name === 'search_knowledge') {
        const type = name === 'search_history' ? 'entry' : 'knowledge'
        return remember(type, await search(client, userId, type, args)).map(previewRecord)
      }
      if (name === 'read_record') {
        const input = z.object({ type: z.enum(['entry', 'knowledge', 'reminder']), id: z.string().uuid() }).strict().parse(args)
        const { rows } = await client.query(`SELECT * FROM ${{ entry: 'pm_entries', knowledge: 'pm_knowledge', reminder: 'pm_reminders' }[input.type]} WHERE user_id=$1 AND id=$2`, [userId, input.id])
        const records = remember(input.type, rows.map({ entry, knowledge, reminder }[input.type]))
        if (records.length && input.type !== 'entry') fullyRead.add(`${input.type}:${input.id}`)
        if (input.type === 'knowledge' && records.length) {
          const history = await client.query('SELECT snapshot, reason, source_id AS "sourceId", created_at AS "createdAt" FROM pm_revisions WHERE user_id=$1 AND knowledge_id=$2 ORDER BY version DESC LIMIT 30', [userId, input.id])
          return { records, revisions: history.rows }
        }
        return { records }
      }
      if (name === 'list_reminders') {
        const input = z.object({ before: z.string().datetime({ offset: true }).nullable().optional() }).strict().parse(args)
        const { rows } = await client.query('SELECT * FROM pm_reminders WHERE user_id=$1 AND ($2::timestamptz IS NULL OR created_at < $2) ORDER BY created_at DESC LIMIT 100', [userId, input.before || null])
        return remember('reminder', rows.map(reminder))
      }
      throw new Error('Unknown tool')
    },
  }
}

export function previewRecord(record) {
  const next = { ...record }
  for (const field of ['text', 'content', 'reply']) if (typeof next[field] === 'string' && next[field].length > 1500) { next[field] = next[field].slice(0, 1500); next.truncated = true }
  return next
}
