## Goal
Make Test Chat history strictly private per (user, tenant) so a different store account on the same browser never sees another account's test messages, and a team member never sees the owner's test messages.

## Verified root cause
`src/app/components/settings/TestChat.tsx`:
- Line 15: `const STORAGE_KEY = 'fuqah_test_chat_messages';` — a single global key.
- Line 58: `const CONV_KEY = 'fuqah_test_chat_conversation_id';` — same problem.
- Lines 86–87 read these once on mount; nothing reloads when the logged-in user or `tenantId` changes.

Result: any user that signs into the dashboard on the same browser sees the previous occupant's Test Chat messages and continues their conversation id. Confirmed by the user (Zid account → logout → Salla account on same browser shows the same content; different browser shows different content).

## Fix

Scope persistence per `(userId, tenantId)` and reset state when either changes.

1. **Read `session` from `useApp()`** alongside `tenantId` to derive a stable `userId = session?.user?.id ?? null`.
2. **Per-scope storage keys** — when both ids are present, use:
   - `fuqah_test_chat_messages:v2:{userId}:{tenantId}`
   - `fuqah_test_chat_conversation_id:v2:{userId}:{tenantId}`
   When either id is missing, hold state in memory only (no localStorage write/read) so we never persist under a global key again.
3. **Reload on identity change** — a `useEffect` keyed on `(userId, tenantId)`:
   - Reads the scoped messages key into state (empty array if missing).
   - Reads or generates the scoped conversation id and writes it back under the same scoped key.
4. **One-time cleanup** — on mount, `localStorage.removeItem('fuqah_test_chat_messages')` and `removeItem('fuqah_test_chat_conversation_id')` to purge the legacy unscoped entries so no leftover data can leak after this deploy.
5. **Persist effect** — the existing "save on messages change" effect writes to the current scoped key (skip the write when ids are not yet known).
6. **Clear Chat** — `clearChat` removes the scoped messages key and writes a fresh conversation id under the scoped conversation key (no global keys touched).

## Out of scope
- No backend, schema, or edge-function changes — Test Chat already sends `tenant_id` and a `test-${tenantId}` visitor id to `chat-ai`, and persisted messages on the server are already tenant-scoped. The leak is purely the local cache.
- Widget storefront chat is unaffected (different storage, visitor-id based).

## Verification
- Sign in as account A on a fresh browser, send a Test Chat message, sign out.
- Sign in as account B in the same browser → Test Chat must be empty.
- Switch back to account A → A's previous messages reappear.
- Owner sends a Test Chat message; team member of the same tenant signs in on the same browser → team member sees an empty Test Chat (different `userId` in the key).
- After deploy, confirm `localStorage` no longer contains the old unscoped `fuqah_test_chat_messages` / `fuqah_test_chat_conversation_id` keys.
