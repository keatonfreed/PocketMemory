import { App } from '@capacitor/app'
import { Keyboard } from '@capacitor/keyboard'
import { Network } from '@capacitor/network'
import { LocalNotifications } from '@capacitor/local-notifications'
import { softHaptic } from './haptics'
import { native } from './storage'
import { useMemory, sync } from '../state/memory'
export async function startLifecycle(onReminder) {
  const listeners = []
  const change = status => { useMemory.setState({ online: status.connected }); if (status.connected) void sync({ passive: true }) }
  change(await Network.getStatus())
  listeners.push(await Network.addListener('networkStatusChange', change))
  if (native) {
    listeners.push(await App.addListener('appStateChange', ({ isActive }) => { if (isActive) void sync({ passive: true }) }))
    const showKeyboard = ({ keyboardHeight }) => {
      keyboardWasOpen = true
      pendingClamp = false
      clearTimeout(restoreTimer)
      document.body.style.setProperty('--keyboard-height', `${keyboardHeight}px`)
      document.body.classList.add('keyboard-open')
      requestAnimationFrame(() => {
        const field = document.activeElement
        if (!field?.matches('input, textarea')) return
        const bounds = field.getBoundingClientRect(), keyboardTop = window.innerHeight - keyboardHeight
        if (field.matches('.editor-content')) {
          // A document can be taller than the viewport: reveal its top, not its bottom.
          const pane = field.closest('.app-scroll')
          if (pane && bounds.top > keyboardTop - 80) pane.scrollTop += bounds.top - keyboardTop + 100
        } else if (bounds.bottom > keyboardTop) field.scrollIntoView({ block: 'nearest', behavior: 'instant' })
      })
    }
    let keyboardWasOpen = false, restoreTimer, touching = false, pendingClamp = false
    const clampScroll = () => {
      if (touching) { pendingClamp = true; return }
      pendingClamp = false
      document.querySelectorAll('.app-scroll').forEach(pane => {
        const max = Math.max(0, pane.scrollHeight - pane.clientHeight)
        const top = Math.min(max, Math.max(0, pane.scrollTop))
        if (Math.abs(pane.scrollTop - top) > 1) pane.scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
      })
      if (window.scrollX || window.scrollY) window.scrollTo({ top: 0, left: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    }
    const hideKeyboard = () => {
      document.body.classList.remove('keyboard-open')
      document.body.style.removeProperty('--keyboard-height')
      if (keyboardWasOpen) {
        requestAnimationFrame(clampScroll)
        clearTimeout(restoreTimer)
        restoreTimer = setTimeout(clampScroll, 320)
        keyboardWasOpen = false
      }
    }
    listeners.push(await Keyboard.addListener('keyboardWillShow', showKeyboard))
    listeners.push(await Keyboard.addListener('keyboardWillHide', hideKeyboard))
    listeners.push(await Keyboard.addListener('keyboardDidHide', clampScroll))
    // Observe deliberate swipes; leave scrolling and momentum to the native web view.
    let gesture
    const startTouch = e => {
      touching = e.touches.length > 0
      const touch = e.touches[0]
      gesture = touch && { x: touch.clientX, y: touch.clientY, target: e.target, dismissed: false }
    }
    const moveTouch = e => {
      const touch = e.touches[0]
      if (!gesture || !touch || gesture.dismissed || gesture.target.closest('input, [data-no-keyboard-dismiss]')) return
      if (Math.abs(touch.clientY - gesture.y) > 56 && Math.abs(touch.clientX - gesture.x) < 35 && document.body.classList.contains('keyboard-open')) {
        gesture.dismissed = true
        document.activeElement?.blur()
        void Keyboard.hide().catch(() => {})
        softHaptic()
      }
    }
    const endTouch = e => {
      touching = e.touches.length > 0
      if (touching) return
      gesture = null
      if (pendingClamp) requestAnimationFrame(clampScroll)
    }
    const clickFeedback = e => {
      if (e.target.closest('button:not(:disabled), input[type="checkbox"]')) softHaptic()
    }
    document.addEventListener('touchstart', startTouch, { passive: true })
    document.addEventListener('touchmove', moveTouch, { passive: true })
    document.addEventListener('touchend', endTouch, { passive: true })
    document.addEventListener('touchcancel', endTouch, { passive: true })
    document.addEventListener('click', clickFeedback)
    listeners.push({ remove: () => {
      document.removeEventListener('touchstart', startTouch)
      document.removeEventListener('touchmove', moveTouch)
      document.removeEventListener('touchend', endTouch)
      document.removeEventListener('touchcancel', endTouch)
      document.removeEventListener('click', clickFeedback)
      touching = false
      hideKeyboard()
      clearTimeout(restoreTimer)
    } })
    listeners.push(await LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => onReminder(notification.extra?.entryId)))
  }
  return () => listeners.forEach(listener => listener.remove())
}
