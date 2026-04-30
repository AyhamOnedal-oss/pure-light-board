
-- Tickets: add denormalized customer fields + rating
ALTER TABLE public.tickets_main
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS customer_avatar_color TEXT,
  ADD COLUMN IF NOT EXISTS customer_id UUID,
  ADD COLUMN IF NOT EXISTS rating SMALLINT;

-- Conversations: snapshot ticket status + rating comment for list rendering
ALTER TABLE public.conversations_main
  ADD COLUMN IF NOT EXISTS ticket_status TEXT,
  ADD COLUMN IF NOT EXISTS rating_comment TEXT;

-- Messages: support image / file attachments rendered by AttachmentBubble
ALTER TABLE public.conversations_messages
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS file_name TEXT;
