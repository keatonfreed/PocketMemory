import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, CalendarDays, Clock3 } from 'lucide-react'
import { useMemory, enqueue } from '../state/memory'
import { effectiveReminders } from '../../shared/reminders'
import Feedback from '../components/ui/Feedback'
const pad = value => String(value).padStart(2, '0')
function localDateTime(value) {
  const date = new Date(value)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
const ReminderEditor = forwardRef(function ReminderEditor({ id, onClose }, ref) {
  const data = useMemory(s => s.data), item = effectiveReminders(data)[id]
  const [title, setTitle] = useState(item?.title || ''), [date, setDate] = useState(() => item ? localDateTime(item.dueAt).split('T')[0] : ''), [time, setTime] = useState(() => item ? localDateTime(item.dueAt).split('T')[1] : '')
  const when = `${date}T${time}`
  const [error, setError] = useState(''), [saving, setSaving] = useState(false)
  const field = useRef(null), pendingSave = useRef(null)
  useLayoutEffect(() => {
    if (!field.current) return
    field.current.style.height = '0px'
    field.current.style.height = `${Math.max(86, field.current.scrollHeight)}px`
  }, [title])
  async function save() {
    if (pendingSave.current) return pendingSave.current
    if (!item) return true
    const due = new Date(when)
    if (!title.trim() || !Number.isFinite(due.getTime()) || localDateTime(due) !== when) { setError('Add reminder text and choose a valid date and time.'); return false }
    if (title.trim() === item.title && when === localDateTime(item.dueAt)) return true
    setSaving(true); setError('')
    const dueAt = when === localDateTime(item.dueAt) ? item.dueAt : due.toISOString()
    const job = (async () => {
      try { await enqueue('editReminder', { id, title: title.trim(), dueAt }); return true }
      catch (e) { setError(e.message); return false }
      finally { setSaving(false); pendingSave.current = null }
    })()
    pendingSave.current = job
    return job
  }
  async function saveAndClose() { if (await save()) onClose() }
  useImperativeHandle(ref, () => ({ save, saveAndClose }))
  if (!item) return <><button className="text-button" onClick={onClose}><ArrowLeft size={18} /> Back</button><p className="empty">This reminder is no longer available.</p></>
  const operation = data.outbox.find(op => op.action === 'editReminder' && op.data.id === id && op.error)
  return <div className="reminder-editor"><button className="text-button" disabled={saving} onClick={() => void saveAndClose()}><ArrowLeft size={18} /> Back</button><header className="page-heading"><h1>Reminder</h1></header>
    <form onSubmit={e => e.preventDefault()}><textarea ref={field} className="reminder-text" aria-label="Reminder text" value={title} onChange={e => setTitle(e.target.value)} maxLength={160} rows={2} required placeholder="What would you like to remember?" />
      <div className="reminder-schedule compact-pickers"><label className="reminder-field"><span><CalendarDays size={15} /> Date</span><input type="date" value={date} onChange={e => setDate(e.target.value)} required /></label><label className="reminder-field"><span><Clock3 size={15} /> Time</span><input type="time" value={time} onChange={e => setTime(e.target.value)} required /></label></div>
      <button type="button" className="primary-button wide reminder-save" disabled={saving || !title.trim() || !date || !time} onClick={() => void saveAndClose()}>Save reminder</button>
    </form>{error && <Feedback title="Couldn’t save reminder">{error}</Feedback>}{operation && <p className="error" role="alert">{operation.error}</p>}
  </div>
})
export default ReminderEditor
