-- Tighten anon insert policy for tickets and re-affirm grants
DROP POLICY IF EXISTS "tickets_anon_insert_widget" ON public.tickets_main;

CREATE POLICY "tickets_anon_insert_widget"
ON public.tickets_main
FOR INSERT
TO anon
WITH CHECK (
  tenant_exists(tenant_id)
  AND status = 'open'
  AND assignee_user_id IS NULL
  AND resolved_at IS NULL
  AND subject IS NOT NULL
  AND length(btrim(subject)) > 0
  AND customer_phone IS NOT NULL
  AND length(btrim(customer_phone)) > 0
);

GRANT INSERT ON public.tickets_main TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.tickets_number_seq TO anon;