import { isUserCancellation } from '../../../shared/interaction'
import { useState } from 'react'
import Feedback, { Loading } from './Feedback'
export default function AsyncButton({ onClick, beforeAction, children, className = '', disabled = false, busyLabel = 'Please wait…', errorTitle = 'Couldn’t complete that', ...props }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  return <><button {...props} className={className} disabled={busy || disabled} aria-busy={busy} onClick={async () => {
    if (beforeAction && !beforeAction()) return
    setBusy(true); setError('')
    try { await onClick() } catch (e) { if (!isUserCancellation(e)) setError(e.message || 'Please try again.') } finally { setBusy(false) }
  }}>{busy ? <Loading label={busyLabel} /> : children}</button>{error && <Feedback title={errorTitle}>{error}</Feedback>}</>
}
