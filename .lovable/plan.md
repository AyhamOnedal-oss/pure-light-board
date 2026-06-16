## What's happening

The "إعادة التصميم الافتراضي" button on `/dashboard/settings/customize` only mutates **local React state** (`applyDefaults` in `src/app/components/settings/ChatCustomization.tsx`). The actual write to `public.settings_chat_design` happens when the user then clicks "حفظ التغييرات" → `saveToSupabase` → `supabase.from('settings_chat_design').upsert(...)`.

That upsert is gated by RLS:

```
policy chat_widget_write USING / WITH CHECK
  member_can(tenant_id, auth.uid(), 'settings_chat_design')
```

And `member_can(_tenant, _user, _key)` returns true only if:
- the caller is tenant `admin`/`owner`, OR
- super_admin, OR
- `team_members.permissions ->> _key = 'true'` — i.e. the **exact** sub-key `settings_chat_design`.

The same shape is mirrored client-side: `isAllowed` requires both `perms.settings` and `perms.settings_chat_design` to be true for any `settings_*` route, and `handleSave` swallows the RLS denial in a `catch` and shows "تم الحفظ محلياً (خطأ في الخادم)" — so to the member the Reset+Save flow looks like nothing happened. The same problem exists on every other settings sub-page (Train AI, Account, Store, Plans) because each of them is gated by its own `settings_<name>` permission key.

You want a simpler rule: **granting a member the parent `settings` permission should let them do everything inside settings**, and any button visible to them must actually work end-to-end.

## Plan

### 1. Loosen `member_can` so the parent `settings` permission covers every `settings_*` sub-key (database migration)

Update `public.member_can(_tenant uuid, _user uuid, _key text)` so that, when `_key` starts with `settings_`, it also returns true if `permissions ->> 'settings' = 'true'`. Owner/admin and super_admin paths stay unchanged.

Pseudocode of the new body:

```
select
     tenant_role_at_least(_tenant, _user, 'admin')
  or has_role(_user, 'super_admin')
  or exists (
       select 1 from public.team_members
       where tenant_id = _tenant and user_id = _user
         and (
           coalesce((permissions ->> _key)::boolean, false)
           or (
             _key like 'settings\_%' escape '\'
             and coalesce((permissions ->> 'settings')::boolean, false)
           )
         )
     );
```

This fixes the actual cause of the silent failure for every sub-settings RLS policy (`settings_chat_design`, `settings_train_ai`, `settings_account`, `settings_store`, `settings_plans`, `settings_test_chat`) in one place — no per-table policy changes needed.

### 2. Mirror the rule in the frontend permission helper

In `src/app/utils/permissions.ts`, change `isAllowed` so that for any `settings_*` key, having `perms.settings === true` is sufficient:

```ts
if (key.startsWith('settings_')) {
  return !!perms.settings;          // parent perm grants all sub-pages
}
```

`firstAllowedPath` keeps working because the existing fallback already routes into the first sub-page when `perms.settings` is true.

This means: as soon as you tick "الإعدادات" for a member, they get every sub-page; the sub-key checkboxes in the team modal become an optional finer-grained override (still respected if `settings` is off and a specific sub-key is on).

### 3. Surface real errors instead of "saved locally"

In `src/app/components/settings/ChatCustomization.tsx#handleSave`, when `saveToSupabase` throws, also log to console with the original error and show the actual server message in the toast (e.g. "خطأ: <message>") rather than the misleading "تم الحفظ محلياً". Same one-line fix in the equivalent save handlers used by `TrainAI.tsx`, `AccountSettings.tsx`, and `StoreInfo.tsx` so any future RLS denial is visible instead of silent.

### 4. Verify

- After the migration + frontend changes, sign in as a member that has only `settings: true` and confirm: open `/dashboard/settings/customize`, click "إعادة التصميم الافتراضي" → Reset → Save, and watch a successful toast + the row updating in `settings_chat_design`.
- Spot-check the same flow on Train AI and Account pages.

### Out of scope

- No UI redesign of the team-permissions modal. The existing checkboxes still work; ticking just `settings` is now enough.
- No change to non-settings RLS (team, conversations, tickets) — those continue to require their own keys.
- No data migration for existing members' `permissions` JSON.
