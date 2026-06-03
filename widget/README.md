# Fuqah Chat Widget

Source for the storefront chat widget UI.

## DEPRECATED: standalone `widget.js` bundle

The old standalone IIFE bundle (`dist/widget.js` uploaded to
`widget.fuqah.net/widget.js`) is no longer used. It was a second copy of
the same React app and caused real-store traffic to keep running stale
code (e.g. image attachments dropped because the CDN had an old build).

**Single source of truth now:**

- The merchant storefront snippet loads the Supabase edge function
  `widget-loader`, which mounts a bubble and opens an iframe pointing at
  the main React app route `/widget/chat`.
- `/widget/chat` is implemented in `src/app/components/WidgetChatPage.tsx`
  in the parent project and imports the components from this `widget/src`
  folder directly. No separate build, no separate hosted bundle.

If `widget.fuqah.net/widget.js` is still referenced anywhere, replace it
with the Supabase widget-loader URL:

```html
<script src="https://kdrcgusinkqgwaafcgnw.supabase.co/functions/v1/widget-loader"
        data-platform="zid" data-store-id="{{store.id}}" data-store-uuid="{{store.uuid}}"
        defer></script>
```

## Sync architecture

```
Dashboard UI ──save──▶ Supabase: settings_chat_design
                              │
                              ├──▶ widget-config edge fn ──▶ widget.js on storefront (Salla / Zid)
                              │     (host/CDN cache; purge after JS fixes)
                              │
                              └──▶ postMessage FUQAH_CONFIG_UPDATE ──▶ iframe live preview (instant)
```

- **Storefront snippet**: loads the `widget-loader` Supabase edge function (see snippet above).
- **Tenant resolution**: `widget-loader` detects platform → calls `widget-resolve` → mounts the bubble + iframe.
- **Iframe target**: `/widget/chat` in the main React app (`src/app/components/WidgetChatPage.tsx`).
- **Live preview in dashboard**: dashboard embeds the widget in an iframe and posts `FUQAH_*` messages; `useDashboardBridge` applies them in real time.

## Scripts

```bash
cd widget
bun install
bun run dev      # local showcase preview at :5173 (developer-only)
```

## Deploy

Nothing to upload. Edit `widget/src/...`, the main app build picks the
components up automatically and serves them at `/widget/chat`.

## Source of truth

- Types live in `src/app/types/dashboardConfig.ts` (mirror of dashboard's copy in the parent project; keep them in sync).
- All settings come from `settings_chat_design` via the `widget-config` edge function.
- Conversation / event endpoints follow `src/app/docs/widget-integration-prompt.md` in the parent project.