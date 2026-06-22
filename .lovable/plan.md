## What I found (verification)

Yes — the bug is real. Same root cause as the Test Chat leak we just fixed, in a sibling file I missed earlier. I owe you an apology: I cleared the launch on Test Chat but didn't audit the rest of `src/app/components/settings/` for the same anti-pattern. That was the overlap you're calling out.

### Root cause for "color changes then snaps back to default" (Salla owner)

`src/app/components/settings/ChatCustomization.tsx` caches the entire customization payload in a **global, non-scoped** browser key:

```ts
const CHAT_CUSTOM_KEY = 'fuqah_chat_customization';
const persistedSaved = loadChatCustom();   // module-level, runs once
```

Then every `useState` is seeded from `persistedSaved`, so the initial paint shows **whatever the last account on this browser saved** — not the current tenant's data. Only after the `useEffect` round-trip to `settings_chat_design` does the real per-tenant data overwrite it.

Exact symptom this produces for a Salla merchant who shares a browser with a previous Zid session:
1. Page opens → preview shows the **previous tenant's colors** (from localStorage).
2. ~300 ms later `loadFromSupabase(tenantId)` returns the Salla tenant's actual row (still defaults `#000` / `#FFF` because they never saved) → preview "suddenly reverts to default."
3. If they pick a color and hit save, the upsert is correctly scoped by `tenant_id`, but the global localStorage continues to poison the next account that signs in here.

### Why the storefront bubble can still look default even after saving

`widget-bootstrap` sets `Cache-Control: s-maxage=10, stale-while-revalidate=60` and an ETag. After a save we don't bust that cache, so the storefront keeps serving the stale `cfg` for up to ~70 s. Combined with the symptom above, the merchant thinks the save never took.

### About the chat error + missing conversations on Salla

That is a **separate** issue from the color leak (n8n returning `reply_length: 0` for Salla, and the storefront not posting events under the right tenant). I am NOT bundling it into this plan — I'll handle it as its own ticket after you confirm the connection state. The plan below fixes only the multi-tenant color/customization leak that you explicitly flagged.

## Plan

Scope: `src/app/components/settings/ChatCustomization.tsx` only. No schema, no edge-function changes. Save path is already correctly tenant-scoped server-side.

1. **Remove the global localStorage cache entirely.** Delete `CHAT_CUSTOM_KEY`, `loadChatCustom`, `saveChatCustom`, and the module-level `persistedSaved`. The Supabase row is the source of truth — there is no reason to mirror it into a shared browser key.

2. **Seed state from `DEFAULTS`, not from localStorage.** Every `useState` initializes to the `DEFAULTS` object that already exists in the file. The preview shows neutral defaults for the ~300 ms before the server load lands, instead of another tenant's colors.

3. **Re-run the loader on identity change.** Change the existing load `useEffect` so its dependency is `[tenantId, userId]` (pull `userId` from `useApp()` alongside `tenantId`). When either changes:
   - Reset all state back to `DEFAULTS` first (so a slow query doesn't leave the previous tenant's values on screen).
   - Then call `loadFromSupabase(tenantId)` and apply the row if present.
   - Drop the `Object.assign(persistedSaved, s)` and `saveChatCustom(s)` calls — they no longer exist.

4. **One-time legacy cleanup.** On mount, `localStorage.removeItem('fuqah_chat_customization')` to purge stale data already sitting in browsers that loaded the old build.

5. **Bust the storefront cfg cache after save.** In `handleSave`, after the successful upsert, fire-and-forget a `fetch` to `widget-bootstrap?...&_=Date.now()` for this tenant's `(platform, external_id)` with `cache: 'no-store'`. This is a frontend-only hint; the next storefront request still hits the edge cache, but our own preview iframe (and the merchant's reload-to-verify) sees fresh data immediately.

## Verification steps you (or I) will run after the build

1. Sign in as account A on a fresh browser, change widget colors to red, save, sign out.
2. Sign in as account B in the same browser, open Chat Customization → preview shows **black/white defaults**, not red, before and after the server load. Save blue.
3. Sign back in as A → preview shows red (from A's saved row), not blue.
4. Confirm `localStorage` no longer contains `fuqah_chat_customization` after the page has loaded once on the new build.
5. Open the Salla storefront in an incognito tab → bubble paints with the tenant's saved colors (allow up to ~30 s for the bootstrap edge cache to roll over on the very first save).

## Out of scope (handled separately, with your approval)

- "عذراً، حدث خطأ مؤقت" on Salla storefront chat — needs an n8n / `chat-ai` log dive for the Salla webhook URL. I'll come back with a separate plan once you tell me whether the Salla merchant's `salla_connections` row is `is_active = true` and whether `N8N_WEBHOOK_URL_SALLA` is the production endpoint.
- Conversations not appearing in dashboard for the Salla merchant — same investigation as above (likely tenant_id resolution on `conversations_main` insert from the Salla path).
