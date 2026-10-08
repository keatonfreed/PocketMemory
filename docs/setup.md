# Pocket Memory: get the iPhone app running

This guide uses your existing Vercel project **pocket-memory**, your existing Neon database, and **https://pocket-memory-ai.vercel.app**. You do not need pocketmemory.app. Support goes to your requested mailbox through a modest “Contact support” link; it is not displayed as a prominent address. A mailto link is still publicly discoverable. You can replace it later in `src/App.jsx`, `src/pages/Settings.jsx`, and `src/components/ui/Policy.jsx`.

## 1. What lives where

- **Vercel** runs the API and holds production configuration and secrets. Your existing GitHub connection deploys committed/pushed code; files changed only on your Mac are not deployed yet.
- **Neon** stores accounts, memories, history, versions and reminders. Keep your existing `DATABASE_URL` if you want to reuse that database.
- **Better Auth** is an installed backend library. There is no Better Auth dashboard, paid account, separate server, or project to connect. Its tables live in Neon. Apple proves who you are; Better Auth issues your app session.
- **Apple Developer** owns the Bundle ID, signing team, capability, and Apple sign-in key. Your existing developer membership works, but this app needs its own identifier.
- **Xcode / Capacitor** build the iPhone app. The native app bundles the interface locally and calls the HTTPS Vercel API.
- **`VITE_API_URL`** is the public API origin: `https://pocket-memory-ai.vercel.app`. “Vite” is the frontend build tool. The `VITE_` prefix makes a value public in the app bundle. It is NOT a secret or an API key. Do not put `/api` on the end. Never prefix private keys with `VITE_`.

Production secrets belong on Vercel, but Apple identifiers and the API URL must also be available on your Mac when generating the native app. `.env.local` is the ignored local setup copy, not a file to commit or upload into the app.

## 2. Prepare the local tools

In Terminal, from this repository:

```sh
nvm install 24
nvm use
npm ci
vercel login
vercel project inspect --non-interactive
```

The project should be `pocket-memory`, ID `prj_z1IBj9jtR2GksfZaLzwbOTavNmxk`, under `keatonfreeds-projects`. It is already linked here. On a different Mac, run `vercel link` and choose that **existing** project; do not create another one. If `vercel` is missing after switching Node versions, install it with `npm install -g vercel`.

```sh
npm run env:prepare
```

This adds missing names/defaults to `.env.local` without replacing filled-in values. It never prints secrets or generates provider keys. This step has already been run in this workspace.

## 3. Fill the variables

Edit `.env.local` locally. Keep real keys out of chat and Git. These are the active variables:

| Variable | What to use | Where used |
|---|---|---|
| `DATABASE_URL` | Your existing Neon connection string, including SSL parameters | Vercel server; local reset script |
| `OPENAI_API_KEY` | Your existing OpenAI key | Vercel server |
| `TYPESAFE_API_KEY` | Your TypeSafe key | Vercel server |
| `TYPESAFE_MODEL` | `jev-latest` | Vercel server |
| `MEMORY_MODEL` | `gpt-4.1-mini` initially | Vercel server |
| `AGENT_MODEL` | `gpt-4.1-mini` initially | Vercel server |
| `BETTER_AUTH_SECRET` | Generate using the command below; keep stable | Vercel server; local schema setup |
| `BETTER_AUTH_URL` | `https://pocket-memory-ai.vercel.app` | Vercel server |
| `APPLE_BUNDLE_ID` | `app.pocketmemory.ios`, if you successfully register it; otherwise your chosen unique ID | Vercel server and native build |
| `APPLE_TEAM_ID` | Your Apple Developer Team ID | Vercel server and Xcode signing |
| `APPLE_KEY_ID` | Key ID shown for the Apple sign-in P8 key | Vercel server |
| `APPLE_PRIVATE_KEY` | Contents of that P8 file; import with the command below | Vercel server |
| `VITE_API_URL` | `https://pocket-memory-ai.vercel.app` | Public frontend/native build |
| `IOS_BUILD_NUMBER` | `1` initially; increment for each App Store upload | Local Xcode generation only |
| `DEV_ORIGINS` | Optional `http://localhost:5173` for local API development | Server development only; sync script omits it |

Generate your Better Auth secret once:

```sh
npm run env:secret
```

This creates a random secret in `.env.local`, without printing it. It refuses to replace an existing secret. This is an application signing/encryption secret, not an OpenAI/TypeSafe key. Keep a private backup. Changing it later invalidates sessions and can prevent decrypting the stored Apple tokens needed for revocation.

The previous `ASK_MEMORY_MODEL`, `QUERY_MEMORY_MODEL`, `CRON_SECRET`, and `VAPID_*` values are unused by the rewritten app. The old fine-tune has a different output format; do not copy it into the new model settings. Old values are left intact while your old deployment may still be live. After the new version is deployed, remove those obsolete names in Vercel Settings → Environment Variables and locally if desired. No cron/web-push service is needed for native local reminders. `VERCEL_OIDC_TOKEN` is CLI-managed; never copy it into production manually. The new sync script does not upload any of these obsolete/CLI variables.

