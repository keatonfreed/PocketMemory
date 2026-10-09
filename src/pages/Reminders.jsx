import { useEffect, useState } from 'react'
import EmptyState from '../components/ui/EmptyState'
import { Bell, Trash2 } from 'lucide-react'
import { useMemory, enqueue } from '../state/memory'
import NotificationPrompt from '../components/app/NotificationPrompt'
import AsyncButton from '../components/ui/AsyncButton'
import { effectiveReminders } from '../../shared/reminders'
export function reminderTime(value, now) {
  const date = new Date(value), today = new Date(now), tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const day = date.toDateString() === today.toDateString() ? 'Today' : date.toDateString() === tomorrow.toDateString() ? 'Tomorrow' : date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) })
  return `${day} · ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}
export default function Reminders({ onOpen }) {
  const data = useMemory(s => s.data), [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer) }, [])
  const items = Object.values(effectiveReminders(data)).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
  const upcoming = items.filter(item => new Date(item.dueAt).getTime() > now)
  const past = items.filter(item => new Date(item.dueAt).getTime() <= now).reverse()
  function row(item) {
    const isPast = new Date(item.dueAt).getTime() <= now
    return <div key={item.id} className={`reminder-row ${isPast ? 'is-past' : ''}`}><button className="reminder-details" onClick={() => onOpen(item.id)} aria-label={`Edit ${item.title}`}><strong>{item.title}</strong><time dateTime={item.dueAt}>{reminderTime(item.dueAt, now)}</time></button><AsyncButton className="reminder-delete" aria-label={`Delete ${item.title}`} onClick={async () => { if (window.confirm('Delete this reminder?')) await enqueue('delete', { type: 'reminder', id: item.id }) }}><Trash2 size={16} /></AsyncButton></div>
  }
  return <><header className="page-heading"><h1>Reminders</h1></header>
    <NotificationPrompt>{!upcoming.length && <div className="reminder-empty"><EmptyState icon={Bell}>{items.length ? 'You’re all caught up' : 'No reminders yet'}</EmptyState></div>}</NotificationPrompt>
    {upcoming.map(row)}
    {!!past.length && <section className="past-reminders"><h2>Past</h2>{past.map(row)}</section>}
  </>
}
