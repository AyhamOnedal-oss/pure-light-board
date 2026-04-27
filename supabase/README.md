# Supabase Database for Fuqah AI Dashboard

## 📁 هيكل الملفات

```
supabase/
├── schema/
│   └── dashboard_tables.sql      # السكريبت الكامل للجداول
├── SCHEMA_GUIDE.md               # دليل شامل بالعربية
└── README.md                     # هذا الملف

src/app/
├── types/
│   └── database.ts               # TypeScript interfaces
└── services/
    └── supabase.ts               # Service layer

/
├── SUPABASE_SETUP.md             # دليل التثبيت خطوة بخطوة
└── INTEGRATION_EXAMPLE.md        # أمثلة الدمج مع React
```

---

## 🚀 البدء السريع (3 خطوات)

### 1️⃣ تشغيل السكريبت
```bash
# افتح Supabase SQL Editor على:
# https://supabase.com/dashboard/project/kyohutbusszojssbgbvw/sql

# انسخ محتوى: supabase/schema/dashboard_tables.sql
# الصق في المحرر واضغط Run
```

### 2️⃣ التحقق
```bash
# افتح Table Editor
# يجب أن ترى 8 جداول:
✅ stores
✅ conversations
✅ messages
✅ tickets
✅ ratings
✅ insights
✅ analytics
✅ bubble_clicks
```

### 3️⃣ الاستخدام في React
```typescript
import { supabase } from './services/supabase';

// مثال: الحصول على analytics اليوم
const result = await supabase.getTodayAnalytics('YOUR_STORE_ID');
console.log(result.data);
```

---

## 📊 الجداول (8)

| الجدول | الوصف | عدد الحقول |
|--------|-------|------------|
| **stores** | معلومات المتاجر | 5 |
| **conversations** | المحادثات | 10 |
| **messages** | الرسائل | 7 |
| **tickets** | التذاكر | 14 |
| **ratings** | التقييمات | 5 |
| **insights** | الرؤى الذكية | 8 |
| **analytics** | المقاييس اليومية | 20+ |
| **bubble_clicks** | نقرات الفقاعة | 4 |

---

## 🎯 ما تغطيه قاعدة البيانات

### صفحة Dashboard (/dashboard)

✅ **6 KPIs رئيسية:**
- إجمالي المحادثات
- نسبة الإكمال
- التذاكر
- الكلمات المستهلكة
- نقرات الفقاعة
- متوسط وقت الاستجابة

✅ **Charts:**
- Conversation Classification (Pie)
- Ticket Status (Bar)
- Customer Rating (Stars)
- AI Feedback (Donut)

✅ **AI-Driven Insights:**
- Complaints (الشكاوى)
- Requests (الطلبات)
- Inquiries (الاستفسارات)
- Suggestions (الاقتراحات)
- Unknown Questions (أسئلة غير معروفة)

✅ **AI Message Feedback:**
- قائمة الرسائل مع تقييماتها (thumbs up/down)
- عرض المحادثات الكاملة

---

## 🔐 الأمان

### Row Level Security (RLS)
- ✅ مفعّل على جميع الجداول
- ✅ كل تاجر يرى بياناته فقط
- ✅ عزل كامل بين المتاجر

### Policies
```sql
-- مثال
CREATE POLICY "Merchants can view their own conversations"
  ON conversations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM stores 
    WHERE stores.id = conversations.store_id 
    AND auth.uid()::TEXT = stores.id::TEXT
  ));
```

---

## ⚡ الميزات التلقائية

### 🔢 توليد رقم التذكرة
```sql
-- عند إنشاء تذكرة:
ticket_number = 'TKT-12345'  -- تلقائياً
```

### 🔄 عداد الرسائل
```sql
-- عند إضافة رسالة:
UPDATE conversations 
SET message_count = message_count + 1
WHERE id = conversation_id;
```

### 📅 الطوابع الزمنية
```sql
-- عند التعديل:
updated_at = NOW()  -- تلقائياً
```

---

## 🛠️ API Methods (من supabase.ts)

### Stores
- `getStore(storeId)`
- `updateStore(storeId, updates)`

### Analytics
- `getTodayAnalytics(storeId)`
- `getAnalyticsRange(storeId, startDate, endDate)`

### Conversations
- `getConversations(storeId, page, limit, classification?, status?)`
- `getConversationWithMessages(conversationId)`

### Messages
- `addMessage(message)`
- `updateMessageFeedback(messageId, feedback, note?)`

### Tickets
- `getTickets(storeId, page, limit, status?, priority?)`
- `createTicket(ticket)`
- `updateTicket(ticketId, updates)`