## 4. Register this app with Apple

You do not need an App Store listing before testing on your own signed iPhone.

1. Open [Apple Developer → Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list). Choose the same team you use for your other published apps.
2. Under **Identifiers**, press **+**, select **App IDs**, then **App**.
3. Description: **Pocket Memory**. Select an **Explicit** Bundle ID. Try `app.pocketmemory.ios`; if unavailable, use a unique reverse-domain ID you control. Put exactly the same value in `APPLE_BUNDLE_ID` locally and on Vercel.
4. Enable **Sign in with Apple**. Configure it as a **primary App ID**, not grouped with an unrelated existing app. Continue and register.
5. Find your **Team ID** in Apple Developer account membership details. Set `APPLE_TEAM_ID` to that identifier, not your email or App Store numeric app ID.
6. Under **Keys**, press **+**. Name it “Pocket Memory Sign in with Apple”. Enable **Sign in with Apple**, click **Configure**, and select this app’s primary App ID. Register.
7. Download the `.p8` key and save it somewhere private outside this Git repository. Apple provides a limited opportunity to download it. Record the **Key ID** as `APPLE_KEY_ID`.
8. Import its contents without pasting the key into shell history:

```sh
npm run env:apple-key -- "$HOME/Downloads/AuthKey_YOURKEYID.p8"
```

Replace the path with the actual file. This imports into ignored `.env.local`; it does not upload the file to Git.

The backend generates short-lived Apple client secrets from this P8 key automatically. You do not need to generate a six-month JWT by hand. The current flow uses native Apple authorization codes and ID tokens, so **do not create a web Services ID, web return URL, or domain verification file** for it. No outgoing email service is configured; Hide My Email can be used without setting up app-generated mail.

