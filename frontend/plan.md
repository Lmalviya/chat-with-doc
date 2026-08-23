# RAG agent — UI feature specification

## 1. Routing

- `/` — landing state, no active conversation
- `/c/:conversationId` — active conversation view
- `conversationId` is generated client-side (`crypto.randomUUID()`) when the user sends their **first message** in a new chat, and the app navigates to `/c/:conversationId` at that point (not before — see 3.1)
- On direct load of `/c/:conversationId` (refresh, shared link, sidebar click): `GET /conversations/{conversationId}` (returns metadata + all messages) and `GET /conversations/{conversationId}/documents` (metadata only) fired in parallel, using the cookie for ownership check. If either returns 404/403 (not owned by this `anon_id`, or expired), redirect to `/` and show a toast: "This conversation is no longer available."
- **Fetch-once-and-reconstruct:** the client never re-fetches messages just to switch branches. On load, build a children-map from each message's `parentMessageId`, then render the active thread by walking backward from the conversation's `activeLeafMessageId` via `parentMessageId` to the root and reversing. All branches already exist in memory from that one fetch — see section 6 for how switching uses this.

## 2. Sidebar (left, full vertical height)

**Top section**
- "New chat" button, full width, icon + label
- Clicking it: clears the active conversation from view, generates no ID yet, navigates to `/`

**Conversation list section**
- On mount: `GET /conversations` populates this list (sidebar data source)
- One row per conversation, ordered by `last_active_at` descending
- Row shows: truncated title (single line, ellipsis overflow), relative timestamp ("2h ago")
- Active conversation row is visually highlighted
- Row hover reveals a delete icon (soft-delete or hard-delete conversation, confirm with a small inline confirm, not a modal) — confirmed delete calls `DELETE /conversations/{conversationId}`
- Row hover also reveals a rename option — calls `PATCH /conversations/{conversationId}` with `{ title }`
- Empty state (no conversations yet): don't show an empty list — hide the section entirely until the first conversation exists

**Title generation**
- Conversation row initially shows a fallback title = first ~40 characters of the user's first message
- Immediately after the first message pair completes, fire `POST /conversations/{conversationId}/title/generate` as a non-blocking background call (no body — backend looks up the first message itself)
- When it resolves, update that row's title in place — no loading spinner on the row, just a quiet text swap

**Bottom section — theme switcher**
- Pinned to the bottom of the sidebar, always visible regardless of conversation list length (not part of the scrollable list)
- Compact three-icon segmented control, no dropdown needed for just three options:
  - Light — `ti-sun`
  - Dark — `ti-moon`
  - Eye comfort — `ti-eye` (warm, low-blue-light palette — amber/sepia tones rather than pure white or pure black; this is the actual mechanism, not just a color reskin)
- Currently active theme is visually highlighted in the control
- Apply via a `data-theme` attribute on the root element, driven by CSS custom properties — no per-component conditional theme logic
- Persist the choice in `localStorage`. This is a genuine UI preference, independent of `anon_id` and the 24-hour session clock — it should survive even after a session expires
- On first visit with no stored preference, default to the OS-level `prefers-color-scheme`; fall back to Light if that can't be detected either

## 3. Session retention notice

- Anonymous sessions (`anon_id`) expire after 24 hours — conversations, messages, and documents tied to that session are deleted on that clock
- Show a persistent, unobtrusive notice communicating this — e.g. a small line under the sidebar's "New chat" button: "Chats are kept for 24 hours"
- Do not use a dismissible toast or modal for this — it should be quietly always-visible, not an interruption
- When a returning visitor's cookie has expired, no error state is needed: a fresh `anon_id` is issued automatically and the sidebar simply starts empty, same as first-time visit

## 4. Landing / empty state (right side, no active conversation)

- Centered greeting, large text — not literally "hello": something like "What are you working on?" or "Ask anything about your documents"
- Below it: the same input bar described in section 6, so the user can start typing immediately without clicking anything first

