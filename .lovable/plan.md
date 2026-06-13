# Replace date with conversation number in AI Feedback modal

## Change
In the "AI Reply" (`رد الذكاء الاصطناعي`) modal opened from the AI Feedback list on the Dashboard, replace the timestamp footer (e.g. "13 يونيو 2026، 3:26 م") with the conversation's number — formatted as `#<display_code>` (e.g. `#CONV-1024`).

## Files
1. `src/app/services/metrics.ts` — `fetchRecentAiFeedback`
   - Join `conversations_main.display_code` via a Supabase nested select on `conversation_id`.
   - Extend `RecentAiFeedback` with `conversation_code: string | null`.

2. `src/app/components/DashboardPage.tsx`
   - Inside the Feedback modal (`feedbackConvo` block), replace the date `<p>` with:
     `<p>{t('Conversation', 'المحادثة')} #{feedbackConvo.conversation_code ?? '—'}</p>`
   - Keep the list row's date untouched (the user's screenshot is only the modal footer).

## Out of scope
- Linking the number to the conversations page.
- Changing list-row metadata.
- Backfill — `display_code` already populated for all conversations.
