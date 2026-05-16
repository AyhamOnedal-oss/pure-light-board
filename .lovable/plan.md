## What's happening

Your app is a Vite + React Router SPA (`createBrowserRouter` in `src/app/routes.tsx`). When you open `/dashboard` directly or hit refresh, the host has to serve `index.html` so the client router can take over. The "not found" you see in the top-left is the host's 404 page, not your app's UI — meaning the request never reached React Router.

Two things contribute:

1. **SPA fallback fragility.** You rely on `public/_redirects` (`/* /index.html 200`). On the live preview (`id-preview--…lovable.app`) and during sandbox restarts/rebuilds, this fallback can momentarily fail, returning the platform 404. That matches "sometimes, on hard refresh / direct URL, in Lovable and on direct URL".
2. **No app-level catch-all UI.** Your catch-all route is `<Navigate to="/dashboard" replace />`. If routing ever resolves an unknown path before auth/tenant load, the redirect briefly mounts — but it does not protect against the host-level 404 above.

## Fix plan

### 1. Make SPA fallback robust (primary fix)
- Keep `public/_redirects` but also add the same rule via headers so static hosts that ignore `_redirects` still fall back. Specifically:
  - Add `public/200.html` as a copy of `index.html` (some static hosts use this convention).
  - Add a `public/_headers` entry — harmless on hosts that don't read it.
- Verify the published build emits `_redirects` into `dist/` (it does by default for files in `public/`), and confirm the file is present in production.

### 2. Add a real app 404 instead of a silent redirect
- Replace `{ path: '*', element: <Navigate to="/dashboard" replace /> }` with a real `NotFoundPage` component that:
  - Renders inside your layout if authed,
  - Shows a "Go to dashboard" / "Go to login" CTA otherwise.
- This makes accidental misroutes obvious instead of bouncing, and surfaces whether the 404 is host-side (plain text "Not found") vs app-side (styled page). Future "sometimes 404" reports become diagnosable at a glance.

### 3. Guard against bad initial URLs
- In `RootEntry`, currently `/` → `<Navigate to="/dashboard" />`. Add the same handling for typos like `/dashoard` (you mentioned this) by mounting the new `NotFoundPage` with a "Did you mean /dashboard?" hint.

### 4. Verify
- After deploy, hard-refresh `/dashboard`, `/dashboard/tickets`, `/dashboard/settings/account` 10× each in an incognito window. None should show the platform 404.
- If a platform 404 still appears occasionally on the **live preview** specifically, it's the sandbox restarting — that's expected behavior of the preview, not the published site. We'll confirm by reproducing only on `id-preview--…` and never on `pure-light-board.lovable.app`.

## Files to change

- `public/_redirects` — keep.
- `public/200.html` — new (copy of `index.html`).
- `src/app/components/NotFoundPage.tsx` — new.
- `src/app/routes.tsx` — replace the `*` catch-all with `<NotFoundPage />`.

No business logic, auth, or data changes.

## Note on the "sometimes" in Lovable preview
The live preview iframe (`id-preview--…`) is backed by a sandboxed dev server. While it restarts (after edits, idle wake-ups, or transient errors) any direct URL load can momentarily return a platform 404. The published site (`pure-light-board.lovable.app`) does not have this restart behavior — it serves static files + `_redirects`. The fix above hardens both, but expect occasional preview-only blips during active editing; they're not present for end users.