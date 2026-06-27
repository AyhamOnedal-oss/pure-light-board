## Problem
On `/admin/customers/:id`:
1. The three "توكنات" tiles all show `0 / 0` even though `ai_classifier_usage` has real rows (e.g. 68,684 prompt + 3,360 completion tokens for this tenant). Root cause: RLS on `ai_classifier_usage` only allows tenant members, so admin staff queries return 0 rows.
2. Labels mention "توكنات" — user wants words only.
3. The الإجمالي tile is redundant (already shown as "الكلمات المستخدمة" in the subscription card).
4. The subscription card needs input/output words rows below "الكلمات المستخدمة".

## Changes

### 1. RLS migration — `ai_classifier_usage`
Add a SELECT policy so admin/super_admin staff can read all rows (mirrors the policies previously added to `dashboard_usage_daily` and `conversations_main`):
```sql
CREATE POLICY "admins read all classifier usage"
ON public.ai_classifier_usage FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
```

### 2. `src/app/components/admin/AdminCustomerDetails.tsx`
- Replace the 3-tile token row: keep only two tiles — **كلمات المدخلات** and **كلمات المخرجات** (remove "إجمالي التوكنات"). Drop the word "توكنات" everywhere; show plain numbers (`inputWords.toLocaleString()`).
- In the الاشتراك الحالي card, add two rows under "الكلمات المستخدمة":
  - `كلمات المدخلات` → `inputWords`
  - `كلمات المخرجات` → `outputWords`
- Keep the existing tokens→words conversion (`tokens * 0.75`, rounded) but never surface the word "token/توكن" in the UI.

## Verification
- After migration, refresh `/admin/customers/4257914d-…`: tiles show non-zero (≈ 51,513 input words, 2,520 output words for this tenant) and the subscription card lists both values under الكلمات المستخدمة.
- Other tenants render their own real values; no regressions to merchant-side dashboards (their RLS path is unchanged).
