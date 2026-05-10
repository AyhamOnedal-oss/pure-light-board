## Goal

Set up a separate test workspace for Zid (independent of abc's Workspace which is linked to Salla) so you can test the Zid widget — colors, design, etc. — without conflicts.

## What I need from you

- **Zid `store_uuid`** for the test store (you said you'd share next).
- Optional: store name and store URL.

## Steps

1. **You provide the Zid `store_uuid`.**

2. **Provision a new auth user + workspace** for `1dcxpbvhzd@zam-partner.email`:
   - Create Supabase auth user with that email + a generated password.
   - The existing `handle_new_user` trigger automatically creates:
     - a `settings_workspace` row (the new tenant)
     - an `auth_tenant_members` row (owner)
     - a `settings_plans` row
     - a `settings_chat_design` + `settings_train_ai` row (via `create_tenant_default_settings`)
   - Capture the new `tenant_id`.
   - Send the credentials via Resend (same email template used by `provision-merchant`) so you can log in and tweak colors/design.

3. **Insert a `zid_connections` row** linked to the new tenant:
   - `store_uuid` = (your value)
   - `store_email` = `1dcxpbvhzd@zam-partner.email`
   - `tenant_id` = (new tenant)
   - `is_active` = true, `connection_status` = `connected`, `connected_at` = now
   - tokens left null (test seed; widget-resolve / widget-config / widget-events will work since they only need `tenant_id`)

4. **Update the new `settings_workspace`** row:
   - `zid_store_uuid` = (your value)
   - `platform` = `zid`
   - `name` = something like "Zid Test Workspace" (optional)

5. **Verify**: call `widget-resolve` / `widget-config` with the new `store_uuid` → should return the new tenant. Log into the dashboard with the emailed credentials and confirm Chat Customization is editable.

## Notes

- Fully isolated from abc's Workspace (Salla). Two separate tenants, two separate widget configs.
- Easy to clean up later by deleting the `zid_connections` row + the workspace + the auth user.
- No app code changes — database + one auth-admin call (handled inside the migration step / a small script).
- Reply with the Zid `store_uuid` and I'll prepare the migration.