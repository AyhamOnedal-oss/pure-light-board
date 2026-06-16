## رؤى الذكاء الاصطناعي — تقرير فجوات التدريب

تحويل قسم "رؤى الذكاء الاصطناعي" من نسخة مكررة من رسم التصنيف، إلى تقرير حقيقي عن الحالات التي **فشل الذكاء فيها** (لم يفهم / لم يجد معلومة)، مجمّعة حسب نوع رسالة العميل، مع أمثلة فعلية يستخدمها التاجر لتحسين التدريب.

مستقل تمامًا عن: رفع التذاكر، رسم تصنيف المحادثات (يبقى كما هو).

### 1. جدول `ai_insights` جديد

Migration ينشئ `public.ai_insights` مع RLS:

- `id uuid pk`
- `tenant_id uuid` (FK → settings_workspace)
- `conversation_id uuid` (FK → conversations_main)
- `message_id uuid` (FK → conversations_messages) — رسالة العميل التي فشل الذكاء في الرد عليها
- `category text` — تصنيف رسالة العميل: `inquiry` | `request` | `complaint` | `suggestion` | `unknown`
  - `unknown` = الذكاء ما عرف حتى يصنّف الرسالة
- `reason text` — `fallback_phrase` (الذكاء قال صراحة "ما أعرف") أو `negative_feedback` (إبهام سلبي)
- `customer_question text` — نص رسالة العميل
- `ai_answer text` — رد الذكاء (إن وُجد)
- `summary_ar text` — جملة عربية قصيرة للتاجر (مثل: "العميل سأل عن الشحن المبرد ولم تتوفر معلومة")
- `created_at timestamptz default now()`

GRANTs: `select` لـ `authenticated`، `all` لـ `service_role`. RLS: أعضاء التينانت يقرؤون، الخدمة فقط تكتب. فهرسة على `(tenant_id, created_at desc)` و `(tenant_id, category)`.

### 2. كشف الفجوة داخل `chat-ai`

بعد توليد كل رد من الذكاء:

**أ. Heuristic سريع (مجاني):** يفحص رد الذكاء عن عبارات مثل:
`لا أملك معلومات`, `لا أعلم`, `لم أفهم`, `لا أستطيع`, `سأحوّلك`, `تواصل مع خدمة`, `I don't know`, `I'm not sure`, إلخ.

**ب. إذا تطابق الـ heuristic:** نداء واحد لـ `openai/gpt-5-mini` عبر Lovable AI Gateway:
- المدخل: آخر رسالة عميل + رد الذكاء + (تصنيف المحادثة من `conversations_main.category` إن وُجد)
- المخرج (JSON منظّم):
  ```json
  {
    "is_real_gap": true,
    "category": "inquiry" | "request" | "complaint" | "suggestion" | "unknown",
    "summary_ar": "جملة قصيرة"
  }
  ```
- `category="unknown"` يعني الذكاء ما قدر يحدد نوع الرسالة أصلًا.
- إذا `is_real_gap=true` → insert صف في `ai_insights`.

**ج. مسار الإبهام السلبي:** عند تسجيل `feedback='negative'` على رسالة ذكاء، يُستدعى نفس المنطق (إعادة استخدام `chat-ai` بـ action param أو edge function صغير `record-ai-insight`) لإنتاج `summary_ar` و `category` ثم insert مع `reason='negative_feedback'`.

### 3. RPC جديد `dashboard_ai_insights(_tenant, _from, _to)`

يرجّع JSON:
```json
{
  "counts": {
    "inquiry": 5,
    "request": 3,
    "complaint": 2,
    "suggestion": 1,
    "unknown": 4
  },
  "total": 15,
  "examples": {
    "inquiry":    [{ "summary_ar": "...", "conversation_id": "...", "created_at": "..." }, ...],
    "request":    [...],
    "complaint":  [...],
    "suggestion": [...],
    "unknown":    [...]
  }
}
```
حتى 10 أمثلة لكل بطاقة، مرتبة بالأحدث. نفس حماية عضو التينانت مثل `dashboard_metrics`.

### 4. تغييرات الواجهة

- `useDashboardMetrics`: يجلب `dashboard_ai_insights` بالتوازي مع `dashboard_metrics`.
- **رسم تصنيف المحادثات** يبقى كما هو، يقرأ من `metrics.classification` (استفسار/طلب/شكوى/اقتراح/لا يوجد).
- **بطاقات رؤى الذكاء الاصطناعي (5)** تقرأ من `insights.counts` و `insights.examples`:
  - كل بطاقة تعرض العدد + قائمة قابلة للتمرير بأمثلة `summary_ar` (كل مثال قابل للنقر لفتح المحادثة المصدر).
  - الأرقام **مختلفة عمدًا** عن أرقام الرسم — وهذا هو السلوك الصحيح.
- نصوص توضيحية تحت العنوان: "حالات احتاج فيها الذكاء معلومات إضافية — استخدمها لتحسين تدريبه."

### 5. خارج النطاق

- لا تغيير على رسم تصنيف المحادثات.
- لا تغيير على كيفية تعبئة `conversations_main.category`.
- لا backfill للمحادثات السابقة (الرؤى تبدأ من لحظة النشر).
- لا ربط برفع التذاكر.

### تفاصيل تقنية

- النموذج: `openai/gpt-5-mini` عبر `LOVABLE_API_KEY` (موجود مسبقًا في الأسرار).
- نداء النموذج فقط عند تطابق الـ heuristic أو feedback سلبي → تكلفة منخفضة.
- جميع الـ inserts من service role داخل edge function.
- Migration: `supabase/migrations/<timestamp>_ai_insights.sql`.
- Edge functions: تعديل `chat-ai` + إضافة `record-ai-insight` (أو action داخل `chat-ai`).
