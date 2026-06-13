
ALTER TABLE public.conversations_main
ADD COLUMN IF NOT EXISTS unanswered_question text;

-- Backfill for existing 'other'/null-category conversations: pick first customer message body.
UPDATE public.conversations_main c
SET unanswered_question = sub.body
FROM (
  SELECT DISTINCT ON (m.conversation_id) m.conversation_id, m.body
  FROM public.conversations_messages m
  WHERE m.sender = 'customer'
    AND m.body IS NOT NULL
    AND length(btrim(m.body)) > 0
  ORDER BY m.conversation_id, m.created_at ASC
) sub
WHERE c.id = sub.conversation_id
  AND c.unanswered_question IS NULL
  AND (c.category IS NULL OR c.category = 'other');
