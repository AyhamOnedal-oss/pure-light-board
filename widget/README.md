# Fuqah Chat Widget

Standalone storefront widget. Builds to a single IIFE bundle (`dist/widget.js`)
that gets uploaded to `https://widget.fuqah.net/widget.js`.

## Sync architecture

```
Dashboard UI ──save──▶ Supabase: settings_chat_design
                              │
                              ├──▶ widget-config edge fn ──▶ widget.js on storefront (Salla / Zid)
                              │     (60s edge cache)
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

## Source of truth

- Types live in `src/app/types/dashboardConfig.ts` (mirror of dashboard's copy in the parent project; keep them in sync).
- All settings come from `settings_chat_design` via the `widget-config` edge function.
- Conversation / event endpoints follow `src/app/docs/widget-integration-prompt.md` in the parent project.