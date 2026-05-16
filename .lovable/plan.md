## Root cause of the 401 / RLS error

Reproduced the exact error with a raw anon REST call. The RLS policy `tickets_anon_insert_widget` exists and its `WITH CHECK` conditions are satisfied (tenant exists, status='open', no assignee, no resolved_at).

The real problem: **`tickets_main` has zero table privileges granted to any role** (`information_schema.role_table_grants` returns empty). In Postgres, RLS policies only kick in *after* the table-level `GRANT` check passes. Without `GRANT INSERT` to `anon`, Postgres returns the misleading "row violates row-level security policy" error even though the policy itself would allow the row.

## Fix 1 — Database migration

Grant the widget (anon) exactly what it needs to insert a ticket and read back the new row's `id` / `display_code` / `number`:

```sql
GRANT INSERT, SELECT ON public.tickets_main TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.tickets_number_seq TO anon;
```

SELECT is required because the widget uses `Prefer: return=representation` to read the assigned `display_code` and `number`. The `WHERE` clause on SELECT is already locked down by the existing `tickets_view` policy (which doesn't grant anon any rows), so anon can only see the row it just inserted via `RETURNING`.

After this migration, the same anon POST that currently returns 401 will succeed.

## Fix 2 — The flag

The `widget.js` artifact I generated yesterday (v3.6.0, in `/mnt/documents/widget.js`) already contains the correct flag fix — `flagSVG()` wraps the SVG in a `<span>` with explicit inline dimensions and `display:inline-block`, and forces the inner `<svg>` to `display:block; width:100%; height:100%` with `preserveAspectRatio="none"`. Verified in the file at lines 297–300.

Your screenshot shows the OLD flag rendering (plain green block, no white sword/text marks). That means the `widget.js` running on `widget.fuqah.net` is still the old v3.5.0 file — either it wasn't re-uploaded to Hostinger, or the browser/CDN is serving a cached copy.

**To verify**, open `https://widget.fuqah.net/widget.js` in a new tab and check the first few lines. The version comment should read `v3.6.0`. If it still says `3.5.0`:
- Re-upload `/mnt/documents/widget.js` to Hostinger, overwriting the existing file.
- Hard-refresh the test page (Ctrl/Cmd+Shift+R) or load it with `?v=360` appended to the script URL to bust browser cache.
- If Hostinger has any caching/CDN layer, purge it.

I won't re-edit `widget.js` for the flag — the code is already correct. The issue is deployment, not code.

## What I'll do after you approve

1. Run the SQL migration above (grants only — no schema changes, no data changes).
2. Confirm with a fresh anon POST that the insert now returns 201 with the real `TKT-{n}`.
3. Ask you to re-upload the existing `/mnt/documents/widget.js` and hard-refresh.

No changes to `widget.js` are needed for either fix.
