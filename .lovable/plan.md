## Update Resend API key and redeploy invite function

1. Update the `RESEND_API_KEY` secret in Supabase with the new key `re_exH8JamP_CVpZ5uHHoT2GLFy7SEVjVVKS` (uses the secure secret update tool — user confirms in a form).
2. Redeploy the `invite-employee` edge function so it picks up the new key.
3. User tests the invite flow from the Team page; email should now deliver to any recipient via the verified `fuqah.net` domain.

No code changes needed.