
-- 1. Extend enum
ALTER TYPE conversation_category ADD VALUE IF NOT EXISTS 'request';
ALTER TYPE conversation_category ADD VALUE IF NOT EXISTS 'suggestion';

-- 2. Columns to map remaining UI fields cleanly
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS close_reason text,
  ADD COLUMN IF NOT EXISTS display_code text;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS feedback text;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS avatar_color text;

-- Constraints (validation triggers, not CHECK on enum-like text — simple CHECK is fine since immutable)
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_close_reason_check;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_close_reason_check
  CHECK (close_reason IS NULL OR close_reason IN ('customer_manual','ai_request','idle'));

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_feedback_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_feedback_check
  CHECK (feedback IS NULL OR feedback IN ('positive','negative'));

CREATE INDEX IF NOT EXISTS idx_conversations_display_code ON public.conversations(tenant_id, display_code);
