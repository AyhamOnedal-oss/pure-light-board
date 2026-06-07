## Goal

Prevent Arabic-keyboard / RTL users from being locked out of login when their browser silently injects Arabic-Indic digits or invisible BiDi/zero-width characters into the email or password field.

## Root cause recap

On an Arabic keyboard layout, pressing `3` / `9` produces `٣` / `٩` (U+0663 / U+0669). Copy-paste from WhatsApp, Notes, or RTL email apps can also inject invisible control chars (LRM/RLM, zero-width space, NBSP). The password field hides these, so the user sees the "right" password but Supabase receives different bytes and returns `invalid_credentials`.

## Change

Add a small shared helper and call it right before `signIn` on both login pages. No backend / Supabase changes.

### New file: `src/app/utils/authInput.ts`

Two pure functions:

- `normalizeEmail(raw)` — `trim()` + `toLowerCase()` + strip zero-width and BiDi control chars.
- `normalizePassword(raw)` — strip zero-width and BiDi control chars, replace NBSP with regular space, and convert Arabic-Indic (`٠-٩`) and Persian (`۰-۹`) digits to Latin (`0-9`). Do **not** trim or lowercase — passwords are case- and whitespace-sensitive.

Characters stripped: `\u200B-\u200F`, `\u202A-\u202E`, `\u2066-\u2069`, `\uFEFF`.

### Edits

1. `src/app/components/LoginPage.tsx` — import the helpers, call `signIn(normalizeEmail(email), normalizePassword(password))`. Also normalize before the empty-field validation so a password of only invisible chars is treated as empty.
2. `src/app/components/admin/AdminLoginPage.tsx` — same change.
3. (Optional, same PR) `src/app/components/ResetPasswordPage.tsx` — apply `normalizePassword` to the new password before `supabase.auth.updateUser({ password })` so users don't set a password full of Arabic digits they can never re-type from an English keyboard.

### Not changing

- Signup flow is left alone (changing password normalization there could lock out existing users whose passwords were stored with Arabic digits). We can revisit if you want.
- No UI copy changes, no autofill attribute changes, no toast/warning when normalization actually rewrites a character — silent fix. If you'd rather show a small hint ("we converted Arabic digits in your password"), say so and I'll add it.

## Verification

- Manually paste `pA٣kWF٩!HGMviySR` into the password field with email `w8jkkchmfb@zam-partner.email` → login succeeds.
- Existing English-only logins continue to work unchanged (helpers are no-ops on already-Latin input).
- Admin login behaves the same way.

## Out of scope

- Server-side normalization (not possible — Supabase Auth hashes the password as-sent).
- Detecting/warning the user about active Arabic keyboard layout (browser doesn't expose this reliably).
