import { useEffect, useRef, useState } from 'react'
import { Bell, BellOff, ArrowUpRight } from 'lucide-react'
import { App } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import { NativeSettings, IOSSettings } from 'capacitor-native-settings'
import { enableNotifications, reconcileNotifications } from '../../lib/notifications'
import { useMemory } from '../../state/memory'
import { effectiveReminders } from '../../../shared/reminders'
import { notificationState } from '../../../shared/interaction'
import { Loading } from '../ui/Feedback'
export default function NotificationPrompt({ children }) {
  const [permission, setPermission] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const mounted = useRef(true)
  async function refresh() {
    try {
      const { display } = await LocalNotifications.checkPermissions()
      if (mounted.current) { setPermission(display); setError('') }
      if (display === 'granted') await reconcileNotifications(effectiveReminders(useMemory.getState().data))
    } catch { if (mounted.current) setError('Couldn’t update notifications. Try again.') }
  }
  useEffect(() => {
    mounted.current = true; void refresh()
    let listener
    void App.addListener('appStateChange', ({ isActive }) => { if (isActive) void refresh() }).then(handle => { if (mounted.current) listener = handle; else void handle.remove() }).catch(() => { if (mounted.current) setError('Reopen Reminders after changing notification settings.') })
    return () => { mounted.current = false; void listener?.remove() }
  }, [])
  const state = notificationState(permission)
  async function enable() {
    setBusy(true); setError('')
    try {
      if (state === 'settings') {
        const result = await NativeSettings.openIOS({ option: IOSSettings.AppNotification })
        if (!result.status) setError('Open iPhone Settings → Pocket Memory → Notifications.')
      } else {
        await enableNotifications(effectiveReminders(useMemory.getState().data))
        await refresh()
      }
    } catch {
      // Permission denial is a normal state, not an error. Recheck even if scheduling failed.
      const result = await LocalNotifications.checkPermissions().catch(() => null)
      if (mounted.current) { if (result) setPermission(result.display); setError('Couldn’t update notifications. Try again.') }
    } finally { if (mounted.current) setBusy(false) }
  }
  if (permission === null) return <div className="notification-loading">{error ? <button className="text-button" onClick={refresh}>{error}</button> : <Loading label="Checking notifications…" />}</div>
  if (state === 'enabled') return <>{error && <button className="text-button" onClick={refresh}>Retry scheduling reminders</button>}{children}</>
  return <section className="notification-invite"><div className="notification-symbol">{state === 'settings' ? <BellOff size={27} /> : <Bell size={27} />}</div><h2>{state === 'settings' ? 'Whenever you’re ready.' : 'A little nudge, right on time.'}</h2><p>{state === 'settings' ? 'You can turn on reminders in iPhone Settings.' : 'Allow notifications so your reminders can reach you.'}</p><button className="primary-button" disabled={busy} onClick={enable}>{busy ? <Loading label="One moment…" /> : state === 'settings' ? <>Open Settings <ArrowUpRight size={16} /></> : 'Enable notifications'}</button>{error && <p className="inline-notice" role="status">{error}</p>}</section>
}
