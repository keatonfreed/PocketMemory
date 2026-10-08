export const iso = v => v ? new Date(v).toISOString() : null
export const entry = r => ({ id: r.id, text: r.text, createdAt: iso(r.created_at), receivedAt: iso(r.received_at), timezone: r.timezone, research: r.research, status: r.status, reply: r.reply, sources: r.sources, webSources: r.web_sources, error: r.error })
export const knowledge = r => ({ id: r.id, title: r.title, content: r.content, kind: r.kind, version: r.version, sourceId: r.source_id, expiresAt: iso(r.expires_at), eventAt: iso(r.event_at), createdAt: iso(r.created_at), updatedAt: iso(r.updated_at), deletedAt: iso(r.deleted_at) })
export const reminder = r => ({ id: r.id, title: r.title, dueAt: iso(r.due_at), completed: r.completed, sourceId: r.source_id, createdAt: iso(r.created_at) })
