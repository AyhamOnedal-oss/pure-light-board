# مثال الدمج - Supabase مع Dashboard

## نظرة عامة

هذا الملف يوضح كيفية استبدال البيانات الثابتة (mock data) في `DashboardPage.tsx` ببيانات حقيقية من Supabase.

---

## الخطوة 1: إعداد Context للمتجر

أولاً، نحتاج لإضافة `storeId` في AppContext:

```typescript
// src/app/context/AppContext.tsx

interface AppContextType {
  // ... existing properties
  storeId: string; // إضافة
}

export function AppProvider({ children }: { children: ReactNode }) {
  // في بيئة الإنتاج، ستحصل على storeId من الـ authentication
  const [storeId] = useState('550e8400-e29b-41d4-a716-446655440000'); // مثال
  
  // ... rest of the code
  
  return (
    <AppContext.Provider value={{
      // ... existing values
      storeId,
    }}>
      {children}
    </AppContext.Provider>
  );
}
```

---

## الخطوة 2: تحديث DashboardPage لاستخدام Supabase

### قبل (البيانات الثابتة):

```typescript
// DashboardPage.tsx - قديم
const kpis = [
  { icon: MessageSquare, label: t('Conversations', 'المحادثات'), value: '2,847', change: '+12.5%', up: true, color: '#043CC8' },
  // ... hardcoded values
];
```

### بعد (البيانات من Supabase):

```typescript
// DashboardPage.tsx - جديد
import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import type { Analytics } from '../types/database';

export function DashboardPage() {
  const { t, theme, language, showToast, storeId } = useApp();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  // تحميل البيانات من Supabase
  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      const result = await supabase.getTodayAnalytics(storeId);
      if (result.success && result.data) {
        setAnalytics(result.data);
      } else {
        showToast(t('Failed to load analytics', 'فشل تحميل البيانات'), 'error');
      }
      setLoading(false);
    }
    loadDashboardData();
  }, [storeId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">
          {t('Loading dashboard...', 'جارٍ تحميل لوحة التحكم...')}
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center text-muted-foreground">
        {t('No data available', 'لا توجد بيانات')}
      </div>
    );
  }

  // تحويل البيانات من Supabase إلى KPIs
  const kpis = [
    {
      icon: MessageSquare,
      label: t('Conversations', 'المحادثات'),
      value: analytics.total_conversations.toLocaleString(),
      change: '+12.5%', // يمكن حسابها من المقارنة مع الأمس
      up: true,
      color: '#043CC8'
    },
    {
      icon: CheckCircle,
      label: t('Completion Rate', 'نسبة الإكمال'),
      value: `${analytics.completion_rate.toFixed(1)}%`,
      change: '+3.1%',
      up: true,
      color: '#10b981'
    },
    {
      icon: Ticket,
      label: t('Tickets', 'التذاكر'),
      value: analytics.total_tickets.toLocaleString(),
      change: '-5.2%',
      up: false,
      color: '#f59e0b'
    },
    {
      icon: FileText,
      label: t('Words Consumed', 'الكلمات المستهلكة'),
      value: formatNumber(analytics.words_consumed), // 1.2M format
      change: '+18.7%',
      up: true,
      color: '#8b5cf6'
    },
    {
      icon: MousePointerClick,
      label: t('Bubble Clicks', 'نقرات الفقاعة'),
      value: analytics.bubble_clicks.toLocaleString(),
      change: '+22.3%',
      up: true,
      color: '#00C9BD'
    },
    {
      icon: Clock,
      label: t('Avg Response Time', 'متوسط وقت الاستجابة'),
      value: `${analytics.avg_response_time_seconds.toFixed(1)}s`,
      change: '-15.4%',
      up: true,
      color: '#ec4899'
    },
  ];

  // تحويل بيانات التصنيف
  const classificationData = [
    {
      name: t('Complaint', 'شكوى'),
      value: analytics.complaints_count,
      color: '#ff4466'
    },
    {
      name: t('Inquiry', 'استفسار'),
      value: analytics.inquiries_count,
      color: '#043CC8'
    },
    {
      name: t('Request', 'طلب'),
      value: analytics.requests_count,
      color: '#f59e0b'
    },
    {
      name: t('Suggestion', 'اقتراح'),
      value: analytics.suggestions_count,
      color: '#10b981'
    },
  ];

  // تحويل بيانات التذاكر
  const ticketStatusData = [
    {
      name: t('Total', 'الإجمالي'),
      value: analytics.total_tickets,
      fill: '#043CC8'
    },
    {
      name: t('Open', 'مفتوحة'),
      value: analytics.open_tickets,
      fill: '#ff4466'
    },
    {
      name: t('Closed', 'مغلقة'),
      value: analytics.closed_tickets,
      fill: '#10b981'
    },
  ];

  // ... باقي الكود يبقى كما هو
}

// دالة مساعدة لتنسيق الأرقام الكبيرة
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}
```

