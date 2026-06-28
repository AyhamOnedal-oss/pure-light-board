## Two small fixes in `src/app/components/admin/AdminCustomerDetails.tsx`

### 1. Bubble actions — strict mutual exclusivity

Today both "تفعيل الفقاعة" and "تعطيل الفقاعة" render at all times, only greyed via `disabled:opacity-40`. The user wants it unambiguous: when the bubble is currently **active**, only **تعطيل** is offered (and vice‑versa).

- Compute `bubbleOn` from `data.bubbleEnabled` exactly as today.
- In the `ACCOUNT_ACTIONS` builder, drop the action that isn't applicable instead of pushing it as `disabled`:
  - if `bubbleOn` → include `disable_bubble` only.
  - if `!bubbleOn` → include `enable_bubble` only.
- Add a `title` tooltip on the visible button (e.g. "الفقاعة مفعّلة حالياً — اضغط للتعطيل") so the admin understands the current state.
- Keep the existing edge‑function call (`admin-subscription-actions` already sets `bubble_visible` + `bubble_admin_locked` correctly) and the `loadCustomer()` refresh after the action so the button flips immediately.

### 2. "Login as Customer" — popup‑blocker safe

Today: `await supabase.functions.invoke(...)` runs first, then `window.open(res.url, ...)`. Because the `window.open` happens after an `await`, Chrome/Safari treat it as a programmatic open and block it the first time. After the user manually allows pop‑ups, the second click works — which matches the reported behaviour.

Fix in the `impersonate` handler:

1. Synchronously open a placeholder tab **inside the click handler, before any await**:
   ```ts
   const popup = window.open('about:blank', '_blank');
   ```
2. Run the edge‑function call.
3. On success: `popup ? (popup.location.href = res.url) : window.location.assign(res.url)` — so if the browser still blocked the popup we fall back to navigating the current tab (after a confirm) instead of silently failing.
4. On error: `popup?.close()` and toast the existing error.

No backend, schema, or other component changes. All work stays inside `AdminCustomerDetails.tsx`.
