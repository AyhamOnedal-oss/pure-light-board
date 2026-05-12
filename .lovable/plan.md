## Problem

The Zid storefront for store `3128909` (OAuth-connected, email `dfolxp9bgd@…`, tenant `95663988-…`) does not show the Fuqah bubble.

Root cause is in `supabase/functions/widget-resolve/index.ts`. For Zid it does:

```ts
.from("zid_connections").select(...).eq("store_uuid", externalId)
```

But the loader (`widget-loader/index.ts`) reads the storefront's identifier from `<meta name="zid-store-id">` / `window.zid.store_uuid`, and Zid themes expose the **numeric** `{{store.id}}` (`3128909`), not the long UUID. So the lookup never matches → `tenant_id: null` → loader bails silently → no widget.

The shared helper `_shared/resolve-tenant.ts` (used by `chat-ai`) already handles both columns via `.or("store_uuid.eq.X,store_id.eq.X")`. `widget-resolve` was never updated to match.

There is also a stale seed row (`store_uuid='zid-3128909'`, `is_active=false`, same tenant) that should be deleted to avoid future ambiguity.

## Plan

1. **Patch `supabase/functions/widget-resolve/index.ts`** — for the `zid` branch, replace the single `.eq("store_uuid", externalId)` with `.or("store_uuid.eq.<id>,store_id.eq.<id>")` and prefer `is_active=true` rows. Mirrors `resolve-tenant.ts`.

2. **Delete the stale seed row** in `zid_connections` (the one with `store_uuid='zid-3128909'`, `is_active=false`) so only the real OAuth row remains for tenant `95663988-…`. Done via a one-off SQL migration.

3. **Verify** — after deploy, hitting
   `…/functions/v1/widget-resolve?platform=zid&external_id=3128909`
   should return `{ tenant_id: "95663988-…", is_active: true }`. Then a hard refresh of the storefront should mount the bubble.

## Out of scope

- No changes to `widget.js`, `chat-ai`, RLS, or the dashboard.
- No change to how the Zid loader detects context — numeric id stays the source of truth.
