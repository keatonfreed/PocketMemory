import EmptyState from '../components/ui/EmptyState'
import { useState } from 'react'
import { Search, ChevronRight, Layers } from 'lucide-react'
import { useMemory } from '../state/memory'
export default function Knowledge({ onOpen }) {
  const data = useMemory(s => s.data), [query, setQuery] = useState(''), [showExpired, setShowExpired] = useState(false)
  const deleted = new Set(data.outbox.filter(o => o.action === 'delete' && o.data.type === 'knowledge').map(o => o.data.id))
  const records = Object.values(data.knowledge).filter(k => !deleted.has(k.id) && (showExpired || !k.expiresAt || new Date(k.expiresAt) > new Date()) && `${k.title} ${k.content}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  return <><header className="page-heading"><h1>Memory</h1></header>
    <label className="search-field"><Search size={17} /><input aria-label="Search memories" placeholder="Search memories" value={query} onChange={e => setQuery(e.target.value)} /></label>
    {Object.values(data.knowledge).some(record => record.expiresAt) && <label className="toggle-row compact"><span>Show expired</span><input type="checkbox" checked={showExpired} onChange={e => setShowExpired(e.target.checked)} /></label>}
    {!records.length && <EmptyState icon={Layers}>{query ? 'No matches' : 'No memories yet'}</EmptyState>}
    {records.map(record => <button className="memory-row" key={record.id} onClick={() => onOpen(record.id)}><span><span className="record-kind">{record.kind}{record.expiresAt && new Date(record.expiresAt) <= new Date() ? ' · expired' : ''}</span><strong>{record.title}</strong><span className="memory-preview">{record.content}</span></span><ChevronRight size={17} /></button>)}
  </>
}
