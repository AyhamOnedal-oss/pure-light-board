# إعداد Supabase - Fuqah AI Dashboard

## 📋 نظرة عامة

تم إنشاء بنية قاعدة بيانات **بسيطة وشاملة** لدعم جميع بيانات لوحة التحكم، مع التركيز على سهولة الاستخدام للتجار.

---

## 🗂️ الملفات المُنشأة

### 1. `supabase/schema/dashboard_tables.sql`
السكريبت الكامل لإنشاء جميع الجداول والـ triggers والـ RLS policies.

**يحتوي على:**
- ✅ 8 جداول رئيسية
- ✅ Triggers تلقائية (رقم التذكرة، عداد الرسائل، الطوابع الزمنية)
- ✅ Row Level Security (RLS) لحماية البيانات
- ✅ Indexes محسّنة للأداء
- ✅ أمثلة على الاستعلامات

### 2. `src/app/types/database.ts`
TypeScript types لجميع الجداول والـ API responses.

**يحتوي على:**
- ✅ Interfaces لكل جدول
- ✅ Types للـ dashboard KPIs
- ✅ API response types
- ✅ Paginated response types

### 3. `src/app/services/supabase.ts`
Service layer بسيط للتعامل مع Supabase من الواجهة الأمامية.

**يحتوي على:**
- ✅ دوال جاهزة لجميع العمليات (CRUD)
- ✅ Pagination support
- ✅ Filtering & sorting
- ✅ Error handling

### 4. `supabase/SCHEMA_GUIDE.md`
دليل شامل بالعربية يشرح كل جدول وحقل واستعلام.

---

## 🚀 خطوات التثبيت

### الخطوة 1: تشغيل السكريبت في Supabase

1. افتح لوحة تحكم Supabase:
   ```
   https://supabase.com/dashboard/project/kyohutbusszojssbgbvw
   ```

2. اذهب إلى **SQL Editor** من القائمة الجانبية

3. انسخ محتوى ملف `supabase/schema/dashboard_tables.sql` كاملاً

4. الصق في المحرر

5. اضغط **Run** أو **F5**

6. انتظر حتى يظهر ✅ Success

### الخطوة 2: التحقق من الجداول

في **Table Editor**، يجب أن ترى 8 جداول جديدة:

```
✅ stores           - معلومات المتاجر
✅ conversations    - المحادثات
✅ messages         - الرسائل
✅ tickets          - التذاكر
✅ ratings          - التقييمات
✅ insights         - الرؤى الذكية
✅ analytics        - المقاييس اليومية
✅ bubble_clicks    - نقرات الفقاعة
```

### الخطوة 3: اختبار الاتصال

في كود React الخاص بك:

```typescript
import { supabase } from './services/supabase';

// اختبار: الحصول على analytics اليوم
const result = await supabase.getTodayAnalytics('YOUR_STORE_ID');
console.log(result);
```

---

## 📊 الجداول بالتفصيل

### 1. `stores` - المتاجر
معلومات المتجر الأساسية (الاسم، الشعار، API endpoint).

### 2. `conversations` - المحادثات
سجل كامل للمحادثات مع التصنيف التلقائي (شكوى، استفسار، طلب، اقتراح، غير معروف).

### 3. `messages` - الرسائل
الرسائل الفردية داخل كل محادثة، مع دعم:
- المرفقات (صور/ملفات)
- تقييم الرسائل (thumbs up/down)
- تحديد المرسل (عميل، AI، موظف)

### 4. `tickets` - التذاكر
تذاكر الدعم مع:
- رقم تلقائي (TKT-XXXXX)
- أولويات (منخفضة، متوسطة، عالية، عاجلة)
- حالات (مفتوحة، قيد المعالجة، محلولة، مغلقة)
- ربط بالمحادثات

### 5. `ratings` - التقييمات
تقييمات العملاء من 1-5 نجوم مع تعليقات اختيارية.

### 6. `insights` - الرؤى الذكية
المشاكل الشائعة المُستخلصة بالذكاء الاصطناعي (مثل "تأخر التوصيل")، مع:
- عداد التكرار
- حالة الحل
- دعم العربية والإنجليزية

### 7. `analytics` - المقاييس اليومية
جدول مُجمّع لجميع الـ KPIs:
- إجمالي المحادثات
- نسبة الإكمال
- التذاكر (مفتوحة/مغلقة)
- الكلمات المستهلكة
- نقرات الفقاعة
- متوسط وقت الاستجابة
- توزيع التصنيفات
- تقييمات إيجابية/سلبية

### 8. `bubble_clicks` - نقرات الفقاعة
تتبع كل نقرة على فقاعة الدردشة لقياس التفاعل.

---

## 🔐 الأمان (RLS)

تم تفعيل **Row Level Security** على جميع الجداول:

```sql
-- مثال: كل تاجر يرى بياناته فقط
CREATE POLICY "Merchants can view their own conversations" ON conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stores 
      WHERE stores.id = conversations.store_id 
      AND auth.uid()::TEXT = stores.id::TEXT
    )
  );
```

