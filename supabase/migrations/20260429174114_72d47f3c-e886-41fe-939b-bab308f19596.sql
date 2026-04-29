
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT id AS tenant_id FROM public.tenants WHERE id IN (
    '485d1819-77c7-4275-a445-9e4326a084ae'::uuid,
    '00fa2c6b-3d32-48e1-b3ab-f285fa93e1ee'::uuid
  ) LOOP

    -- Idempotent reset
    DELETE FROM public.messages WHERE tenant_id = t.tenant_id;
    DELETE FROM public.tickets WHERE tenant_id = t.tenant_id;
    DELETE FROM public.conversations WHERE tenant_id = t.tenant_id;
    DELETE FROM public.customers WHERE tenant_id = t.tenant_id;
    DELETE FROM public.usage_daily WHERE tenant_id = t.tenant_id;

    -- 200 customers
    INSERT INTO public.customers (tenant_id, display_name, display_name_ar, email, phone, locale)
    SELECT t.tenant_id,
           'Customer ' || g,
           'عميل ' || g,
           'cust' || g || '@example.com',
           '+9665' || lpad(g::text, 8, '0'),
           'ar'
    FROM generate_series(1, 200) g;

    -- 2,847 conversations (set-based)
    INSERT INTO public.conversations (
      tenant_id, customer_id, channel_kind, status, category,
      ai_handled, ai_quality_score, csat_rating, language,
      last_message_at, first_response_at, resolved_at, created_at
    )
    SELECT
      t.tenant_id,
      (SELECT id FROM public.customers
         WHERE tenant_id = t.tenant_id
         ORDER BY random() LIMIT 1),
      (ARRAY['web','whatsapp','instagram','salla','zid','snapchat'])[1 + (i % 6)]::channel_kind,
      CASE WHEN i % 7 = 0 THEN 'open' ELSE 'resolved' END::conversation_status,
      CASE
        WHEN i <= 320  THEN 'complaint'::conversation_category   -- Complaints 320
        WHEN i <= 900  THEN 'inquiry'::conversation_category     -- Inquiries 580
        WHEN i <= 1110 THEN 'shipping'::conversation_category    -- Requests 420 (split)
        WHEN i <= 1320 THEN 'refund'::conversation_category
        WHEN i <= 1500 THEN 'other'::conversation_category       -- Suggestions 180
        ELSE NULL
      END,
      true,
      CASE
        WHEN i <= 53  THEN (1 + (i % 2))::smallint               -- 53 negative
        WHEN i <= 900 THEN (4 + (i % 2))::smallint               -- 847 positive
        ELSE NULL
      END,
      CASE
        WHEN i <= 1100 THEN 5::smallint
        WHEN i <= 1200 THEN 4::smallint
        WHEN i <= 1247 THEN 3::smallint
        ELSE NULL
      END,
      'ar',
      now() - (random() * interval '30 days'),
      now() - (random() * interval '30 days') + interval '2 seconds',
      CASE WHEN i % 7 <> 0 THEN now() - (random() * interval '29 days') ELSE NULL END,
      now() - (random() * interval '30 days')
    FROM generate_series(1, 2847) AS i;

    -- 156 tickets (42 open, 114 closed)
    INSERT INTO public.tickets (
      tenant_id, subject, description, status, priority, category, created_at, resolved_at
    )
    SELECT
      t.tenant_id,
      'تذكرة #' || i,
      'تذكرة تجريبية للوحة التحكم',
      CASE WHEN i <= 42 THEN 'open' ELSE 'closed' END::ticket_status,
      (ARRAY['low','medium','high','urgent'])[1 + (i % 4)]::ticket_priority,
      (ARRAY['complaint','inquiry','shipping','refund'])[1 + (i % 4)]::conversation_category,
      now() - (random() * interval '30 days'),
      CASE WHEN i > 42 THEN now() - (random() * interval '15 days') ELSE NULL END
    FROM generate_series(1, 156) AS i;

    -- usage_daily: 30 days; clicks 281*30≈8,430, words 40,000*30=1,200,000, avg response 2.5s
    INSERT INTO public.usage_daily (
      tenant_id, day, conversations_opened, conversations_resolved,
      messages_in, messages_out, unique_customers,
      clicks, ai_words_used, ai_tokens_used,
      avg_response_seconds, csat_avg, ai_quality_avg
    )
    SELECT
      t.tenant_id,
      (current_date - i),
      90 + (random()*30)::int,
      85 + (random()*25)::int,
      180 + (random()*40)::int,
      170 + (random()*40)::int,
      60 + (random()*20)::int,
      281,
      40000,
      13000,
      CASE WHEN i % 2 = 0 THEN 2 ELSE 3 END,  -- avg 2.5
      4.8,
      4.6
    FROM generate_series(0, 29) AS i;

  END LOOP;
END $$;
