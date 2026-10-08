import { randomUUID } from 'node:crypto'
import { db, transaction, publish } from './db.js'
import { entry, knowledge, reminder } from './records.js'
import { runAgent } from './agent.js'
import { captureSchema, editSchema } from '../shared/contracts.js'

async function saveRevision(client, userId, record, reason) {
  await client.query('INSERT INTO pm_revisions(user_id,knowledge_id,version,snapshot,source_id,reason) VALUES ($1,$2,$3,$4,$5,$6)', [userId, record.id, record.version, record, record.sourceId, reason])
  await publish(client, userId, 'knowledge', record)
}
export async function capture(userId, raw, { agent = runAgent, transact = transaction } = {}) {
  const input = captureSchema.parse(raw)
  // Commit the original before calling any AI provider. Retries use the same ID.
  await transact(userId, async client => {
    const existing = await client.query('SELECT * FROM pm_entries WHERE id=$1', [input.id])
    if (existing.rows.length) {
      const row = existing.rows[0]
      if (row.user_id !== userId || row.text !== input.text || row.research !== input.research) throw Object.assign(new Error('Entry ID was already used for different content'), { status: 409 })
      return
    }
    const limit = await client.query("SELECT count(*) FROM pm_entries WHERE user_id=$1 AND received_at > now()-interval '1 hour'", [userId])
    if (Number(limit.rows[0].count) >= 120) throw Object.assign(new Error('Please wait before adding more entries.'), { status: 429 })
    const { rows } = await client.query('INSERT INTO pm_entries(id,user_id,text,created_at,timezone,research) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [input.id, userId, input.text, input.createdAt, input.timezone, input.research])
    await publish(client, userId, 'entry', entry(rows[0]))
  })
  try {
    return await transact(userId, async client => {
      const current = await client.query('SELECT * FROM pm_entries WHERE id=$1 AND user_id=$2 FOR UPDATE', [input.id, userId])
      if (current.rows[0].status === 'done') return entry(current.rows[0])
      const consent = await client.query('SELECT ai_enabled FROM pm_consent WHERE user_id=$1', [userId])
      if (!consent.rows[0]?.ai_enabled) throw Object.assign(new Error('Enable AI processing in Settings to process this entry.'), { status: 403 })
      const { plan, webSources } = await agent(client, userId, input)
      for (const change of plan.changes) {
        let rows
        if (change.action === 'create') {
          // Exact semantic-normalized duplicates are also checked against records outside retrieved context.
          const duplicate = await client.query("SELECT id FROM pm_knowledge WHERE user_id=$1 AND deleted_at IS NULL AND lower(regexp_replace(trim(content),'\\s+',' ','g'))=lower(regexp_replace(trim($2),'\\s+',' ','g')) AND (expires_at IS NULL OR expires_at > now()) LIMIT 1", [userId, change.content])
          if (duplicate.rows.length) continue
          ;({ rows } = await client.query('INSERT INTO pm_knowledge(id,user_id,title,content,kind,source_id,expires_at,event_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [randomUUID(), userId, change.title, change.content, change.kind, input.id, change.expiresAt, change.eventAt]))
        } else {
          ({ rows } = await client.query('UPDATE pm_knowledge SET title=$3, content=$4, kind=$5, source_id=$6, expires_at=$7, event_at=$8, version=version+1, updated_at=now() WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL RETURNING *', [change.targetId, userId, change.title, change.content, change.kind, input.id, change.expiresAt, change.eventAt]))
          if (!rows.length) throw new Error('Memory changed before update')
        }
        await saveRevision(client, userId, knowledge(rows[0]), change.reason)
      }
      for (const item of plan.reminders) {
        const { rows } = await client.query('INSERT INTO pm_reminders(id,user_id,source_id,title,due_at) VALUES ($1,$2,$3,$4,$5) RETURNING *', [randomUUID(), userId, input.id, item.title, item.dueAt])
        await publish(client, userId, 'reminder', reminder(rows[0]))
      }
      const { rows } = await client.query("UPDATE pm_entries SET status='done',reply=$3,sources=$4,web_sources=$5,error=NULL WHERE id=$1 AND user_id=$2 RETURNING *", [input.id, userId, plan.reply, JSON.stringify(plan.sources), JSON.stringify(webSources)])
      const result = entry(rows[0])
      await publish(client, userId, 'entry', result)
      return result
    })
  } catch (error) {
    // A concurrent request owns the lock; don't overwrite its outcome with a failure.
    if (error.status !== 409) await transact(userId, async client => {
      const { rows } = await client.query("UPDATE pm_entries SET status='failed',error=$3 WHERE id=$1 AND user_id=$2 AND status!='done' RETURNING *", [input.id, userId, error.status && error.status < 600 ? error.message : 'Processing did not finish. Please retry.'])
      if (rows.length) await publish(client, userId, 'entry', entry(rows[0]))
    }).catch(() => {})
    throw error
  }
}
export async function edit(userId, raw, transact = transaction) {
  const input = editSchema.parse(raw)
  return transact(userId, async client => {
    const prior = await client.query('SELECT result FROM pm_operations WHERE user_id=$1 AND id=$2', [userId, input.requestId])
    if (prior.rows.length) return prior.rows[0].result
    const { rows } = await client.query('UPDATE pm_knowledge SET title=$4,content=$5,kind=$6,expires_at=$7,event_at=$8,version=version+1,updated_at=now(),source_id=NULL WHERE user_id=$1 AND id=$2 AND version=$3 AND deleted_at IS NULL RETURNING *', [userId, input.id, input.version, input.title, input.content, input.kind, input.expiresAt, input.eventAt])
    if (!rows.length) throw Object.assign(new Error('This memory changed elsewhere. Your draft is preserved. Compare it with the latest version before saving.'), { status: 409, conflict: true })
    const result = knowledge(rows[0])
    await saveRevision(client, userId, result, 'Edited by you')
    await client.query('INSERT INTO pm_operations(user_id,id,result) VALUES ($1,$2,$3)', [userId, input.requestId, result])
    return result
  })
}
export async function sync(userId, cursor) {
  if (!/^\d{1,20}$/.test(cursor)) throw Object.assign(new Error('Invalid sync cursor'), { status: 400 })
  const { rows } = await db().query('SELECT seq,type,record_id AS id,data,deleted FROM pm_changes WHERE user_id=$1 AND seq>$2::bigint ORDER BY seq LIMIT 100', [userId, cursor])
  return { changes: rows, cursor: rows.at(-1)?.seq || cursor, more: rows.length === 100 }
}
