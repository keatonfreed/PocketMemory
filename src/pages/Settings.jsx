import { useState } from 'react'
import { useMemory, setConsent, sync, signOut, deleteAccount, retry, discardOperation } from '../state/memory'
import { exportData } from '../lib/export'
import AsyncButton from '../components/ui/AsyncButton'
import Policy from '../components/ui/Policy'
export default function Settings() {
  const { user, data, syncing, online } = useMemory(), [policy, setPolicy] = useState(null)
  if (policy) return <><button className="text-button" onClick={() => setPolicy(null)}>Back to Settings</button><Policy terms={policy === 'terms'} /></>
  const failures = data.outbox.filter(o => o.error)
  return <><header className="page-heading"><span className="wordmark">Pocket Memory</span><h1>Settings</h1></header>
    <section className="settings-section"><h2>Account</h2><p>{user.name || 'Signed in with Apple'}</p><p className="muted">{user.email}</p><p className="hint">{online ? syncing ? 'Syncing…' : `${data.outbox.length} pending updates` : 'Offline — saved on this phone'}</p><AsyncButton className="text-button" disabled={syncing} onClick={sync}>Sync now</AsyncButton></section>
    <section className="settings-section"><h2>AI processing</h2><p>OpenAI receives your entry and relevant memories to answer and organize information. TypeSafe receives your entry and recent context for classification. Both process information on their servers.</p><p className="hint">Turning this off pauses new processing. Your history and memories remain available. Research is a separate choice for each request.</p><AsyncButton className="secondary-button" onClick={() => setConsent(!data.consent)}>{data.consent ? 'Pause AI processing' : 'Allow AI processing'}</AsyncButton></section>
    {!!failures.length && <section className="settings-section"><h2>Updates needing attention</h2>{failures.map(o => <div key={o.id} className="pending-error"><strong>{o.action === 'capture' ? o.data.text.slice(0, 100) : o.data.title || o.action}</strong><p className="error">{o.error}</p>{o.conflict ? <p className="hint">Open this memory to compare your draft with the latest version.</p> : <AsyncButton className="text-button" onClick={() => retry(o.id)}>Retry</AsyncButton>}<AsyncButton className="text-button" onClick={() => discardOperation(o.id)}>Stop retrying</AsyncButton></div>)}</section>}
    <section className="settings-section"><h2>Your information</h2><AsyncButton className="text-button" onClick={() => exportData(data)}>Export history, memories, and versions</AsyncButton><button className="text-button" onClick={() => setPolicy('privacy')}>Privacy policy</button><button className="text-button" onClick={() => setPolicy('terms')}>Terms of use</button><a className="text-button" href="mailto:keaton@mfreed.com">Contact support</a></section>
    <section className="settings-section"><AsyncButton className="text-button" disabled={syncing} onClick={async () => {
      if ((data.outbox.length || Object.values(data.drafts).some(value => typeof value === 'string' ? value.trim() : Boolean(value))) && !window.confirm('Signing out clears this phone’s unsynced entries and drafts. Export first if you need them. Continue?')) return
      await signOut()
    }}>Sign out</AsyncButton><AsyncButton className="text-button danger" disabled={syncing} onClick={async () => {
      if (!window.confirm('Permanently delete your account, history, memories, versions, and reminders? You will confirm your identity with Apple first. This cannot be undone.')) return
      await deleteAccount()
    }}>Delete account and all data</AsyncButton></section>
  </>
}
