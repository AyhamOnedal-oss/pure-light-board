CREATE TABLE public.ai_classifier_usage (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.settings_workspace(id) ON DELETE CASCADE,
  conversation_id uuid,
  model        text NOT NULL,
  intent       text NOT NULL,
  confidence   numeric(4,3) NOT NULL DEFAULT 0,
  source       text NOT NULL,
  prompt_tokens     integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens      integer NOT NULL DEFAULT 0,
  cost_usd     numeric(12,8) NOT NULL DEFAULT 0,
  latency_ms   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_classifier_usage TO authenticated;
GRANT ALL    ON public.ai_classifier_usage TO service_role;

ALTER TABLE public.ai_classifier_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read classifier usage"
ON public.ai_classifier_usage
FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE INDEX ai_classifier_usage_tenant_day_idx
  ON public.ai_classifier_usage (tenant_id, created_at DESC);