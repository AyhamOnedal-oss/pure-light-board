
CREATE TABLE IF NOT EXISTS public.admin_customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  author_id uuid,
  author_name text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_customer_notes_tenant
  ON public.admin_customer_notes(tenant_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_customer_notes TO authenticated;
GRANT ALL ON public.admin_customer_notes TO service_role;

ALTER TABLE public.admin_customer_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read customer notes"
  ON public.admin_customer_notes FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'admin_customers'));

CREATE POLICY "Admins insert customer notes"
  ON public.admin_customer_notes FOR INSERT TO authenticated
  WITH CHECK (public.admin_has_permission(auth.uid(), 'admin_customers'));

CREATE POLICY "Admins delete customer notes"
  ON public.admin_customer_notes FOR DELETE TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'admin_customers'));

CREATE TRIGGER trg_admin_customer_notes_updated_at
  BEFORE UPDATE ON public.admin_customer_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
