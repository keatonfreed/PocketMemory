import { forwardRef, useImperativeHandle, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, History, Trash2, MoreHorizontal } from 'lucide-react'
import { useMemory, saveDraft, enqueue, discardOperation } from '../state/memory'
import { request } from '../lib/api'
import AsyncButton from '../components/ui/AsyncButton'
import { formatDate } from './Timeline'
const Editor = forwardRef(function Editor({ id, onClose, onEntry }, ref) {
  const data = useMemory(s => s.data)
  const record = data.knowledge[id]
  const [draft, setDraft] = useState(() => data.drafts[id] || (record ? { title: record.title, content: record.content, version: record.version } : null))
  const [error, setError] = useState(''), [revisions, setRevisions] = useState(null), [saving, setSaving] = useState(false), [menu, setMenu] = useState(false)
  const draftWrite = useRef(0), contentField = useRef(null), base = useRef(record), clearedConflict = useRef(null)
  const pending = data.outbox.find(o => o.action === 'edit' && o.data.id === id)
  useEffect(() => {
    if (!record || !draft) return
    if (draft.version !== record.version) {
      const previous = base.current
      const next = {
        title: previous?.version === draft.version && draft.title !== previous.title ? draft.title : record.title,
        content: previous?.version === draft.version && draft.content !== previous.content ? draft.content : record.content,
        version: record.version,
      }
      base.current = record
      setDraft(next)
      void saveDraft(id, next).catch(e => setError(e.message))
    }
    if (pending?.conflict && clearedConflict.current !== pending.id) {
      clearedConflict.current = pending.id
      void discardOperation(pending.id).catch(e => { clearedConflict.current = null; setError(e.message) })
    }
  }, [record, draft, pending, id])
  useLayoutEffect(() => {
    const field = contentField.current
    if (!field) return
    field.style.height = '0px'
    field.style.height = `${Math.max(180, field.scrollHeight)}px`
  }, [draft?.content])
  useImperativeHandle(ref, () => ({ saveAndClose: save }))
  if (!record || !draft) return <><button className="text-button" onClick={onClose}><ArrowLeft size={18} /> Back</button><p className="empty">This memory is no longer available.</p></>
  const dirty = draft.title !== record.title || draft.content !== record.content
  function change(patch) {
    const next = { ...draft, ...patch }; setDraft(next)
    const write = ++draftWrite.current
    void saveDraft(id, next).catch(e => { if (write === draftWrite.current) { setError(e.message) } })
  }
  async function save() {
    if (!record || !draft) { onClose(); return }
    if (saving) return
    if (!dirty || pending && !pending.error && !pending.conflict && pending.data.title === draft.title.trim() && pending.data.content === draft.content.trim()) { onClose(); return }
    if (record.version !== draft.version || pending?.conflict) return
    if (pending && !pending.error) { setError('The previous edit is still syncing. Your changes are saved on this phone; try Back again once it finishes.'); return }
    if (!draft.title.trim() || !draft.content.trim()) { setError('A title and content are required.'); return }
    setSaving(true); setError('')
    try {
      await saveDraft(id, draft)
      if (pending) await discardOperation(pending.id)
      await enqueue('edit', { id, requestId: crypto.randomUUID(), version: draft.version, title: draft.title.trim(), content: draft.content.trim(), kind: record.kind, expiresAt: record.expiresAt, eventAt: record.eventAt })
      onClose()
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }
  return <div className="editor" onClick={e => { if (!e.target.closest('.editor-options, .editor-toolbar')) setMenu(false) }} onKeyDown={e => { if (e.key === 'Escape') setMenu(false) }}>
    <header className="editor-header"><div className="editor-toolbar"><button className="text-button" disabled={saving} onClick={save}><ArrowLeft size={18} /> Back</button><button className="icon-button" aria-label="Memory options" aria-expanded={menu} onClick={() => setMenu(!menu)}><MoreHorizontal size={21} /></button></div><input className="editor-title" aria-label="Memory title" placeholder="Memory title" value={draft.title} maxLength={160} onChange={e => change({ title: e.target.value })} /></header>
    {menu && <div className="editor-options"><AsyncButton className="text-button" onClick={async () => { setRevisions((await request(`/api/memory?id=${id}`)).revisions); setMenu(false) }}><History size={16} /> Version history</AsyncButton><AsyncButton className="text-button danger" onClick={async () => {
      if (!window.confirm('Delete this memory and all its versions? Original history entries remain.')) return
      if (pending) await discardOperation(pending.id)
      await enqueue('delete', { type: 'knowledge', id }); onClose()
    }}><Trash2 size={16} /> Delete memory</AsyncButton></div>}
    {error && <p className="error" role="alert">{error}</p>}
    {pending?.error && !pending.conflict && <p className="error">{pending.error}</p>}
    <textarea ref={contentField} className="editor-content" placeholder="Add the details you want to keep…" aria-label="Memory content" value={draft.content} maxLength={20000} onChange={e => change({ content: e.target.value })} spellCheck autoCapitalize="sentences" />
    {record.kind === 'list' && <div className="checklist">{draft.content.split('\n').map((line, index) => /^- \[[ xX]\] /.test(line) ? <label key={index}><input type="checkbox" checked={/^- \[[xX]\]/.test(line)} onChange={e => { const lines = draft.content.split('\n'); lines[index] = line.replace(/^- \[[ xX]\]/, e.target.checked ? '- [x]' : '- [ ]'); change({ content: lines.join('\n') }) }} /><span>{line.slice(6)}</span></label> : null)}</div>}

    {revisions && <section className="revisions"><div className="section-heading"><h2>Version history</h2><button className="text-button" onClick={() => setRevisions(null)}>Close</button></div>{revisions.map(({ snapshot, reason, createdAt }) => <details key={snapshot.version}><summary>Version {snapshot.version} · {formatDate(createdAt)}</summary><p className="hint">{reason}</p><h3>{snapshot.title}</h3><p className="preserve">{snapshot.content}</p>{snapshot.sourceId && <button className="text-button" onClick={() => onEntry(snapshot.sourceId)}>Original entry</button>}</details>)}</section>}
  </div>
})
export default Editor
