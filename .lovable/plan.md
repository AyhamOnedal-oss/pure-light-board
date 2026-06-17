## Problem

When the AI replies with a product image, it sends a plain URL (e.g. `https://media.zid.store/.../...jpg`) instead of showing the actual image. The reply text comes from the n8n agent, but the chat UIs only linkify URLs — they never render them as `<img>`.

## Fix

Detect image URLs inside AI message text and render them as an inline image (still clickable to open full size), in addition to (or replacing) the raw link. Applies wherever the AI reply is shown.

### Files to update

1. **`src/app/components/chat/LinkifiedText.tsx`** (dashboard: Conversations, Tickets, Test Chat)
   - In the URL branch, if the URL looks like an image, render a small thumbnail (`<img>` ~240px wide, rounded, `object-cover`) wrapped in an `<a target="_blank">` so clicking opens the original.
   - Otherwise, keep current anchor behavior.

2. **`widget/src/app/components/MessageTextWithLinks.tsx`** (storefront widget)
   - Same change: image URLs become an inline `<img>` (max-width 220px, rounded 12px) inside an anchor.
   - Add `onError` fallback that reverts to the existing text link if the image fails to load (CORS / hotlink protection).

3. **Rebuild `public/widget-4.7.32-hostinger.js`** so the storefront snippet picks up the new widget behavior (bump to `4.7.33-hostinger.js` to bust Hostinger/CDN cache; update version constants accordingly).

### Image-URL detection

Single shared rule, used by both renderers:

- Ends with `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.avif` (optionally followed by `?query`), case-insensitive, **or**
- Hostname matches a known image CDN: `media.zid.store`, `cdn.salla.sa`, `cdn.youcan.shop`, `images.unsplash.com`, `picsum.photos`.

### Out of scope

- No change to the n8n agent prompt — the URL stays in the reply text; we just render it visually.
- No new attachments pipeline; the AI's `attachments` array is untouched.
- No change to how customer-sent images render (already handled by `AttachmentBubble`).

### Verification

- Send a message in Test Chat / storefront that triggers a product image URL in the reply → image renders inline, clicking opens original in new tab.
- Send a normal product link (non-image URL) → still a plain blue link.
- Break the image URL (404) → falls back to showing the text link.