---

## الخطوة 3: تحميل Insights من Supabase

```typescript
// DashboardPage.tsx - تحديث

const [insights, setInsights] = useState({
  complaints: [],
  requests: [],
  inquiries: [],
  suggestions: [],
  unknown: []
});

useEffect(() => {
  async function loadInsights() {
    // تحميل جميع الفئات
    const categories = ['complaints', 'requests', 'inquiries', 'suggestions', 'unknown'];
    const results = await Promise.all(
      categories.map(cat => supabase.getInsights(storeId, cat, false))
    );

    const newInsights: any = {};
    results.forEach((result, index) => {
      if (result.success) {
        newInsights[categories[index]] = result.data;
      }
    });

    setInsights(newInsights);
  }

  loadInsights();
}, [storeId]);

// في الـ JSX
{insights[openInsight]?.length === 0 ? (
  <div className="flex items-center justify-center py-16 text-muted-foreground text-[14px]">
    {t('No issues in this category', 'لا توجد مشكلات في هذه الفئة')}
  </div>
) : (
  insights[openInsight]?.map((issue: Insight) => (
    <div key={issue.id} className="...">
      <p>{language === 'ar' ? issue.label_ar : issue.label_en}</p>
      <span>{issue.count}</span>
      {/* أزرار الحل والحذف */}
    </div>
  ))
)}
```

---

## الخطوة 4: دوال الإجراءات (Resolve & Delete)

```typescript
// تحديث دالة resolveIssue لاستخدام Supabase
const resolveIssue = async (category: string, insightId: string) => {
  const insight = insights[category].find((i: Insight) => i.id === insightId);
  if (!insight) return;

  const result = await supabase.updateInsight(insightId, {
    resolved: !insight.resolved
  });

  if (result.success) {
    // تحديث الـ state المحلي
    setInsights(prev => ({
      ...prev,
      [category]: prev[category].map((i: Insight) =>
        i.id === insightId ? { ...i, resolved: !i.resolved } : i
      )
    }));
    showToast(
      t('Issue updated', 'تم تحديث المشكلة'),
      'success'
    );
  } else {
    showToast(
      t('Failed to update issue', 'فشل تحديث المشكلة'),
      'error'
    );
  }
};

// تحديث دالة deleteIssue لاستخدام Supabase
const deleteIssue = async (category: string, insightId: string) => {
  const result = await supabase.deleteInsight(insightId);

  if (result.success) {
    // تحديث الـ state المحلي
    setInsights(prev => ({
      ...prev,
      [category]: prev[category].filter((i: Insight) => i.id !== insightId)
    }));
    showToast(
      t('Issue deleted', 'تم حذف المشكلة'),
      'success'
    );
  } else {
    showToast(
      t('Failed to delete issue', 'فشل حذف المشكلة'),
      'error'
    );
  }
};
```

---

## الخطوة 5: تحميل AI Message Feedback

```typescript
const [feedbackMessages, setFeedbackMessages] = useState([]);

useEffect(() => {
  async function loadFeedbackMessages() {
    // الحصول على آخر 50 محادثة
    const convResult = await supabase.getConversations(storeId, 1, 50);
    
    if (!convResult.data.length) return;

    // الحصول على الرسائل مع feedback
    const allMessages = [];
    for (const conv of convResult.data) {
      const msgResult = await supabase.getConversationWithMessages(conv.id);
      if (msgResult.success && msgResult.data) {
        const feedbackMsgs = msgResult.data.messages.filter(
          m => m.sender === 'ai' && m.feedback
        );
        allMessages.push(...feedbackMsgs);
      }
    }

    setFeedbackMessages(allMessages.slice(0, 10)); // أول 10
  }

  loadFeedbackMessages();
}, [storeId]);

// في الـ JSX
{feedbackMessages.map((msg: Message) => {
  const isPositive = msg.feedback === 'positive';
  return (
    <div key={msg.id} className="...">
      {/* عرض الرسالة */}
      <p>{msg.content}</p>
      {/* عرض الأيقونة */}
      {isPositive ? <ThumbsUp /> : <ThumbsDown />}
    </div>
  );
})}
```

