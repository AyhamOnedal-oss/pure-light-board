# Plan: ship product cards in real widget (4.7.5 → 4.7.6) + expose n8n workflow

## 1. Patch the production widget
Read `/mnt/documents/widget-4.7.5.js`, locate the chat-response handler and AI-message render path. Add surgical changes:

- After parsing the edge-function reply, also read `attachments` array of `{type:"product_card", id, name, price, sale_price, image_url, url}`.
- After appending the AI text bubble, if `attachments` exist, render a horizontal-scroll row of product cards beneath it: image, name, price (with sale_price strikethrough when present), and a button **"عرض المنتج"** linking to `url` (opens in new tab).
- RTL-friendly, uses existing widget styling conventions (inline styles or existing CSS classes — no new external stylesheet).
- Cap render at 5 cards; silently ignore unknown attachment types.
- Bump internal version constant to `4.7.6`.

Outputs:
- `/mnt/documents/widget-4.7.6.js` (new)
- `/mnt/documents/widget.js` mirrored to 4.7.6
- `/mnt/documents/widget-v4.7.6-notes.md` short changelog
- Append 4.7.6 entry to `/mnt/documents/widget.changelog.md`

## 2. Expose n8n workflow in Files view
Copy `docs/n8n/fuqah-zid-workflow-v1.json` → `/mnt/documents/fuqah-zid-workflow-v1.json` so it appears alongside the widget files.

## 3. QA
- grep patched widget for `attachments` handling and `4.7.6` version string.
- Confirm file-size delta is sane (a few KB larger, not truncated).
- No preview test — standalone JS loaded by Zid, not by this Lovable app.

## Out of scope
- No edits to `widget/src/...` React tree (not what ships).
- No Supabase product cache, token-fetch function, or multi-tenant resolution.
- `supabase/functions/chat-ai/index.ts` already forwards `attachments` from prior turn — no change.
