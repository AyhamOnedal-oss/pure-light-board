## Fix 3 issues on Admin Customer Details page

### 1. Notes — show display name + confirm delete
- **Add note**: resolve author name from `public.settings_account.display_name` (fallback to user_metadata.full_name, then "Admin"). Never fall back to the email.
- **Existing notes** with `author_name` containing an email: load the matching display name from `settings_account` by `author_id` and prefer that for rendering.
- **Delete**: replace the silent delete with a confirmation modal ("حذف الملاحظة؟ لا يمكن التراجع.") reusing the existing confirm-modal pattern used for "حذف الحساب".

### 2. Remove "إرسال رابط إعادة تعيين البريد"
- Remove the `send_email_reset` entry from `ACCOUNT_ACTIONS` in `AdminCustomerDetails.tsx`.
- Remove the `send_email_reset` branch from `supabase/functions/admin-subscription-actions/index.ts`.
- Leave password reset action intact.

### 3. Bubble enable/disable — actually take effect + lock user toggle
Today the admin action writes `settings_chat_design.bubble_enabled`, but the widget and the user-facing toggle ("إظهار فقاعة المحادثة") read `settings_train_ai.bubble_visible`. That's why nothing changes. Fix end-to-end:

**Database (migration):**
- Add `bubble_admin_locked boolean NOT NULL DEFAULT false` to `settings_train_ai`.
- (No new table.) Keep `bubble_visible` as the single source of truth the widget already honours.

**Edge function `admin-subscription-actions`:**
- `disable_bubble` → `UPDATE settings_train_ai SET bubble_visible = false, bubble_admin_locked = true`.
- `enable_bubble`  → `UPDATE settings_train_ai SET bubble_visible = true,  bubble_admin_locked = false`.
- Upsert if no row exists. Keep logging to `admin_activity_events`.

**Admin UI (`AdminCustomerDetails.tsx`):**
- Read `bubble_visible` + `bubble_admin_locked` from `settings_train_ai` instead of `settings_chat_design.bubble_enabled` to compute the enabled/disabled state of the two admin buttons.

**User-facing toggle (`ChatCustomization.tsx`):**
- Also select `bubble_admin_locked` and subscribe to it on realtime.
- When `bubble_admin_locked === true`:
  - Force the switch to OFF and `disabled`.
  - Show inline Arabic message under the toggle: "تم تعطيل الفقاعة من قبل الإدارة. للتفعيل، يرجى التواصل مع الدعم."
  - Block any save that would set `bubble_visible = true` (defensive guard; the DB still trusts the admin flag).

### Out of scope
- No design/visual changes beyond the inline locked-state hint.
- No changes to widget runtime (it already hides when `bubble_visible = false`).

### Technical notes
- Files touched: `src/app/components/admin/AdminCustomerDetails.tsx`, `src/app/components/settings/ChatCustomization.tsx`, `supabase/functions/admin-subscription-actions/index.ts`, one new SQL migration.
- The existing `settings_chat_design.bubble_enabled` column is left in place but no longer read/written (dead, harmless).
