import { LocalNotifications } from '@capacitor/local-notifications'
import { native } from './storage'
import { notificationPlan } from '../../shared/reminders'
let queue = Promise.resolve()
export function reconcileNotifications(reminders) {
  const task = queue.then(async () => {
    if (!native) return
    const permission = await LocalNotifications.checkPermissions()
    if (permission.display !== 'granted') return
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications })
    const notifications = notificationPlan(reminders)
    if (notifications.length) await LocalNotifications.schedule({ notifications })
  })
  queue = task.catch(() => {})
  return task
}
export async function enableNotifications(reminders) {
  if (!native) throw new Error('Notifications are available in the iPhone app.')
  const permission = await LocalNotifications.requestPermissions()
  if (permission.display === 'granted') await reconcileNotifications(reminders)
  return permission.display
}
export async function clearNotifications() {
  await queue
  if (!native) return
  const pending = await LocalNotifications.getPending()
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications })
  await LocalNotifications.removeAllDeliveredNotifications()
}
