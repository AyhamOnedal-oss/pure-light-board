CREATE TABLE IF NOT EXISTS public.widget_rate_limits (
  tenant_id UUID NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, window_start)
);

ALTER TABLE public.widget_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only - no client access"
  ON public.widget_rate_limits
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_widget_rate_limits_window
  ON public.widget_rate_limits (window_start);