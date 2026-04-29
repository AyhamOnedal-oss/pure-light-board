
-- 1. Phone column already exists on customers; just backfill demo phones.
UPDATE public.customers SET phone='+966 55 123 4567' WHERE display_name='Fatima Al-Zahrani' AND phone IS NULL;
UPDATE public.customers SET phone='+966 54 456 7890' WHERE display_name='Mohammed Ali' AND phone IS NULL;
UPDATE public.customers SET phone='+966 59 654 3210' WHERE display_name='Reem Hassan' AND phone IS NULL;

-- 2. ticket_activities table
CREATE TABLE IF NOT EXISTS public.ticket_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  ticket_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('note','status')),
  status text CHECK (status IS NULL OR status IN ('created','open','closed','resolved','pending')),
  text text,
  attachment jsonb,
  author_name text NOT NULL,
  author_role text NOT NULL DEFAULT 'agent',
  author_user_id uuid,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_activities_ticket ON public.ticket_activities(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_activities_tenant ON public.ticket_activities(tenant_id);

ALTER TABLE public.ticket_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ticket_activities_view ON public.ticket_activities;
DROP POLICY IF EXISTS ticket_activities_write ON public.ticket_activities;

CREATE POLICY ticket_activities_view ON public.ticket_activities
  FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY ticket_activities_write ON public.ticket_activities
  FOR ALL TO authenticated
  USING (tenant_role_at_least(tenant_id, auth.uid(), 'agent'::tenant_role))
  WITH CHECK (tenant_role_at_least(tenant_id, auth.uid(), 'agent'::tenant_role));

-- 3. Seed TK-005 and TK-006 for both demo tenants (idempotent)
DO $$
DECLARE
  t_id uuid;
  cust_ali uuid; cust_sara uuid;
  cv_ali uuid; cv_sara uuid;
  tk_ali uuid; tk_sara uuid;
BEGIN
  FOR t_id IN SELECT id FROM tenants WHERE name IN ('abc''s Workspace','ayhamonedal''s Workspace') LOOP
    -- TK-005
    IF NOT EXISTS (SELECT 1 FROM tickets WHERE tenant_id=t_id AND display_code='TK-005') THEN
      INSERT INTO customers (tenant_id, display_name, display_name_ar, avatar_color, phone, locale)
      VALUES (t_id,'Ali Saeed','علي سعيد','#8b5cf6','+966 59 654 3210','ar')
      RETURNING id INTO cust_ali;

      INSERT INTO conversations (tenant_id, customer_id, channel_kind, status, category, language, display_code, ai_handled, created_at, last_message_at, first_response_at)
      VALUES (t_id, cust_ali,'web','open','complaint','ar','CV-TK-005',true,'2026-04-14 07:00+00','2026-04-14 07:01+00','2026-04-14 07:00+00')
      RETURNING id INTO cv_ali;

      INSERT INTO messages (tenant_id, conversation_id, sender, body, feedback, created_at) VALUES
        (t_id, cv_ali,'customer','طلبي متأخر أكثر من أسبوع. ذا محبط جداً.',NULL,'2026-04-14 07:00+00'),
        (t_id, cv_ali,'ai','أعتذر بشدة عن التأخير. دعني أتحقق من حالة طلبك فوراً.','negative','2026-04-14 07:00+00'),
        (t_id, cv_ali,'ai','طلبك حالياً في مركز التوزيع. التسليم المتوقع غداً. تم تصنيفه كأولوية.','positive','2026-04-14 07:01+00');

      INSERT INTO tickets (tenant_id, conversation_id, subject, status, category, priority, display_code, created_at)
      VALUES (t_id, cv_ali,'Late delivery complaint','open','complaint','high','TK-005','2026-04-14 07:00+00')
      RETURNING id INTO tk_ali;

      INSERT INTO ticket_activities (tenant_id, ticket_id, type, status, author_name, author_role, created_at)
      VALUES (t_id, tk_ali,'status','created','System','admin','2026-04-14 07:00+00');
    END IF;

    -- TK-006
    IF NOT EXISTS (SELECT 1 FROM tickets WHERE tenant_id=t_id AND display_code='TK-006') THEN
      INSERT INTO customers (tenant_id, display_name, display_name_ar, avatar_color, phone, locale)
      VALUES (t_id,'Sara Mohammed','سارة محمد','#f59e0b','+966 58 111 2222','ar')
      RETURNING id INTO cust_sara;

      INSERT INTO conversations (tenant_id, customer_id, channel_kind, status, category, language, display_code, close_reason, ai_handled, created_at, last_message_at, resolved_at, first_response_at)
      VALUES (t_id, cust_sara,'web','resolved','request','ar','CV-TK-006','customer_manual',true,'2026-04-11 15:30+00','2026-04-11 15:32+00','2026-04-12 09:00+00','2026-04-11 15:30+00')
      RETURNING id INTO cv_sara;

      INSERT INTO messages (tenant_id, conversation_id, sender, body, feedback, created_at) VALUES
        (t_id, cv_sara,'customer','هل يمكنني تغيير عنوان التوصيل؟ انتقلت الأسبوع الماضي.',NULL,'2026-04-11 15:30+00'),
        (t_id, cv_sara,'ai','بالطبع! يرجى تقديم عنوانك الجديد وسأقوم بتحديثه فوراً.','positive','2026-04-11 15:30+00'),
        (t_id, cv_sara,'customer','العنوان الجديد: 123 طريق الملك فهد، الرياض',NULL,'2026-04-11 15:31+00'),
        (t_id, cv_sara,'ai','تم تحديث العنوان بنجاح! سيتم توصيل طلبك إلى العنوان الجديد.','positive','2026-04-11 15:32+00');

      INSERT INTO tickets (tenant_id, conversation_id, subject, status, category, priority, display_code, created_at, resolved_at)
      VALUES (t_id, cv_sara,'Delivery address change','closed','shipping','medium','TK-006','2026-04-11 15:30+00','2026-04-12 09:00+00')
      RETURNING id INTO tk_sara;

      INSERT INTO ticket_activities (tenant_id, ticket_id, type, status, author_name, author_role, created_at) VALUES
        (t_id, tk_sara,'status','created','System','admin','2026-04-11 15:30+00'),
        (t_id, tk_sara,'status','closed','System','admin','2026-04-12 09:00+00');
      INSERT INTO ticket_activities (tenant_id, ticket_id, type, text, author_name, author_role, created_at)
      VALUES (t_id, tk_sara,'note','تمت مراجعة الطلب وتحديث العنوان بنجاح. لا حاجة لإجراء إضافي.','Ahmed Al-Rashid','admin','2026-04-12 09:05+00');
    END IF;
  END LOOP;
END $$;

-- 4. Backfill "created" + optional "closed" activities for existing TK-001..TK-003
INSERT INTO ticket_activities (tenant_id, ticket_id, type, status, author_name, author_role, created_at)
SELECT tk.tenant_id, tk.id, 'status','created','System','admin', tk.created_at
FROM tickets tk
WHERE tk.display_code IN ('TK-001','TK-002','TK-003')
  AND NOT EXISTS (SELECT 1 FROM ticket_activities a WHERE a.ticket_id=tk.id AND a.status='created');

INSERT INTO ticket_activities (tenant_id, ticket_id, type, status, author_name, author_role, created_at)
SELECT tk.tenant_id, tk.id, 'status','closed','System','admin', tk.resolved_at
FROM tickets tk
WHERE tk.display_code IN ('TK-001','TK-002','TK-003')
  AND tk.status='closed' AND tk.resolved_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM ticket_activities a WHERE a.ticket_id=tk.id AND a.status='closed');
