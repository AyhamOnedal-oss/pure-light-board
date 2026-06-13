CREATE OR REPLACE FUNCTION public.enforce_completion_vs_rating()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cap int;
BEGIN
  IF NEW.csat_rating IS NULL THEN
    RETURN NEW;
  END IF;
  v_cap := CASE NEW.csat_rating
    WHEN 1 THEN 15
    WHEN 2 THEN 35
    WHEN 3 THEN 60
    WHEN 4 THEN 85
    ELSE 100
  END;
  IF NEW.completion_score IS NOT NULL AND NEW.completion_score > v_cap THEN
    NEW.completion_score := v_cap;
  END IF;
  IF NEW.csat_rating <= 2 THEN
    NEW.goal_met := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_completion_vs_rating ON public.conversations_main;
CREATE TRIGGER trg_enforce_completion_vs_rating
  BEFORE INSERT OR UPDATE OF csat_rating, completion_score, goal_met
  ON public.conversations_main
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_completion_vs_rating();

-- Backfill existing rows so historical conversations reflect new logic.
UPDATE public.conversations_main
SET completion_score = LEAST(completion_score,
      CASE csat_rating WHEN 1 THEN 15 WHEN 2 THEN 35 WHEN 3 THEN 60 WHEN 4 THEN 85 ELSE 100 END),
    goal_met = CASE WHEN csat_rating <= 2 THEN false ELSE goal_met END
WHERE csat_rating IS NOT NULL;