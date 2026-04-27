-- Enums
CREATE TYPE public.activity_type AS ENUM ('conversation', 'ticket', 'insight');
CREATE TYPE public.activity_channel AS ENUM ('whatsapp', 'instagram', 'tiktok', 'snapchat', 'web', 'none');
CREATE TYPE public.activity_status AS ENUM ('open', 'pending', 'resolved', 'trending', 'new');

-- Table
CREATE TABLE public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type public.activity_type NOT NULL,
  channel public.activity_channel NOT NULL DEFAULT 'none',
  primary_en TEXT NOT NULL,
  primary_ar TEXT NOT NULL,
  preview_en TEXT NOT NULL DEFAULT '',
  preview_ar TEXT NOT NULL DEFAULT '',
  status public.activity_status NOT NULL DEFAULT 'new',
  assignee TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activities_user_updated ON public.activities (user_id, updated_at DESC);

-- RLS
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activities"
  ON public.activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activities"
  ON public.activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activities"
  ON public.activities FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activities"
  ON public.activities FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_activities_updated_at
BEFORE UPDATE ON public.activities
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();