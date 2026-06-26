# Landing Page Form → Fuqah Admin

Public endpoint that ingests submissions from the marketing landing page and
stores them in the admin pipeline ("صفحة الهبوط" table at /admin/pipeline).

## Endpoint

```
POST https://kdrcgusinkqgwaafcgnw.supabase.co/functions/v1/landing-lead-submit
Content-Type: application/json
```

No auth header required. CORS is open.

## Request body

```jsonc
{
  "name":          "NASER A ALQAHTANI",     // required, ≤ 200 chars (display only — never used for matching)
  "phone":         "+966540904947",          // required, Saudi format accepted (05…, 5…, +9665…)
  "email":         "shrman@samksa.ai",       // required, valid email
  "customer_type": "new" | "existing",      // required — "عميل جديد" or "عميل حالي"
  "contact_time":  "morning" | "evening",   // required — "صباحاً" / "مساءً"

  // ONE of the following depending on customer_type:
  "source":  "tiktok" | "instagram" | "snapchat" | "facebook" | "google" | "ecommerce" | "other",  // when "new"
  "subject": "اريد تحديث بيانات الاشتراك"   // when "existing"
}
```

## Response

```json
{ "ok": true, "id": "uuid", "match_status": "full" | "partial" | "none" }
```

Match status is computed server-side by comparing email + phone against active
Zid/Salla store contacts. Name is ignored.

## Prompt for Figma AI

> Build a 2-step form matching the attached design. Step 1 collects: name,
> phone, email, and a radio choice "نوع العميل" (عميل جديد / عميل حالي).
> Step 2 collects "وقت التواصل" (صباحاً / مساءً) and either a source picker
> (TikTok, Instagram, Snapchat, Facebook, Google, متجر إلكتروني, أخرى) when
> "عميل جديد" was selected in step 1, OR a free-text "الموضوع" textarea when
> "عميل حالي" was selected. On submit POST the JSON shape above to the
> endpoint, then show a success state.
