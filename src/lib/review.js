import { Capacitor } from '@capacitor/core'
import { InAppReview } from '@capacitor-community/in-app-review'
import { advanceReviewProgress, shouldRequestReview } from '../../shared/review'
const key = 'pocket-review-progress-v1'
let timer
export function recordSentMessage() {
  if (!Capacitor.isNativePlatform()) return
  try {
    const progress = advanceReviewProgress(JSON.parse(localStorage.getItem(key) || '{}'))
    localStorage.setItem(key, JSON.stringify(progress))
    if (!shouldRequestReview(progress)) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      try {
        const current = JSON.parse(localStorage.getItem(key) || '{}')
        if (!shouldRequestReview(current) || document.visibilityState !== 'visible' || !Capacitor.isPluginAvailable('InAppReview')) return
        // Store the attempt before invoking the OS; it decides whether to show the prompt.
        localStorage.setItem(key, JSON.stringify({ ...current, requested: true }))
        void InAppReview.requestReview().catch(() => {})
      } catch { /* Reviews never interrupt saving or sending. */ }
    }, 1400)
  } catch { /* Unavailable local preferences must not block a message. */ }
}