Later, for TestFlight/App Store: App Store Connect → My Apps → **+ → New App**, iOS, Pocket Memory, your language, select the same Bundle ID, choose a unique internal SKU such as `pocket-memory-ios`. The Bundle ID is not a value you can casually change after distributing the app: changing it changes the app/sign-in identity. See [Apple’s App ID registration instructions](https://developer.apple.com/help/account/identifiers/register-an-app-id/) and [private-key instructions](https://developer.apple.com/help/account/capabilities/create-a-sign-in-with-apple-private-key/).

## 5. Sync to Vercel

```sh
npm run check:config
npm run env:push
```

`check:config` prints only names and validity/presence, never values. `env:push` verifies CLI access to the linked existing project, uploads only the active allowlisted variables, skips blanks, and targets **Production** by default. Secrets go over stdin rather than command arguments and are stored as sensitive values. The script does not deploy code, reset the database, or erase obsolete variables. It can be rerun after you fill in missing Apple/TypeSafe values. It overwrites each included Production value with your local value, so only run it when your local copy contains the intended values.

To refresh local non-secret settings after changing them in Vercel:

```sh
npm run env:pull
```

This merges production configuration and preserves local secrets. Vercel does **not** return sensitive production secrets on pull; keep your private local originals for setup/reset operations. Do not run raw `vercel env pull .env.local --yes`: it replaces the file and can erase locally filled-in secrets. The script pulls into a temporary ignored file, then removes it.

For now use Production with your existing app URL. Do not copy production database credentials into branch previews by default. The optional `npm run env:push -- preview` / `development` targets upload your current local values; use those only with a deliberate separate environment configuration/database. Sensitive storage is supported for Production/Preview; Development values have different visibility rules.

Changes to Vercel variables apply to **new deployments**, not the existing live deployment. [Vercel CLI environment documentation](https://vercel.com/docs/cli/env).

## 6. Fresh database setup — one command, no old-data migration

You asked for a reset rather than keeping old backend data. The reset command deletes the known Pocket Memory tables and creates the new empty schema, including Better Auth’s tables. You still need tables for the app to work, but you do not need to write SQL or run a separate migration afterward.

First inspect the target without connecting or changing anything:

```sh
npm run db:reset
```

When ready to discard old data:

```sh
npm run db:reset -- --execute
```

It shows the Neon host/database (never the password) and requires you to type `RESET` followed by that exact target. It drops only the listed Pocket Memory and Better Auth tables, including old `push_subscriptions` and `notification_schedules`. It does not delete the Neon project, drop the entire schema, or cascade into unrelated tables. Use the database dedicated to this app. An unrelated dependency makes the drop fail rather than erasing that dependency.

**This permanently deletes all app accounts/content in the target database.** It is for this initial clean start, not every release. The command has NOT been executed for you. Stop using the old app during this cutover; its push endpoints will no longer work after the reset. If initialization fails after deletion, fix the reported setup problem and run `npm run db:migrate` to create the empty tables—do not keep resetting a database with new user data. Future schema changes use normal migrations; reset is not an upgrade strategy.

## 7. Deploy the new backend using the existing GitHub connection

1. Finish the variables and run `env:push`.
2. Run the one-time reset when ready for the cutover.
3. Commit and push the new code to the Git branch configured as this Vercel project’s **Production Branch**. Vercel → Project → Settings → Git shows the connected repository/branch. This task does not silently push your changes.
4. Wait for that Git deployment to become Ready. The project uses Vite, `npm run build`, `dist`, and Node **24.x**. Do not put the reset command in Vercel’s build command.
5. If the new code was already deployed before you filled variables, redeploy that **new-code deployment** from Vercel’s Deployments page. Redeploying an old commit keeps the old API code.
6. Open `https://pocket-memory-ai.vercel.app/privacy` and `/terms`. Confirm these show the new policy/contact. The web root should say it is an iPhone app.
7. The native app needs publicly accessible production API endpoints. They enforce their own Apple/Better Auth authentication. If you enabled Vercel deployment protection on Production, configure that intentionally for your app; never put a Vercel protection-bypass secret in the iPhone bundle. Preview protection can remain enabled.

No deployment can prove live Apple/AI behavior until your credentials and database are configured. Existing deployed old code is not evidence that the refactor is live.

## 8. Sync Xcode and run on iPhone

```sh
npm run ios:sync
npm run ios:open
```

`ios:sync` rebuilds the bundled UI, copies it into iOS, updates installed native plugins, and sets the Bundle ID/team from `.env.local`. It does not package the server secrets into the app. Rerun it after changing the API origin, Bundle ID/team, or frontend code. Xcode was opened for this workspace during setup; rerun sync once your Apple identifiers are filled.

In Xcode:

1. Select the blue **App** project → **App** target → **Signing & Capabilities**.
2. Enable **Automatically manage signing**. Choose the same Apple Developer **Team**. Confirm Bundle Identifier matches the registered `APPLE_BUNDLE_ID` exactly.
3. Confirm **Sign in with Apple** is listed. If Xcode asks to repair provisioning after enabling the capability, let it refresh the profile. This is distinct from the P8 server key.
4. Connect your iPhone, trust the Mac, enable Developer Mode if requested, and select it as the run destination.
5. Run. Sign in with Apple, allow AI processing when you want to test it, then submit an entry. You will test the real behavior yourself.
6. For distribution, increment `IOS_BUILD_NUMBER`, run `ios:sync`, select an iOS device/archive destination, Product → Archive, then distribute through App Store Connect.

Unsigned simulator compilation already passed in this workspace. That does not test provisioning, real Apple sign-in, live providers, or notifications on your phone.

## 9. Common setup failures

| Symptom | Check |
|---|---|
| “Sign-in is not configured” | `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` on Vercel, then a new deployment |
| Apple sign-in fails before returning to app | Correct team, explicit Bundle ID, capability and provisioning profile |
| Apple code exchange fails | P8 key belongs to the selected primary App ID; Key ID, Team ID and Bundle ID all match; key not revoked |
| “relation … does not exist” | Empty auth/app tables were not initialized in the database used by the deployed `DATABASE_URL` |
| API URL/configuration error or network failure | `VITE_API_URL` HTTPS origin, then `ios:sync`; deployed new API reachable without Vercel browser-only login |
| Entry saved but AI failed | TypeSafe/OpenAI keys, billing/access, model settings; retry the saved entry after fixing |
| CLI login/project error | `vercel login`, then inspect the existing project from this exact folder |
| Xcode still shows old UI | `ios:sync`, rebuild and run; native assets are bundled |
| Export-compliance question | SQLite links SQLCipher; current plist conservatively declares non-exempt encryption. Complete Apple's questionnaire using actual library usage; do not flip it just to hide the question |

Before submitting, follow [the release checklist](release.md) for App Privacy, policies/contact accuracy, encryption and screenshots. The API enforces account ownership, validates changes, and avoids printing private data; setup still needs your signed-device and live-provider checks.

## Verified in this workspace

The Vercel CLI is logged in and the existing project link was verified. `DATABASE_URL`, `OPENAI_API_KEY`, `TYPESAFE_API_KEY`, `TYPESAFE_MODEL`, `MEMORY_MODEL`, `AGENT_MODEL`, `BETTER_AUTH_URL`, `APPLE_BUNDLE_ID`, and `VITE_API_URL` were synced to Production. The three credential values are sensitive; public/model/identifier values are readable configuration. Existing Preview/Development scopes were verified intact.

Still missing at this check: `BETTER_AUTH_SECRET`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`. Xcode was opened. No database reset or deployment was executed. The existing Production alias was Ready but still served the old May 7 deployment and old API routes. Setup-script tests and lint passed; no browser testing or live AI calls were performed.
