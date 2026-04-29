## Rename all tables with page-prefix naming

### Current table names → new names

| Current | New | Reason |
|---|---|---|
| `tenants` | `settings_workspace` | Workspace identity, edited in Settings → Store |
| `profiles` | `settings_account` | Edited in Settings → Account |
| `plan_quotas` | `settings_plans` | Settings → Plans |
| `ai_training_settings` | `settings_train_ai` | Settings → Train AI |
| `chat_widget_settings` | `settings_chat_design` | Settings → Customize |
| `team_members` | `team_team_members` *(or just keep)* | Team page |
| `tenant_members` | `auth_tenant_members` | Auth/membership (cross-page) |
| `user_roles` | `auth_user_roles` | Auth (cross-page) |
| `conversations` | `conversations_main` | Conversations page |
| `messages` | `conversations_messages` | Conversations page |
| `customers` | `conversations_customers` | Used by conversations + tickets |
| `channels` | `conversations_channels` | Conversation channels |
| `tickets` | `tickets_main` | Tickets page |
| `ticket_activities` | `tickets_activities` | Tickets page |
| `activities` | `dashboard_activities` | Dashboard recent activity |
| `usage_daily` | `dashboard_usage_daily` | Dashboard analytics |

### What gets touched

**Database (one big migration):**
- `ALTER TABLE … RENAME TO …` for all 16 tables
- Drop + recreate every RLS policy (policies don't follow renames cleanly when they reference table names in expressions)
- Update 2 trigger functions: `handle_new_user()` (references `tenants`, `tenant_members`, `profiles`, `plan_quotas`) and `create_tenant_default_settings()` (references the new settings tables)
- Update the 2 RLS helper functions: `is_tenant_member()`, `tenant_role_at_least()` (reference `tenant_members`)
- Sequences, indexes, foreign-key-style columns keep working (they reference table OIDs, not names)

**Code:**
- `src/integrations/supabase/types.ts` — auto-regenerates after migration, no manual edit
- Only 2 hardcoded references found in `src/` and `supabase/`:
  - `.from('activities')` → `.from('dashboard_activities')`
  - `.from('tenant_members')` → `.from('auth_tenant_members')`
- All other tables in the codebase are referenced only via legacy localStorage / mock data / the old edge-function backend (`make-server-fc841b6e`), not via the Supabase client. So actual breakage surface is tiny.

### Risks

- The signup trigger `handle_new_user()` runs on every new user. If its rewrite has a typo, **no one can sign up**. We test by signing up a throwaway account right after.
- Any external integration that hits the REST API by table name (e.g. `…/rest/v1/tenants`) will 404. None found in this project, but worth knowing.
- Once renamed, going back means another full rename migration.

### Execution order

1. **Single migration** that does, in one transaction:
   - Rename all 16 tables
   - Drop and recreate every affected RLS policy with the new names
   - Recreate `handle_new_user()`, `create_tenant_default_settings()`, `is_tenant_member()`, `tenant_role_at_least()` with new table names
2. After approval, update the 2 code references (`activities`, `tenant_members`) in the same turn.
3. Verify with a SELECT against the new names + a smoke-test sign-up.

### Naming nits to confirm

- Should I drop the `_main` suffix and just call them `conversations`, `tickets` (the page name = the table)? It's cleaner. Let me know.
- `team_team_members` looks silly — keep as `team_members`?
- Cross-page tables (`auth_tenant_members`, `auth_user_roles`, `conversations_customers`) — happy with the prefix I chose?

Reply with any name tweaks and I'll execute.