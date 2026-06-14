# إضافة إيميلَين جديدَين

بناءً على اختياراتك، نضيف اثنين فقط ونتجاوز إيميل تحديث الباقة.

## 1) تنبيه الرصيد المنخفض (80%)

**المنطق:** يُرسل مرة واحدة في كل دورة شهرية لما الاستهلاك يعبر 80% من `monthly_word_quota`، قبل ما الخدمة توقف عند 100%.

**التنفيذ:**
- تعديل دالة `bump_word_usage()` في DB: نضيف فحص عتبة 80% بجانب فحص 100% الحالي، ونطلق webhook جديد.
- عمود جديد في `settings_plans`: `low_balance_emailed_period date` (نفس نمط `service_paused_emailed_period`) لمنع التكرار في نفس الشهر.
- مفتاحان جديدان في `_app_secrets`: `low_balance_webhook_secret` + `low_balance_webhook_url`.
- إدج فنكشن جديدة: `send-low-balance-warning/index.ts` تبني الإيميل العربي وترسله عبر `sendResendEmail` للمالك.
- قالب HTML عربي جديد في `_shared/email-templates-ar.ts`: `lowBalanceWarningHtml({ store_name, used_percent, used_words, total_words, remaining_words, renewal_link })`.
- تسجيل الفنكشن في `supabase/config.toml` مع `verify_jwt = false`.

**محتوى الإيميل (مختصر):**
- عنوان: "وصلت إلى 80% من رصيدك في فقاعة AI"
- يوضح: النسبة المستهلكة، الكلمات المتبقية، تحذير من توقف الخدمة عند 100%، زر تجديد/ترقية.

## 2) تأكيد تجديد الاشتراك (عند تجديد ناجح)

**المنطق:** يُرسل حين يتم تمديد `subscription_end_date` بنجاح للباقة الحالية أو ترقيتها مع دفع جديد.

**التنفيذ:**
- ترايجر DB جديد على `settings_plans` يكتشف لما `subscription_end_date` يتغير لتاريخ مستقبلي أبعد من السابق (= تجديد).
- مفتاحان جديدان في `_app_secrets`: `renewal_confirmation_webhook_secret` + `renewal_confirmation_webhook_url`.
- إدج فنكشن جديدة: `send-renewal-confirmation/index.ts` ترسل التأكيد للمالك.
- قالب HTML عربي جديد: `renewalConfirmationHtml({ store_name, plan_name, new_end_date, monthly_quota })`.
- تسجيل الفنكشن في `supabase/config.toml`.
- إضافة عمود `last_renewal_emailed_for_end date` على `settings_plans` لمنع تكرار الإرسال لنفس تاريخ الانتهاء.

**محتوى الإيميل:**
- عنوان: "تم تجديد اشتراكك في فقاعة AI بنجاح"
- يوضح: اسم الباقة، تاريخ الانتهاء الجديد، حصة الكلمات الشهرية، رابط لوحة التحكم.

## بعد التطبيق

- إضافة المفاتيح الأربعة الجديدة في `_app_secrets` (URLs + secrets) عبر insert SQL.
- اختبار يدوي:
  - رفع `monthly_words_used` لـ 80% لتفعيل إيميل التنبيه.
  - تمديد `subscription_end_date` يدوياً لتفعيل إيميل التجديد.

## التفاصيل التقنية

- جميع الإيميلات عبر `RESEND_API_KEY` الموجود مسبقاً ودومين `support@fuqah.net`.
- المستلم = مالك الـ tenant (نفس نمط `send-service-paused` و`process-subscription-expiry`).
- استخدام `formatRiyadhDate` لتنسيق التواريخ بنفس أسلوب باقي الإيميلات.
- اللغة عربية فقط، RTL، يطابق هوية باقي القوالب في `email-templates-ar.ts`.
