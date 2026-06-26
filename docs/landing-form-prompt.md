# Landing Page Form → Fuqah Admin

Public endpoint that ingests submissions from the marketing landing page and
stores them in the admin pipeline ("صفحة الهبوط" table at /admin/pipeline).

Flow:

```
Figma form ──POST JSON──▶ landing-lead-submit (edge function)
                              │
                              ▼
                  admin_landing_leads (DB trigger computes match_status)
                              │
                              ▼
              /admin/pipeline → صفحة الهبوط table
```

No auth header. CORS open. IP rate-limited.

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

## Field-name → JSON-key mapping

Set each Figma input's `name` attribute to match the JSON key on the right.

| Figma label              | input `name`    | JSON key        | Notes                                    |
| ------------------------ | --------------- | --------------- | ---------------------------------------- |
| الاسم                    | `name`          | `name`          | Display only — not used for matching     |
| رقم الجوال               | `phone`         | `phone`         | Saudi: `05…`, `5…`, or `+9665…`         |
| الإيميل                  | `email`         | `email`         | Lowercased before send                   |
| نوع العميل (radio)       | `customer_type` | `customer_type` | values: `new` / `existing`              |
| وقت التواصل (radio)      | `contact_time`  | `contact_time`  | values: `morning` / `evening`           |
| المصدر (when new)        | `source`        | `source`        | tiktok/instagram/snapchat/facebook/google/ecommerce/other |
| الموضوع (when existing)  | `subject`       | `subject`       | textarea, ≤ 500 chars                    |

## Validation (mirror these in Figma to reject bad input early)

- `name`: required, ≤ 200 chars.
- `email`: required, must match `^[^\s@]+@[^\s@]+\.[^\s@]+$`, ≤ 255 chars.
- `phone`: required, ≥ 8 digits after stripping non-digits.
- `customer_type`: must be `new` or `existing` (defaults to `new` server-side).
- `contact_time`: must be `morning` or `evening` (defaults to `morning`).
- When `customer_type = new` → send `source`, omit `subject`.
- When `customer_type = existing` → send `subject`, omit `source`.

## Ready-to-paste snippet (Figma Sites / Make code block)

Drop a Code/Embed block next to the form and paste the snippet below. It picks
up inputs by `name`, normalizes the phone, sends the right shape, and toggles
success/error UI. Expects the form to have `id="lead-form"` and (optionally)
`#lead-success` / `#lead-error` containers.

```html
<script>
(() => {
  const ENDPOINT = "https://kdrcgusinkqgwaafcgnw.supabase.co/functions/v1/landing-lead-submit";
  const form = document.getElementById("lead-form");
  if (!form) return;

  const $ok  = document.getElementById("lead-success");
  const $err = document.getElementById("lead-error");

  const normPhone = (raw) => {
    const d = String(raw || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.startsWith("966")) return "+" + d;
    if (d.startsWith("0"))   return "+966" + d.slice(1);
    if (d.length === 9)      return "+966" + d;
    return d.startsWith("+") ? raw : "+" + d;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const customer_type = fd.get("customer_type") === "existing" ? "existing" : "new";

    const payload = {
      name:          String(fd.get("name") || "").trim(),
      phone:         normPhone(fd.get("phone")),
      email:         String(fd.get("email") || "").trim().toLowerCase(),
      customer_type,
      contact_time:  fd.get("contact_time") === "evening" ? "evening" : "morning",
    };
    if (customer_type === "new") {
      payload.source = String(fd.get("source") || "other").toLowerCase();
    } else {
      payload.subject = String(fd.get("subject") || "").trim().slice(0, 500);
    }

    // basic client-side guard
    if (!payload.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) ||
        payload.phone.replace(/\D/g, "").length < 8) {
      if ($err) { $err.textContent = "تأكد من الاسم والإيميل ورقم الجوال."; $err.style.display = "block"; }
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.dataset._label = btn.textContent; btn.textContent = "...جاري الإرسال"; }
    if ($err) $err.style.display = "none";

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "submit_failed");

      form.reset();
      if ($ok) $ok.style.display = "block";
    } catch (err) {
      console.error("[lead-form]", err);
      if ($err) { $err.textContent = "تعذر الإرسال، حاول مرة أخرى."; $err.style.display = "block"; }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset._label || "إرسال"; }
    }
  });
})();
</script>
```

## Troubleshooting

- **CORS error in browser console** — confirm the request is `POST` with
  `Content-Type: application/json` and no extra custom headers. The endpoint
  allows `authorization, x-client-info, apikey, content-type` only.
- **400 `invalid_phone` / `invalid_email` / `invalid_name`** — client-side
  validation skipped or mangled the value; re-check the field `name`
  attributes match the mapping table above.
- **200 returned but row not visible** — open `/admin/pipeline` and scroll to
  **صفحة الهبوط**; hit the refresh icon. The DB trigger sets `match_status`
  on insert, so a row should appear within a second.
- **Lots of spam** — only IP rate limiting is in place; add a honeypot field
  (hidden input the bot fills, ignored client-side before submit) or
  reCAPTCHA on the Figma side if abuse starts.

## Prompt for Figma AI

> Build a 2-step form matching the attached design. Step 1 collects: name,
> phone, email, and a radio choice "نوع العميل" (عميل جديد / عميل حالي).
> Step 2 collects "وقت التواصل" (صباحاً / مساءً) and either a source picker
> (TikTok, Instagram, Snapchat, Facebook, Google, متجر إلكتروني, أخرى) when
> "عميل جديد" was selected in step 1, OR a free-text "الموضوع" textarea when
> "عميل حالي" was selected. On submit POST the JSON shape above to the
> endpoint, then show a success state.
