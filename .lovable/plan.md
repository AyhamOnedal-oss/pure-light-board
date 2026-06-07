## Plan

1. **Fix the generated reset URL**
   - Update the password reset email function so the email sends users directly to the app’s `/reset-password` page, instead of sending a Supabase action link that can expire after being opened once or redirect incorrectly.
   - Use Supabase’s generated recovery URL/token data correctly so the app receives a usable recovery session.

2. **Make the reset page handle both valid and expired links cleanly**
   - Keep showing only the two password fields when a valid recovery token/session is present.
   - If Supabase returns `otp_expired`, `access_denied`, or another recovery error in the URL hash, show the current “request a new link” state instead of getting stuck.

3. **Preserve the public route behavior**
   - Keep `/reset-password` public and outside authenticated dashboard routing.
   - Do not change database schema, RLS, or unrelated login behavior.

4. **Validate the flow**
   - Check the reset email URL generation path and confirm the app route will receive the right parameters.
   - Verify the reset page still renders the form for valid recovery links and the expired-link message for already-used/expired links.

## Technical details

The screenshot URL contains:

```text
#error=access_denied&error_code=otp_expired&error_description=Email link is invalid or has expired
```

That means Supabase rejected the recovery link before the app could create a password reset session. The app page is doing the right thing by showing an expired-link state for that URL, but the reset email generation likely needs to be adjusted so newly requested links land on `/reset-password` with usable recovery credentials instead of being consumed/invalidated before the password form can complete.