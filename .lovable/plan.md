## Goal
Confirm the direct Figma → Supabase wiring you described, and tighten `docs/landing-form-prompt.md` so the Figma side has everything it needs in one place.

## The flow you're locking in
```
Figma form  ──POST JSON──▶  https://kdrcgusinkqgwaafcgnw.supabase.co/functions/v1/landing-lead-submit
                              │
                              ▼
                     admin_landing_leads (trigger computes match_status)
                              │
                              ▼
                /admin/pipeline → صفحة الهبوط table
```

This works as-is. The edge function is already public (no auth header), CORS is open, and the DB trigger fills `match_status` from email+phone against active Zid/Salla connections. No backend changes needed.

## Why this is the right call
- Zero middleware, zero monthly cost.
- One source of truth — every submission lands in the same admin table.
- Admin can copy any row into سير العميل via the existing actions menu.

## What I'll change (docs only — no code)
Update `docs/landing-form-prompt.md` so the Figma builder can paste it straight into a Figma Sites/Make **code block** with no guesswork:

1. **Exact request contract** (already there) — keep.
2. **Ready-to-paste `<script>` snippet** for the Figma code block:
   - Reads inputs by `name` attribute (matches the field names in your screenshot: الاسم، رقم الجوال، الإيميل، نوع العميل، وقت التواصل، المصدر، الموضوع).
   - Normalizes Saudi phone (`05…` / `5…` / `+9665…` → `+9665…`).
   - Lowercases email, trims name.
   - Sends only `source` for "عميل جديد" and only `subject` for "عميل حالي".
   - Disables submit while in-flight, shows success/error states, resets the form on success.
3. **Field-name → JSON-key mapping table** so whoever wires the Figma inputs knows what to call each field.
4. **Validation rules mirror** of the edge function (so the form rejects bad input before the round-trip).
5. **Troubleshooting**: CORS, 400 messages (`invalid_phone`, `invalid_email`, etc.), and how to confirm a submission landed (`/admin/pipeline` → صفحة الهبوط).

## Out of scope (call out if you want any of these next)
- reCAPTCHA / hCaptcha or honeypot anti-spam — currently only IP rate limiting is in place.
- Email/Slack notification to admins on each new lead.
- Auto-promote "full match" leads to سير العميل without a manual copy.

If this matches what you want, approve and I'll just update the doc — no code changes.