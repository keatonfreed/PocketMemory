export function appStoreUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'apps.apple.com' && /\/id\d+(?:\/|$)/.test(url.pathname) ? url.href : null
  } catch { return null }
}
