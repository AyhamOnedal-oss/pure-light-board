# دليل قاعدة البيانات - Fuqah AI Dashboard

## نظرة عامة

تم تصميم قاعدة البيانات لتكون **بسيطة وسهلة الاستخدام للتجار**، مع دعم كامل للغتين العربية والإنجليزية.

---

## الجداول الرئيسية

### 1️⃣ `stores` - المتاجر

يحتوي على معلومات المتجر الأساسية.

| الحقل | النوع | الوصف |
|------|------|------|
| `id` | UUID | معرّف المتجر الفريد |
| `store_name` | نص | اسم المتجر |
| `store_logo` | نص (URL) | رابط شعار المتجر |
| `api_endpoint` | نص (URL) | نقطة الاتصال بالـ API |
| `created_at` | تاريخ ووقت | تاريخ الإنشاء |
| `updated_at` | تاريخ ووقت | تاريخ آخر تحديث |

**مثال:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "store_name": "متجر الهدايا الفاخرة",
  "store_logo": "https://example.com/logo.png",
  "api_endpoint": "https://api.fuqah.ai"
}
```

---

### 2️⃣ `conversations` - المحادثات

يحتوي على سجل المحادثات بين العملاء والذكاء الاصطناعي.

| الحقل | النوع | الوصف |
|------|------|------|
| `id` | UUID | معرّف المحادثة |
| `store_id` | UUID | معرّف المتجر |
| `customer_phone` | نص | رقم هاتف العميل |
| `customer_name` | نص | اسم العميل |
| `classification` | نص | تصنيف المحادثة (شكوى، استفسار، طلب، اقتراح، غير معروف) |
| `status` | نص | حالة المحادثة (نشطة، مكتملة، مؤرشفة) |
| `message_count` | رقم | عدد الرسائل |
| `last_message_at` | تاريخ ووقت | تاريخ آخر رسالة |

**التصنيفات الممكنة:**
- `complaint` - شكوى
- `inquiry` - استفسار
- `request` - طلب
- `suggestion` - اقتراح
- `unknown` - غير معروف

---

### 3️⃣ `messages` - الرسائل

يحتوي على الرسائل الفردية داخل كل محادثة.

| الحقل | النوع | الوصف |
|------|------|------|
| `id` | UUID | معرّف الرسالة |
| `conversation_id` | UUID | معرّف المحادثة |
| `sender` | نص | المرسل (عميل، ذكاء اصطناعي، موظف) |
| `content` | نص | محتوى الرسالة |
| `media_url` | نص (URL) | رابط الصورة/الملف المرفق |
| `feedback` | نص | تقييم الرسالة (إيجابي، سلبي) |
| `feedback_note` | نص | ملاحظة على التقييم |

**أنواع المرسل:**
- `customer` - العميل
- `ai` - الذكاء الاصطناعي
- `agent` - موظف الدعم

---

### 4️⃣ `tickets` - التذاكر

يحتوي على تذاكر الدعم المُنشأة من المحادثات.

| الحقل | النوع | الوصف |
|------|------|------|
| `id` | UUID | معرّف التذكرة |
| `ticket_number` | نص | رقم التذكرة (مثال: TKT-12345) |
| `store_id` | UUID | معرّف المتجر |
| `customer_phone` | نص | رقم هاتف العميل |
| `title_en` | نص | العنوان بالإنجليزية |
| `title_ar` | نص | العنوان بالعربية |
| `description_en` | نص | الوصف بالإنجليزية |
| `description_ar` | نص | الوصف بالعربية |
| `priority` | نص | الأولوية (منخفضة، متوسطة، عالية، عاجلة) |
| `status` | نص | الحالة (مفتوحة، قيد المعالجة، محلولة، مغلقة) |
| `assigned_to` | UUID | معيّنة لـ (معرّف الموظف) |
| `resolved_at` | تاريخ ووقت | تاريخ الحل |

**الأولويات:**
- `low` - منخفضة
- `medium` - متوسطة
- `high` - عالية
- `urgent` - عاجلة

**الحالات:**
- `open` - مفتوحة
- `in_progress` - قيد المعالجة
- `resolved` - محلولة
- `closed` - مغلقة

---

### 5️⃣ `ratings` - التقييمات

يحتوي على تقييمات رضا العملاء.

| الحقل | النوع | الوصف |
|------|------|------|
| `id` | UUID | معرّف التقييم |
| `store_id` | UUID | معرّف المتجر |
| `conversation_id` | UUID | معرّف المحادثة |
| `rating` | رقم | التقييم (1-5 نجوم) |
| `comment` | نص | تعليق العميل |

---

### 6️⃣ `insights` - الرؤى الذكية

يحتوي على الرؤى المُستخلصة بواسطة الذكاء الاصطناعي.

| الحقل | النوع | الوصف |
|------|------|------|
| `id` | UUID | معرّف الرؤية |
| `store_id` | UUID | معرّف المتجر |
| `category` | نص | الفئة (شكاوى، طلبات، استفسارات، اقتراحات، غير معروف) |
| `label_en` | نص | التسمية بالإنجليزية |
| `label_ar` | نص | التسمية بالعربية |
| `count` | رقم | عدد التكرار |
| `resolved` | صح/خطأ | تم الحل؟ |

**مثال:**
```json
{
  "category": "complaints",
  "label_en": "Delivery delay",
  "label_ar": "تأخر التوصيل",
  "count": 47,
  "resolved": false
}
```

---

### 7️⃣ `analytics` - المقاييس اليومية

يحتوي على المقاييس المُجمّعة لكل يوم (KPIs).

| المقياس | الوصف |
|---------|------|
| `total_conversations` | إجمالي المحادثات |
| `completion_rate` | نسبة الإكمال (%) |
| `total_tickets` | إجمالي التذاكر |
| `open_tickets` | التذاكر المفتوحة |
| `closed_tickets` | التذاكر المغلقة |
| `words_consumed` | الكلمات المستهلكة |
| `bubble_clicks` | نقرات الفقاعة |
| `avg_response_time_seconds` | متوسط وقت الاستجابة (بالثواني) |
| `complaints_count` | عدد الشكاوى |
| `inquiries_count` | عدد الاستفسارات |
| `requests_count` | عدد الطلبات |
| `suggestions_count` | عدد الاقتراحات |
| `unknown_count` | عدد الأسئلة غير المعروفة |
| `positive_feedback` | التقييمات الإيجابية |
| `negative_feedback` | التقييمات السلبية |
| `total_ratings` | إجمالي التقييمات |
| `avg_rating` | متوسط التقييم |

---

### 8️⃣ `bubble_clicks` - نقرات الفقاعة

يتتبع نقرات العملاء على فقاعة الدردشة.

| الحقل | النوع | الوصف |
|------|------|------|
| `id` | UUID | معرّف النقرة |
| `store_id` | UUID | معرّف المتجر |
| `session_id` | نص | معرّف الجلسة |
| `clicked_at` | تاريخ ووقت | وقت النقر |

---

## الميزات التلقائية

### 🔄 التحديث التلقائي للطوابع الزمنية
جميع الجداول تُحدّث حقل `updated_at` تلقائياً عند التعديل.

### 🔢 عداد الرسائل التلقائي
عند إضافة رسالة جديدة، يتم تحديث `message_count` في جدول المحادثات تلقائياً.

### 🎫 توليد رقم التذكرة التلقائي
يتم إنشاء رقم تذكرة فريد (TKT-XXXXX) تلقائياً عند إنشاء تذكرة جديدة.

---

## الأمان (RLS)

تم تفعيل **Row Level Security** على جميع الجداول، بحيث:
- كل تاجر يرى بيانات متجره فقط
- لا يمكن الوصول لبيانات المتاجر الأخرى

---

## أمثلة على الاستعلامات

### 📊 الحصول على مقاييس اليوم الحالي
```sql
SELECT * FROM analytics
WHERE store_id = 'xxx'
AND date = CURRENT_DATE;
```

### 💬 الحصول على آخر 50 محادثة
```sql
SELECT * FROM conversations
WHERE store_id = 'xxx'
ORDER BY created_at DESC
LIMIT 50;
```

### 🎫 الحصول على جميع التذاكر المفتوحة
```sql
SELECT * FROM tickets
WHERE store_id = 'xxx'
AND status = 'open'
ORDER BY created_at DESC;
```

### ⭐ الحصول على متوسط التقييم لآخر 30 يوم
```sql
SELECT AVG(rating) FROM ratings
WHERE store_id = 'xxx'
AND created_at >= NOW() - INTERVAL '30 days';
```

### 🔍 الحصول على أكثر الشكاوى تكراراً
```sql
SELECT * FROM insights
WHERE store_id = 'xxx'
AND category = 'complaints'
AND resolved = FALSE
ORDER BY count DESC
LIMIT 10;
```

### 👍👎 الحصول على إحصائيات التقييم (إيجابي/سلبي)
```sql
SELECT feedback, COUNT(*) FROM messages
WHERE conversation_id IN (
  SELECT id FROM conversations WHERE store_id = 'xxx'
)
AND feedback IS NOT NULL
GROUP BY feedback;
```

---

## خطوات التثبيت

### 1️⃣ تشغيل السكريبت في Supabase

1. افتح لوحة تحكم Supabase الخاصة بك
2. اذهب إلى **SQL Editor**
3. انسخ محتوى ملف `dashboard_tables.sql`
4. الصق في المحرر واضغط **Run**

### 2️⃣ التحقق من الجداول

بعد التشغيل، ستجد 8 جداول جديدة:
- ✅ stores
- ✅ conversations
- ✅ messages
- ✅ tickets
- ✅ ratings
- ✅ insights
- ✅ analytics
- ✅ bubble_clicks

---

## الدعم

للمساعدة أو الاستفسارات، تواصل مع فريق Fuqah AI على:
**www.fuqah.ai**
