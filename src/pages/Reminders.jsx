import { Bell, Check } from 'lucide-react'
import { useMemory, enqueue } from '../state/memory'
import { enableNotifications } from '../lib/notifications'
import AsyncButton from '../components/ui/AsyncButton'
import { effectiveReminders } from '../../shared/reminders'
import { formatDate } from './Timeline'
export default function Reminders({ onEntry }) {
  const data = useMemory(s => s.data)
  const items = Object.values(effectiveReminders(data)).sort((a, b) => Number(a.completed) - Number(b.completed) || new Date(a.dueAt) - new Date(b.dueAt))
  return <><header className="page-heading"><span className="wordmark">Keep track</span><h1>Reminders</h1></header>
    <AsyncButton className="secondary-button" onClick={() => enableNotifications(effectiveReminders(data))}><Bell size={17} /> Enable notifications</AsyncButton>
    <p className="hint">Ask Pocket Memory to remind you and include a time. The next 60 future reminders are scheduled on this iPhone after sync; opening the app refreshes them.</p>
    {!items.length && <p className="empty">No reminders yet.</p>}
    {items.map(item => <div key={item.id} className={`reminder-row ${item.completed ? 'completed' : ''}`}><AsyncButton className="check-button" aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'} onClick={() => enqueue('completeReminder', { id: item.id, completed: !item.completed })}>{item.completed && <Check size={17} />}</AsyncButton><div><strong>{item.title}</strong><p className={!item.completed && new Date(item.dueAt) < new Date() ? 'overdue' : 'muted'}>{formatDate(item.dueAt)}</p><div className="row-actions">{item.sourceId && <button className="text-button" onClick={() => onEntry(item.sourceId)}>Original entry</button>}<AsyncButton className="text-button danger" onClick={async () => { if (window.confirm('Delete this reminder?')) await enqueue('delete', { type: 'reminder', id: item.id }) }}>Delete</AsyncButton></div></div></div>)}
  </>
}
