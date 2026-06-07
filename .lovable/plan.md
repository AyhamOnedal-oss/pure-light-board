## Fix WhatsApp wa.me links in Tickets

The current WhatsApp link in Tickets strips `+` and spaces but leaves the local trunk `0` after the country code, producing invalid `wa.me` URLs like `9620796675249` instead of `962796675249`.

### Changes

1. **Widget — store correct international number**
   - `widget/src/app/components/ChatWindow.tsx`
   - In both `handleInlineTicketSubmit` and `handleTicketFormSubmit`, strip leading `0` from the local phone digits before concatenating with `dialCode`.
   - This makes `customer_phone` store true E.164-ish format (e.g. `+962796675249`).

2. **Dashboard — robust wa.me normalization**
   - `src/app/components/TicketsPage.tsx`
   - Add a `toWhatsAppUrl(phone)` helper that:
     - Keeps only digits
     - Recognises the known MENA country codes used in the app (962, 966, 971, 965, 974, 973, 968, 967, 964, 20)
     - Removes a leading `0` that appears immediately after the country code
     - Produces `https://wa.me/<normalized>`
   - Replace the inline `href={`https://wa.me/...`}` with this helper.
   - This fixes existing tickets that were already saved with the extra `0`, and future tickets once the widget fix lands.

### Result
Clicking the WhatsApp icon in any ticket opens `wa.me/962796675249` (etc.) correctly.