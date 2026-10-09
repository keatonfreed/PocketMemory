import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, CalendarDays, Clock3 } from 'lucide-react'
import { useMemory, enqueue } from '../state/memory'
import { effectiveReminders, nextReminderAt } from '../../shared/reminders'
import Feedback from '../components/ui/Feedback'
const pad = value => String(value).padStart(2, '0')
function localDateTime(value) {
  const date = new Date(value)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
const ReminderEditor = forwardRef(function ReminderEditor({ id, onClose }, ref) {
  const data = useMemory(s => s.data), item = effectiveReminders(data)[id]
  const [displayedAt] = useState(() => item ? nextReminderAt(item) : null)
  const [body, setBody] = useState(item?.body || ''), [repeat, setRepeat] = useState(item?.repeat || '')
  const [title, setTitle] = useState(item?.title || ''), [date, setDate] = useState(() => item ? localDateTime(displayedAt).split('T')[0] : ''), [time, setTime] = useState(() => item ? localDateTime(displayedAt).split('T')[1] : '')
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
    if (title.trim() === item.title && body.trim() === (item.body || '') && (repeat || null) === (item.repeat || null) && when === localDateTime(displayedAt)) return true
    setSaving(true); setError('')
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const dueAt = repeat ? nextReminderAt({ dueAt: due.toISOString(), repeat, timezone }, Date.now(), false) : due.toISOString()
    const job = (async () => {
      try { await enqueue('editReminder', { id, title: title.trim(), body: body.trim(), dueAt, repeat: repeat || null, timezone }); return true }
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
    <form onSubmit={e => e.preventDefault()}><textarea ref={field} className="reminder-text" aria-label="Notification title" value={title} onChange={e => setTitle(e.target.value)} maxLength={160} rows={2} required placeholder="Notification title" />
      <label className="reminder-body-field">Notification message<textarea value={body} onChange={e => setBody(e.target.value)} maxLength={500} rows={3} placeholder="A little more detail…" /></label>
      <label className="reminder-repeat-field">Repeat<select value={repeat} onChange={e => setRepeat(e.target.value)}><option value="">Never</option><option value="daily">Every day</option><option value="weekly">Every week</option></select></label>
      <div className="reminder-schedule compact-pickers">{!repeat ? <label className="reminder-field"><span><CalendarDays size={15} /> Date</span><input type="date" value={date} onChange={e => setDate(e.target.value)} required /></label> : repeat === 'weekly' ? <label className="reminder-field"><span><CalendarDays size={15} /> Day</span><select value={new Date(`${date}T12:00`).getDay()} onChange={e => { const anchor = new Date(); anchor.setDate(anchor.getDate() + (Number(e.target.value) - anchor.getDay() + 7) % 7); setDate(localDateTime(anchor).split('T')[0]) }}>{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label> : null}<label className="reminder-field"><span><Clock3 size={15} /> Time</span><input type="time" value={time} onChange={e => setTime(e.target.value)} required /></label></div>
      <button type="button" className="primary-button wide reminder-save" disabled={saving || !title.trim() || !date || !time} onClick={() => void saveAndClose()}>Save reminder</button>
    </form>{error && <Feedback title="Couldn’t save reminder">{error}</Feedback>}{operation && <p className="error" role="alert">{operation.error}</p>}
  </div>
})
export default ReminderEditor
