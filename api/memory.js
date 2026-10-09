import { eventStream } from '../server/stream.js'
import { publicError, safeDiagnostics } from '../server/errors.js'
import { z } from 'zod'
import { endpoint, body, method, user } from '../server/http.js'
import { editReminder } from '../server/reminders.js'
import { capture, edit } from '../server/memory.js'
import { db, transaction, publish } from '../server/db.js'
import { reminder } from '../server/records.js'
export default endpoint(async (req, res) => {
  const account = await user(req)
  if (req.method === 'GET') {
    const id = z.string().uuid().parse(req.query.id)
    const { rows } = await db().query('SELECT snapshot,reason,created_at AS "createdAt" FROM pm_revisions WHERE user_id=$1 AND knowledge_id=$2 ORDER BY version DESC', [account.id, id])
    return res.json({ revisions: rows })
  }
  method(req, 'POST')
  const input = body(req)
  if (input.action === 'capture') {
    if (!req.headers.accept?.includes('text/event-stream')) return res.json({ entry: await capture(account.id, input.data) })
    const stream = eventStream(res)
    stream.emit({ type: 'connected', requestId: req.requestId })
    try {
      const entry = await capture(account.id, input.data, { onEvent: stream.emit })
      stream.emit({ type: 'complete', entry })
    } catch (error) {
      error.requestId = req.requestId
      const failure = publicError(error)
      console.error('capture_failed', { requestId: req.requestId, status: failure.status, code: failure.code, ...safeDiagnostics(error) })
      stream.emit({ type: 'error', ...failure })
    } finally { stream.end() }
    return
  }
  if (input.action === 'edit') return res.json({ knowledge: await edit(account.id, input.data) })
  if (input.action === 'editReminder') return res.json({ reminder: await editReminder(account.id, input.data) })
  if (input.action === 'completeReminder') {
    const data = z.object({ id: z.string().uuid(), completed: z.boolean() }).parse(input.data)
    await transaction(account.id, async client => {
      const { rows } = await client.query('UPDATE pm_reminders SET completed=$3 WHERE user_id=$1 AND id=$2 RETURNING *', [account.id, data.id, data.completed])
      if (rows.length) await publish(client, account.id, 'reminder', reminder(rows[0]))
    })
    return res.json({ ok: true })
  }
  if (input.action === 'delete') {
    const data = z.object({ type: z.enum(['entry', 'knowledge', 'reminder']), id: z.string().uuid() }).parse(input.data)
    await transaction(account.id, async client => {
      const table = { entry: 'pm_entries', knowledge: 'pm_knowledge', reminder: 'pm_reminders' }[data.type]
      // Remove old sync payloads too; otherwise deleted content survives in the change log.
      await client.query('DELETE FROM pm_changes WHERE user_id=$1 AND type=$2 AND record_id=$3', [account.id, data.type, data.id])
      await client.query(`DELETE FROM ${table} WHERE user_id=$1 AND id=$2`, [account.id, data.id])
      if (data.type === 'knowledge') await client.query('DELETE FROM pm_operations WHERE user_id=$1 AND result->>\'id\'=$2', [account.id, data.id])
      await publish(client, account.id, data.type, { id: data.id }, true)
    })
    return res.json({ ok: true })
  }
  res.status(400).json({ error: 'Unknown action' })
})
