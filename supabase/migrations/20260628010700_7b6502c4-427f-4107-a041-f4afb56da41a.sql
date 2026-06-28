
ALTER TABLE public.settings_chat_design
  ADD COLUMN IF NOT EXISTS bubble_enabled boolean NOT NULL DEFAULT true;
