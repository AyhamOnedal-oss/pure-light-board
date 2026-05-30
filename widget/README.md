# Fuqah Chat Widget

Standalone storefront widget. Builds to a single IIFE bundle (`dist/widget.js`)
that gets uploaded to `https://widget.fuqah.net/widget.js`.

## Sync architecture

```
Dashboard UI ──save──▶ Supabase: settings_chat_design
                              │
                              ├──▶ widget-config edge fn ──▶ widget.js on storefront (Salla / Zid)
                              │     (host/CDN cache; purge after JS fixes)
                              │
                              └──▶ postMessage FUQAH_CONFIG_UPDATE ──▶ iframe live preview (instant)
```

- **Storefront snippet** (unchanged): `<script src="https://widget.fuqah.net/widget.js"></script>`
- **Tenant resolution**: `widget-loader` edge function detects platform → calls `widget-resolve` → loads this bundle.
- **Live preview in dashboard**: dashboard embeds the widget in an iframe and posts `FUQAH_*` messages; `useDashboardBridge` applies them in real time.

## Scripts

```bash
cd widget
bun install
bun run dev      # local preview at :5173
bun run build    # outputs dist/widget.js
```

## Deploy

Upload `widget/dist/widget.js` to whatever hosts `widget.fuqah.net` (Cloudflare R2, S3, etc.). Cache it short (5–15 min) so design tweaks propagate without forcing merchants to bust cache.

After functional widget fixes, rebuild the standalone bundle and replace the hosted `widget.js`. If the CDN responds with a long cache header (for example `max-age=604800`), purge that file from the CDN; otherwise stores can keep running an older bundle even when the React source is fixed.

## Source of truth

- Types live in `src/app/types/dashboardConfig.ts` (mirror of dashboard's copy in the parent project; keep them in sync).
- All settings come from `settings_chat_design` via the `widget-config` edge function.
- Conversation / event endpoints follow `src/app/docs/widget-integration-prompt.md` in the parent project.