---

## الخطوة 6: حساب النسبة المئوية للتغيير (Optional)

لحساب الـ change percentage (مثل +12.5%)، نحتاج لمقارنة بيانات اليوم مع الأمس:

```typescript
const [yesterdayAnalytics, setYesterdayAnalytics] = useState<Analytics | null>(null);

useEffect(() => {
  async function loadComparison() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const yesterdayDate = yesterday.toISOString().split('T')[0];
    
    const result = await supabase.getAnalyticsRange(
      storeId,
      yesterdayDate,
      yesterdayDate
    );
    
    if (result.success && result.data?.length) {
      setYesterdayAnalytics(result.data[0]);
    }
  }
  
  loadComparison();
}, [storeId]);

// دالة حساب النسبة
function calculateChange(today: number, yesterday: number): { change: string; up: boolean } {
  if (!yesterday) return { change: 'N/A', up: true };
  
  const diff = today - yesterday;
  const percentage = ((diff / yesterday) * 100).toFixed(1);
  
  return {
    change: `${diff > 0 ? '+' : ''}${percentage}%`,
    up: diff > 0
  };
}

// استخدام
const conversationsChange = calculateChange(
  analytics.total_conversations,
  yesterdayAnalytics?.total_conversations || 0
);
```

---

## الخطوة 7: تحديث بيانات التقييم (Rating)

```typescript
useEffect(() => {
  async function loadRatings() {
    const result = await supabase.getRatings(storeId, 1, 1000); // جميع التقييمات
    
    if (result.success && result.data.length) {
      const total = result.data.length;
      const sum = result.data.reduce((acc, r) => acc + r.rating, 0);
      const avg = sum / total;
      
      setRatingData({
        average: avg,
        total: total
      });
    }
  }
  
  loadRatings();
}, [storeId]);

// في الـ JSX
<AnimatedValue value={ratingData.average.toFixed(1)} />
<p>{t('Based on', 'بناءً على')} {ratingData.total} {t('ratings', 'تقييم')}</p>
```

---

## الخطوة 8: تحديث البيانات تلقائياً

لتحديث البيانات كل 30 ثانية:

```typescript
useEffect(() => {
  // تحميل أول مرة
  loadDashboardData();
  
  // تحديث كل 30 ثانية
  const interval = setInterval(() => {
    loadDashboardData();
  }, 30000);
  
  // تنظيف
  return () => clearInterval(interval);
}, [storeId]);
```

---

## الخطوة 9: إضافة Refresh Button (اختياري)

```typescript
const [refreshing, setRefreshing] = useState(false);

async function handleRefresh() {
  setRefreshing(true);
  await loadDashboardData();
  setRefreshing(false);
  showToast(t('Dashboard refreshed', 'تم تحديث لوحة التحكم'), 'success');
}

// في الـ JSX
<button onClick={handleRefresh} disabled={refreshing}>
  <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
  {t('Refresh', 'تحديث')}
</button>
```

---

## ملاحظات مهمة

### 🔄 التحديثات في الوقت الفعلي
لإضافة real-time updates، استخدم Supabase Realtime:

```typescript
useEffect(() => {
  const subscription = supabase
    .channel('analytics_changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'analytics',
      filter: `store_id=eq.${storeId}`
    }, (payload) => {
      console.log('Analytics updated:', payload);
      loadDashboardData();
    })
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, [storeId]);
```

### ⚡ تحسين الأداء
- استخدم `useMemo` للبيانات المحسوبة
- استخدم `React.memo` للمكونات الثقيلة
- حمّل البيانات بشكل lazy عند الحاجة

### 🐛 معالجة الأخطاء
- دائماً تحقق من `result.success`
- اعرض رسائل خطأ واضحة للمستخدم
- سجّل الأخطاء في console للتطوير

---

## الخلاصة

الآن لديك:
✅ قاعدة بيانات كاملة في Supabase
✅ TypeScript types جاهزة
✅ Service layer بسيط وقوي
✅ أمثلة عملية للدمج في Dashboard

**الخطوة التالية:** ابدأ بتطبيق هذه الأمثلة خطوة بخطوة في `DashboardPage.tsx`!
