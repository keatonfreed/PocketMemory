# iOS release preparation

Implemented: native Apple sign-in, device-only Keychain session storage, in-app account deletion with reauthentication and Apple token revocation, AI-processing consent before server AI use, per-request research consent, export, optional local notifications, safe-area/keyboard handling, privacy and terms pages, privacy manifest, repeatable Capacitor sync, and original Pocket Memory app icon.

For exact commands and Apple portal steps, follow [the setup guide](setup.md).

Required setup:

1. Fill `.env.local` and matching Vercel server settings using `.env.example`. `npm run check:config` lists missing names without values. Only the HTTPS API origin is included in the client build.
2. For the requested clean start, preview `npm run db:reset`, then run `npm run db:reset -- --execute` when ready. This deletes known app/auth/web-push tables and initializes empty tables. For future updates, use `npm run db:migrate` instead. Verify backup/retention settings for this deployment.
3. Configure the Apple Developer App ID, Sign in with Apple capability, P8 key and team. Run `npm run ios:sync`; select your signing certificate/provisioning in Xcode if automatic signing cannot resolve it.
4. Deploy the backend; ensure a stable HTTPS origin. Rebuild native assets using that origin. Confirm `/privacy` and `/terms` are publicly reachable.
5. Verify on a signed iPhone: initial Apple sign-in including Hide My Email, subsequent sign-in without profile fields, session renewal, fresh-session deletion/revocation, offline capture followed by relaunch/reconnect, editing with the keyboard visible, conflict handling, notification permission denial/delivery/taps, and export/share. These are manual native checks, not browser automation.
6. Add the TypeSafe and OpenAI keys and evaluate captures/corrections/ambiguous people/dates on your own representative data. Tests isolate provider behavior; they do not measure live model quality.

Before App Store submission, the owner must confirm the published support address works (`keaton@mfreed.com`), identify the correct legal operator/contact details in the policies, align backup/provider retention statements with the actual service settings, complete App Privacy answers, age rating, screenshots, and review access instructions. User content can contain sensitive information; disclose actual processing, not just a generic data category. No advertising or tracking SDK is enabled.

The SQLite package links SQLCipher even when app-level SQLCipher encryption is disabled. `ITSAppUsesNonExemptEncryption` is conservatively set to true; complete the applicable encryption/export-compliance questionnaire before distribution. Do not change this merely to suppress App Store Connect questions. The app uses OS data protection; it is not end-to-end encrypted.

Review the current authoritative requirements:
- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion
- https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations
- https://capacitorjs.com/docs/ios/privacy-manifest

These implementation and documentation steps support submission, but cannot guarantee Apple approval. Policies must describe the deployed service accurately.

## Verification in this workspace

The test suite passes on Node 24 LTS; use the pinned runtime in `.nvmrc` (the local Node 23 runtime stalled during PGlite tests). Code-level checks exercise real PostgreSQL semantics through PGlite without connecting to the live Neon database. They cover atomic capture/retry, corrections and revision history, stale edits, rollback, isolation, migration replay, deletion cascades, structured-output validation, tool limits, offline-state merging, notification limits, and native CORS. No browser automation was used.

Xcode 26.2 successfully compiled the unsigned iOS Simulator app after the iOS platform was installed. Capacitor sync and package resolution succeeded with only Apple enabled in the social-login plugin. This verifies compilation, not Apple sign-in or signed-device behavior; complete the device checks above after configuring credentials and deployment.

## Updated interface and dictation

The native app now has a welcome page followed by Apple sign-in with explicit AI-processing permission. Consent is saved to the account; existing accounts that have not consented see a one-time setup page. The web landing, privacy, terms, and support pages are separate from native onboarding. Set `VITE_APP_STORE_URL` to the published Apple listing URL to show the download link.

Native dictation uses `@capgo/capacitor-speech-recognition` and Apple's speech service; no audio is stored by Pocket Memory. Both microphone and speech permission descriptions are added by `ios:sync`. On-device checks: deny permission, allow permission, dictate across pauses, stop then send, navigate away while recording, and background the app. Review App Privacy answers for actual Apple speech processing before submission.

Notification permission now refreshes when Reminders opens and when the app returns from Settings. Denial offers the supported app-settings link; approval hides the enable prompt. Check both paths on iPhone. The app is portrait-only, and page transitions reset scroll for each destination, including Account subpages. Apple sign-in cancellation (`USER_CANCELLED` from the installed plugin) is intentionally silent. The capture Research toggle has been removed; new captures do not enable web search.
