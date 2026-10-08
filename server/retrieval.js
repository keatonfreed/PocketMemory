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
  const known = new Map(), evidence = new Set(), fullyRead = new Set()
  function remember(type, records) {
    records.forEach(row => { evidence.add(`${type}:${row.id}`); if (type === 'knowledge') known.set(row.id, row) })
    return records
  }
  return {
    known, evidence, fullyRead, remember,
    async execute(name, args) {
      if (name === 'search_history' || name === 'search_knowledge') {
        const type = name === 'search_history' ? 'entry' : 'knowledge'
        return remember(type, await search(client, userId, type, args)).map(previewRecord)
      }
      if (name === 'read_record') {
        const input = z.object({ type: z.enum(['entry', 'knowledge']), id: z.string().uuid() }).strict().parse(args)
        const { rows } = await client.query(`SELECT * FROM ${input.type === 'entry' ? 'pm_entries' : 'pm_knowledge'} WHERE user_id=$1 AND id=$2`, [userId, input.id])
        const records = remember(input.type, rows.map(input.type === 'entry' ? entry : knowledge))
        if (records.length && input.type === 'knowledge') fullyRead.add(input.id)
        if (input.type === 'knowledge' && records.length) {
          const history = await client.query('SELECT snapshot, reason, source_id AS "sourceId", created_at AS "createdAt" FROM pm_revisions WHERE user_id=$1 AND knowledge_id=$2 ORDER BY version DESC LIMIT 30', [userId, input.id])
          return { records, revisions: history.rows }
        }
        return { records }
      }
      if (name === 'list_reminders') {
        z.object({}).strict().parse(args)
        const { rows } = await client.query('SELECT * FROM pm_reminders WHERE user_id=$1 AND completed=false ORDER BY due_at LIMIT 50', [userId])
        return rows.map(reminder)
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
