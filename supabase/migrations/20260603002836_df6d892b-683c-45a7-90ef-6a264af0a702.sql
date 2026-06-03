-- Add attachments column to conversations_messages
ALTER TABLE public.conversations_messages
ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Update bump_word_usage to add 750-word surcharge per image attachment on customer messages
CREATE OR REPLACE FUNCTION public.bump_word_usage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_words integer := COALESCE(NEW.word_count, 0);
  v_today date := (now() at time zone 'utc')::date;
  v_period_start date := (date_trunc('month', now()))::date;
  v_attachment_count integer := 0;
  v_attachment_surcharge integer := 0;
BEGIN
  IF v_words <= 0 THEN
    v_words := GREATEST(array_length(regexp_split_to_array(COALESCE(NEW.body,''), '\s+'), 1), 0);
  END IF;

  -- Image attachments cost ~750 words each (gpt-4o-mini vision high detail avg)
  IF NEW.sender = 'customer' AND NEW.attachments IS NOT NULL THEN
    v_attachment_count := jsonb_array_length(NEW.attachments);
    v_attachment_surcharge := v_attachment_count * 750;
  END IF;

  -- Monthly quota meter on settings_plans (auto-reset if period rolled over)
  UPDATE public.settings_plans
  SET monthly_words_used = CASE
        WHEN period_start < v_period_start THEN v_words + v_attachment_surcharge
        ELSE monthly_words_used + v_words + v_attachment_surcharge
      END,
      period_start = CASE
        WHEN period_start < v_period_start THEN v_period_start
        ELSE period_start
      END,
      updated_at = now()
  WHERE tenant_id = NEW.tenant_id;

  -- Daily usage row
  INSERT INTO public.dashboard_usage_daily (tenant_id, day, ai_words_used, messages_in, messages_out)
  VALUES (
    NEW.tenant_id,
    v_today,
    CASE WHEN NEW.sender = 'ai' THEN v_words ELSE v_attachment_surcharge END,
    CASE WHEN NEW.sender = 'customer' THEN 1 ELSE 0 END,
    CASE WHEN NEW.sender = 'ai' THEN 1 ELSE 0 END
  )
  ON CONFLICT (tenant_id, day) DO UPDATE
  SET ai_words_used = public.dashboard_usage_daily.ai_words_used + EXCLUDED.ai_words_used,
      messages_in   = public.dashboard_usage_daily.messages_in   + EXCLUDED.messages_in,
      messages_out  = public.dashboard_usage_daily.messages_out  + EXCLUDED.messages_out,
      updated_at = now();

  RETURN NEW;
END;
$function$;