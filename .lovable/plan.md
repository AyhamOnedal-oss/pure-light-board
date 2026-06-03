## Goal
Make the live store, dashboard preview, and image upload test use the same widget/chat path so we stop fixing one path while the customer sees another.

## Simplest path

1. **Keep one working runtime path**
   - Keep the Supabase `widget-loader` → iframe flow.
   - This means the storefront bubble opens:
     ```text
     APP_BASE_URL/widget/chat?tenant_id=...&platform=...&store_id=...
     ```
   - This path uses the React widget code where image `dataUrl` sending already exists.

2. **Add the missing `/widget/chat` app route**
   - Add a public, no-auth route in the main React app.
   - It renders only the actual chat widget UI, not the dashboard layout, not the test chat page.
   - It reads `tenant_id`, `platform`, `store_id`, and `store_uuid` from the iframe URL.

3. **Make the iframe chat route use the existing widget code**
   - Reuse the existing widget components instead of creating a second chat implementation.
   - Ensure image selection still creates a base64 `dataUrl` and forwards it into `sendBackendMessage`.
   - Keep the dashboard test chat as a separate testing screen, but not as the storefront runtime.

4. **Delete/retire the broken standalone hosted bundle path**
   - Stop treating `widget/dist/widget.js` / Hostinger CDN bundle as the source of truth.
   - Remove or clearly deprecate the standalone widget build docs/scripts so future fixes are not applied to the wrong bundle.
   - The official storefront snippet should load the Supabase `widget-loader` endpoint, or `widget.fuqah.net/widget.js` should become only a thin proxy to that loader, not a separate widget app.

5. **Keep backend behavior unchanged except verification logs**
   - `chat-ai` already works when it receives image attachments.
   - Keep the existing `attachments_in` and `vision_usage` logs.
   - No database schema changes needed.

6. **Validation after implementation**
   - Open `/widget/chat?...` directly and send a product image.
   - Confirm the browser request to `chat-ai` contains `attachments` with a `data:image/...` URL.
   - Confirm Supabase logs show:
     ```text
     attachments_in.count = 1
     url_kinds = ["data"]
     vision_usage
     ```
   - Confirm the saved customer message has non-empty `attachments`.

## Files likely affected
- `src/app/routes.tsx`
- New small route component for `/widget/chat`
- `widget/src/app/components/*` only if the route integration exposes a gap
- `widget/README.md` and root build script/docs to remove the stale Hostinger-bundle deployment path
- Possibly `supabase/functions/widget-loader/index.ts` only if the snippet URL or query params need cleanup