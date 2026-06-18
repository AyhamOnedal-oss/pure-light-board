## Goal
Route Zid stores to one n8n webhook and Salla stores to a different one, from inside `chat-ai`.

## Approach
Per-platform webhook URLs via secrets, selected at request time using the already-resolved `platform` value. No widget.js or DB changes — the widget already sends `platform`, and `chat-ai` already resolves it (`resolvedPlatform = workspace?.platform ?? platform`).

## Changes

### 1. New secrets
- `N8N_WEBHOOK_URL_ZID` — Zid workflow URL (webhook A, the current one)
- `N8N_WEBHOOK_URL_SALLA` — Salla workflow URL (webhook B, new)
- Keep `N8N_WEBHOOK_URL` as a fallback for unknown/manual platforms and backward compat.

I'll prompt for both via `add_secret` at build time.

### 2. `supabase/functions/chat-ai/index.ts`
- Read all three env vars at top of file.
- Add a tiny resolver:
  ```ts
  function pickN8nUrl(platform: string | null): string {
    if (platform === "zid")   return Deno.env.get("N8N_WEBHOOK_URL_ZID")   || N8N_WEBHOOK_URL;
    if (platform === "salla") return Deno.env.get("N8N_WEBHOOK_URL_SALLA") || N8N_WEBHOOK_URL;
    return N8N_WEBHOOK_URL;
  }
  ```
- Replace the single `N8N_WEBHOOK_URL` usage (lines ~941, 963, 965) with `const n8nUrl = pickN8nUrl(resolvedPlatform);` and use `n8nUrl` for the empty-check, the log line, and the `fetch()` call.
- Update the log to show which platform/url kind was chosen, for debugging.

### 3. Docs
Append a short note to `docs/n8n-integration.md` explaining the two secrets and that routing is automatic by `platform`.

## Out of scope
- No changes to widget.js (4.7.33 stays as-is).
- No changes to `widget-bootstrap`, `widget-resolve`, or the dashboard.
- No per-tenant webhook override (can be added later by reading a column on `settings_workspace` if needed).

## Validation
1. Set both secrets to distinct test webhooks.
2. Open a Zid storefront → message lands in webhook A only.
3. Open a Salla storefront → message lands in webhook B only.
4. Check `chat-ai` logs: `n8n webhook platform=zid|salla url-kind=PRODUCTION`.
