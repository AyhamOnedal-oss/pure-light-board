import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { AnimatedValue } from './AnimatedNumber';
import {
  MessageSquare, CheckCircle, Ticket, FileText, MousePointerClick,
  Star, AlertCircle, HelpCircle, Lightbulb, TrendingUp, X,
  Check, Trash2, CircleHelp, Clock, ThumbsUp, ThumbsDown
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  TooltipProps
} from 'recharts';
import { RecentActivityTable } from './dashboard/RecentActivityTable';

interface InsightIssue {
  id: string;
  labelEn: string;
  labelAr: string;
  count: number;
  resolved: boolean;
}

const insightIssues: Record<string, InsightIssue[]> = {
  complaints: [
    { id: 'c1', labelEn: 'Delivery delay', labelAr: 'تأخر التوصيل', count: 47, resolved: false },
    { id: 'c2', labelEn: 'Cash on delivery not available', labelAr: 'الدفع عند الاستلام غير متاح', count: 38, resolved: false },
    { id: 'c3', labelEn: 'Product arrived damaged', labelAr: 'المنتج وصل تالف', count: 29, resolved: false },
    { id: 'c4', labelEn: 'Wrong item received', labelAr: 'تم استلام منتج خاطئ', count: 22, resolved: false },
    { id: 'c5', labelEn: 'No response from support', labelAr: 'لا رد من الدعم', count: 18, resolved: false },
    { id: 'c6', labelEn: 'Quality lower than expected', labelAr: 'الجودة أقل من المتوقع', count: 14, resolved: false },
    { id: 'c7', labelEn: 'Incomplete order received', labelAr: 'طلب ناقص تم استلامه', count: 11, resolved: false },
  ],
  requests: [
    { id: 'r1', labelEn: 'Track order status', labelAr: 'تتبع حالة الطلب', count: 63, resolved: false },
    { id: 'r2', labelEn: 'Change delivery address', labelAr: 'تغيير عنوان التوصيل', count: 41, resolved: false },
    { id: 'r3', labelEn: 'Process refund', labelAr: 'معالجة استرجاع', count: 35, resolved: false },
    { id: 'r4', labelEn: 'Exchange for different size', labelAr: 'استبدال بمقاس مختلف', count: 28, resolved: false },
    { id: 'r5', labelEn: 'Cancel order before shipping', labelAr: 'إلغاء الطلب قبل الشحن', count: 21, resolved: false },
    { id: 'r6', labelEn: 'Update payment method', labelAr: 'تحديث طريقة الدفع', count: 16, resolved: false },
  ],
  inquiries: [
    { id: 'i1', labelEn: 'Return policy details', labelAr: 'تفاصيل سياسة الإرجاع', count: 54, resolved: false },
    { id: 'i2', labelEn: 'International shipping fees', labelAr: 'رسوم الشحن الدولي', count: 42, resolved: false },
    { id: 'i3', labelEn: 'Product restock date', labelAr: 'تاريخ إعادة توفر المنتج', count: 33, resolved: false },
    { id: 'i4', labelEn: 'Accepted payment methods', labelAr: 'طرق الدفع المقبولة', count: 27, resolved: false },
    { id: 'i5', labelEn: 'Standard shipping duration', labelAr: 'مدة الشحن العادي', count: 19, resolved: false },
    { id: 'i6', labelEn: 'Warranty coverage', labelAr: 'تغطية الضمان', count: 12, resolved: false },
  ],
  suggestions: [
    { id: 's1', labelEn: 'Add live chat support', labelAr: 'إضافة دعم محادثة مباشرة', count: 31, resolved: false },
    { id: 's2', labelEn: 'Add wishlist feature', labelAr: 'إضافة ميزة المفضلة', count: 24, resolved: false },
    { id: 's3', labelEn: 'More payment options (Apple Pay)', labelAr: 'خيارات دفع أكثر (Apple Pay)', count: 19, resolved: false },
    { id: 's4', labelEn: 'Mobile app', labelAr: 'تطبيق جوال', count: 15, resolved: false },
    { id: 's5', labelEn: 'Loyalty rewards program', labelAr: 'برنامج مكافآت الولاء', count: 11, resolved: false },
  ],
  unknown: [
    { id: 'u1', labelEn: 'asdhjk whats the thing?', labelAr: 'asdhjk ما الشيء؟', count: 8, resolved: false },
    { id: 'u2', labelEn: 'can you do that thing from before', labelAr: 'هل يمكنك فعل ذلك الشيء من قبل', count: 6, resolved: false },
    { id: 'u3', labelEn: 'blah blah something about order', labelAr: 'بلا بلا شيء عن الطلب', count: 5, resolved: false },
    { id: 'u4', labelEn: 'hello??!!! I need xyz', labelAr: 'مرحبا??!!! أحتاج xyz', count: 4, resolved: false },
    { id: 'u5', labelEn: 'where is the other page', labelAr: 'أين الصفحة الأخرى', count: 3, resolved: false },
    { id: 'u6', labelEn: 'fjdksl;a random message', labelAr: 'fjdksl;a رسالة عشوائية', count: 2, resolved: false },
  ],
};

