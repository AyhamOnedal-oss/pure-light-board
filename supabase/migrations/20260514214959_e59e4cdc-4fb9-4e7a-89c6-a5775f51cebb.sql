ALTER TABLE public.conversations_main
  ADD COLUMN IF NOT EXISTS completion_score smallint,
  ADD COLUMN IF NOT EXISTS intent_type text,
  ADD COLUMN IF NOT EXISTS goal_met boolean,
  ADD COLUMN IF NOT EXISTS analysis_done boolean NOT NULL DEFAULT false;

ALTER TABLE public.conversations_main
  DROP CONSTRAINT IF EXISTS conversations_main_completion_score_chk;
ALTER TABLE public.conversations_main
  ADD CONSTRAINT conversations_main_completion_score_chk
  CHECK (completion_score IS NULL OR (completion_score >= 0 AND completion_score <= 100));

ALTER TABLE public.conversations_main
  DROP CONSTRAINT IF EXISTS conversations_main_intent_type_chk;
ALTER TABLE public.conversations_main
  ADD CONSTRAINT conversations_main_intent_type_chk
  CHECK (intent_type IS NULL OR intent_type IN ('complaint','inquiry','request','suggestion'));

CREATE INDEX IF NOT EXISTS conversations_main_analysis_done_idx
  ON public.conversations_main (tenant_id, analysis_done);