
CREATE TABLE IF NOT EXISTS public.admin_openai_key_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id uuid NOT NULL REFERENCES public.admin_openai_keys(id) ON DELETE CASCADE,
  slot text NOT NULL,
  project_id text,
  default_model text,
  input_price_per_1m numeric NOT NULL DEFAULT 0,
  output_price_per_1m numeric NOT NULL DEFAULT 0,
  tokens_per_word numeric NOT NULL DEFAULT 3.3,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aokv_key_eff ON public.admin_openai_key_versions(key_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_aokv_project_eff ON public.admin_openai_key_versions(project_id, effective_from DESC);

GRANT SELECT ON public.admin_openai_key_versions TO authenticated;
GRANT ALL ON public.admin_openai_key_versions TO service_role;

ALTER TABLE public.admin_openai_key_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY aokv_admin_read
  ON public.admin_openai_key_versions FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'admin_dashboard'));

CREATE POLICY aokv_service_all
  ON public.admin_openai_key_versions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Trigger: on insert OR on relevant column change, close current version + insert new
CREATE OR REPLACE FUNCTION public.admin_openai_keys_version_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changed boolean := false;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_changed :=
      COALESCE(NEW.project_id,'') IS DISTINCT FROM COALESCE(OLD.project_id,'')
      OR COALESCE(NEW.default_model,'') IS DISTINCT FROM COALESCE(OLD.default_model,'')
      OR NEW.input_price_per_1m IS DISTINCT FROM OLD.input_price_per_1m
      OR NEW.output_price_per_1m IS DISTINCT FROM OLD.output_price_per_1m
      OR NEW.tokens_per_word IS DISTINCT FROM OLD.tokens_per_word;
    IF NOT v_changed THEN
      RETURN NEW;
    END IF;
  END IF;

  -- close any currently open version for this key
  UPDATE public.admin_openai_key_versions
  SET effective_to = now()
  WHERE key_id = NEW.id AND effective_to IS NULL;

  INSERT INTO public.admin_openai_key_versions
    (key_id, slot, project_id, default_model, input_price_per_1m, output_price_per_1m, tokens_per_word, effective_from, created_by)
  VALUES
    (NEW.id, NEW.slot, NEW.project_id, NEW.default_model,
     NEW.input_price_per_1m, NEW.output_price_per_1m, NEW.tokens_per_word,
     now(), auth.uid());

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_admin_openai_keys_version_sync ON public.admin_openai_keys;
CREATE TRIGGER trg_admin_openai_keys_version_sync
AFTER INSERT OR UPDATE ON public.admin_openai_keys
FOR EACH ROW EXECUTE FUNCTION public.admin_openai_keys_version_sync();

-- Backfill: one initial version per existing key, effective 30 days ago
INSERT INTO public.admin_openai_key_versions
  (key_id, slot, project_id, default_model, input_price_per_1m, output_price_per_1m, tokens_per_word, effective_from)
SELECT k.id, k.slot, k.project_id, k.default_model,
       k.input_price_per_1m, k.output_price_per_1m, k.tokens_per_word,
       now() - interval '30 days'
FROM public.admin_openai_keys k
WHERE NOT EXISTS (
  SELECT 1 FROM public.admin_openai_key_versions v WHERE v.key_id = k.id
);

-- Lookup helper: pick active version for (project_id, at)
CREATE OR REPLACE FUNCTION public.admin_openai_active_version(_project_id text, _at timestamptz)
RETURNS TABLE(
  key_id uuid, slot text, project_id text, default_model text,
  input_price_per_1m numeric, output_price_per_1m numeric, tokens_per_word numeric,
  effective_from timestamptz, effective_to timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.key_id, v.slot, v.project_id, v.default_model,
         v.input_price_per_1m, v.output_price_per_1m, v.tokens_per_word,
         v.effective_from, v.effective_to
  FROM public.admin_openai_key_versions v
  WHERE v.project_id IS NOT DISTINCT FROM _project_id
    AND v.effective_from <= _at
    AND (v.effective_to IS NULL OR v.effective_to > _at)
  ORDER BY v.effective_from DESC
  LIMIT 1;
$$;
