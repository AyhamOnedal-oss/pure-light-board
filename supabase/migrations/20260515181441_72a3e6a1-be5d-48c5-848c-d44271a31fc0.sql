-- 1) Attach the AI classification trigger to conversations_main
DROP TRIGGER IF EXISTS trg_notify_classify_conversation ON public.conversations_main;
CREATE TRIGGER trg_notify_classify_conversation
AFTER UPDATE ON public.conversations_main
FOR EACH ROW
EXECUTE FUNCTION public.notify_classify_conversation();

-- 2) Backfill the missing ticket for conversation 7574c956…
DO $$
DECLARE
  v_conv_id uuid := '7574c956-9cd7-44b1-9f3b-d65b52a1b42e';
  v_tenant_id uuid;
  v_customer_id uuid;
  v_ticket_id uuid;
  v_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.tickets_main WHERE conversation_id = v_conv_id) INTO v_exists;
  IF v_exists THEN
    RAISE NOTICE 'Ticket already exists for conversation %, skipping backfill', v_conv_id;
  ELSE
    SELECT tenant_id, customer_id INTO v_tenant_id, v_customer_id
    FROM public.conversations_main WHERE id = v_conv_id;

    IF v_tenant_id IS NOT NULL THEN
      INSERT INTO public.tickets_main (
        tenant_id, conversation_id, subject, description,
        status, priority, customer_id
      ) VALUES (
        v_tenant_id, v_conv_id,
        'تذكرة من المحادثة',
        'عندي اقتراح بطور متجركم بشكل رهيب',
        'open', 'medium', v_customer_id
      )
      RETURNING id INTO v_ticket_id;

      INSERT INTO public.tickets_activities (
        tenant_id, ticket_id, type, status, author_name, author_role
      ) VALUES (
        v_tenant_id, v_ticket_id, 'status', 'created', 'Customer', 'agent'
      );

      -- Close + flag for re-analysis (trigger will fire and call classify-conversation)
      UPDATE public.conversations_main
      SET ticket_status = 'open',
          status = 'closed',
          close_reason = 'customer_manual',
          resolved_at = COALESCE(resolved_at, now()),
          analysis_done = false,
          updated_at = now()
      WHERE id = v_conv_id;
    END IF;
  END IF;
END $$;