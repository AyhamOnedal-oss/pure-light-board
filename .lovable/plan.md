## مشكلتان

### 1) التصنيف يظهر "استفسار" دائماً
**السبب:** في `src/app/components/ConversationsPage.tsx` السطر 142 يحوّل `category=null` إلى `'inquiry'` افتراضياً. محادثتك `2bbc5dd1` حالتها `status=new` و `analysis_done=false` — لم تُحلَّل بعد لأنها لم تُغلق. التحليل من AI يحدث عند الإغلاق فقط (عبر trigger `notify_classify_conversation` → `classify-conversation`)، وهذا متوافق مع رغبتك.

**الإصلاح:** عند `category=null` نُرجع `null` ولا نعرض شارة الفئة في الواجهة (أو نعرض "بانتظار التحليل").

### 2) التذاكر لا تظهر
**السبب:** تينانتك `c9b3f2cf…` يحوي **0 تذكرة**. كل تذاكر الـDB مزروعة لتينانتات أخرى. إضافة لذلك في `widget/src/app/components/ChatWindow.tsx` يُستدعى `postTicket(...)` ثم `trackEvent('ticket.created', ...)` بشكل مكرر بدون subject — يُرسل حدثين، الثاني بدون subject.

**الإصلاح:**
- إزالة استدعاء `trackEvent('ticket.created')` المكرر (سطر 269 و 326) — `postTicket` يستدعيه داخلياً.
- إعادة بناء حزمة الويدجت بعد التعديل.
- اختبار يدوي بـ curl على `widget-events` لإثبات أن الإدراج في `tickets_main` يعمل لتينانتك، ثم متابعة الإدراج الفعلي من الويدجت.

## الملفات المتأثرة
- `src/app/components/ConversationsPage.tsx` — تعيين `category` (سطر 142).
- `src/app/components/conversation/AnalysisBadges.tsx` — إخفاء شارة عند `null`.
- `widget/src/app/components/ChatWindow.tsx` — حذف استدعائي `trackEvent('ticket.created')` المكررين.
- إعادة بناء widget bundle.

## خارج النطاق
- لا تعديل على `classify-conversation` (تعمل صحيحاً).
- لا تعديل على schema قاعدة البيانات.
- لا cron / لا مهام دورية.

## خطوات الاختبار
1. افتح محادثة جديدة من الويدجت → لا تظهر شارة فئة (لأن التحليل لم يحدث).
2. أغلق المحادثة → trigger يستدعي `classify-conversation` → تظهر الفئة الصحيحة.
3. أنشئ تذكرة من الويدجت → تظهر مباشرة في صفحة التذاكر لتينانتك.
