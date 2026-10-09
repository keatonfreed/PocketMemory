# Architecture

## Source of truth

Neon holds account-scoped `pm_entries`, `pm_knowledge`, `pm_revisions`, `pm_reminders`, consent, operation receipts, and a paginated change log. Better Auth owns its own user/account/session/verification/rate-limit tables. App records reference Better Auth users with cascading deletion. The Apple refresh token required for revocation is encrypted with Better Auth's symmetric encryption using the auth secret.

On iPhone, community SQLite durably stores the account's local snapshot, drafts, sync cursor and outbox in one transaction. The initial snapshot representation is intentionally small and understandable; if histories grow large, normalize local records before introducing attachment storage. SQLite lives under Library, not browser localStorage. The web development adapter uses IndexedDB; browser sign-in/token persistence is deliberately unavailable. Server authorization checks account ownership on every read and write, regardless of the local cache.

Writes are serialized locally. A submission is persisted before its input clears. Offline submissions await sync. Foreground and network events trigger a pull and an ordered outbox drain. Incremental sync fetches 100 changes at a time. Failed AI calls retain their original entry. Transport failures use bounded backoff; permanent failures stay visible for retry. Save receipts make edit retries idempotent. Captures use stable UUIDs and reject reuse with different content or ownership.

Server writes serialize per account with Postgres transaction-scoped advisory locks; a busy account returns retryable 409 instead of processing stale context. Originals commit before AI processing. The interpretation and all resulting memory/reminder changes commit together. This also keeps change-log sequence order meaningful per account. AI work has an overall deadline; a crash leaves the original and can be replayed. A stale manual edit returns a distinct conflict, preserving the local draft. An already completed capture is returned without rerunning AI.

## One assistant workflow

1. Store the original text and chronology.
2. Ask JEV focused Choice questions for intent, lifetime and response mode (accept, answer, act, clarify), with real recent context.
3. Route confident quiet acceptance to the configurable memory model; otherwise use the agent model. Quiet captures return an empty reply; questions, tasks and necessary clarification remain visible. The device shows Saved while processing continues.
4. Start with up to 200 active memory previews (100,000 characters), up to 50 pending reminders, recent history, current time and timezone. Mark truncated memory context explicitly; older or full records remain available through tools. The Responses loop can search original history, search current/expired knowledge, read a record with its revisions, and list reminders. All queries are parameterized and account-scoped. Search uses Postgres full-text plus literal substring matching. There is no vector service or knowledge graph.
5. Research opt-in exposes OpenAI web search for that request only. Return source annotations as links.
6. Validate final structured output with Zod and enforce semantic invariants in code: valid targets, exact source substrings, no double update to a memory, no unknown citations, future reminders, and normalized exact deduplication. Semantic deduplication and ambiguity handling also depend on the model and need real-data evaluation.
7. Commit the complete result; then sync it to the device.

The tool allowlist is read-only. Only the validated final plan can create/update memory and create reminders. AI cannot delete user data, run arbitrary code, send email, or access calendars. No speculative changes are streamed into local state. The loop has six steps, fourteen retrieval calls, per-request timeouts, and an overall 180-second deadline. Provider failures are visible; content and tokens are not logged by our server.

`store: false` is sent to OpenAI Responses. This controls response storage, not every aspect of provider retention; the privacy policy does not promise zero retention.

## History and editing

A memory is a practical interpreted record (fact, preference, person, event, plan, note, or list). These are internal distinctions; users can simply submit text. An optional actual event time is distinct from submission time. Optional expiry marks temporary information as no longer current without destroying chronology. Models see expiry/deletion state and must ground personal answers in retrieved sources.

The editor has an independent durable draft, stable text fields, an explicit versioned Save, and a comparison flow for conflicts. It does not reset text or the cursor after each keystroke. Lists remain plain text with optional checkbox controls, so there is no separate fragile item-ID hierarchy.

## Reminders

One-time reminders sync through Neon and are scheduled with Capacitor Local Notifications. The next 60 future reminders fit below iOS's pending limit and are refreshed when the app opens/syncs. Completing/deleting locally also updates the device schedule. Delivery depends on permission and iOS settings. Reminders are not a server job scheduler, recurring automation system, or guarantee of background agent execution.

## Intentional limits

No calendar/email integrations, file/photo ingestion, recurring jobs, or provider-generated demo data. No migration of old localStorage notes. Database/provider/signing configuration and signed-device verification remain deployment steps. The implementation does not claim that schema validation alone proves a model's interpretation true.
