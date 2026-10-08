import { betterAuth } from 'better-auth'
import { bearer } from 'better-auth/plugins'
import { importPKCS8, SignJWT } from 'jose'
import { symmetricDecrypt } from 'better-auth/crypto'
import { db } from './db.js'
let instance
export async function appleSecret() {
  const { APPLE_PRIVATE_KEY, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_BUNDLE_ID } = process.env
  if (!APPLE_PRIVATE_KEY || !APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_BUNDLE_ID) throw Object.assign(new Error('Apple sign-in is not configured yet.'), { status: 503 })
  const key = await importPKCS8(APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'), 'ES256')
  return new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: APPLE_KEY_ID }).setIssuer(APPLE_TEAM_ID).setSubject(APPLE_BUNDLE_ID).setAudience('https://appleid.apple.com').setIssuedAt().setExpirationTime('1h').sign(key)
}
export function auth() {
  if (!process.env.BETTER_AUTH_SECRET || !process.env.BETTER_AUTH_URL) throw Object.assign(new Error('Sign-in is not configured yet.'), { status: 503 })
  return instance ??= betterAuth({
    database: db(), secret: process.env.BETTER_AUTH_SECRET, baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: [process.env.BETTER_AUTH_URL, 'capacitor://localhost', 'https://appleid.apple.com'],
    emailAndPassword: { enabled: false },
    socialProviders: { apple: {
      clientId: process.env.APPLE_BUNDLE_ID || 'app.pocketmemory.ios',
      appBundleIdentifier: process.env.APPLE_BUNDLE_ID || 'app.pocketmemory.ios',
      // Native ID-token sign-in does not use the redirect/client-secret flow.
      mapProfileToUser: async profile => {
        if (profile.email) return {}
        const { rows } = await db().query('SELECT u.email, u.name FROM "user" u JOIN account a ON a."userId"=u.id WHERE a."providerId"=$1 AND a."accountId"=$2', ['apple', profile.sub])
        return rows[0] ? { email: rows[0].email, name: rows[0].name } : {}
      },
    } },
    account: { encryptOAuthTokens: true, accountLinking: { enabled: false } },
    session: { expiresIn: 60 * 60 * 24 * 90, updateAge: 60 * 60 * 24, freshAge: 60 * 10 },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 30 },
    user: { deleteUser: { enabled: true, beforeDelete: async user => {
      const { rows } = await db().query('SELECT token FROM pm_apple_credentials WHERE user_id=$1', [user.id])
      if (!rows[0]) throw new Error('Sign in with Apple again before deleting your account.')
      const token = await symmetricDecrypt({ key: process.env.BETTER_AUTH_SECRET, data: rows[0].token })
      const response = await fetch('https://appleid.apple.com/auth/revoke', {
        method: 'POST', signal: AbortSignal.timeout(15000),
        body: new URLSearchParams({ client_id: process.env.APPLE_BUNDLE_ID, client_secret: await appleSecret(), token, token_type_hint: 'refresh_token' }),
      })
      if (!response.ok) throw new Error('Apple could not revoke access. Please try deletion again.')
    } } },
    plugins: [bearer()],
  })
}
