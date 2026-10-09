import { AppLauncher } from '@capacitor/app-launcher'
import { native } from './storage'
export const supportEmail = 'keaton@mfreed.com'
export async function contactSupport() {
  const url = `mailto:${supportEmail}?subject=${encodeURIComponent('Pocket Memory support')}`
  if (!native) { window.location.href = url; return }
  try {
    const result = await AppLauncher.openUrl({ url })
    if (result.completed) return
  } catch { /* A mail app may not be installed or configured. */ }
  window.alert(`Contact ${supportEmail} for Pocket Memory support.`)
}
