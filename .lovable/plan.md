## Problem

1. **Visitor name still shows "Storefront visitor"** — not the empty fallback we localized. The widget saves `conversations_customers.display_name = "Storefront visitor"` for anonymous visitors, so the `name || visitorCustomerLabel(t)` chain in `ConversationsPage.tsx` / `TicketsPage.tsx` / `ChatLogDownload` never falls through to the Arabic label.
2. **Want to re-test AI analysis** on already-analyzed (or stuck) conversations to verify badges + scores end-to-end.

## Plan

### A. Treat "Storefront visitor" as the placeholder

Add a helper next to `visitorCustomerLabel`:

```ts
const VISITOR_PLACEHOLDERS = ['storefront visitor', 'visitor customer', 'عميل زائر', 'زائر المتجر'];
export function resolveVisitorName(name: string | null | undefined, t) {
  const v = (name ?? '').trim();
  if (!v || VISITOR_PLACEHOLDERS.includes(v.toLowerCase())) return visitorCustomerLabel(t);
  return v;
}
```

Replace the 5 call sites that currently do `name || visitorCustomerLabel(t)`:
- `ConversationsPage.tsx` lines 121, 181
- `TicketsPage.tsx` lines 158, 210
- `ChatLogDownload` (if it uses the same pattern)

Also fix the **widget** so new visitors are saved with `display_name = NULL` instead of the literal string `"Storefront visitor"`. File to update: `widget/src/...` where the customer row is upserted.

### B. Re-run AI analysis for testing

Two parts:

1. **Reset flag + dispatch** via SQL: clear `analysis_done`, `completion_score`, `intent_type`, `goal_met` for all `status IN ('resolved','closed')` rows of the current tenant, then loop `net.http_post` to the classify webhook for each. This is run as a one-shot migration (or via the insert tool with a DO block).
2. **Add a manual "Re-analyze" button** in the conversation detail header (admin-only), visible when `chatStatus === 'closed'`. Clicking it calls a small `createServerFn` (`reanalyze_conversation.functions.ts`) that:
   - Verifies the caller is a tenant admin/agent for that conversation
   - Resets the four analysis fields on that single row
   - Calls the same `classify-conversation` edge function with the project's classify secret
   - Returns the fresh row so React Query can refetch

This gives an in-app way to re-test without DB access for future iterations.

### C. Out of scope

- Changing the AI model, prompt, or scoring thresholds
- Backfilling historical `conversations_customers.display_name` rows (the resolver above handles them at read time; no destructive update needed)
- Dashboard KPIs

## Files

- `src/app/components/conversation/AnalysisBadges.tsx` — add `resolveVisitorName`
- `src/app/components/ConversationsPage.tsx` — use resolver; add Re-analyze button
- `src/app/components/TicketsPage.tsx` — use resolver
- `src/app/components/ChatLogDownload.tsx` (if applicable) — use resolver
- `widget/src/...` — stop writing literal "Storefront visitor" on visitor creation
- `src/lib/reanalyze_conversation.functions.ts` — new server fn
- One-shot SQL via insert tool to reset + re-dispatch existing closed conversations
