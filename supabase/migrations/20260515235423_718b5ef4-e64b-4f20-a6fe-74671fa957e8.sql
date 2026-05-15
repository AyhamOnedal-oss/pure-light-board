-- 1) BEFORE INSERT trigger on tickets_main: fill display_code, copy from conversation
CREATE OR REPLACE FUNCTION public.tickets_fill_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv RECORD;
  v_cust RECORD;
  v_colors TEXT[] := ARRAY['#043CC8','#0EA5E9','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6'];
BEGIN
  IF NEW.display_code IS NULL THEN
    NEW.display_code := 'TKT-' || NEW.number::text;
  END IF;

  IF NEW.customer_avatar_color IS NULL THEN
    NEW.customer_avatar_color := v_colors[1 + floor(random() * array_length(v_colors,1))::int];
  END IF;

  IF NEW.conversation_id IS NOT NULL THEN
    SELECT category, customer_id, subject INTO v_conv
    FROM public.conversations_main
    WHERE id = NEW.conversation_id;

    IF FOUND THEN
      IF NEW.category IS NULL AND v_conv.category IS NOT NULL THEN
        NEW.category := v_conv.category;
      END IF;
      IF NEW.customer_id IS NULL AND v_conv.customer_id IS NOT NULL THEN
        NEW.customer_id := v_conv.customer_id;
      END IF;

      IF (NEW.customer_phone IS NULL OR NEW.customer_name IS NULL) AND v_conv.customer_id IS NOT NULL THEN
        SELECT phone, display_name INTO v_cust
        FROM public.conversations_customers
        WHERE id = v_conv.customer_id;
        IF FOUND THEN
          IF NEW.customer_phone IS NULL THEN NEW.customer_phone := v_cust.phone; END IF;
          IF NEW.customer_name  IS NULL THEN NEW.customer_name  := v_cust.display_name; END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_fill_defaults ON public.tickets_main;
CREATE TRIGGER trg_tickets_fill_defaults
BEFORE INSERT ON public.tickets_main
FOR EACH ROW EXECUTE FUNCTION public.tickets_fill_defaults();

-- 2) AFTER INSERT on tickets_main: persist phone back onto conversations_customers
CREATE OR REPLACE FUNCTION public.tickets_propagate_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL AND NEW.customer_phone IS NOT NULL THEN
    UPDATE public.conversations_customers
    SET phone = COALESCE(phone, NEW.customer_phone),
        display_name = COALESCE(display_name, NEW.customer_name),
        updated_at = now()
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_propagate_phone ON public.tickets_main;
CREATE TRIGGER trg_tickets_propagate_phone
AFTER INSERT ON public.tickets_main
FOR EACH ROW EXECUTE FUNCTION public.tickets_propagate_phone();

-- 3) Re-enable classification trigger on conversations_main
DROP TRIGGER IF EXISTS trg_notify_classify_conversation ON public.conversations_main;
CREATE TRIGGER trg_notify_classify_conversation
AFTER UPDATE ON public.conversations_main
FOR EACH ROW EXECUTE FUNCTION public.notify_classify_conversation();

-- 4) Backfill: set display_code on every ticket missing one
UPDATE public.tickets_main
SET display_code = 'TKT-' || number::text
WHERE display_code IS NULL OR display_code !~ '^TKT-';

-- 5) Backfill: copy phone / name / category from linked conversation where missing
UPDATE public.tickets_main t
SET
  category        = COALESCE(t.category, c.category),
  customer_id     = COALESCE(t.customer_id, c.customer_id),
  customer_phone  = COALESCE(t.customer_phone, cust.phone),
  customer_name   = COALESCE(t.customer_name, cust.display_name)
FROM public.conversations_main c
LEFT JOIN public.conversations_customers cust ON cust.id = c.customer_id
WHERE t.conversation_id = c.id
  AND (t.category IS NULL OR t.customer_phone IS NULL OR t.customer_name IS NULL OR t.customer_id IS NULL);

-- 6) Re-trigger classification for closed conversations that never got analyzed
UPDATE public.conversations_main
SET updated_at = now()
WHERE status IN ('closed','resolved') AND COALESCE(analysis_done,false) = false;