**الفائدة:**
- 🔒 عزل كامل بين المتاجر
- 🔒 لا يمكن لأي تاجر رؤية بيانات الآخرين
- 🔒 حماية تلقائية على مستوى قاعدة البيانات

---

## 🎯 أمثلة الاستخدام في React

### مثال 1: عرض KPIs في Dashboard

```typescript
import { supabase } from './services/supabase';
import { useEffect, useState } from 'react';

function DashboardPage() {
  const [analytics, setAnalytics] = useState(null);
  const storeId = 'YOUR_STORE_ID';

  useEffect(() => {
    async function loadAnalytics() {
      const result = await supabase.getTodayAnalytics(storeId);
      if (result.success) {
        setAnalytics(result.data);
      }
    }
    loadAnalytics();
  }, []);

  if (!analytics) return <div>Loading...</div>;

  return (
    <div>
      <h1>Dashboard</h1>
      <div className="kpis">
        <div>Conversations: {analytics.total_conversations}</div>
        <div>Completion Rate: {analytics.completion_rate}%</div>
        <div>Tickets: {analytics.total_tickets}</div>
        <div>Words: {analytics.words_consumed}</div>
      </div>
    </div>
  );
}
```

### مثال 2: عرض المحادثات مع Pagination

```typescript
const [conversations, setConversations] = useState([]);
const [page, setPage] = useState(1);

useEffect(() => {
  async function loadConversations() {
    const result = await supabase.getConversations(storeId, page, 20);
    setConversations(result.data);
  }
  loadConversations();
}, [page]);
```

### مثال 3: عرض الرؤى الذكية (Insights)

```typescript
const [complaints, setComplaints] = useState([]);

useEffect(() => {
  async function loadComplaints() {
    const result = await supabase.getInsights(storeId, 'complaints', false);
    if (result.success) {
      setComplaints(result.data);
    }
  }
  loadComplaints();
}, []);
```

### مثال 4: تحديث حالة التذكرة

```typescript
async function resolveTicket(ticketId: string) {
  const result = await supabase.updateTicket(ticketId, {
    status: 'resolved',
    resolved_at: new Date().toISOString()
  });
  
  if (result.success) {
    console.log('Ticket resolved!');
  }
}
```

---

## 🔧 الميزات التلقائية

### 1. رقم التذكرة التلقائي
```sql
-- عند إنشاء تذكرة، يتم توليد رقم تلقائياً:
-- TKT-12345, TKT-67890, etc.
```

### 2. عداد الرسائل
```sql
-- عند إضافة رسالة، يُحدّث message_count في conversations تلقائياً
```

### 3. الطوابع الزمنية
```sql
-- created_at و updated_at يُحدّثان تلقائياً
```

---

## 📈 استعلامات مفيدة

### الحصول على توزيع المحادثات حسب التصنيف

```typescript
const analytics = await supabase.getTodayAnalytics(storeId);

const distribution = {
  complaints: analytics.data.complaints_count,
  inquiries: analytics.data.inquiries_count,
  requests: analytics.data.requests_count,
  suggestions: analytics.data.suggestions_count,
  unknown: analytics.data.unknown_count
};
```

### الحصول على متوسط التقييم

```typescript
const analytics = await supabase.getTodayAnalytics(storeId);
const avgRating = analytics.data.avg_rating; // 0-5
```

### الحصول على التذاكر المفتوحة فقط

```typescript
const openTickets = await supabase.getTickets(storeId, 1, 50, 'open');
```

---

## 🐛 استكشاف الأخطاء

### المشكلة: "relation does not exist"
**الحل:** تأكد من تشغيل سكريبت `dashboard_tables.sql` في Supabase SQL Editor.

### المشكلة: "RLS policy violation"
**الحل:** تأكد من أن `auth.uid()` يطابق `store_id` في الـ RLS policies.

### المشكلة: "Cannot read property of undefined"
**الحل:** تحقق من أن الـ API response يحتوي على `success: true` و `data`.

---

## 📚 الخطوات التالية

1. ✅ تشغيل السكريبت في Supabase
2. ✅ اختبار الاتصال من React
3. ⏭️ دمج الـ Supabase service في صفحة Dashboard الحالية
4. ⏭️ استبدال البيانات الثابتة (mock data) ببيانات حقيقية من Supabase
5. ⏭️ إضافة صفحات المحادثات والتذاكر والإعدادات

---

## 💡 ملاحظات مهمة

- **الجداول محسّنة للأداء** مع indexes على الحقول الأكثر استخداماً
- **دعم كامل للعربية والإنجليزية** في جميع الحقول النصية
- **Pagination جاهز** في جميع الدوال
- **Error handling** مدمج في جميع العمليات
- **RLS مفعّل** لحماية البيانات تلقائياً

---

## 📞 الدعم

للمساعدة أو الأسئلة:
- **الموقع:** www.fuqah.ai
- **المستندات:** راجع `supabase/SCHEMA_GUIDE.md`

---

✨ **تم تصميم هذه البنية لتكون بسيطة وسهلة الاستخدام للتجار، مع قوة كافية لدعم جميع ميزات لوحة التحكم.**
