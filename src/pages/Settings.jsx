import { ChevronRight, Cloud, Download, Shield, FileText, Mail, LogOut, Trash2, UserRound, RefreshCw, AlertCircle } from 'lucide-react'
import { useMemory, sync, signOut, deleteAccount, retry, discardOperation } from '../state/memory'
import { exportData } from '../lib/export'
import AsyncButton from '../components/ui/AsyncButton'
import Policy from '../components/ui/Policy'
import { contactSupport } from '../lib/support'
export default function Settings({ page, onPageChange: setPage }) {
  const { user, data, syncing, online } = useMemory()
  const failures = data.outbox.filter(o => o.error)
  if (page === 'privacy' || page === 'terms') return <Policy terms={page === 'terms'} />
  if (page === 'data') return <><header className="page-heading data-heading"><h1>Your data</h1></header><div className="settings-group"><div className="settings-row"><Cloud size={22} /><span>{!online ? 'Offline' : syncing ? 'Syncing…' : data.outbox.length ? `${data.outbox.length} pending` : 'Up to date'}</span></div><AsyncButton className="settings-row" disabled={syncing} onClick={sync}><RefreshCw size={19} /><span>Sync now</span></AsyncButton><AsyncButton className="settings-row" onClick={() => exportData(data)}><Download size={20} /><span>Export everything</span></AsyncButton></div>
    {failures.map(o => <section className="pending-error" key={o.id}><h2>{o.data.title || 'Update needs attention'}</h2><p className="error">{o.error}</p>{!o.conflict && <AsyncButton className="text-button" onClick={() => retry(o.id)}>Retry</AsyncButton>}<AsyncButton className="text-button" onClick={() => discardOperation(o.id)}>Stop retrying</AsyncButton></section>)}
    <div className="settings-group"><AsyncButton className="settings-row danger" disabled={syncing} onClick={async () => {
      if (!window.confirm('Permanently delete your account and all its data? You’ll confirm with Apple. This cannot be undone.')) return
      await deleteAccount()
    }}><Trash2 size={20} /><span>Delete account</span></AsyncButton></div></>
  const row = (Icon, title, destination) => <button className="settings-row" onClick={() => setPage(destination)}><Icon size={20} /><span>{title}</span><ChevronRight size={16} /></button>
  return <><div className="account-card"><div className="account-avatar"><UserRound size={29} /></div><h2>{user.name || 'Your account'}</h2><p>{user.email}</p><span className="account-provider"> Signed in with Apple</span></div>
    <div className="settings-group">{row(failures.length ? AlertCircle : Download, failures.length ? `Your data · ${failures.length} pending issues` : 'Your data', 'data')}</div>
    <div className="settings-group">{row(Shield, 'Privacy', 'privacy')}{row(FileText, 'Terms', 'terms')}<AsyncButton className="settings-row" onClick={contactSupport}><Mail size={20} /><span>Contact support</span><ChevronRight size={16} /></AsyncButton></div>
    <div className="settings-group"><AsyncButton className="settings-row" disabled={syncing} onClick={async () => {
      if ((data.outbox.length || Object.values(data.drafts).some(value => typeof value === 'string' ? value.trim() : Boolean(value))) && !window.confirm('Sign out and clear this phone’s unsynced entries and drafts? Export first if you need them.')) return
      await signOut()
    }}><LogOut size={20} /><span>Sign out</span></AsyncButton></div>
  </>
}