### 4.1 Conversation creation timing (important)
- Do **not** create a conversation record in Postgres when "New chat" is clicked
- Generate `conversationId` client-side only when the first message is actually sent
- The first message send calls `POST /conversations/{conversationId}/messages` with `{ content }` (no `parentMessageId` — see section 7 for the full payload shape) — this single call both creates the conversation row and persists the message, since conversation creation is lazy on the backend
- This guarantees the sidebar never shows empty/abandoned conversations

## 5. Message thread (center panel)

- User messages: right-aligned, bounded max-width (~65% of panel), rounded bubble
- AI messages: left-aligned, no bubble background (or a subtle one), full available width for readability
- AI messages stream token-by-token as they arrive (SSE)
- While an AI message is streaming: replace the input bar's send icon with a stop icon (see 7.2)
- Below a completed AI message that used retrieval: a small collapsible "Sources" row listing which uploaded document(s) were used
- Optional/stretch: a small, low-emphasis "view trace" link on each AI message (admin/debug builds only) — opens the LangSmith trace for that reply's `request_id`. Not user-facing in the normal build; useful for your own debugging and a good thing to mention in the interview even if you gate it behind a dev flag
- Auto-scroll to bottom on new content, but stop auto-scrolling if the user has manually scrolled up (standard chat UX — don't yank their scroll position)
- Each message reveals a small action row on hover (icons, low-emphasis until hovered):
  - **All messages** — Copy (copies rendered text to clipboard, brief "Copied" tooltip, purely client-side, no backend call)
  - **User messages only** — Edit
  - **Assistant messages only** — Regenerate
- Disable Edit and Regenerate on every message while any generation is in flight anywhere in the conversation — prevents branching from an inconsistent state

## 6. Editing, regenerating, and branch switching

### 6.1 Edit a user message
- Clicking Edit turns that message into an inline editable text area in place (Save / Cancel), not a separate modal
- On Save: calls `POST /conversations/{conversationId}/messages` with `{ content: <new text>, parentMessageId: <the edited message's own parentMessageId> }` and header `X-Request-Id`. This does **not** overwrite the original message — passing the original's parent (not its own id) is what makes the backend create a sibling instead of appending. The backend generates the new assistant reply as its child and that reply becomes the new active leaf
- The thread view updates immediately to show the new branch; the old branch is not deleted, just no longer displayed
- The edited message now shows a branch switcher (see 6.3) since it has more than one sibling

### 6.2 Regenerate an assistant message
- Clicking Regenerate calls `POST /conversations/{conversationId}/messages/{messageId}/regenerate` (no body, header `X-Request-Id`) — the backend derives the correct parent from the target message's own `parentMessageId`
- Same branching mechanism as edit, just triggered without changing any content
- The new reply becomes the active leaf; the old reply becomes an inactive branch, still reachable via the switcher

### 6.3 Branch switcher
- Appears only on messages that have more than one sibling (i.e. more than one child under the same parent) — most messages never show this
- Small `‹ 2/3 ›`-style control directly on the message
- Clicking it recomputes the active thread **entirely client-side** from the already-fetched message tree — no loading state, should feel instant
- After switching, send a background `PATCH /conversations/{conversationId}` with `{ activeLeafMessageId }` to persist the choice so a refresh or another device shows the same branch — this call does not block the UI and has no visible loading indicator

## 7. Input bar (bottom, sticky)

- Horizontal bar: attach button (left) — text area (center, auto-grows up to a max height, then scrolls) — send/stop button (right)
- Enter sends, Shift+Enter newlines
- Sending calls `POST /conversations/{conversationId}/messages` with `{ content }` (no `parentMessageId` — omitting it tells the backend to use the current `activeLeafMessageId` as parent, i.e. a normal append) and header `X-Request-Id`, generated fresh client-side for this call
- Disabled state while a message is generating (except the stop button, which stays active)

### 7.1 Attach button → document popup
- Clicking opens a popup showing:
  - List of documents already attached to **this conversation** (not shared across conversations) — fetched via `GET /conversations/{conversationId}/documents` (metadata only: filename, type, status, size — kept fast on purpose)
  - Each row: filename, file type icon, upload status (uploading / ready / failed), and a kebab menu with **View / Replace / Delete**
  - "Upload new document" button/dropzone at the top or bottom of the list
- Upload flow is two calls: `POST /conversations/{conversationId}/documents/upload-url` with `{ filename, contentType, size }` returns a presigned URL; the file uploads directly to object storage from the client using that URL; then `POST /conversations/{conversationId}/documents` with `{ storageKey, filename }` finalizes it and triggers ingestion
- Supported types: `.pdf`, `.txt`, `.md`, and common code file extensions (`.py`, `.js`, `.ts`, `.java`, `.go`, `.rs`, `.cpp`, `.c`, `.rb`, `.php`, etc.) — validate extension **and** MIME type client-side before upload, and re-validate server-side (never trust the client)
- Show a max file size limit and a max document count per conversation in the popup UI (define both — e.g. 10MB/file, 10 docs/conversation — to keep free-tier storage bounded)

### 7.2 Stop button behavior
- While streaming, the send icon becomes a stop (square) icon
- Clicking it calls `POST /conversations/{conversationId}/messages/stop` with header `X-Request-Id` matching the in-flight call, and also aborts the client-side fetch/EventSource; server sees the disconnect via `request.is_disconnected()` as a backup and halts the LangGraph run either way
- The partial AI message that had already streamed in stays visible, marked subtly as "stopped" (not deleted)

## 8. Document viewer (popup → View)

- Opens a modal/pop-up showing the document content, sized generously (not the same small popup as the attach list)
- Content is fetched via `GET /conversations/{conversationId}/documents/{docId}` on opening the viewer
- Render by type:
  - `.pdf` → embedded viewer (iframe pointing at the short-lived presigned URL returned by that call, or `pdf.js`)
  - `.txt`, `.md` → rendered as plain text in a monospace or readable font; for `.md` optionally offer a raw/rendered toggle, default to raw since the doc is a RAG source, not a reading experience
  - code files → syntax-highlighted read-only view (language inferred from extension)
- All non-PDF content must be rendered as escaped text, never as raw HTML, to avoid any injection risk from uploaded file contents

## 9. Document replace / delete

- **Delete**: confirm inline (not a full modal — a lightweight "Delete this document?" with Confirm/Cancel in place of the row), then call `DELETE /conversations/{conversationId}/documents/{docId}` — removes from storage, vector DB, and Postgres
- **Replace**: user-managed flow (per your note) — same two-step upload as a new document (`POST .../documents/upload-url` then a finalize call), except finalize uses `PUT /conversations/{conversationId}/documents/{docId}` with `{ storageKey, filename }` instead of the plain create call, so the row's `documentId` stays the same rather than creating a new one

## 10. States to design for explicitly

- First-time visit (empty sidebar, landing greeting)
- Mid-stream generation (stop button live, input disabled)
- Stopped generation (partial message marked, input re-enabled)
- Upload in progress / upload failed (retry action)
- Conversation load failure (expired/not owned → redirect + toast)
- Empty document list vs populated document list in the attach popup
- Network error on send (show inline retry on the failed message, don't silently drop it)
- Returning visitor with expired `anon_id` (see section 3 — silent fresh start, no error)
- Editing a message (inline text area open, Save disabled until content changes, Cancel reverts with no backend call)
- Edit/Regenerate save in flight (same visual treatment as normal generation — stop button live, input disabled)
- Branch switch (instant, client-side only — no loading state should ever appear here)
- Edit/Regenerate attempted while another generation is in flight — buttons should be disabled, not silently ignored

## 11. Accessibility baseline

- All icon-only buttons (attach, stop, delete, kebab menu, theme switcher, copy, edit, regenerate, branch switcher arrows) need `aria-label`
- Modal/popup traps focus and closes on `Escape`
- Streaming text region uses `aria-live="polite"` so screen readers announce new content without interrupting
- Verify text/background contrast meets WCAG AA for all three themes — the Eye comfort palette's warmer tones need the same contrast check as Light and Dark, not an exemption
- Branch switcher's current position (e.g. "2 of 3") should be exposed as text for screen readers, not conveyed by arrow icons alone