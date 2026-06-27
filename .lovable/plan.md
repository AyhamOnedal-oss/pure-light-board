## Issue
On `صفحة الهبوط`, clicking "Copy to Pipeline" (نسخ إلى سير العميل) on a lead currently calls `navigate(\`/admin/pipeline/${nu.id}\`)` — which jumps the admin into the Customer Journey (سير العملاء) detail page, even though they're working inside Landing Page.

## Fix
In `src/app/components/admin/AdminLandingLeadDetailPage.tsx`, inside `copyToPipeline`:
- Remove the navigation to `/admin/pipeline/${nu.id}`.
- Stay on the landing lead detail page (`/admin/pipeline/landing/<id>`).
- Refresh the local `lead` state by setting `copied_to_pipeline_at` and `pipeline_customer_id` locally so the UI reflects the copy.
- Keep showing the success toast `Copied to Customer Pipeline / تم النسخ إلى سير العميل`.
- Optionally add a small inline confirmation/link "فتح في سير العملاء" next to the button (only after copy) so admins can choose to jump there manually — but no automatic redirect.

No other files change. Behavior on `سير العملاء` pages is untouched.
