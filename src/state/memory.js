import { create } from 'zustand'
import { emptyState, applySync } from '../../shared/contracts'
import { readState, writeState, readSession, writeSession, removeSession, removeState, native } from '../lib/storage'
import { request, setToken } from '../lib/api'
import { reconcileNotifications, clearNotifications } from '../lib/notifications'
import { effectiveReminders } from '../../shared/reminders'
import { SocialLogin } from '@capgo/capacitor-social-login'
let writes = Promise.resolve(), syncing = false, authenticating = false, epoch = 0, retryTimer, syncFailures = 0
export const useMemory = create(() => ({ ready: false, signingIn: false, preparingSignIn: false, user: null, data: emptyState(), syncing: false, error: null, online: navigator.onLine, needsSignIn: false }))
function update(fn) {
  const generation = epoch
  const job = writes.then(async () => {
    const current = useMemory.getState()
    if (!current.user || generation !== epoch) throw new Error('Account changed')
    const data = fn(current.data)
    await writeState(current.user.id, data)
    if (generation === epoch) useMemory.setState({ data })
  })
  writes = job.catch(() => {})
  return job
}
export async function initialize() {
  try {
    const session = await readSession()
    if (session?.token && session?.user) {
      setToken(session.token)
      const data = await readState(session.user.id)
      if (data && data.schema !== 1) throw new Error('This local database needs a newer app version.')
      useMemory.setState({ user: session.user, data: data || emptyState() })
    }
    useMemory.setState({ ready: true })
    if (useMemory.getState().user) void sync()
  } catch (error) { useMemory.setState({ ready: true, error: error.message }) }
}
export async function signIn({ expectedUserId, skipSync = false, allowAI = false } = {}) {
  if (authenticating) throw new Error('Sign-in is already in progress.')
  authenticating = true
  useMemory.setState({ signingIn: true })
  try {
    await authenticate(expectedUserId)
    if (allowAI) await setConsent(true)
  }
  finally { authenticating = false; useMemory.setState({ signingIn: false, preparingSignIn: false }) }
  if (!skipSync) await sync()
}
async function authenticate(expectedUserId) {
  if (syncing) throw new Error('Please wait for the current sync to finish.')
  if (!native) throw new Error('Use Sign in with Apple in the iPhone app.')
  await SocialLogin.initialize({ apple: { redirectUrl: '', useProperTokenExchange: true } })
  const nonce = crypto.randomUUID() + crypto.randomUUID()
  const { result } = await SocialLogin.login({ provider: 'apple', options: { scopes: ['email', 'name'], nonce } })
  useMemory.setState({ preparingSignIn: true })
  let session
  try {
    session = await request('/api/session', { method: 'POST', data: { code: result.authorizationCode, nonce, firstName: result.profile.givenName, lastName: result.profile.familyName } })
  } finally {
    // The plugin's own identity-token cache is not needed; our session lives in Keychain.
    await SocialLogin.logout({ provider: 'apple' }).catch(() => {})
  }
  if (expectedUserId && session.user.id !== expectedUserId) {
    await request('/api/auth/sign-out', { method: 'POST', data: {}, authToken: session.token })
    throw new Error('Use the same Apple account to confirm deletion.')
  }
  epoch++
  await writes
  await writeSession(session)
  setToken(session.token)
  const data = await readState(session.user.id)
  useMemory.setState({ user: session.user, data: data || emptyState(), needsSignIn: false, error: null })
}
export async function signOut({ deleted = false } = {}) {
  if (syncing) throw new Error('Wait for syncing to finish before signing out.')
  const current = useMemory.getState()
  if (!deleted) await request('/api/auth/sign-out', { method: 'POST', data: {} })
  epoch++
  clearTimeout(retryTimer)
  await writes
  await clearNotifications()
  await removeState(current.user.id)
  await removeSession()
  setToken(null)
  useMemory.setState({ user: null, data: emptyState(), error: null, needsSignIn: false })
}
export async function deleteAccount() {
  if (syncing) throw new Error('Wait for syncing to finish before deleting your account.')
  // Better Auth requires a fresh session; native reauthentication provides it.
  await signIn({ expectedUserId: useMemory.getState().user.id, skipSync: true })
  await request('/api/auth/delete-user', { method: 'POST', data: {} })
  await signOut({ deleted: true })
}
export async function setConsent(consent) {
  await request('/api/account', { method: 'POST', data: { consent } })
  await update(data => ({ ...data, consent }))
  if (consent) void sync()
}
export async function prepareReminderDraft() {
  await update(data => data.drafts.composer?.trim() ? data : { ...data, drafts: { ...data.drafts, composer: 'Remind me to ' } })
}
export async function prepareMemoryDraft() {
  await update(data => data.drafts.composer?.trim() ? data : { ...data, drafts: { ...data.drafts, composer: 'Remember that ' } })
}
export async function saveDraft(key, value) { await update(data => ({ ...data, drafts: { ...data.drafts, [key]: value } })) }
export async function submit(text, research) {
  const data = { id: crypto.randomUUID(), text: text.trim(), createdAt: new Date().toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, research }
  if (!data.text || data.text.length > 20000) throw new Error('Use between 1 and 20,000 characters.')
  await update(state => ({ ...state, drafts: { ...state.drafts, composer: '' }, entries: { ...state.entries, [data.id]: { ...data, status: 'pending', reply: null, sources: [], webSources: [] } }, outbox: [...state.outbox, { id: data.id, action: 'capture', data }] }))
  void sync()
  return data.id
}
export async function enqueue(action, data) {
  const id = data.requestId || crypto.randomUUID()
  await update(state => ({ ...state, outbox: [...state.outbox, { id, action, data }] }))
  await reconcileNotifications(effectiveReminders(useMemory.getState().data)).catch(error => useMemory.setState({ error: `Saved, but reminders could not be scheduled: ${error.message}` }))
  void sync()
}
export async function retry(id) {
  await update(state => {
    const existing = state.outbox.find(o => o.id === id)
    if (existing) return { ...state, outbox: state.outbox.map(o => o.id === id ? { ...o, error: null, conflict: false, attempts: 0 } : o) }
    const e = state.entries[id]
    return { ...state, outbox: [...state.outbox, { id, action: 'capture', data: { id, text: e.text, createdAt: e.createdAt, timezone: e.timezone, research: e.research } }] }
  })
  void sync()
}
export async function discardOperation(id) {
  await update(state => {
    const operation = state.outbox.find(o => o.id === id)
    const entries = { ...state.entries }
    if (operation?.action === 'capture' && entries[id]?.status !== 'done') entries[id] = { ...entries[id], status: 'failed', error: 'Processing paused. Retry whenever you’re ready.' }
    return { ...state, entries, outbox: state.outbox.filter(o => o.id !== id) }
  })
}
export async function sync() {
  const initial = useMemory.getState()
  if (syncing || authenticating || !initial.user || !initial.online || initial.needsSignIn) return
  syncing = true
  useMemory.setState({ syncing: true, error: null })
  const generation = epoch
  try {
    const account = await request('/api/account', { timeout: 20000 })
    if (generation !== epoch) return
    syncFailures = 0
    await update(data => ({ ...data, consent: account.consent }))
    // Pull before pushing so conflicts can be shown against current server records.
    await pull()
    let next
    while ((next = useMemory.getState().data.outbox.find(o => !o.error && (o.action !== 'capture' || account.consent)))) {
      try {
        await request('/api/memory', { method: 'POST', data: { action: next.action, data: next.data } })
        // Do not discard a request until its committed state has been fetched locally.
        await pull()
        await update(data => {
          const drafts = { ...data.drafts }
          if (next.action === 'edit' && drafts[next.data.id]?.content === next.data.content && drafts[next.data.id]?.title === next.data.title) delete drafts[next.data.id]
          if (next.action === 'delete' && next.data.type === 'knowledge') delete drafts[next.data.id]
          return { ...data, drafts, outbox: data.outbox.filter(o => o.id !== next.id) }
        })
      } catch (error) {
        if (error.status === 401) throw error
        if (!useMemory.getState().online) break
        const transient = !error.status || error.status === 429 || (error.status === 409 && !error.conflict)
        if (transient && (next.attempts || 0) < 3) {
          await update(data => ({ ...data, outbox: data.outbox.map(o => o.id === next.id ? { ...o, attempts: (o.attempts || 0) + 1 } : o) }))
          retryTimer = setTimeout(() => void sync(), 2000 * 2 ** (next.attempts || 0))
          break
        }
        await update(data => ({ ...data, outbox: data.outbox.map(o => o.id === next.id ? { ...o, error: error.message, conflict: Boolean(error.conflict) } : o) }))
        await pull()
      }
    }
    await reconcileNotifications(effectiveReminders(useMemory.getState().data))
  } catch (error) {
    useMemory.setState({ error: error.message, needsSignIn: error.status === 401 })
    if (!error.status && useMemory.getState().online && syncFailures < 3) retryTimer = setTimeout(() => void sync(), 2000 * 2 ** syncFailures++)
  } finally { syncing = false; useMemory.setState({ syncing: false }) }
}
async function pull() {
  let result
  do {
    result = await request(`/api/sync?cursor=${useMemory.getState().data.cursor}`, { timeout: 20000 })
    await update(data => applySync(data, result.changes, result.cursor))
  } while (result.more)
}
