# RAG agent — backend schema and API reference

Scope: only the endpoints and tables needed for what's been designed so far (anonymous sessions,
conversations with branching, messages, documents). More endpoints (auth, admin/trace lookup, etc.)
come later and aren't included here.

---

## 1. Database schema (Postgres)

```sql
CREATE TABLE anon_users (
  anon_id     UUID PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
  -- expires_at is sliding: reset to now() + 24h on every authenticated request,
  -- not fixed at creation time. Prevents an active session from expiring mid-use.
);

CREATE TABLE conversations (
  conversation_id         UUID PRIMARY KEY,
  anon_id                 UUID NOT NULL REFERENCES anon_users(anon_id) ON DELETE CASCADE,
  title                   TEXT,
  active_leaf_message_id  UUID,  -- FK to messages.message_id, added after messages exists
                                 -- (circular reference between the two tables — see note below)
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  message_id         UUID PRIMARY KEY,
  conversation_id     UUID NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  parent_message_id   UUID REFERENCES messages(message_id) ON DELETE CASCADE,  -- NULL = root
  role               TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content            TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'complete'
                       CHECK (status IN ('streaming', 'complete', 'stopped', 'failed')),
  request_id         UUID NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add after both tables exist, to resolve the circular reference:
ALTER TABLE conversations
  ADD CONSTRAINT fk_active_leaf
  FOREIGN KEY (active_leaf_message_id) REFERENCES messages(message_id) ON DELETE SET NULL;

CREATE TABLE documents (
  document_id      UUID PRIMARY KEY,
  conversation_id  UUID NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  filename         TEXT NOT NULL,
  file_type        TEXT NOT NULL,
  storage_key      TEXT NOT NULL,   -- object storage key/path, not the file itself
  size_bytes       INTEGER,
  status           TEXT NOT NULL DEFAULT 'uploading'
                     CHECK (status IN ('uploading', 'ready', 'failed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_conversations_anon_id ON conversations(anon_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_parent_message_id ON messages(parent_message_id);
CREATE INDEX idx_documents_conversation_id ON documents(conversation_id);
```

**Anonymous session issuance:** no dedicated endpoint. Any incoming request is checked (middleware)
for a valid, unexpired `anon_id` cookie. If missing or expired, the backend creates a new `anon_users`
row and sets the cookie on the response — happens transparently on whichever endpoint the client hits
first (typically `GET /conversations` on app load).

---

## 2. API endpoints

Every request carries the `anon_id` cookie automatically. Every write request that's part of a
generation (send, regenerate, stop) also carries an `X-Request-Id` header, client-generated, used as
the trace root and for correlating logs — never put it in the JSON body.

### Conversations

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/conversations` | — | List conversations for this `anon_id`, ordered by `updated_at` desc. Sidebar data. |
| GET | `/conversations/{conversationId}` | — | Returns conversation metadata + **all** message rows (flat list) for fetch-once-and-reconstruct. Ownership-checked against `anon_id`. |
| PATCH | `/conversations/{conversationId}` | `{ title? , activeLeafMessageId? }` | Partial update — rename, or persist a branch switch. Either field optional, at least one required. |
| DELETE | `/conversations/{conversationId}` | — | Hard delete. Cascades to messages and documents. |
| POST | `/conversations/{conversationId}/title/generate` | — | Backend looks up the first message itself and generates a title async — no message text passed in. |

### Messages

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/conversations/{conversationId}/messages` | `{ content, parentMessageId? }` | Handles first message, follow-up, and edit-as-branch through one path. Omit `parentMessageId` for a normal append (backend uses current `activeLeafMessageId`); pass it explicitly (the original message's parent) to create an edit branch. Creates the conversation row lazily if it doesn't exist yet. Requires `X-Request-Id`. |
| POST | `/conversations/{conversationId}/messages/{messageId}/regenerate` | — | Creates a new sibling reply for the given assistant message (parent derived from the target's own `parentMessageId`). Requires `X-Request-Id`. |
| POST | `/conversations/{conversationId}/messages/stop` | — | Cancels the in-flight run identified by `X-Request-Id`. |

### Documents

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/conversations/{conversationId}/documents` | — | Metadata only (`documentId`, `filename`, `fileType`, `status`, `sizeBytes`) — fast list for the attach popup. |
| GET | `/conversations/{conversationId}/documents/{docId}` | — | Full content for the View action — inline text for txt/md/code, presigned URL for PDF. |
| POST | `/conversations/{conversationId}/documents/upload-url` | `{ filename, contentType, size }` | Returns a presigned URL; the file uploads directly to object storage from the client, not through this API. |
| POST | `/conversations/{conversationId}/documents` | `{ storageKey, filename }` | Finalizes the upload, triggers chunk/embed/store ingestion. |
| PUT | `/conversations/{conversationId}/documents/{docId}` | `{ storageKey, filename }` | Replace — same upload-url flow first, then this call. Keeps the same `documentId`. |
| DELETE | `/conversations/{conversationId}/documents/{docId}` | — | Removes from storage, vector DB, and Postgres. |