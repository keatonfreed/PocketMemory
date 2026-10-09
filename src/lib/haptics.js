import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
let lastFeedback = 0
export function softHaptic() {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('Haptics') || Date.now() - lastFeedback < 140) return
  lastFeedback = Date.now()
  void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
}
