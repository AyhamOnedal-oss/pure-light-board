-- Enable pg_net for HTTP calls from Postgres triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Widget events table (currently we only need widget_open clicks but keep schema generic)
CREATE TABLE IF NOT EXISTS public.widget_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  type text NOT NULL,
  conversation_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS widget_events_tenant_created_idx
  ON public.widget_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS widget_events_tenant_type_idx
  ON public.widget_events (tenant_id, type);

ALTER TABLE public.widget_events ENABLE ROW LEVEL SECURITY;

-- Anon can insert if the tenant exists (widget runs unauthenticated)
CREATE POLICY widget_events_anon_insert
  ON public.widget_events FOR INSERT TO anon
  WITH CHECK (public.tenant_exists(tenant_id));

-- Tenant members can read their own events
CREATE POLICY widget_events_view
  ON public.widget_events FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

-- Internal config table to hold the shared classify webhook secret.
-- No RLS policies => only service_role can read/write (RLS denies everyone else).
CREATE TABLE IF NOT EXISTS public._app_secrets (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public._app_secrets ENABLE ROW LEVEL SECURITY;

INSERT INTO public._app_secrets (key, value)
VALUES
  ('classify_webhook_secret', '4a979d3ac8bda32b3625652c46372f74aebfa4d8c44eb5780abf4c0c981ff7ce'),
  ('classify_webhook_url', 'https://kdrcgusinkqgwaafcgnw.supabase.co/functions/v1/classify-conversation')
ON CONFLICT (key) DO NOTHING;

-- Trigger function: when a conversation flips to 'resolved', POST to the classify endpoint.
CREATE OR REPLACE FUNCTION public.notify_classify_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_secret text;
  v_url text;
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status = 'resolved' THEN
    SELECT value INTO v_secret FROM public._app_secrets WHERE key = 'classify_webhook_secret';
    SELECT value INTO v_url    FROM public._app_secrets WHERE key = 'classify_webhook_url';
    IF v_secret IS NOT NULL AND v_url IS NOT NULL THEN
      PERFORM net.http_post(
        url     := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-classify-secret', v_secret
        ),
        body    := jsonb_build_object(
          'tenant_id', NEW.tenant_id,
          'conversation_id', NEW.id
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conversations_main_classify_on_resolve ON public.conversations_main;
CREATE TRIGGER conversations_main_classify_on_resolve
  AFTER UPDATE ON public.conversations_main
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_classify_conversation();

-- Make sure realtime is broadcasting changes for the dashboard tables
ALTER TABLE public.conversations_main REPLICA IDENTITY FULL;
ALTER TABLE public.conversations_messages REPLICA IDENTITY FULL;
ALTER TABLE public.tickets_main REPLICA IDENTITY FULL;
ALTER TABLE public.widget_events REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations_main; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets_main; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.widget_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;