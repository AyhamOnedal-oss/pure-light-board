# Plan — widget v4.7.29 hardened fixes

The 4.7.28 file already attempted these fixes, but they're still visible. Either the file on Hostinger is stale, or the edge case isn't covered (AI returns the prompt as plain prose without `intent === 'offer_ticket'`). v4.7.29 will close every gap so the issues cannot reappear regardless of what the backend returns.

## 1. Duplicate ticket-prompt bubble (image 1)
Keep only the green/circled prompt (`يرجى إدخال رقم هاتفك ليتم إنشاء تذكرة دعم لك:` from `appendInlineTicketForm`). Erase the AI prose version (`تمام، يرجى إدخال رقم هاتفك ليتم فتح تذكرة دعم لك:`).

Edit in `doSend`'s backend callback (~line 1681–1700):
- If `intent === 'offer_ticket'` OR the returned `aiText` matches a ticket-offer regex (`/(ادخل|أدخل|إدخال).{0,30}(رقم.{0,5}هاتف|جوّال|جوال)/` together with `/تذكرة/`), suppress `pushAiMessage(aiText)` entirely and only call `appendInlineTicketForm('backend')`.
- Delete the now-dead second `if (false && intent === 'offer_ticket'…)` block.

## 2. Duplicate ticket-confirmation bubble (image 2)
Keep the green inline `تم إرسال طلبك بنجاح` success badge. Erase the blue store-message `تم استلام رقمك ✅ سيتواصل معك أحد موظفي خدمة العملاء…`.

Edits:
- Lines 1800–1804: remove the `state.messages.push({ … text: 'تم استلام رقمك ✅ …' })` block.
- Lines 2231–2235: remove the identical push inside the ticket-form submit handler.

## 3. Back arrow on ticket-created screen (image 3)
`renderTicketCreatedScreen` already omits `backBtn`, but to make it impossible by construction:
- Add a CSS rule scoped via a body class: when `state.currentScreen === 'ticket-created'`, set `dom.window.classList.add('fq-ticket-locked')` and add `.fq-ticket-locked .fq-screen-back { display:none !important; }` to `FQ_INLINE_CSS`.
- Remove the class on any other `render*Screen` call.

This guarantees that even if a cached/old code path tries to render a back button on the ticket-created screen, it cannot appear.

## 4. Version bump + delivery
- Bump header comment to `Version: 4.7.29 (Hostinger embed: harden ticket prompt/confirm dedupe + lock back arrow after ticket)`.
- Save to `/mnt/documents/widget-4.7.29-hostinger.js` and `public/widget-4.7.29-hostinger.js`.

## Verification before handoff
- File starts with `/** Fuqah AI Chat Widget — Embeddable Script`.
- Size ~170 KB, not the 450 KB minified bundle.
- `grep` confirms:
  - no remaining `'تم استلام رقمك ✅ سيتواصل معك'` push,
  - no `backBtn` inside `renderTicketCreatedScreen`,
  - new `.fq-ticket-locked .fq-screen-back { display:none }` rule present,
  - regex fallback for offer-ticket prose present.
