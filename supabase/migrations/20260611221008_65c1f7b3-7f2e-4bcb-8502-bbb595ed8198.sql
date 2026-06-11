
-- Enable Realtime for tickets so all teammates see notes/status changes instantly.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets_activities;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets_main;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.tickets_activities REPLICA IDENTITY FULL;
ALTER TABLE public.tickets_main REPLICA IDENTITY FULL;

CREATE INDEX IF NOT EXISTS tickets_activities_author_user_id_idx
  ON public.tickets_activities (author_user_id);
