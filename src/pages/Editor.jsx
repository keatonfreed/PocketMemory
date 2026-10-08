import { useState } from 'react'
import { ArrowLeft, History, Trash2 } from 'lucide-react'
import { useMemory, saveDraft, enqueue, discardOperation } from '../state/memory'
import { request } from '../lib/api'
import AsyncButton from '../components/ui/AsyncButton'
import { formatDate } from './Timeline'
export default function Editor({ id, onClose, onEntry }) {
  const data = useMemory(s => s.data)
  const record = data.knowledge[id]
  const [draft, setDraft] = useState(() => data.drafts[id] || (record ? { title: record.title, content: record.content, version: record.version } : null))
  const [error, setError] = useState(''), [revisions, setRevisions] = useState(null), [saving, setSaving] = useState(false)
  const pending = data.outbox.find(o => o.action === 'edit' && o.data.id === id)
  if (!record || !draft) return <><button className="text-button" onClick={onClose}><ArrowLeft size={18} /> Back</button><p className="empty">This memory is no longer available.</p></>
  const conflict = pending?.conflict || record.version !== draft.version
  const dirty = draft.title !== record.title || draft.content !== record.content
  function change(patch) {
    const next = { ...draft, ...patch }; setDraft(next)
    void saveDraft(id, next).catch(e => setError(e.message))
  }
  async function save() {
    if (!draft.title.trim() || !draft.content.trim()) { setError('A title and content are required.'); return }
    setSaving(true); setError('')
    try {
      if (pending) await discardOperation(pending.id)
      await enqueue('edit', { id, requestId: crypto.randomUUID(), version: draft.version, title: draft.title.trim(), content: draft.content.trim(), kind: record.kind, expiresAt: record.expiresAt, eventAt: record.eventAt })
      onClose()
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }
  return <div className="editor">
    <header className="editor-toolbar"><button className="text-button" onClick={onClose}><ArrowLeft size={18} /> Back</button><span className="muted">{dirty ? 'Draft on this phone' : 'Saved'}</span><button className="text-button primary" disabled={saving || conflict || Boolean(pending && !pending.error) || !dirty} onClick={save}>Save</button></header>
    {error && <p className="error" role="alert">{error}</p>}
    {pending?.error && <p className="error">{pending.error}</p>}
    {conflict && <section className="conflict"><h2>This memory changed</h2><p>Your draft is safe below. Compare the latest version before replacing it.</p><details><summary>Latest saved version</summary><h3>{record.title}</h3><p className="preserve">{record.content}</p></details><AsyncButton className="text-button" onClick={async () => { if (pending) await discardOperation(pending.id); change({ version: record.version }) }}>Keep my draft and edit the latest version</AsyncButton><button className="text-button" onClick={() => { if (window.confirm('Replace your local draft with the latest saved version?')) change({ title: record.title, content: record.content, version: record.version }) }}>Use latest content</button></section>}
    <input className="editor-title" aria-label="Memory title" value={draft.title} maxLength={160} onChange={e => change({ title: e.target.value })} />
    <textarea className="editor-content" aria-label="Memory content" value={draft.content} maxLength={20000} onChange={e => change({ content: e.target.value })} spellCheck autoCapitalize="sentences" />
    {record.kind === 'list' && <div className="checklist">{draft.content.split('\n').map((line, index) => /^- \[[ xX]\] /.test(line) ? <label key={index}><input type="checkbox" checked={/^- \[[xX]\]/.test(line)} onChange={e => { const lines = draft.content.split('\n'); lines[index] = line.replace(/^- \[[ xX]\]/, e.target.checked ? '- [x]' : '- [ ]'); change({ content: lines.join('\n') }) }} /><span>{line.slice(6)}</span></label> : null)}</div>}
    <p className="hint">Changes stay in a local draft until you tap Save.</p>
    {record.sourceId && <button className="text-button" onClick={() => onEntry(record.sourceId)}>View original entry</button>}
    <div className="editor-footer"><AsyncButton className="text-button" onClick={async () => setRevisions((await request(`/api/memory?id=${id}`)).revisions)}><History size={16} /> Version history</AsyncButton><AsyncButton className="text-button danger" onClick={async () => {
      if (!window.confirm('Delete this memory and all its versions? Original history entries remain.')) return
      if (pending) await discardOperation(pending.id)
      await enqueue('delete', { type: 'knowledge', id }); onClose()
    }}><Trash2 size={16} /> Delete memory</AsyncButton></div>
    {revisions && <section className="revisions"><h2>Version history</h2>{revisions.map(({ snapshot, reason, createdAt }) => <details key={snapshot.version}><summary>Version {snapshot.version} · {formatDate(createdAt)}</summary><p className="hint">{reason}</p><h3>{snapshot.title}</h3><p className="preserve">{snapshot.content}</p>{snapshot.sourceId && <button className="text-button" onClick={() => onEntry(snapshot.sourceId)}>Original entry</button>}</details>)}</section>}
  </div>
}
