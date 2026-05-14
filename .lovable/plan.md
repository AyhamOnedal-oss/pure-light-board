## الخطة المعدّلة (بدون cron)

### 1. إلغاء أي مهمة cron مجدولة
- لا ننشئ migration لـ `pg_cron`/`pg_net`.
- إذا كانت المهمة `auto-close-idle-conversations` قد جُدوِلت سابقاً، نزيلها:
  ```sql
  SELECT cron.unschedule('auto-close-idle-conversations');
  ```
  (migration واحد فقط للتنظيف، بدون أي جدولة جديدة).

### 2. إغلاق فوري من الويدجت عند انتهاء مؤقت الخمول
في `widget/src/app/utils/analytics.ts` (أو حيث يُدار مؤقت الخمول):
- عند انتهاء المؤقت المعرّف في إعدادات الويدجت، نستدعي:
  - `trackEvent("conversation.closed", { conversation_id, reason: "inactivity" })`
- هذا الحدث يصل إلى edge function `widget-events` التي تحتوي بالفعل (من التعديل السابق) على معالج `conversation.closed` الذي يحدّث `conversations_main` بـ `status='closed'` و `close_reason='inactivity'` و `resolved_at=now()`.

### 3. إغلاق يدوي للمحادثة `ea5a3f5c` العالقة
migration لمرة واحدة:
```sql
UPDATE conversations_main
SET status='closed', close_reason='inactivity', resolved_at=now(), updated_at=now()
WHERE id LIKE 'ea5a3f5c%' AND status IN ('new','open','pending');
```

### خارج النطاق
- لا cron، لا job دوري.
- لا تعديل على معالجة `ticket.created` (تم سابقاً).
- لا تغيير في منطق مؤقت الخمول نفسه (مدته تبقى من إعدادات الويدجت).

### الملفات المتأثرة
- migration جديد: إلغاء cron + إغلاق المحادثة العالقة.
- `widget/src/app/utils/analytics.ts`: التأكد من إرسال `conversation.closed` عند انتهاء المؤقت.
