
## Goal
Add a second table **صفحة الهبوط** beneath the existing **سير العملاء** table on `/admin/pipeline`. It receives submissions from the public landing-page form (Figma-built, external) via a new edge function, classifies each lead's identity match against Zid/Salla connections, and lets admins copy a row into the main pipeline.

## 1. Database

New table `admin_landing_leads`:
- `id`, `created_at`
- `name` (display only, NOT used for matching)
- `phone`, `email`
- `customer_type` `'new' | 'existing'` (عميل جديد / عميل حالي)
- `contact_time` `'morning' | 'evening'`
- `source` — `tiktok | instagram | snapchat | facebook | google | ecommerce | other` (only for `new`)
- `subject` text (only for `existing`)
- `match_status` `'full' | 'partial' | 'none'` (computed at insert)
- `copied_to_pipeline_at` timestamptz (nullable; row stays after copy)
- `pipeline_customer_id` uuid (nullable)

Phone column added to `settings_account` if missing (per your answer).

Match rule (only against active Zid + Salla connections — joined to the tenant's owner contact in `settings_account`):
- both email AND phone match a tenant → **full** (مطابق)
- one matches → **partial** (مطابق جزئياً)
- neither → **none** (غير مطابق)
Name is never used.

A SECURITY DEFINER function `admin_landing_compute_match(email, phone)` runs the lookup and is called by a `BEFORE INSERT` trigger so `match_status` is always trustworthy.

RLS: only super_admin or admins with `admin_pipeline` permission can SELECT/UPDATE/DELETE. INSERT is done by the edge function via service role (no anon policy needed).

GRANTs included for `authenticated` + `service_role`.

## 2. Edge function `landing-lead-submit`

Public endpoint (verify_jwt off, CORS open) for the external landing page:

`POST /functions/v1/landing-lead-submit`
```json
{ "name": "...", "phone": "+9665...", "email": "...",
  "customer_type": "new" | "existing",
  "contact_time": "morning" | "evening",
  "source": "tiktok|instagram|...",   // when new
  "subject": "..."                     // when existing
}
```
- Zod validation, normalizes phone (digits only, +966 prefix), lowercases email.
- Inserts into `admin_landing_leads`; trigger fills `match_status`.
- Returns `{ ok: true, id, match_status }`.
- Rate limited per IP via existing `widget_rate_limits` pattern.

A short prompt block for Figma AI will be added to `docs/landing-form-prompt.md` so you can wire the external form to this endpoint.

## 3. Admin UI — `AdminPipelinePage.tsx`

Add a second card below the existing pipeline table titled **صفحة الهبوط** (icon: globe), same Monday-style design:

Columns (RTL):
| # | الإسم | رقم الجوال | الإيميل | نوع العميل | وقت التواصل | المصدر | الموضوع | المطابقة | الإجراءات |

Rendering rules:
- نوع العميل: green chip "عميل جديد" / blue chip "عميل حالي"
- وقت التواصل: ☀️ صباحاً / 🌙 مساءً
- المصدر: shown only when `customer_type='new'`; uses existing `SOURCE_META` icons (TikTok, Google, Instagram…). Otherwise `—`.
- الموضوع: shown only when `customer_type='existing'`. Otherwise `—`.
- المطابقة: pill — green مطابق / amber مطابق جزئياً / red غير مطابق.
- When match ≠ full, color the basic-data cells (name/phone/email) in red text per your legend.
- Actions menu (`⋯`):
  - **نسخ إلى سير العميل** — creates a `PipelineCustomer` (status `new_lead`, source = landing source or `manual`, subscribedVia inferred from match if any) and sets `copied_to_pipeline_at`. Row remains visible with a small "منقول" badge.
  - **تعديل** — inline edit dialog (subject/source/contact_time).
  - **حذف** — soft delete via service.

Legend strip beneath the table (matches your screenshot):
- البيانات الأساسية: الاسم • رقم الجوال • الإيميل • نوع العميل
- مطابق / مطابق جزئياً / غير مطابق explanations with icons.

Loading state uses `Loader2` (per your earlier preference, no default-flash).

## 4. Services / wiring

New `src/app/services/adminLandingLeads.ts`:
- `fetchLandingLeads()`, `deleteLandingLead(id)`, `updateLandingLead(id, patch)`, `copyToPipeline(id, currentUserId)`.

`copyToPipeline` uses the existing `pipelineData` helpers to append a `PipelineCustomer` to localStorage (the pipeline is still local per current code) and stamps `copied_to_pipeline_at` in the DB. When the pipeline migrates to DB later, swap to the proper insert.

## 5. Technical notes
- All currency-free, all Arabic strings already present in `STATUS_META` / `SOURCE_META` are reused.
- No changes to existing سير العملاء table behavior, columns, or styling.
- Email and phone are the only identity inputs used for matching — name is purely display.
- Realtime not required (admin refresh via existing refetch button is enough); we can add a `supabase.channel` later.
