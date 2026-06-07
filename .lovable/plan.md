## What’s happening

The password field in **Account Settings → Change Password** is doing two different checks:

1. **On blur**, it compares the typed password against a hardcoded mock value: `123456Aa`.
2. **On submit**, it correctly asks Supabase to re-authenticate with the current password.

That is why the password can work at login but still show “Incorrect password” in this modal: the red error in the screenshot is coming from the old mock validation, not from Supabase.

## Plan

1. Update `AccountSettings.tsx` so the current-password field no longer uses the hardcoded mock password check.
2. Reuse the same password normalization helper used by login, so Arabic/RTL invisible characters and digit variants are handled consistently.
3. Keep the real Supabase re-authentication check when the user submits the password-change form.
4. Adjust the UI state so it only shows “incorrect current password” after the real Supabase check fails, not simply when the field loses focus.

## Expected result

The current password will no longer be falsely marked wrong while typing/leaving the field. If the user can log in with that password, the change-password modal should accept it too.