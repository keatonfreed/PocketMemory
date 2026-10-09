# Architecture

## Source of truth

Neon holds account-scoped `pm_entries`, `pm_knowledge`, `pm_revisions`, `pm_reminders`, consent, operation receipts, and a paginated change log. Better Auth owns its own user/account/session/verification/rate-limit tables. App records reference Better Auth users with cascading deletion. The Apple refresh token required for revocation is encrypted with Better Auth's symmetric encryption using the auth secret.

On iPhone, community SQLite durably stores the account's local snapshot, drafts, sync cursor and outbox in one transaction. The initial snapshot representation is intentionally small and understandable; if histories grow large, normalize local records before introducing attachment storage. SQLite lives under Library, not browser localStorage. The web development adapter uses IndexedDB; browser sign-in/token persistence is deliberately unavailable. Server authorization checks account ownership on every read and write, regardless of the local cache.

Writes are serialized locally. A submission is persisted before its input clears. Offline submissions await sync. Foreground and network events trigger a pull and an ordered outbox drain. Incremental sync fetches 100 changes at a time. Failed AI calls retain their original entry. Transport failures use bounded backoff; permanent failures stay visible for retry. Save receipts make edit retries idempotent. Captures use stable UUIDs and reject reuse with different content or ownership.

Server writes serialize per account with Postgres transaction-scoped advisory locks; a busy account returns retryable 409 instead of processing stale context. Originals commit before AI processing. The interpretation and all resulting memory/reminder changes commit together. This also keeps change-log sequence order meaningful per account. AI work has an overall deadline; a crash leaves the original and can be replayed. A stale manual edit returns a distinct conflict, preserving the local draft. An already completed capture is returned without rerunning AI.

## One assistant workflow

1. Store the original text and chronology.
2. Ask JEV independent Noul yes/no questions for a text reply and record actions, plus Choice questions for intent and lifetime. JEV receives personal/time context with a conservative 28,000-byte state budget: exact whole recent turns first, then compact reminder/memory records. GPT receives the broader snapshot. Extremely long multibyte messages exceeding JEV’s state budget route to GPT with the full original input rather than clipping the message.
3. Neither reply nor actions: finish without GPT. Quiet actions: use MEMORY_MODEL and enforce an empty reply. Text response: use AGENT_MODEL; actions=false enforces empty change/reminder arrays. The device always shows a saved receipt on the original message; only a requested reply has typing dots.
4. Start with up to 300 chronological history entries (120,000 characters), up to 300 active memory previews (100,000 characters), up to 200 reminders including completed ones, current time, local day/time and timezone. Recent history uses exact message/reply text for up to 20 entries within the budget; older entries use previews. Mark truncated memory context explicitly; older or full records remain available through tools. The Responses loop can search original history, search current/expired knowledge, read a record with its revisions, and list reminders. All queries are parameterized and account-scoped. Search uses Postgres full-text plus literal substring matching. There is no vector service or knowledge graph.
5. Research opt-in exposes OpenAI web search for that request only. Return source annotations as links.
6. Validate final structured output with Zod and enforce semantic invariants in code: valid targets, exact source substrings, no double update to a memory, no unknown citations, future reminders, and normalized exact deduplication. Semantic deduplication and ambiguity handling also depend on the model and need real-data evaluation.
7. Commit the complete result; then sync it to the device. New clients request SSE on the capture endpoint: saved receipt, JEV decisions, retrieval/save progress, provisional reply text, then a committed completion or explicit error. Old clients retain the JSON response path.

The tool allowlist is read-only. Only the validated final plan can create/update/delete memory records and reminders. Deletion requires an explicit user request in the assistant instructions, exact latest-message evidence and a full record read; targets are checked against retrieved account records. Deleting memories removes their revisions and stale sync payloads, while original messages remain in history. AI cannot delete original history/account data, run arbitrary code, send email, or access calendars. Streamed reply text lives only in transient UI state; no speculative actions are applied. The loop has six steps, fourteen retrieval calls, per-request timeouts, and an overall 180-second deadline. One repair attempt handles truncated/invalid output before surfacing a distinct AI error. Provider failures are visible; content and tokens are not logged by our server.

`store: false` is sent to OpenAI Responses. This controls response storage, not every aspect of provider retention; the privacy policy does not promise zero retention.

## History and editing

A memory is a practical interpreted record (fact, preference, person, event, plan, note, or list). These are internal distinctions; users can simply submit text. An optional actual event time is distinct from submission time. Optional expiry marks temporary information as no longer current without destroying chronology. Models see expiry/deletion state and must ground personal answers in retrieved sources.

The editor has an independent durable draft, stable text fields, an explicit versioned Save, and a comparison flow for conflicts. It does not reset text or the cursor after each keystroke. Lists remain plain text with optional checkbox controls, so there is no separate fragile item-ID hierarchy.

## Reminders

One-time, daily and weekly reminders sync through Neon with a short title, body (up to 500 characters), next occurrence, recurrence and timezone. Capacitor Local Notifications uses native calendar matching for repeating reminders, so they continue without opening the app and follow device local time. The app computes next occurrences in the saved timezone for display; travel across timezones may require editing/resyncing the schedule. Up to 60 pending notification requests fit below iOS's limit and are refreshed when the app opens/syncs. Completing/deleting locally also updates the device schedule. Delivery depends on permission and iOS settings. Recurring reminders are notifications, not recurring agent execution or a server job scheduler.

## Intentional limits

No calendar/email integrations, file/photo ingestion, recurring jobs, or provider-generated demo data. No migration of old localStorage notes. Database/provider/signing configuration and signed-device verification remain deployment steps. The implementation does not claim that schema validation alone proves a model's interpretation true.

## Updating this assistant version

Run `npm run db:migrate` against the intended deployment database before deploying the new server. This adds reminder body, repeat and timezone columns without deleting existing data. Deploy the backend, then run `npm run ios:sync` and rebuild/install the native app for streaming, the chat layout and recurring notification scheduling. Tests do not migrate the production database or exercise live providers/device notification delivery.
