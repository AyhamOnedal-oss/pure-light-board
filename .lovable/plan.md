## 1. IQ Test daily token cap (300k input / 30k output)

The DB already enforces per-tenant daily IQ caps via `iqtest_can_use(_tenant)` and increments through `iqtest_increment`. Current caps are `300000` input / `3000` output. Only the output cap needs to change to `30000`, and it should apply uniformly to trial and paid tenants (already the case — the function doesn't check plan).

**Changes**
- Migration: update `public.iqtest_can_use` so `_out_cap := 30000` (input stays `300000`). Reset is already daily at Riyadh midnight via `riyadh_today()`.
- No frontend code change needed — the IQ Test screen already reads limits from this RPC and shows remaining input/output tokens + reset time. Verify the wording says "resets daily 12:00 AM".

## 2. Make Inactivity Timer mandatory with hard cap on the 3rd (rating) idle

Currently the merchant can toggle the whole timer off, which lets conversations stay open forever and breaks conversation counting/quota logic.

**Changes in `src/app/components/settings/ChatCustomization.tsx`**
- Remove the "Enabled/Disabled" toggle for the Inactivity Timer. The section is always on. Keep the two sliders (prompt idle, auto-close after prompt) and the rating idle input visible at all times.
- Force `inactivityEnabled = true` on load, on save, and when normalizing DB rows (drop `handleInactivityToggle` and the "Timer disabled" placeholder branch).
- Tighten the rating (3rd) idle cap: change `RATING_MAX` from `3600` to `900` (15 min). Clamp `ratingInactivitySeconds` to `[RATING_MIN, 900]` on load, on typed input, and on +/− buttons. Keep `DEFAULT_RATING = 900`.
- Update the helper copy under the rating field to state the 15-minute hard limit in both languages.

**Backend safety net (migration)**
- Add a `BEFORE INSERT/UPDATE` trigger on `public.settings_chat_design` that:
  - Forces `inactivity_enabled = true`.
  - Clamps `rating_inactivity_seconds` into `[30, 900]` (defaulting NULL to 900).
  - Leaves prompt/close sliders within their existing ranges.
- Backfill: `UPDATE settings_chat_design SET inactivity_enabled = true, rating_inactivity_seconds = LEAST(COALESCE(rating_inactivity_seconds, 900), 900)` so existing tenants immediately conform.

**Widget/runtime**
- No widget code change required as long as the widget already honors `inactivity_enabled` + `rating_inactivity_seconds` from `settings_chat_design`; the values will now always be present and ≤ 900s.

## Out of scope
- No changes to conversation counting logic, plan quotas, or the chat-ai edge function — this plan only enforces the timer so conversations always close, which lets the existing counters behave correctly.
