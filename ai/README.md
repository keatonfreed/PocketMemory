# PocketMemory AI Dataset

This folder is a separate development workspace for `queryMemory` fine-tuning data.

## Commands

- `npm run ai:editor` starts the local dataset editor at `http://localhost:5174`.
- `npm run ai:export` validates approved examples and writes `ai/exports/query-memory.ft.jsonl`.

The editor starts from `ai/data/examples.seed.mjs` until you save. The first save writes expanded editable JSON to `ai/data/examples.json`, and later saves preserve your edits there.

The editor autosaves after edits settle. While changes are pending, the Save button reads `Unsaved - Save now`; if any JSON field is invalid, it turns into `Fix JSON before saving` and blocks save/export until the JSON parses.

## Format

Each approved example exports as one OpenAI chat fine-tuning JSONL line:

- `messages[0]` is a `developer` instruction with that example's fake document list.
- `tools` always includes `get_docs`, even when the correct assistant behavior is not to call it.
- Modification examples include assistant `tool_calls`, a `tool` output containing full document content, then final assistant JSON.
- Open/create/delete/no-op examples skip tool calls and go directly to final assistant JSON.
- `parallel_tool_calls` is always `false`.

Existing fetched list documents include `itemId`, `itemContent`, and `itemCompleted` because `editListItem` and `deleteListItem` must point at a real existing item. Newly created list outputs stay simple and use string arrays; the app generates item ids for those later.

## Policy Notes

- Capture mode opens documents for "what's on/show/open/view" requests; it does not answer those questions.
- `get_docs` is only for mods.
- `modifyDoc` requires one prior `get_docs` output for the exact docId.
- One user request should call `get_docs` at most once.
- Mark/check/cross off means `editListItem` with `itemCompleted: true`.
- Delete/remove/take out a list item means `deleteListItem`.
- Note edits use `editNote` with the entire replacement note content.
