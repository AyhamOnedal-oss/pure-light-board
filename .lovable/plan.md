## التشخيص

### 1) المحادثة لم تُغلق تلقائياً بعد الخمول
- موقت الخمول في `widget/src/app/components/ChatWindow.tsx` يعمل **فقط أثناء فتح الفقاعة**. إذا أغلق الزائر التبويب أو غادر الصفحة، لا يوجد أي شيء يغلق المحادثة.
- لا يوجد cron على الخادم يفحص المحادثات الخاملة.

### 2) المحادثة `ea5a3f5c` لم تُغلق رغم النقر على إغلاق
- في DB حالتها `status='new'` وآخر تحديث 22:09:03. لم تصل أبداً إلى `closed`.
- السبب: `closeConversation()` في `widget/src/app/utils/analytics.ts` يستدعي `trackEvent('conversation.closed', ...)` فقط، و `supabase/functions/widget-events/index.ts` لا يعالج هذا الحدث (يعالج `bubble.click` / `bubble.shown` فقط). فالإغلاق لا يصل إلى `conversations_main`.

### 3) التذاكر المُنشأة من الفقاعة لا تظهر في صفحة التذاكر بالداشبورد
- `postTicket()` يحاول الإدراج المباشر في `tickets_main` عبر REST، لكنه يتخطّى الإدراج إذا لم يكن `tenant_id` متوفراً في `getStoreContext()` (يطبع `[FuqahChat] postTicket skipped: no tenant_id resolved`).
- لا توجد أي صفوف في `tickets_main` للمستأجر الحالي `c9b3f2cf-...` — مما يؤكد أن `tenant_id` لا يصل للفقاعة، أو أن RLS `tickets_anon_insert_widget` ترفض (تتطلب `status='open'` و `assignee_user_id IS NULL` و `resolved_at IS NULL`).

## الخطة

### A. إغلاق المحادثة من الفقاعة (الإصلاح الفوري للنقطة 2)
في `supabase/functions/widget-events/index.ts` أضف معالجة `event === 'conversation.closed'`:
- يقرأ `conversation_id` و `reason` من body.
- يستخدم service-role client لتحديث `conversations_main`:
  ```sql
  UPDATE conversations_main
     SET status = 'closed',
         close_reason = <reason mapped: manual|inactivity|ai|rating_skip>,
         resolved_at = COALESCE(resolved_at, now()),
         updated_at = now()
   WHERE id = :conversation_id AND tenant_id = :tenant_id
  ```
- ملاحظة: قيود `conversations_close_reason_check` ظاهرة في logs — يجب التحقق من القيم المسموحة. إن كانت `customer_manual / inactivity / ai_resolved / rating_skip` فقط، نعمل mapping. سأقرأ الـ check constraint ضمن التنفيذ ونوفّق القيم.
- إرسال نفس الإغلاق أيضاً عند تجاوز موقت الخمول داخل الفقاعة (موجود مسبقاً، فقط يحتاج backend يعالجه).

### B. cron لإغلاق المحادثات الخاملة على الخادم (النقطة 1)
- تفعيل `pg_cron` و `pg_net` (إن لم يكونا).
- جدولة وظيفة كل 5 دقائق تُغلق المحادثات النشطة التي مرّ على آخر رسالة فيها أكثر من X دقيقة (افتراضياً 30 دقيقة، قابل للضبط لاحقاً):
  ```sql
  UPDATE conversations_main
     SET status = 'closed',
         close_reason = 'inactivity',
         resolved_at = now(),
         updated_at = now()
   WHERE status IN ('new','open','pending')
     AND last_message_at < now() - interval '30 minutes';
  ```
- هذا يضمن إغلاق المحادثات حتى عندما يغادر الزائر بدون تفاعل، ويُشغّل `notify_classify_conversation()` تلقائياً (موجود trigger مسبقاً).

### C. ظهور التذاكر من الفقاعة في الداشبورد (النقطة 3)
1. **توليد ticket عبر edge function بدلاً من REST مباشر** — أضف `event === 'ticket.created'` في `widget-events` تستخدم service-role لإدراج صف في `tickets_main` مع:
   - `tenant_id`, `conversation_id`, `subject`, `description`, `status='open'`, `priority='medium'`, `customer_phone`, `customer_name` (من `display_name` للعميل المرتبط بالمحادثة).
   - يتجاوز RLS، لا يعتمد على `tenant_id` في storeContext، بل يستخرجه من `conversation_id`.
2. تعديل `postTicket()` في `widget/src/app/utils/analytics.ts` لإزالة الإدراج المباشر وإعتماد trackEvent فقط (الـ widget-events يتولّى الإدراج).
3. التحقق من فلترة `TicketsPage.tsx`: تستخدم نفس `tenant_id` ومن المفترض أن تظهر التذاكر الجديدة فوراً عبر React Query refetch.

### D. تنظيف فوري للحالة الحالية
- إغلاق المحادثة `ea5a3f5c` (و أي محادثة خاملة أخرى) عبر تشغيل أول دفعة من cron يدوياً ضمن الـ migration.

## الملفات

- `supabase/functions/widget-events/index.ts` — إضافة معالجة `conversation.closed` و `ticket.created`.
- `widget/src/app/utils/analytics.ts` — `postTicket()` يكتفي بـ trackEvent.
- migration جديدة: تفعيل pg_cron/pg_net، جدولة الإغلاق التلقائي كل 5 دقائق، وإغلاق فوري للمحادثات الخاملة الحالية.

## خارج النطاق
- تغيير منطق التحليل (classify-conversation) أو UI الداشبورد للتذاكر.
- دعم قنوات WhatsApp/Instagram للإغلاق التلقائي (الحالي web فقط).
