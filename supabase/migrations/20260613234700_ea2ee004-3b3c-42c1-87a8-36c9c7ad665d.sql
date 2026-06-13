ALTER TABLE public.conversations_main
  ADD COLUMN IF NOT EXISTS last_customer_message_at timestamptz;

UPDATE public.conversations_main c
SET last_customer_message_at = sub.ts
FROM (
  SELECT conversation_id, max(created_at) AS ts
  FROM public.conversations_messages
  WHERE sender = 'customer'
  GROUP BY conversation_id
) sub
WHERE sub.conversation_id = c.id
  AND (c.last_customer_message_at IS NULL OR c.last_customer_message_at <> sub.ts);

CREATE OR REPLACE FUNCTION public.bump_last_customer_message_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.sender = 'customer' THEN
    UPDATE public.conversations_main
       SET last_customer_message_at = NEW.created_at
     WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_bump_last_customer_message_at ON public.conversations_messages;
CREATE TRIGGER trg_bump_last_customer_message_at
AFTER INSERT ON public.conversations_messages
FOR EACH ROW EXECUTE FUNCTION public.bump_last_customer_message_at();