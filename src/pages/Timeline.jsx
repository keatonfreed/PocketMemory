import { useState } from 'react'
import { ArrowUp, Globe, Search, RotateCw, ChevronDown, Trash2 } from 'lucide-react'
import { useMemory, submit, saveDraft, retry, enqueue, discardOperation } from '../state/memory'
import AsyncButton from '../components/ui/AsyncButton'
export const formatDate = value => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
export function Entry({ entry, onMemory, onEntry, expanded = false }) {
  const [open, setOpen] = useState(expanded)
  const data = useMemory(s => s.data)
  const operation = data.outbox.find(o => o.id === entry.id)
  const pending = operation && !operation.error
  return <article className="entry" id={`entry-${entry.id}`}>
    <div className="entry-meta"><time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time><span>{pending ? 'Waiting to process' : entry.status === 'done' ? '' : entry.status === 'failed' ? 'Needs retry' : 'Saved'}</span>
      <button className="icon-button subtle" aria-label="Entry options" aria-expanded={open} onClick={() => setOpen(!open)}><ChevronDown size={17} /></button></div>
    <p className="entry-text">{entry.text}</p>
    {entry.reply && <div className="entry-reply"><span className="reply-label">Pocket Memory</span><p>{entry.reply}</p></div>}
    {!!entry.sources?.length && <div className="sources">{entry.sources.map((source, i) => <button key={`${source.type}-${source.id}-${i}`} onClick={() => source.type === 'knowledge' ? onMemory(source.id) : onEntry(source.id)}>{source.type === 'knowledge' ? data.knowledge[source.id]?.title || 'Memory unavailable' : data.entries[source.id] ? formatDate(data.entries[source.id].createdAt) : 'Entry unavailable'}</button>)}</div>}
    {!!entry.webSources?.length && <div className="sources">{entry.webSources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</div>}
    {(operation?.error || entry.status === 'failed') && <div className="entry-error"><p>{operation?.error || entry.error}</p><AsyncButton className="text-button" onClick={() => retry(entry.id)}><RotateCw size={14} /> Retry</AsyncButton></div>}
    {open && <div className="entry-actions"><AsyncButton className="text-button danger" onClick={async () => {
      if (!window.confirm('Delete this original entry? Memories already learned from it remain in Memory until you delete them there.')) return
      if (operation) await discardOperation(operation.id)
      await enqueue('delete', { type: 'entry', id: entry.id })
    }}><Trash2 size={14} /> Delete entry</AsyncButton></div>}
  </article>
}
export default function Timeline({ onMemory, onEntry }) {
  const data = useMemory(s => s.data), online = useMemory(s => s.online)
  const [input, setInput] = useState(data.drafts.composer || ''), [research, setResearch] = useState(false), [query, setQuery] = useState(''), [error, setError] = useState(''), [sending, setSending] = useState(false), [limit, setLimit] = useState(30)
  const deleted = new Set(data.outbox.filter(o => o.action === 'delete' && o.data.type === 'entry').map(o => o.data.id))
  const entries = Object.values(data.entries).filter(e => !deleted.has(e.id) && `${e.text} ${e.reply || ''}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  async function send() {
    if (!input.trim() || sending) return
    setSending(true); setError('')
    try { await submit(input, research); setInput(''); setResearch(false) } catch (e) { setError(e.message) } finally { setSending(false) }
  }
  return <>
    <header className="page-heading"><span className="wordmark">Pocket Memory</span><h1>What’s on your mind?</h1></header>
    <div className="composer">
      <textarea aria-label="Tell Pocket Memory something or ask for help" placeholder="Tell me something, or ask…" value={input} maxLength={20000} rows={3} onChange={e => { setInput(e.target.value); void saveDraft('composer', e.target.value).catch(e => setError(e.message)) }} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) { e.preventDefault(); void send() } }} />
      <div className="composer-actions"><button className={`research-toggle ${research ? 'selected' : ''}`} aria-pressed={research} onClick={() => setResearch(!research)}><Globe size={16} /> Research</button><button className="send-button" aria-label="Send" disabled={!input.trim() || sending} onClick={send}><ArrowUp size={22} /></button></div>
    </div>
    {research && <p className="hint">Allow web search for this request. Search queries may include relevant context.</p>}
    {!online && <p className="hint">Offline. Entries save on this phone and process after you reconnect.</p>}
    {!data.consent && <p className="hint">AI is paused. Entries stay saved; enable AI processing in Settings when you’re ready.</p>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="section-heading"><h2>History</h2><span>{entries.length}</span></div>
    <label className="search-field"><Search size={17} /><input aria-label="Search history" placeholder="Find something you said" value={query} onChange={e => { setQuery(e.target.value); setLimit(30) }} /></label>
    {!entries.length && <p className="empty">{query ? 'No matching entries.' : 'Your original entries will stay here, in your words.'}</p>}
    {entries.slice(0, limit).map(entry => <Entry key={entry.id} entry={entry} onMemory={onMemory} onEntry={onEntry} />)}
    {entries.length > limit && <button className="text-button load-more" onClick={() => setLimit(limit + 30)}>Show earlier entries</button>}
  </>
}
