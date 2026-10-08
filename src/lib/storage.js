import { Capacitor } from '@capacitor/core'
import { get, set, del } from 'idb-keyval'
import { SecureStorage, KeychainAccess } from '@aparajita/capacitor-secure-storage'
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite'
export const native = Capacitor.isNativePlatform()
let connection
async function database() {
  if (!connection) connection = (async () => {
    const sqlite = new SQLiteConnection(CapacitorSQLite)
    const consistent = await sqlite.checkConnectionsConsistency()
    const exists = await sqlite.isConnection('pocket_memory', false)
    const db = consistent.result && exists.result ? await sqlite.retrieveConnection('pocket_memory', false) : await sqlite.createConnection('pocket_memory', false, 'no-encryption', 1, false)
    await db.open()
    await db.execute('CREATE TABLE IF NOT EXISTS local_state (account TEXT PRIMARY KEY, data TEXT NOT NULL); PRAGMA secure_delete=ON;')
    return db
  })()
  return connection
}
export async function readState(userId) {
  if (!native) return get(`pocket:${userId}`)
  const result = await (await database()).query('SELECT data FROM local_state WHERE account=?', [userId])
  return result.values?.length ? JSON.parse(result.values[0].data) : null
}
export async function writeState(userId, value) {
  if (!native) return set(`pocket:${userId}`, value)
  await (await database()).run('INSERT INTO local_state(account,data) VALUES (?,?) ON CONFLICT(account) DO UPDATE SET data=excluded.data', [userId, JSON.stringify(value)])
}
export async function removeState(userId) {
  if (!native) return del(`pocket:${userId}`)
  await (await database()).run('DELETE FROM local_state WHERE account=?', [userId])
}
export async function readSession() {
  if (!native) return null // Do not persist bearer tokens in browser localStorage.
  return SecureStorage.get('pocket-session', false, false)
}
export async function writeSession(session) {
  if (!native) throw new Error('Sign in from the iPhone app.')
  await SecureStorage.set('pocket-session', session, false, false, KeychainAccess.whenUnlockedThisDeviceOnly)
}
export async function removeSession() { if (native) await SecureStorage.remove('pocket-session', false) }
