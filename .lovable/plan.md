## Goal
Stop using `onboarding@resend.dev` (causing 400s) and always send via the verified `support@fuqah.net`.

## Change
Single file: `supabase/functions/_shared/provision-merchant.ts`

- Replace:
  ```ts
  const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";
  ```
  with:
  ```ts
  const from = "Fuqah AI <support@fuqah.net>";
  ```

This is the only place Resend is invoked (used by both Zid and Salla provisioning flows for welcome / linked-account emails). The `RESEND_FROM_EMAIL` env var will be ignored going forward.

## Prerequisite (user side)
`fuqah.net` must be verified in Resend and the `RESEND_API_KEY` secret must belong to that account. If not yet verified, sends will still 400 — confirm domain status in Resend dashboard.

## Out of scope
No changes to widget, OAuth flows, templates, or other functions.