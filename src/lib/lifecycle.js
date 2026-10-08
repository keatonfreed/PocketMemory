import { App } from '@capacitor/app'
import { Keyboard } from '@capacitor/keyboard'
import { Network } from '@capacitor/network'
import { LocalNotifications } from '@capacitor/local-notifications'
import { native } from './storage'
import { useMemory, sync } from '../state/memory'
export async function startLifecycle(onReminder) {
  const listeners = []
  const change = status => { useMemory.setState({ online: status.connected }); if (status.connected) void sync() }
  change(await Network.getStatus())
  listeners.push(await Network.addListener('networkStatusChange', change))
  if (native) {
    listeners.push(await App.addListener('appStateChange', ({ isActive }) => { if (isActive) void sync() }))
    listeners.push(await Keyboard.addListener('keyboardWillShow', () => document.body.classList.add('keyboard-open')))
    listeners.push(await Keyboard.addListener('keyboardWillHide', () => document.body.classList.remove('keyboard-open')))
    listeners.push(await LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => onReminder(notification.extra?.entryId)))
  }
  return () => listeners.forEach(listener => listener.remove())
}
