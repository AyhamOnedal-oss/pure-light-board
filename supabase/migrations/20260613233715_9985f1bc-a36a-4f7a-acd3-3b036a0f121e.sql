-- One-shot backfill: replace artificial 50 ms (customer → ai) gaps with
-- plausible AI latency (1.5–8 s), without reordering any thread.
WITH ordered AS (
  SELECT
    id,
    conversation_id,
    sender,
    created_at,
    LAG(sender)      OVER (PARTITION BY conversation_id ORDER BY created_at, id) AS prev_sender,
    LAG(created_at)  OVER (PARTITION BY conversation_id ORDER BY created_at, id) AS prev_at,
    LEAD(created_at) OVER (PARTITION BY conversation_id ORDER BY created_at, id) AS next_at
  FROM public.conversations_messages
),
candidates AS (
  SELECT
    id,
    prev_at,
    next_at,
    -- 1.5–8 s after the customer message, deterministic per id
    prev_at + ((1.5 + ((hashtext(id::text) & 2147483647) % 6500) / 1000.0) || ' seconds')::interval AS proposed_at
  FROM ordered
  WHERE sender = 'ai'
    AND prev_sender = 'customer'
    AND prev_at IS NOT NULL
    AND EXTRACT(EPOCH FROM (created_at - prev_at)) < 0.2
)
UPDATE public.conversations_messages m
SET created_at = LEAST(
      c.proposed_at,
      -- never push past the next message in the thread (minus a tiny gap)
      COALESCE(c.next_at - interval '50 ms', c.proposed_at)
    )
FROM candidates c
WHERE m.id = c.id
  AND (c.next_at IS NULL OR c.proposed_at < c.next_at);