### Ratings
- `getRatings(storeId, page, limit)`
- `addRating(rating)`

### Insights
- `getInsights(storeId, category?, resolvedOnly?)`
- `updateInsight(insightId, updates)`
- `deleteInsight(insightId)`

### Bubble Clicks
- `trackBubbleClick(storeId, sessionId?)`

---

## 📖 الملفات التوثيقية

### 1. SUPABASE_SETUP.md
دليل التثبيت الكامل مع:
- شرح كل جدول
- خطوات التثبيت
- أمثلة الاستعلامات
- استكشاف الأخطاء

### 2. SCHEMA_GUIDE.md
دليل شامل بالعربية للتجار:
- نظرة عامة على كل جدول
- أنواع البيانات
- العلاقات بين الجداول
- أمثلة SQL

### 3. INTEGRATION_EXAMPLE.md
أمثلة عملية للدمج:
- تحديث DashboardPage
- تحميل البيانات
- معالجة الأخطاء
- Real-time updates

---

## 🧪 اختبار الاتصال

```typescript
// test-connection.ts
import { supabase } from './src/app/services/supabase';

async function testConnection() {
  console.log('Testing Supabase connection...');
  
  const result = await supabase.getTodayAnalytics('test-store-id');
  
  if (result.success) {
    console.log('✅ Connection successful!');
    console.log('Data:', result.data);
  } else {
    console.log('❌ Connection failed:', result.error);
  }
}

testConnection();
```

---

## 📈 أمثلة الاستعلامات

### الحصول على مقاييس اليوم
```typescript
const analytics = await supabase.getTodayAnalytics(storeId);
```

### الحصول على المحادثات النشطة
```typescript
const conversations = await supabase.getConversations(
  storeId,
  1,      // page
  50,     // limit
  null,   // classification (any)
  'active' // status
);
```

### الحصول على التذاكر المفتوحة
```typescript
const openTickets = await supabase.getTickets(
  storeId,
  1,
  50,
  'open'  // status
);
```

### الحصول على الشكاوى غير المحلولة
```typescript
const complaints = await supabase.getInsights(
  storeId,
  'complaints',  // category
  false          // resolved
);
```

---

## 🔄 Real-time Updates (متقدم)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// الاستماع للتغييرات في analytics
const subscription = supabaseClient
  .channel('analytics_changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'analytics',
    filter: `store_id=eq.${storeId}`
  }, (payload) => {
    console.log('Analytics updated!', payload);
    // تحديث الواجهة
  })
  .subscribe();

// تنظيف
subscription.unsubscribe();
```

---

## 🎨 البيانات الوهمية (لأغراض التطوير)

يمكنك إضافة بيانات وهمية للاختبار:

```sql
-- إضافة متجر
INSERT INTO stores (id, store_name, store_logo, api_endpoint)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'متجر الهدايا الفاخرة',
  'https://example.com/logo.png',
  'https://api.fuqah.ai'
);

-- إضافة analytics لليوم
INSERT INTO analytics (store_id, date, total_conversations, completion_rate, total_tickets)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  CURRENT_DATE,
  2847,
  94.2,
  156
);

-- إضافة محادثة
INSERT INTO conversations (store_id, customer_phone, classification, status)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  '+966501234567',
  'inquiry',
  'active'
);
```

---

## 🐛 المشاكل الشائعة

### "relation does not exist"
```bash
✅ الحل: تأكد من تشغيل dashboard_tables.sql في SQL Editor
```

### "RLS policy violation"
```bash
✅ الحل: تأكد من أن auth.uid() يطابق store_id
```

### "Cannot read property of undefined"
```bash
✅ الحل: تحقق من result.success قبل الوصول لـ result.data
```

---

## 📞 الدعم

- **التوثيق:** راجع الملفات في `/supabase/`
- **الأمثلة:** راجع `INTEGRATION_EXAMPLE.md`
- **الموقع:** www.fuqah.ai

---

## ✨ الميزات

- ✅ **بسيط:** 8 جداول فقط، سهلة الفهم
- ✅ **شامل:** يغطي جميع بيانات Dashboard
- ✅ **آمن:** RLS مفعّل على كل شيء
- ✅ **سريع:** Indexes محسّنة للأداء
- ✅ **ثنائي اللغة:** دعم كامل للعربية والإنجليزية
- ✅ **موثّق:** 4 ملفات توثيق شاملة
- ✅ **جاهز للإنتاج:** Triggers تلقائية، error handling، pagination

---

**تم تصميم هذه البنية لتكون بسيطة وسهلة الاستخدام للتجار، مع قوة كافية لدعم جميع ميزات Fuqah AI Dashboard.** 🚀
