import { useEffect, useRef, useState } from 'react'
import { shallow } from 'zustand/shallow'
import { Brain, UserRound, ArrowLeft, Plus } from 'lucide-react'
import { useMemory, initialize, signIn, prepareReminderDraft, prepareMemoryDraft } from './state/memory'
import { startLifecycle } from './lib/lifecycle'
import { native } from './lib/storage'
import Timeline, { Entry } from './pages/Timeline'
import Knowledge from './pages/Knowledge'
import Editor from './pages/Editor'
import Reminders from './pages/Reminders'
import ReminderEditor from './pages/ReminderEditor'
import Settings from './pages/Settings'
import Policy from './components/ui/Policy'
import AsyncButton from './components/ui/AsyncButton'
import ErrorBoundary from './components/ui/ErrorBoundary'
import Feedback, { Loading } from './components/ui/Feedback'
import Onboarding from './components/app/Onboarding'
import Navigation from './components/app/Navigation'
import Website from './pages/site/Website'
import Screen from './components/app/Screen'
import GettingReady from './components/app/GettingReady'
import './styles/assistant.css'
import { softHaptic } from './lib/haptics'

function Application() {
  const { ready, user, data, error, syncing, needsSignIn, signingIn, preparingSignIn, sessionVersion } = useMemory(s => ({ ready: s.ready, user: s.user, data: s.data, error: s.error, syncing: s.syncing, needsSignIn: s.needsSignIn, signingIn: s.signingIn, preparingSignIn: s.preparingSignIn, sessionVersion: s.sessionVersion }), shallow)
  const [tab, setTab] = useState('home'), [detail, setDetail] = useState(null), [policy, setPolicy] = useState(location.pathname === '/privacy' ? 'privacy' : location.pathname === '/terms' ? 'terms' : null)
  const previousTab = useRef('home'), backSwipe = useRef(null), reminderEditor = useRef(null), memoryEditor = useRef(null), frame = useRef(null)
  const [accountPage, setAccountPage] = useState(null), [focusCapture, setFocusCapture] = useState(false)
  useEffect(() => {
    document.body.classList.add('native-app')
    void initialize()
    let stop, cancelled = false
    startLifecycle(id => { setTab('home'); setDetail(id ? { type: 'entry', id } : null) }).then(cleanup => { if (cancelled) cleanup(); else stop = cleanup }).catch(e => useMemory.setState({ error: e.message }))
    return () => { cancelled = true; stop?.(); document.body.classList.remove('native-app') }
  }, [])
  useEffect(() => {
    if (!sessionVersion) return
    setTab('home'); setDetail(null); setAccountPage(null); setPolicy(null); setFocusCapture(false)
    previousTab.current = 'home'
  }, [sessionVersion])
  const routeKey = detail ? `${detail.type}:${detail.id}` : tab === 'settings' ? `account:${accountPage || 'home'}` : tab
  async function leaveReminder(action) {
    if (detail?.type === 'reminder' && reminderEditor.current && !await reminderEditor.current.save()) return
    action()
  }
  function openAccount() { void leaveReminder(() => { previousTab.current = tab; setAccountPage(null); setDetail(null); setTab('settings') }) }
  async function addFromPage() {
    if (tab === 'reminders') await prepareReminderDraft()
    else if (tab === 'memory') await prepareMemoryDraft()
    setFocusCapture(true); setDetail(null); setTab('home')
  }
  function goHome() {
    void leaveReminder(() => {
      if (tab === 'home' && !detail) frame.current?.querySelector('#capture-thought')?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
      else { setTab('home'); setDetail(null) }
    })
  }
  function backFromAccount() { if (accountPage) setAccountPage(null); else setTab(previousTab.current) }
  const openMemory = id => setDetail({ type: 'knowledge', id })
  const openEntry = id => setDetail({ type: 'entry', id })
  if (!ready) return <div className="launch"><Brain size={42} /><Loading label="Opening Pocket Memory…" /></div>
  const policyPage = policy && <main className="public-page"><button className="text-button" onClick={() => setPolicy(null)}><ArrowLeft size={18} /> Back</button><Policy terms={policy === 'terms'} /></main>
  const setupLoading = preparingSignIn || Boolean(user && (signingIn || !data.consent && syncing && !needsSignIn))
  if (!user || setupLoading) return <>{policyPage}<div hidden={Boolean(policy) || setupLoading}>{!user && <Onboarding onPolicy={setPolicy} />}</div>{setupLoading && <GettingReady key="setup" />}</>
  if (!data.consent && !needsSignIn) return <>{policyPage}<div hidden={Boolean(policy)}><Onboarding consentOnly onPolicy={setPolicy} /></div></>
  if (policy) return policyPage
  return <div ref={frame} className="app-frame" onTouchStart={e => {
    const touch = e.touches[0]
    backSwipe.current = (tab === 'settings' && !detail || detail?.type === 'reminder' || detail?.type === 'knowledge') && e.touches.length === 1 && touch.clientX <= 24 ? { x: touch.clientX, y: touch.clientY } : null
  }} onTouchCancel={() => { backSwipe.current = null }} onTouchEnd={e => {
    const start = backSwipe.current, touch = e.changedTouches[0]; backSwipe.current = null
    if (start && touch && touch.clientX - start.x > 90 && Math.abs(touch.clientY - start.y) < 50) { softHaptic(); if (detail?.type === 'reminder') void reminderEditor.current?.saveAndClose(); else if (detail?.type === 'knowledge') void memoryEditor.current?.saveAndClose(); else backFromAccount() }
  }}>
    <header className="app-topbar"><button className="brand-word" onClick={goHome}><Brain size={20} /> Pocket Memory</button><button className={tab === 'settings' ? 'text-button account-back' : 'icon-button'} aria-label={tab === 'settings' ? accountPage ? 'Account' : 'Back' : 'Account'} onClick={tab === 'settings' ? backFromAccount : openAccount}>{tab === 'settings' ? <><ArrowLeft size={18} /><span>{accountPage ? 'Account' : 'Back'}</span></> : <UserRound size={21} />}</button></header>
    <Screen pageKey={routeKey} resetScroll={tab === 'home' && !detail && focusCapture}>
      {needsSignIn && <section className="notice"><p>Sign in again to continue syncing. Your local entries are safe.</p><AsyncButton className="apple-signin" onClick={signIn}>Sign in with Apple</AsyncButton></section>}
      {error && <Feedback title="Couldn’t sync">{error}</Feedback>}
      {detail?.type === 'reminder' ? <ReminderEditor ref={reminderEditor} key={detail.id} id={detail.id} onClose={() => setDetail(null)} /> : detail?.type === 'knowledge' ? <Editor ref={memoryEditor} key={detail.id} id={detail.id} onClose={() => setDetail(null)} onEntry={openEntry} /> : detail?.type === 'entry' ? <><button className="text-button" onClick={() => setDetail(null)}><ArrowLeft size={18} /> Back</button>{data.entries[detail.id] ? <Entry entry={data.entries[detail.id]} onMemory={openMemory} onEntry={openEntry} /> : <p className="empty">This original entry is no longer available.</p>}</> : tab === 'home' ? <Timeline onMemory={openMemory} onEntry={openEntry} focusCapture={focusCapture} /> : tab === 'memory' ? <Knowledge onOpen={openMemory} /> : tab === 'reminders' ? <Reminders onOpen={id => setDetail({ type: 'reminder', id })} /> : <Settings page={accountPage} onPageChange={setAccountPage} />}
    </Screen>
    {!detail && (tab === 'reminders' || tab === 'memory') && <div className="page-add-dock"><AsyncButton className="page-add-button" busyLabel="Opening…" onClick={addFromPage}><Plus size={15} />{tab === 'reminders' ? 'Add reminder' : 'Add to memory'}</AsyncButton></div>}
    {!detail && <Navigation tab={tab} onChange={id => { setFocusCapture(false); setTab(id); setDetail(null) }} />}
  </div>
}
export default function App() { return <ErrorBoundary>{native ? <Application /> : <Website />}</ErrorBoundary> }
