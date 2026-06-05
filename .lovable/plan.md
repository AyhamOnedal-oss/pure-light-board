Update the `RESEND_FROM_EMAIL` secret to use the verified `fuqah.net` domain.

The current secret is set to `onboarding@resend.dev`, which is Resend's sandbox-only sender. That address is restricted to sending only to the account owner's email address — any other recipient returns a 403 validation error.

The verified Resend domain is `fuqah.net`. Updating the `from` address to something like `support@fuqah.net` (or `Fuqah AI <support@fuqah.net>`) will allow the invite-employee edge function to send welcome emails to any recipient.

Steps:
1. Use the secure secret update form to change `RESEND_FROM_EMAIL` to `Fuqah AI <support@fuqah.net>`.
2. No code or edge-function redeployment is needed — the function already reads this secret at runtime.