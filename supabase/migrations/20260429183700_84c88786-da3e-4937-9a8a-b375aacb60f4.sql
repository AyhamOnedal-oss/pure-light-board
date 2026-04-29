
DO $$
DECLARE
  t_id uuid;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid; c6 uuid;
  cv1 uuid; cv2 uuid; cv3 uuid; cv4 uuid; cv5 uuid; cv6 uuid;
BEGIN
  FOR t_id IN SELECT id FROM tenants WHERE name IN ('abc''s Workspace','ayhamonedal''s Workspace') LOOP
    IF EXISTS (SELECT 1 FROM conversations WHERE tenant_id=t_id AND display_code='CV-001') THEN
      CONTINUE;
    END IF;

    INSERT INTO customers (tenant_id, display_name, display_name_ar, avatar_color, locale)
    VALUES (t_id,'Fatima Al-Zahrani','فاطمة الزهراني','#043CC8','ar') RETURNING id INTO c1;
    INSERT INTO customers (tenant_id, display_name, display_name_ar, avatar_color, locale)
    VALUES (t_id,'Mohammed Ali','محمد علي','#10b981','ar') RETURNING id INTO c2;
    INSERT INTO customers (tenant_id, display_name, display_name_ar, avatar_color, locale)
    VALUES (t_id,'Nora Saeed','نورا سعيد','#f59e0b','ar') RETURNING id INTO c3;
    INSERT INTO customers (tenant_id, display_name, display_name_ar, avatar_color, locale)
    VALUES (t_id,'Abdullah Qasim','عبدالله قاسم','#8b5cf6','ar') RETURNING id INTO c4;
    INSERT INTO customers (tenant_id, display_name, display_name_ar, avatar_color, locale)
    VALUES (t_id,'Reem Hassan','ريم حسن','#ff4466','ar') RETURNING id INTO c5;
    INSERT INTO customers (tenant_id, display_name, display_name_ar, avatar_color, locale)
    VALUES (t_id,'Hassan Faisal','حسن فيصل','#00C9BD','ar') RETURNING id INTO c6;

    INSERT INTO conversations (tenant_id, customer_id, channel_kind, status, category, csat_rating, csat_comment, language, display_code, close_reason, ai_handled, created_at, last_message_at, resolved_at, first_response_at)
    VALUES (t_id, c1,'web','resolved','inquiry',5,'دعم ممتاز! حصلت على معلومات التتبع فوراً.','ar','CV-001','customer_manual',true,'2026-04-14 09:30+00','2026-04-14 10:32+00','2026-04-14 16:45+00','2026-04-14 10:30+00')
    RETURNING id INTO cv1;
    INSERT INTO messages (tenant_id, conversation_id, sender, body, feedback, created_at) VALUES
      (t_id, cv1,'customer','مرحباً، أحتاج مساعدة في تتبع طلبي #45231',NULL,'2026-04-14 10:30+00'),
      (t_id, cv1,'ai','مرحباً فاطمة! يسعدني مساعدتك. طلبك #45231 في الطريق ومن المتوقع وصوله غداً.','positive','2026-04-14 10:30+00'),
      (t_id, cv1,'customer','هل يمكنك إرسال لقطة شاشة التتبع؟',NULL,'2026-04-14 10:31+00'),
      (t_id, cv1,'ai','','positive','2026-04-14 10:31+00'),
      (t_id, cv1,'customer','شكراً لمساعدتك!',NULL,'2026-04-14 10:32+00');
    UPDATE messages SET attachments='[{"type":"image","fileName":"tracking-screenshot.png"}]'::jsonb WHERE conversation_id=cv1 AND body='' AND sender='ai';
    INSERT INTO tickets (tenant_id, conversation_id, subject, status, category, resolved_at)
    VALUES (t_id, cv1,'Order tracking #45231','closed','shipping','2026-04-14 16:45+00');

    INSERT INTO conversations (tenant_id, customer_id, channel_kind, status, category, csat_rating, language, display_code, ai_handled, created_at, last_message_at, first_response_at)
    VALUES (t_id, c2,'web','open','request',4,'ar','CV-002',true,'2026-04-22 09:15+00','2026-04-22 09:17+00','2026-04-22 09:15+00')
    RETURNING id INTO cv2;
    INSERT INTO messages (tenant_id, conversation_id, sender, body, feedback, created_at) VALUES
      (t_id, cv2,'customer','أريد إرجاع هذا المنتج',NULL,'2026-04-22 09:15+00'),
      (t_id, cv2,'ai','أتفهم ذلك. هل يمكنك مشاركة رقم الطلب وسبب الإرجاع؟','positive','2026-04-22 09:15+00'),
      (t_id, cv2,'customer','طلب #78432. المقاس خاطئ.',NULL,'2026-04-22 09:16+00'),
      (t_id, cv2,'customer','',NULL,'2026-04-22 09:16+00'),
      (t_id, cv2,'ai','تم بدء عملية الإرجاع للطلب #78432. ستتلقى ملصق الشحن عبر البريد الإلكتروني خلال 24 ساعة.','positive','2026-04-22 09:17+00');
    UPDATE messages SET attachments='[{"type":"file","fileName":"receipt.pdf"}]'::jsonb WHERE conversation_id=cv2 AND body='' AND sender='customer';
    INSERT INTO tickets (tenant_id, conversation_id, subject, status, category)
    VALUES (t_id, cv2,'Return request #78432','open','refund');

    INSERT INTO conversations (tenant_id, customer_id, channel_kind, status, category, csat_rating, csat_comment, language, display_code, close_reason, ai_handled, created_at, last_message_at, resolved_at, first_response_at)
    VALUES (t_id, c3,'web','resolved','inquiry',5,'سريع جداً ومفيد!','ar','CV-003','ai_request',true,'2026-04-22 08:00+00','2026-04-22 08:00+00','2026-04-22 08:20+00','2026-04-22 08:00+00')
    RETURNING id INTO cv3;
    INSERT INTO messages (tenant_id, conversation_id, sender, body, feedback, created_at) VALUES
      (t_id, cv3,'customer','هل يتوفر هذا باللون الأزرق؟',NULL,'2026-04-22 08:00+00'),
      (t_id, cv3,'ai','نعم! لدينا أزرق داكن، أزرق سماوي، وأزرق ملكي. أيهم يهمك؟','positive','2026-04-22 08:00+00');

    INSERT INTO conversations (tenant_id, customer_id, channel_kind, status, category, csat_rating, language, display_code, close_reason, ai_handled, created_at, last_message_at, resolved_at, first_response_at)
    VALUES (t_id, c4,'web','resolved','inquiry',3,'ar','CV-004','idle',true,'2026-04-22 06:30+00','2026-04-22 06:30+00','2026-04-22 07:00+00','2026-04-22 06:30+00')
    RETURNING id INTO cv4;
    INSERT INTO messages (tenant_id, conversation_id, sender, body, feedback, created_at) VALUES
      (t_id, cv4,'customer','متى يبدأ التخفيض؟',NULL,'2026-04-22 06:30+00'),
      (t_id, cv4,'ai','تخفيضاتنا الموسمية تبدأ يوم الاثنين القادم بخصومات تصل إلى 40%!','negative','2026-04-22 06:30+00');

    INSERT INTO conversations (tenant_id, customer_id, channel_kind, status, category, csat_rating, language, display_code, ai_handled, created_at, last_message_at, first_response_at)
    VALUES (t_id, c5,'web','open','complaint',2,'ar','CV-005',true,'2026-04-22 04:00+00','2026-04-22 04:01+00','2026-04-22 04:00+00')
    RETURNING id INTO cv5;
    INSERT INTO messages (tenant_id, conversation_id, sender, body, feedback, created_at) VALUES
      (t_id, cv5,'customer','المنتج وصل تالف',NULL,'2026-04-22 04:00+00'),
      (t_id, cv5,'ai','أنا آسف لسماع ذلك! هل يمكنك مشاركة صور الضرر؟','negative','2026-04-22 04:00+00'),
      (t_id, cv5,'customer','',NULL,'2026-04-22 04:01+00');
    UPDATE messages SET attachments='[{"type":"image","fileName":"damaged-item.jpg"}]'::jsonb WHERE conversation_id=cv5 AND body='' AND sender='customer';
    INSERT INTO tickets (tenant_id, conversation_id, subject, status, category, priority)
    VALUES (t_id, cv5,'Damaged product complaint','open','other','high');

    INSERT INTO conversations (tenant_id, customer_id, channel_kind, status, category, csat_rating, language, display_code, close_reason, ai_handled, created_at, last_message_at, resolved_at, first_response_at)
    VALUES (t_id, c6,'web','resolved','inquiry',5,'ar','CV-006','customer_manual',true,'2026-04-22 03:00+00','2026-04-22 03:01+00','2026-04-22 03:05+00','2026-04-22 03:00+00')
    RETURNING id INTO cv6;
    INSERT INTO messages (tenant_id, conversation_id, sender, body, feedback, created_at) VALUES
      (t_id, cv6,'customer','هل هذا المنتج متوفر؟',NULL,'2026-04-22 03:00+00'),
      (t_id, cv6,'ai','نعم، متوفر في المخزون! هل ترغب في إضافته إلى سلة التسوق؟','positive','2026-04-22 03:00+00'),
      (t_id, cv6,'customer','شكراً على الرد السريع!',NULL,'2026-04-22 03:01+00');
  END LOOP;
END $$;
