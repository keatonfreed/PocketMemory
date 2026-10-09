import CaptureBox from '../components/app/CaptureBox'
import EmptyState from '../components/ui/EmptyState'
import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Brain, Check, FileText, Loader2, RotateCw } from 'lucide-react'
import { useMemory, retry } from '../state/memory'
import AsyncButton from '../components/ui/AsyncButton'
import { Loading } from '../components/ui/Feedback'
export const formatDate = value => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
export function Entry({ entry, onMemory, onEntry }) {
  const reduced = useReducedMotion()
  const data = useMemory(s => s.data)
  const operation = data.outbox.find(o => o.id === entry.id)
  const turn = useMemory(s => s.turns[entry.id])
  const pending = Boolean(operation && !operation.error && entry.status !== 'done')
  const failed = operation?.error || entry.status === 'failed'
  const memories = Object.values(data.knowledge).filter(item => item.sourceId === entry.id)
  const sources = [...memories.map(item => ({ type: 'knowledge', id: item.id })), ...(entry.sources || [])]
    .filter((source, index, all) => all.findIndex(other => other.type === source.type && other.id === source.id) === index)
  // The quiet receipt is outside the user bubble, and never accompanies a reply.
  const reply = entry.reply?.trim()
  const showReceipt = !pending && !failed && !reply
  const transition = { duration: reduced ? 0 : .24, ease: [.25, .1, .25, 1] }
  return <motion.article layout={reduced ? false : 'position'} transition={transition} className={`conversation-entry${!reply && !turn?.reply && !failed ? ' conversation-quiet' : ''}`} id={`entry-${entry.id}`}>
    <motion.div layout={reduced ? false : 'position'} transition={transition} className="conversation-response">
      {pending ? (turn?.reply ? <div className="assistant-in-progress">{turn.text ? <p className="conversation-answer">{turn.text}</p> : <span className="typing-dots" role="status" aria-label="Preparing a reply"><i /><i /><i /></span>}{turn.progress && <span className="assistant-progress" role="status">{turn.progress}</span>}</div> : null) : failed ? <div className="entry-error"><p>{operation?.error || entry.error || 'Couldn’t finish this entry.'}</p>{operation?.errorCode && <small className="entry-error-details">{operation.errorCode}{operation.stage ? ` · ${operation.stage}` : ''}{operation.requestId ? ` · Request ${operation.requestId}` : ''}</small>}<AsyncButton className="text-button" onClick={() => retry(entry.id)}><RotateCw size={14} /> Retry</AsyncButton></div> : <>
        {reply ? <p className="conversation-answer">{entry.reply}</p> : null}
        {!!sources.length && <div className="sources">{sources.map(source => <button key={`${source.type}-${source.id}`} onClick={() => source.type === 'knowledge' ? onMemory(source.id) : onEntry(source.id)}><FileText size={14} />{source.type === 'knowledge' ? data.knowledge[source.id]?.title || 'Memory unavailable' : 'Related entry'}</button>)}</div>}
        {!!entry.webSources?.length && <div className="sources">{entry.webSources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</div>}
      </>}
    </motion.div>
    <div className="conversation-request" aria-label="You"><p>{entry.text}</p></div>
    {pending && !turn?.reply && <span className="message-receipt" role="status" aria-label="Processing message"><Loader2 size={12} className="spin" /></span>}
    {showReceipt && <span className="message-receipt"><Check size={12} />Saved</span>}
  </motion.article>
}
export default function Timeline({ onMemory, onEntry, focusCapture }) {
  const data = useMemory(s => s.data), syncing = useMemory(s => s.syncing), reduced = useReducedMotion()
  const [limit, setLimit] = useState(30)
  const [greeting] = useState(() => {
    const first = useMemory.getState().user?.name?.trim().split(/\s+/)[0]
    const choices = ['What’s on your mind?', 'Something to remember?', 'Where shall we start?', 'A thought to keep?']
    if (first && first.length <= 6) choices.push(`What’s new, ${first}?`)
    return choices[Math.floor(Math.random() * choices.length)]
  })
  const deleted = new Set(data.outbox.filter(o => o.action === 'delete' && o.data.type === 'entry').map(o => o.data.id))
  const entries = Object.values(data.entries).filter(e => !deleted.has(e.id)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || b.id.localeCompare(a.id))
  return <>
    <header className="page-heading home-heading"><h1><label htmlFor="capture-thought" onMouseDown={e => e.preventDefault()}>{greeting}</label></h1></header>
    <CaptureBox autoFocus={focusCapture} />
    {!entries.length && (syncing ? <div className="history-loading"><Loading label="Loading your history…" /></div> : <EmptyState icon={Brain}>No entries yet</EmptyState>)}
    <div className="conversation-feed"><AnimatePresence initial={false}>{entries.slice(0, limit).map(entry => <motion.div key={entry.id} layout={reduced ? false : 'position'} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: reduced ? 0 : .26 }} style={{ overflow: 'hidden' }}><Entry entry={entry} onMemory={onMemory} onEntry={onEntry} /></motion.div>)}</AnimatePresence></div>
    {entries.length > limit && <button className="text-button load-more" onClick={() => setLimit(limit + 30)}>Earlier entries</button>}
  </>
}
