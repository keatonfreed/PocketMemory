import { useEffect, useRef, useState } from 'react'
import { BookOpen, CircleDot, Clock3, Settings2, ArrowLeft } from 'lucide-react'
import { useMemory, initialize, signIn, setConsent } from './state/memory'
import { startLifecycle } from './lib/lifecycle'
import { native } from './lib/storage'
import Timeline, { Entry } from './pages/Timeline'
import Knowledge from './pages/Knowledge'
import Editor from './pages/Editor'
import Reminders from './pages/Reminders'
import Settings from './pages/Settings'
import Policy from './components/ui/Policy'
import AsyncButton from './components/ui/AsyncButton'
import ErrorBoundary from './components/ui/ErrorBoundary'

const tabs = [{ id: 'home', title: 'Home', icon: CircleDot }, { id: 'memory', title: 'Memory', icon: BookOpen }, { id: 'reminders', title: 'Reminders', icon: Clock3 }, { id: 'settings', title: 'Settings', icon: Settings2 }]
function Application() {
  const { ready, user, data, error, syncing, needsSignIn } = useMemory()
  const [tab, setTab] = useState('home'), [detail, setDetail] = useState(null), [policy, setPolicy] = useState(location.pathname === '/privacy' ? 'privacy' : location.pathname === '/terms' ? 'terms' : null), [consentDismissed, setConsentDismissed] = useState(false)
  const scroller = useRef(null)
  useEffect(() => {
    void initialize()
    let stop, cancelled = false
    startLifecycle(id => { setTab('home'); setDetail(id ? { type: 'entry', id } : null) }).then(cleanup => { if (cancelled) cleanup(); else stop = cleanup }).catch(e => useMemory.setState({ error: e.message }))
    return () => { cancelled = true; stop?.() }
  }, [])
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }) }, [tab, detail?.id, policy])
  const openMemory = id => setDetail({ type: 'knowledge', id })
  const openEntry = id => setDetail({ type: 'entry', id })
  if (!ready) return <div className="launch"><span className="wordmark">Pocket Memory</span><p>Opening your memory…</p></div>
  if (policy) return <main className="public-page"><button className="text-button" onClick={() => setPolicy(null)}><ArrowLeft size={18} /> Back</button><Policy terms={policy === 'terms'} /></main>
  if (!user) return <main className="welcome"><span className="wordmark">Pocket Memory</span><div><div className="brand-mark"><CircleDot size={38} /></div><h1>A little less<br />to keep in your head.</h1><p>Tell it what matters. Come back to your words, find what changed, and get help with what’s next.</p></div>{native ? <AsyncButton className="apple-signin" onClick={signIn}><span aria-hidden="true"></span> Sign in with Apple</AsyncButton> : <p className="hint">Pocket Memory is an iPhone app.</p>}<p className="hint">Your memory stays with your account. AI processing is optional and explained before you use it.</p>{error && <p role="alert" className="error">{error}</p>}<footer><button onClick={() => setPolicy('privacy')}>Privacy</button><button onClick={() => setPolicy('terms')}>Terms</button><a href="mailto:keaton@mfreed.com">Support</a></footer></main>
  return <div className="app-frame">
    <div className="sync-line" aria-live="polite">{!useMemory.getState().online ? 'Offline · saved on this phone' : syncing ? 'Syncing' : data.outbox.length ? `${data.outbox.length} pending` : ''}</div>
    <main className="app-scroll" ref={scroller}>
      {needsSignIn && <section className="notice"><p>Sign in again to continue syncing. Your local entries are safe.</p><AsyncButton className="apple-signin" onClick={signIn}>Sign in with Apple</AsyncButton></section>}
      {error && <p className="error global-error" role="alert">{error}</p>}
      {!data.consent && !consentDismissed && tab === 'home' && !detail && <section className="consent"><h2>Let Pocket Memory help you remember</h2><p>OpenAI processes your entries and relevant memories to answer and organize information. TypeSafe’s JEV processes entries and recent context for classification.</p><p>You can pause this anytime in Settings. Research is off unless you enable it for a request.</p><button className="text-button" onClick={() => setPolicy('privacy')}>Read the privacy policy</button><div className="consent-actions"><AsyncButton className="primary-button" onClick={() => setConsent(true)}>Allow AI processing</AsyncButton><button className="text-button" onClick={() => setConsentDismissed(true)}>Not now</button></div></section>}
      {detail?.type === 'knowledge' ? <Editor key={detail.id} id={detail.id} onClose={() => setDetail(null)} onEntry={openEntry} /> : detail?.type === 'entry' ? <><button className="text-button" onClick={() => setDetail(null)}><ArrowLeft size={18} /> Back</button>{data.entries[detail.id] ? <Entry entry={data.entries[detail.id]} onMemory={openMemory} onEntry={openEntry} expanded /> : <p className="empty">This original entry is no longer available.</p>}</> : tab === 'home' ? <Timeline onMemory={openMemory} onEntry={openEntry} /> : tab === 'memory' ? <Knowledge onOpen={openMemory} /> : tab === 'reminders' ? <Reminders onEntry={openEntry} /> : <Settings />}
    </main>
    {!detail && <nav className="bottom-nav" aria-label="Main navigation">{tabs.map(({ id, title, icon: Icon }) => <button key={id} className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); setDetail(null) }}><Icon size={23} strokeWidth={1.7} /><span>{title}</span></button>)}</nav>}
  </div>
}
export default function App() { return <ErrorBoundary><Application /></ErrorBoundary> }
