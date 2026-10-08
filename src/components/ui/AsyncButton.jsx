import { useState } from 'react'
export default function AsyncButton({ onClick, children, className = '', disabled = false, ...props }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  return <><button {...props} className={className} disabled={busy || disabled} onClick={async () => {
    setBusy(true); setError('')
    try { await onClick() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }}>{busy ? 'Please wait…' : children}</button>{error && <p className="error" role="alert">{error}</p>}</>
}