// Custom tooltip for charts — all white text in dark mode, clean layout
function ChartTooltip({ active, payload, isDark }: TooltipProps<number, string> & { isDark: boolean }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div style={{
      backgroundColor: isDark ? '#1e2740' : '#ffffff',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      borderRadius: '10px',
      padding: '8px 12px',
      color: isDark ? '#ffffff' : '#1a1a2e',
      fontSize: '13px',
      fontWeight: 600,
    }}>
      <span style={{ color: item.payload?.fill || item.payload?.color || '#fff' }}>{item.name}</span>
      <span style={{ marginInlineStart: 8 }}>{item.value}</span>
    </div>
  );
}

export function DashboardPage() {
  const { t, theme, language, showToast } = useApp();
  const [openInsight, setOpenInsight] = useState<string | null>(null);
  const [issues, setIssues] = useState(insightIssues);
  const [feedbackConvo, setFeedbackConvo] = useState<any | null>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (openInsight || feedbackConvo) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [openInsight, feedbackConvo]);

  const kpis = [
    { icon: MessageSquare, label: t('Conversations', 'المحادثات'), value: '2,847', change: '+12.5%', up: true, color: '#043CC8' },
    { icon: CheckCircle, label: t('Completion Rate', 'نسبة الإكمال'), value: '94.2%', change: '+3.1%', up: true, color: '#10b981' },
    { icon: Ticket, label: t('Tickets', 'التذاكر'), value: '156', change: '-5.2%', up: false, color: '#f59e0b' },
    { icon: FileText, label: t('Words Consumed', 'الكلمات المستهلكة'), value: '1.2M', change: '+18.7%', up: true, color: '#8b5cf6' },
    { icon: MousePointerClick, label: t('Bubble Clicks', 'نقرات الفقاعة'), value: '8,432', change: '+22.3%', up: true, color: '#00C9BD' },
    { icon: Clock, label: t('Avg Response Time', 'متوسط وقت الاستجابة'), value: '2.5s', change: '-15.4%', up: true, color: '#ec4899' },
  ];

  const classificationData = [
    { name: t('Complaint', 'شكوى'), value: 320, color: '#ff4466' },
    { name: t('Inquiry', 'استفسار'), value: 580, color: '#043CC8' },
    { name: t('Request', 'طلب'), value: 420, color: '#f59e0b' },
    { name: t('Suggestion', 'اقتراح'), value: 180, color: '#10b981' },
  ];

  const ticketStatusData = [
    { name: t('Total', 'الإجمالي'), value: 156, fill: '#043CC8' },
    { name: t('Open', 'مفتوحة'), value: 42, fill: '#ff4466' },
    { name: t('Closed', 'مغلقة'), value: 114, fill: '#10b981' },
  ];

  const insights = [
    { key: 'complaints', icon: AlertCircle, label: t('Complaints', 'الشكاوى'), count: '320', clickLabel: t('Click to view complaints', 'اضغط لعرض الشكاوى'), color: '#ff4466' },
    { key: 'requests', icon: TrendingUp, label: t('Requests', 'الطلبات'), count: '420', clickLabel: t('Click to view requests', 'اضغط لعرض الطلبات'), color: '#f59e0b' },
    { key: 'inquiries', icon: HelpCircle, label: t('Inquiries', 'الاستفسارات'), count: '580', clickLabel: t('Click to view inquiries', 'اضغط لعرض الاستفسارات'), color: '#043CC8' },
    { key: 'suggestions', icon: Lightbulb, label: t('Suggestions', 'الاقتراحات'), count: '180', clickLabel: t('Click to view suggestions', 'اضغط لعرض الاقتراحات'), color: '#10b981' },
    { key: 'unknown', icon: CircleHelp, label: t('Unknown Questions', 'أسئلة غير معروفة'), count: '28', clickLabel: t('Click to view unknown questions', 'اضغط لعرض الأسئلة غير المعروفة'), color: '#8b5cf6' },
  ];

  const resolveIssue = (category: string, id: string) => {
    setIssues(prev => ({
      ...prev,
      [category]: prev[category].map(item =>
        item.id === id ? { ...item, resolved: !item.resolved } : item
      ),
    }));
  };

  const deleteIssue = (category: string, id: string) => {
    setIssues(prev => ({
      ...prev,
      [category]: prev[category].filter(item => item.id !== id),
    }));
    showToast(t('Issue deleted', 'تم حذف المشكلة'));
  };

  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? '#1e2740' : '#ffffff',
    border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: '12px',
    color: theme === 'dark' ? '#ffffff' : '#1a1a2e',
    fontSize: '13px',
  };

  const currentInsight = openInsight ? insights.find(i => i.key === openInsight) : null;

  // Tick text color for dark mode — must be white-ish
  const tickColor = theme === 'dark' ? '#c5ccdf' : '#6B7294';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[24px]" style={{ fontWeight: 700 }}>{t('Dashboard', 'لوحة التحكم')}</h1>
        <p className="text-muted-foreground text-[14px] mt-1">{t('Overview of your AI customer service performance', 'نظرة عامة على أداء خدمة العملاء بالذكاء الاصطناعي')}</p>
      </div>

      {/* KPIs — compact */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
        {kpis.map((kpi, idx) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: idx * 0.07 }}
            className="relative overflow-hidden bg-card rounded-2xl p-4 border border-border shadow-sm hover:border-border/80 transition-colors group"
          >
            <div
              aria-hidden
              className="absolute top-0 end-0 w-28 h-28 rounded-full pointer-events-none"
              style={{
                backgroundColor: kpi.color,
                opacity: theme === 'dark' ? 0.18 : 0.12,
                transform: 'translate(30%, -30%)',
              }}
            />
            <div className="relative flex items-start justify-start mb-3">
              <kpi.icon className="w-[18px] h-[18px]" style={{ color: kpi.color }} />
            </div>
            <p className="relative text-[12px] text-muted-foreground mb-1 text-start">{kpi.label}</p>
            <div className="relative flex items-center justify-between">
              <AnimatedValue
                value={kpi.value}
                duration={2000}
                delay={idx * 100}
                className="text-[22px] text-foreground"
                style={{ fontWeight: 700 }}
              />
              <span className={`text-[11px] flex items-center gap-1 ${kpi.up ? 'text-green-500' : 'text-red-400'}`} style={{ fontWeight: 600 }}>
                {kpi.change}
                {kpi.up ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Classification Pie */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-card rounded-2xl p-5 border border-border shadow-sm"
        >
          <h3 className="text-[14px] mb-1" style={{ fontWeight: 600 }}>{t('Conversation Classification', 'تصنيف المحادثات')}</h3>
          <p className="text-[11px] text-muted-foreground mb-3">{t('Distribution by type', 'التوزيع حسب النوع')}</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={classificationData}
                cx="50%" cy="50%"
                innerRadius={50} outerRadius={78}
                dataKey="value" paddingAngle={4} strokeWidth={0}
                isAnimationActive animationBegin={500} animationDuration={1200} animationEasing="ease-out"
              >
                {classificationData.map((entry, i) => <Cell key={`cls-${i}`} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: tooltipStyle.color }} labelStyle={{ color: tooltipStyle.color }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2">
            {classificationData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
                <span className="text-[11px] text-foreground" style={{ fontWeight: 500 }}>{entry.name}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Ticket Status Bar — subtle hover, white text in dark */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="bg-card rounded-2xl p-5 border border-border shadow-sm"
        >
          <h3 className="text-[14px] mb-1" style={{ fontWeight: 600 }}>{t('Ticket Status', 'حالة التذاكر')}</h3>
          <p className="text-[11px] text-muted-foreground mb-3">{t('Total, Open & Closed tickets', 'التذاكر الإجمالية والمفتوحة والمغلقة')}</p>
          <div className="h-[200px] flex items-end justify-around gap-4 px-2 pb-6 pt-4 relative">
            {ticketStatusData.map((d) => {
              const max = Math.max(...ticketStatusData.map(x => x.value));
              const pct = (d.value / max) * 100;
              return (
                <div key={d.name} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-[13px]" style={{ fontWeight: 700, color: tickColor }}>{d.value}</span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${pct}%` }}
                    transition={{ duration: 1.2, delay: 0.6, ease: 'easeOut' }}
                    className="w-full rounded-t-lg"
                    style={{ backgroundColor: d.fill, maxWidth: 64 }}
                  />
                  <span className="text-[12px]" style={{ color: tickColor }}>{d.name}</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Rating */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="bg-card rounded-2xl p-5 border border-border shadow-sm flex flex-col"
        >
          <h3 className="text-[14px] mb-1" style={{ fontWeight: 600 }}>{t('Customer Rating', 'تقييم العملاء')}</h3>
          <p className="text-[11px] text-muted-foreground mb-3">{t('Average customer satisfaction', 'متوسط رضا العملاء')}</p>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="flex items-center gap-1.5 mb-3">
              {[1, 2, 3, 4, 5].map(s => (
                <motion.div
                  key={s}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.6 + s * 0.1 }}
                >
                  <Star className={`w-7 h-7 ${s <= 4 ? 'fill-yellow-400 text-yellow-400' : 'fill-yellow-400/40 text-yellow-400/40'}`} />
                </motion.div>
              ))}
            </div>
            <AnimatedValue value="4.8" duration={2000} delay={800} className="text-[38px] block text-foreground" style={{ fontWeight: 800 }} />
            <p className="text-muted-foreground text-[13px]" style={{ fontWeight: 500 }}>{t('out of 5.0', 'من 5.0')}</p>
            <p className="text-muted-foreground/60 text-[11px] mt-1.5">{t('Based on 1,247 ratings', 'بناءً على 1,247 تقييم')}</p>
          </div>
        </motion.div>

        {/* AI Feedback Chart — positive vs negative donut */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="bg-card rounded-2xl p-5 border border-border shadow-sm"
        >
          <h3 className="text-[14px] mb-1" style={{ fontWeight: 600 }}>{t('AI Feedback', 'تقييم الذكاء الاصطناعي')}</h3>
          <p className="text-[11px] text-muted-foreground mb-3">{t('Positive vs negative responses', 'الردود الإيجابية مقابل السلبية')}</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={[
                  { name: t('Positive', 'إيجابي'), value: 847, color: '#10b981' },
                  { name: t('Negative', 'سلبي'), value: 53, color: '#ff4466' },
                ]}
                cx="50%" cy="50%"
                innerRadius={50} outerRadius={78}
                dataKey="value" paddingAngle={4} strokeWidth={0}
                isAnimationActive animationBegin={600} animationDuration={1200} animationEasing="ease-out"
              >
                <Cell key="fb-positive" fill="#10b981" />
                <Cell key="fb-negative" fill="#ff4466" />
              </Pie>
              <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: tooltipStyle.color }} labelStyle={{ color: tooltipStyle.color }} />
            </PieChart>
          </ResponsiveContainer>
          {/* Custom legend with thumbs icons */}
          <div className="flex items-center justify-center gap-5 mt-1">
            <div className="flex items-center gap-1.5">
              <ThumbsUp className="w-3.5 h-3.5 text-green-500" />
              <span className="text-[11px] text-foreground" style={{ fontWeight: 500 }}>{t('Positive', 'إيجابي')} ({((847 / 900) * 100).toFixed(1)}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ThumbsDown className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[11px] text-foreground" style={{ fontWeight: 500 }}>{t('Negative', 'سلبي')} ({((53 / 900) * 100).toFixed(1)}%)</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* AI Insights — compact cards */}
      <div>
        <h3 className="text-[15px] mb-3" style={{ fontWeight: 600 }}>{t('AI-Driven Insights', 'رؤى الذكاء الاصطناعي')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          {insights.map((ins, idx) => (
            <motion.button
              key={ins.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.7 + idx * 0.06 }}
              onClick={() => setOpenInsight(ins.key)}
              className="relative overflow-hidden bg-card rounded-2xl p-4 border border-border shadow-sm hover:border-[#043CC8]/20 transition-colors group text-start w-full cursor-pointer"
            >
              <div
                aria-hidden
                className="absolute top-0 end-0 w-28 h-28 rounded-full pointer-events-none transition-transform group-hover:scale-110"
                style={{
                  backgroundColor: ins.color,
                  opacity: theme === 'dark' ? 0.18 : 0.12,
                  transform: 'translate(30%, -30%)',
                }}
              />
              <div className="relative flex items-start justify-start mb-2.5">
                <ins.icon className="w-[18px] h-[18px]" style={{ color: ins.color }} />
              </div>
              <p className="relative text-[13px] text-start" style={{ fontWeight: 600 }}>{ins.label}</p>
              <div className="relative flex items-center justify-between mt-1.5">
                <AnimatedValue
                  value={ins.count}
                  duration={2000}
                  delay={800 + idx * 100}
                  className="text-[20px]"
                  style={{ fontWeight: 700, color: ins.color }}
                />
                <p className="text-[11px] text-[#043CC8]" style={{ fontWeight: 600 }}>
                  {ins.clickLabel} →
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Insight Modal — no back arrow, scroll lock, fast render, long text support */}
      <AnimatePresence>
        {openInsight && currentInsight && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setOpenInsight(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.18 }}
              className="bg-card rounded-2xl w-full max-w-lg border border-border shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header — only X close button, no back arrow */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/20 shrink-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: currentInsight.color + '12' }}>
                  <currentInsight.icon className="w-4 h-4" style={{ color: currentInsight.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[16px] truncate" style={{ fontWeight: 600 }}>{currentInsight.label}</h3>
                  <p className="text-[11px] text-muted-foreground">{t('AI-classified issue types, sorted by frequency', 'أنواع المشكلات المصنفة بالذكاء الاصطناعي')}</p>
                </div>
                <button onClick={() => setOpenInsight(null)} className="p-1.5 hover:bg-muted rounded-lg transition-colors shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Issue List — supports long text, scrollable */}
              <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(5 * 52px)' }}>
                {issues[openInsight]?.length === 0 ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground text-[14px]">
                    {t('No issues in this category', 'لا توجد مشكلات في هذه الفئة')}
                  </div>
                ) : (
                  issues[openInsight]?.map((issue) => (
                    <div
                      key={issue.id}
                      className={`flex items-start gap-3 px-5 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${issue.resolved ? 'opacity-50' : ''}`}
                    >
                      {/* Issue text — multi-line support */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className={`text-[13px] break-words ${issue.resolved ? 'line-through text-muted-foreground' : 'text-foreground'}`} style={{ fontWeight: 500 }}>
                          {language === 'ar' ? issue.labelAr : issue.labelEn}
                        </p>
                      </div>

                      {/* Count badge */}
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted shrink-0 mt-0.5" style={{ fontWeight: 600, color: currentInsight.color }}>
                        {issue.count}
                      </span>

                      {/* Resolve */}
                      <button
                        onClick={() => resolveIssue(openInsight, issue.id)}
                        className={`p-1.5 rounded-lg transition-all shrink-0 ${
                          issue.resolved
                            ? 'bg-green-500/15 text-green-500'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                        title={issue.resolved ? t('Unresolve', 'إلغاء الحل') : t('Resolve', 'حل')}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => deleteIssue(openInsight, issue.id)}
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all shrink-0"
                        title={t('Delete', 'حذف')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Message Feedback — customer thumbs up/down data */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.9 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px]" style={{ fontWeight: 600 }}>{t('AI Message Feedback', 'تقييم رسائل الذكاء الاصطناعي')}</h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <ThumbsUp className="w-4 h-4 text-green-500" />
              <span className="text-[13px] text-green-500" style={{ fontWeight: 600 }}>847</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ThumbsDown className="w-4 h-4 text-red-400" />
              <span className="text-[13px] text-red-400" style={{ fontWeight: 600 }}>53</span>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(5 * 88px)' }}>
            {[
              { id: 'fb1', msgEn: 'Your order #45231 has been shipped via Aramex and is expected to arrive within 2-3 business days. Here is your tracking link.', msgAr: 'تم شحن طلبك رقم #45231 عبر أرامكس ومن المتوقع وصوله خلال 2-3 أيام عمل. إليك رابط التتبع.', result: 'positive' as const, analysisEn: 'Accurate shipping info with tracking link provided.', analysisAr: 'معلومات شحن دقيقة مع رابط تتبع.',
                convoEn: [
                  { from: 'customer', text: 'Where is my order #45231?' },
                  { from: 'ai', text: 'Your order #45231 has been shipped via Aramex and is expected to arrive within 2-3 business days. Here is your tracking link.' },
                  { from: 'customer', text: 'Thank you so much!' },
                ],
                convoAr: [
                  { from: 'customer', text: 'وين طلبي رقم #45231؟' },
                  { from: 'ai', text: 'تم شحن طلبك رقم #45231 عبر أرامكس ومن المتوقع وصوله خلال 2-3 أيام عمل. إليك رابط التتبع.' },
                  { from: 'customer', text: 'شكراً جزيلاً!' },
                ],
              },
              { id: 'fb2', msgEn: 'I understand your concern about the delayed delivery. I have escalated this to our logistics team and you will receive an update within 24 hours.', msgAr: 'أتفهم قلقك بشأن التأخر في التوصيل. لقد رفعت هذا الأمر لفريق الخدمات اللوجستية وستتلقى تحديثاً خلال 24 ساعة.', result: 'positive' as const, analysisEn: 'Empathetic response with clear escalation and timeline.', analysisAr: 'رد متعاطف مع تصعيد واضح وجدول زمني.',
                convoEn: [
                  { from: 'customer', text: 'My delivery is 5 days late! This is unacceptable.' },
                  { from: 'ai', text: 'I understand your concern about the delayed delivery. I have escalated this to our logistics team and you will receive an update within 24 hours.' },
                  { from: 'customer', text: 'Okay, please make it fast.' },
                ],
                convoAr: [
                  { from: 'customer', text: 'طلبي متأخر 5 أيام! هذا غير مقبول.' },
                  { from: 'ai', text: 'أتفهم قلقك بشأن التأخر في التوصيل. لقد رفعت هذا الأمر لفريق الخدمات اللوجستية وستتلقى تحديثاً خلال 24 ساعة.' },
                  { from: 'customer', text: 'طيب، أرجو الإسراع.' },
                ],
              },
              { id: 'fb3', msgEn: 'Based on our return policy, you can return this item within 14 days of delivery. I can initiate the return process for you right now.', msgAr: 'بناءً على سياسة الإرجاع، يمكنك إرجاع هذا المنتج خلال 14 يوماً من التسليم. يمكنني بدء عملية الإرجاع لك الآن.', result: 'positive' as const, analysisEn: 'Clear policy explanation with proactive assistance.', analysisAr: 'شرح واضح للسياسة مع مساعدة استباقية.',
                convoEn: [
                  { from: 'customer', text: "I want to return the shoes I bought. They don't fit." },
                  { from: 'ai', text: 'Based on our return policy, you can return this item within 14 days of delivery. I can initiate the return process for you right now.' },
                  { from: 'customer', text: 'Yes please, go ahead.' },
                ],
                convoAr: [
                  { from: 'customer', text: 'أبي أرجع الحذاء اللي شريته. ما ناسبني.' },
                  { from: 'ai', text: 'بناءً على سياسة الإرجاع، يمكنك إرجاع هذا المنتج خلال 14 يوماً من التسليم. يمكنني بدء عملية الإرجاع لك الآن.' },
                  { from: 'customer', text: 'تمام، كمل.' },
                ],
              },
              { id: 'fb4', msgEn: 'Your refund of 350 SAR has been processed successfully. It will reflect in your account within 5-7 business days.', msgAr: 'تم معالجة استرجاعك البالغ 350 ريال بنجاح. سينعكس في حسابك خلال 5-7 أيام عمل.', result: 'positive' as const, analysisEn: 'Confirmed refund with expected timeline.', analysisAr: 'تأكيد الاسترجاع مع الجدول الزمني المتوقع.',
                convoEn: [
                  { from: 'customer', text: 'When will I receive my refund?' },
                  { from: 'ai', text: 'Your refund of 350 SAR has been processed successfully. It will reflect in your account within 5-7 business days.' },
                  { from: 'customer', text: 'Perfect, thanks!' },
                ],
                convoAr: [
                  { from: 'customer', text: 'متى يوصلني الاسترجاع؟' },
                  { from: 'ai', text: 'تم معالجة استرجاعك البالغ 350 ريال بنجاح. سينعكس في حسابك خلال 5-7 أيام عمل.' },
                  { from: 'customer', text: 'ممتاز، شكراً!' },
                ],
              },
              { id: 'fb5', msgEn: 'We currently accept Visa, Mastercard, Mada, Apple Pay, and cash on delivery for orders within Riyadh. Would you like help placing an order?', msgAr: 'نقبل حالياً فيزا وماستركارد ومدى وApple Pay والدفع عند الاستلام للطلبات داخل الرياض. هل تريد المساعدة في تقديم طلب؟', result: 'positive' as const, analysisEn: 'Comprehensive payment info with helpful follow-up.', analysisAr: 'معلومات دفع شاملة مع متابعة مفيدة.',
                convoEn: [
                  { from: 'customer', text: 'What payment methods do you accept?' },
                  { from: 'ai', text: 'We currently accept Visa, Mastercard, Mada, Apple Pay, and cash on delivery for orders within Riyadh. Would you like help placing an order?' },
                  { from: 'customer', text: 'Do you support STC Pay?' },
                  { from: 'ai', text: 'Unfortunately STC Pay is not available at the moment, but we are working on adding it soon.' },
                ],
                convoAr: [
                  { from: 'customer', text: 'ايش طرق الدفع عندكم؟' },
                  { from: 'ai', text: 'نقبل حالياً فيزا وماستركارد ومدى وApple Pay والدفع عند الاستلام للطلبات داخل الرياض. هل تريد المساعدة في تقديم طلب؟' },
                  { from: 'customer', text: 'عندكم STC Pay؟' },
                  { from: 'ai', text: 'للأسف STC Pay غير متاح حالياً، لكن نعمل على إضافته قريباً.' },
                ],
              },
              { id: 'fb6', msgEn: "I apologize but I'm unable to process warranty claims directly. Let me connect you with our specialized warranty team for faster resolution.", msgAr: 'أعتذر ولكن لا أستطيع معالجة مطالبات الضمان مباشرة. دعني أوصلك بفريق الضمان المتخصص لحل أسرع.', result: 'negative' as const, analysisEn: 'Failed to resolve directly — customer expressed frustration.', analysisAr: 'فشل في الحل المباشر — العميل أبدى إحباطه.',
                convoEn: [
                  { from: 'customer', text: 'My phone screen cracked after 2 weeks. I need warranty.' },
                  { from: 'ai', text: "I apologize but I'm unable to process warranty claims directly. Let me connect you with our specialized warranty team for faster resolution." },
                  { from: 'customer', text: "This is frustrating. Why can't you help me directly?" },
                  { from: 'ai', text: 'I understand your frustration. Warranty claims require specialist verification. I have notified the team and they will contact you within 2 hours.' },
                ],
                convoAr: [
                  { from: 'customer', text: 'شاشة جوالي انكسرت بعد أسبوعين. أبي الضمان.' },
                  { from: 'ai', text: 'أعتذر ولكن لا أستطيع معالجة مطالبات الضمان مباشرة. دعني أوصلك بفريق الضمان المتخصص لحل أسرع.' },
                  { from: 'customer', text: 'هذا محبط. ليه ما تقدر تساعدني مباشرة؟' },
                  { from: 'ai', text: 'أتفهم إحباطك. مطالبات الضمان تحتاج تحقق متخصص. أبلغت الفريق وسيتواصلون معك خلال ساعتين.' },
                ],
              },
              { id: 'fb7', msgEn: "The product you're looking for is currently out of stock. Based on our records, it's expected to be restocked by April 20, 2026. I can notify you when it's available.", msgAr: 'المنتج الذي تبحث عنه غير متوفر حالياً. بناءً على سجلاتنا، من المتوقع إعادة توفيره بحلول 20 أبريل 2026. يمكنني إخطارك عند توفره.', result: 'positive' as const, analysisEn: 'Helpful stock update with notification offer.', analysisAr: 'تحديث مفيد للمخزون مع عرض الإشعار.',
                convoEn: [
                  { from: 'customer', text: 'Is the Nike Air Max available in size 42?' },
                  { from: 'ai', text: "The product you're looking for is currently out of stock. Based on our records, it's expected to be restocked by April 20, 2026. I can notify you when it's available." },
                  { from: 'customer', text: 'Yes, please notify me.' },
                  { from: 'ai', text: 'Done! You will receive a notification as soon as it is back in stock.' },
                ],
                convoAr: [
                  { from: 'customer', text: 'هل Nike Air Max متوفر بمقاس 42؟' },
                  { from: 'ai', text: 'المنتج الذي تبحث عنه غير متوفر حالياً. بناءً على سجلاتنا، من المتوقع إعادة توفيره بحلول 20 أبريل 2026. يمكنني إخطارك عند توفره.' },
                  { from: 'customer', text: 'تمام، نبهني لو رجع.' },
                  { from: 'ai', text: 'تم! ستصلك إشعار فور توفره مرة أخرى.' },
                ],
              },
            ].map((row) => {
              const isPositive = row.result === 'positive';
              return (
                <div
                  key={row.id}
                  className="px-5 py-3.5 border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer flex items-start gap-3.5"
                  onClick={() => setFeedbackConvo(row)}
                >
                  {/* Final feedback icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isPositive ? 'bg-green-500/12' : 'bg-red-500/12'}`}>
                    {isPositive ? (
                      <ThumbsUp className="w-4 h-4 text-green-500" />
                    ) : (
                      <ThumbsDown className="w-4 h-4 text-red-400" />
                    )}
                  </div>

                  {/* Analysis + Message */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-muted-foreground mb-1" style={{ fontWeight: 500 }}>
                      {language === 'ar' ? row.analysisAr : row.analysisEn}
                    </p>
                    <p className="text-[13px] text-foreground break-words line-clamp-5" style={{ fontWeight: 400 }}>
                      {language === 'ar' ? row.msgAr : row.msgEn}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Feedback Conversation Modal */}
      <AnimatePresence>
        {feedbackConvo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setFeedbackConvo(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.18 }}
              className="bg-card rounded-2xl w-full max-w-lg border border-border shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/20 shrink-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${feedbackConvo.result === 'positive' ? 'bg-green-500/12' : 'bg-red-500/12'}`}>
                  {feedbackConvo.result === 'positive' ? (
                    <ThumbsUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <ThumbsDown className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] truncate" style={{ fontWeight: 600 }}>{t('Conversation Details', 'تفاصيل المحادثة')}</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {feedbackConvo.result === 'positive' ? t('Positive feedback', 'تقييم إيجابي') : t('Negative feedback', 'تقييم سلبي')}
                  </p>
                </div>
                <button onClick={() => setFeedbackConvo(null)} className="p-1.5 hover:bg-muted rounded-lg transition-colors shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3" dir="ltr">
                {(language === 'ar' ? feedbackConvo.convoAr : feedbackConvo.convoEn)?.map((msg: any, i: number) => (
                  <div key={i} className={`flex ${msg.from === 'customer' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-[13px] ${
                        msg.from === 'customer'
                          ? 'bg-[#043CC8] text-white rounded-br-md'
                          : 'bg-muted text-foreground rounded-bl-md'
                      }`}
                      style={{ fontWeight: 400 }}
                    >
                      <p className="break-words">{msg.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Evaluated message highlight */}
              <div className="px-5 py-3 border-t border-border bg-muted/20 shrink-0">
                <p className="text-[11px] text-muted-foreground mb-1" style={{ fontWeight: 500 }}>{t('Evaluated AI Response', 'رد الذكاء الاصطناعي المُقيَّم')}</p>
                <p className="text-[12px] text-foreground break-words" style={{ fontWeight: 400 }}>
                  {language === 'ar' ? feedbackConvo.msgAr : feedbackConvo.msgEn}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <RecentActivityTable />
    </div>
  );
}