import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { AnimatedValue } from './AnimatedNumber';
import {
  MessageSquare, CheckCircle, Ticket, FileText, MousePointerClick,
  Star, AlertCircle, HelpCircle, Lightbulb, TrendingUp, TrendingDown, X,
  Check, Trash2, CircleHelp, Clock, ThumbsUp, ThumbsDown
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  TooltipProps
} from 'recharts';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import type { RecentAiFeedback } from '../services/metrics';
import { DateRangePicker, computeRange, type RangePreset } from './dashboard/DateRangePicker';
import type { DateRange } from '../services/metrics';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 10_000) return (n / 1_000).toFixed(0) + 'K';
  if (n >= 1_000) return n.toLocaleString();
  return String(n);
}

function formatSeconds(s: number): string {
  if (!s || s < 0) return '0s';
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s - m * 60);
  return `${m}m ${rem}s`;
}

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
  const [rangePreset, setRangePreset] = useState<RangePreset>('last30');
  const [range, setRange] = useState<DateRange>(() => computeRange('last30'));
  const { metrics, topSubjects, recentFeedback } = useDashboardMetrics(range);
  const feedback = metrics.feedback;
  const feedbackAnimationKey = 'feedback-live';
  const feedbackPieData = useMemo(
    () => [
      { name: t('Positive', 'إيجابي'), value: feedback.positive, color: '#10b981' },
      { name: t('Negative', 'سلبي'), value: feedback.negative, color: '#ff4466' },
    ],
    [feedback.positive, feedback.negative, language],
  );
  const [openInsight, setOpenInsight] = useState<string | null>(null);
  // Locally dismissed/resolved issue IDs per category (session only).
  const [dismissed, setDismissed] = useState<Record<string, Set<string>>>({});
  const [resolvedIds, setResolvedIds] = useState<Record<string, Set<string>>>({});
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

  // TODO: replace these mock day-over-day growth values with real
  // today-vs-yesterday deltas from `dashboard_usage_daily`.
  const kpis = [
    { icon: MessageSquare, label: t('Conversations', 'المحادثات'), value: formatNumber(metrics.conversations), color: '#043CC8', growth: 12.4 },
    { icon: CheckCircle, label: t('Completion Rate', 'نسبة الإكمال'), value: `${(metrics.completionRate * 100).toFixed(1)}%`, color: '#10b981', growth: 3.1 },
    { icon: Ticket, label: t('Tickets', 'التذاكر'), value: formatNumber(metrics.ticketsTotal), color: '#f59e0b', growth: -5.8 },
    { icon: FileText, label: t('Words Consumed', 'الكلمات المستهلكة'), value: formatNumber(metrics.wordsUsed), color: '#8b5cf6', growth: 22.7 },
    { icon: MousePointerClick, label: t('Bubble Clicks', 'نقرات الفقاعة'), value: formatNumber(metrics.widgetClicks), color: '#00C9BD', growth: 8.9 },
    { icon: Clock, label: t('Avg Response Time', 'متوسط وقت الاستجابة'), value: formatSeconds(metrics.avgResponseSeconds), color: '#ec4899', growth: -4.2 },
  ];

  const classificationLabels: Record<string, { en: string; ar: string; color: string }> = {
    complaint: { en: 'Complaint', ar: 'شكوى', color: '#ff4466' },
    inquiry: { en: 'Inquiry', ar: 'استفسار', color: '#043CC8' },
    request: { en: 'Request', ar: 'طلب', color: '#f59e0b' },
    suggestion: { en: 'Suggestion', ar: 'اقتراح', color: '#10b981' },
    shipping: { en: 'Shipping', ar: 'شحن', color: '#06b6d4' },
    refund: { en: 'Refund', ar: 'استرجاع', color: '#a855f7' },
    product: { en: 'Product', ar: 'منتج', color: '#14b8a6' },
    payment: { en: 'Payment', ar: 'دفع', color: '#eab308' },
    other: { en: 'Other', ar: 'أخرى', color: '#8b5cf6' },
  };
  const classificationData = Object.entries(metrics.classification)
    .map(([k, v]) => ({
      name: t(classificationLabels[k]?.en ?? k, classificationLabels[k]?.ar ?? k),
      value: v,
      color: classificationLabels[k]?.color ?? '#8b5cf6',
    }))
    .sort((a, b) => b.value - a.value);

  const ticketStatusData = [
    { name: t('Total', 'الإجمالي'), value: metrics.ticketsTotal, fill: '#043CC8' },
    { name: t('Open', 'مفتوحة'), value: metrics.ticketsOpen, fill: '#ff4466' },
    { name: t('Closed', 'مغلقة'), value: metrics.ticketsClosed, fill: '#10b981' },
  ];

  // Map insight keys to classification bucket keys used by the AI classifier.
  const insightBucket: Record<string, string> = {
    complaints: 'complaint',
    requests: 'request',
    inquiries: 'inquiry',
    suggestions: 'suggestion',
    unknown: 'other',
  };
  const insights = [
    { key: 'complaints', icon: AlertCircle, label: t('Complaints', 'الشكاوى'), count: formatNumber(metrics.classification.complaint ?? 0), clickLabel: t('Click to view complaints', 'اضغط لعرض الشكاوى'), color: '#ff4466' },
    { key: 'requests', icon: TrendingUp, label: t('Requests', 'الطلبات'), count: formatNumber(metrics.classification.request ?? 0), clickLabel: t('Click to view requests', 'اضغط لعرض الطلبات'), color: '#f59e0b' },
    { key: 'inquiries', icon: HelpCircle, label: t('Inquiries', 'الاستفسارات'), count: formatNumber(metrics.classification.inquiry ?? 0), clickLabel: t('Click to view inquiries', 'اضغط لعرض الاستفسارات'), color: '#043CC8' },
    { key: 'suggestions', icon: Lightbulb, label: t('Suggestions', 'الاقتراحات'), count: formatNumber(metrics.classification.suggestion ?? 0), clickLabel: t('Click to view suggestions', 'اضغط لعرض الاقتراحات'), color: '#10b981' },
    { key: 'unknown', icon: CircleHelp, label: t('Unknown Questions', 'أسئلة غير معروفة'), count: formatNumber(metrics.classification.other ?? 0), clickLabel: t('Click to view unknown questions', 'اضغط لعرض الأسئلة غير المعروفة'), color: '#8b5cf6' },
  ];

  const currentIssues = useMemo(() => {
    if (!openInsight) return [];
    const bucketKey = insightBucket[openInsight] ?? 'other';
    const items = topSubjects[bucketKey] ?? [];
    const dismissedSet = dismissed[openInsight] ?? new Set<string>();
    const resolvedSet = resolvedIds[openInsight] ?? new Set<string>();
    return items
      .filter(it => !dismissedSet.has(it.id))
      .map(it => ({ ...it, resolved: resolvedSet.has(it.id) }));
  }, [openInsight, topSubjects, dismissed, resolvedIds]);

  const resolveIssue = (category: string, id: string) => {
    setResolvedIds(prev => {
      const next = new Set(prev[category] ?? []);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, [category]: next };
    });
  };

  const deleteIssue = (category: string, id: string) => {
    setDismissed(prev => {
      const next = new Set(prev[category] ?? []);
      next.add(id);
      return { ...prev, [category]: next };
    });
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
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[24px]" style={{ fontWeight: 700 }}>{t('Dashboard', 'لوحة التحكم')}</h1>
          <p className="text-muted-foreground text-[14px] mt-1">{t('Overview of your AI customer service performance', 'نظرة عامة على أداء خدمة العملاء بالذكاء الاصطناعي')}</p>
        </div>
        <DateRangePicker
          preset={rangePreset}
          custom={range}
          onChange={(p, r) => { setRangePreset(p); setRange(r); }}
        />
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
              {(() => {
                const g = kpi.growth;
                if (g == null) {
                  return <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 600 }}>—</span>;
                }
                const up = g >= 0;
                const Icon = up ? TrendingUp : TrendingDown;
                const color = up ? 'text-green-500' : 'text-red-500';
                const sign = up ? '+' : '';
                return (
                  <span className={`text-[10px] flex items-center gap-0.5 ${color}`} style={{ fontWeight: 600 }}>
                    <Icon className="w-2.5 h-2.5" />
                    {sign}{g.toFixed(1)}%
                  </span>
                );
              })()}
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
          {metrics.csat.total === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-8">
              <div className="text-[32px] mb-2">⭐</div>
              <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                {t('No ratings yet', 'لا توجد تقييمات بعد')}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t('Ratings will appear once customers rate conversations', 'ستظهر التقييمات بمجرد تقييم العملاء للمحادثات')}
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="flex items-center gap-1.5 mb-3">
                {[1, 2, 3, 4, 5].map(s => {
                  const rounded = Math.round(metrics.csat.avg);
                  return (
                    <motion.div
                      key={s}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.6 + s * 0.1 }}
                    >
                      <Star className={`w-7 h-7 ${s <= rounded ? 'fill-yellow-400 text-yellow-400' : 'fill-yellow-400/40 text-yellow-400/40'}`} />
                    </motion.div>
                  );
                })}
              </div>
              <AnimatedValue value={metrics.csat.avg.toFixed(1)} duration={2000} delay={800} className="text-[38px] block text-foreground" style={{ fontWeight: 800 }} />
              <p className="text-muted-foreground text-[13px]" style={{ fontWeight: 500 }}>{t('out of 5.0', 'من 5.0')}</p>
              <p className="text-muted-foreground/60 text-[11px] mt-1.5">
                {language === 'ar'
                  ? `بناءً على ${metrics.csat.total.toLocaleString('ar-EG')} تقييم`
                  : `Based on ${metrics.csat.total.toLocaleString('en-US')} ratings`}
              </p>
            </div>
          )}
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
          {feedback.total === 0 ? (
            <div className="h-[200px] flex flex-col items-center justify-center text-center px-4">
              <div className="text-[32px] mb-2">💬</div>
              <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                {t('No feedback in this period', 'لا توجد تقييمات في هذه الفترة')}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t('Try widening the date range', 'جرّب توسيع نطاق التاريخ')}
              </p>
            </div>
          ) : (
          <motion.div
            key={feedbackAnimationKey}
            initial={{ opacity: 0.78, rotate: -360, scale: 0.94 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            transition={{ duration: 1.65, ease: [0.22, 1, 0.36, 1] }}
            className="h-[200px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={feedbackPieData}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={78}
                  dataKey="value" paddingAngle={4} strokeWidth={0}
                  isAnimationActive={false}
                >
                  <Cell key="fb-positive" fill="#10b981" />
                  <Cell key="fb-negative" fill="#ff4466" />
                </Pie>
                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: tooltipStyle.color }} labelStyle={{ color: tooltipStyle.color }} />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
          )}
          {/* Custom legend with thumbs icons */}
          <div className="flex items-center justify-center gap-5 mt-1">
            <div className="flex items-center gap-1.5">
              <ThumbsUp className="w-3.5 h-3.5 text-green-500" />
              <span className="text-[11px] text-foreground" style={{ fontWeight: 500 }}>{t('Positive', 'إيجابي')} {feedback.positive} ({feedback.total > 0 ? ((feedback.positive / feedback.total) * 100).toFixed(1) : '0.0'}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ThumbsDown className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[11px] text-foreground" style={{ fontWeight: 500 }}>{t('Negative', 'سلبي')} {feedback.negative} ({feedback.total > 0 ? ((feedback.negative / feedback.total) * 100).toFixed(1) : '0.0'}%)</span>
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
                <p className="text-[10px] text-[#043CC8]" style={{ fontWeight: 600 }}>
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
                {currentIssues.length === 0 ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground text-[14px]">
                    {t('No issues in this category', 'لا توجد مشكلات في هذه الفئة')}
                  </div>
                ) : (
                  currentIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className={`flex items-start gap-3 px-5 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${issue.resolved ? 'opacity-50' : ''}`}
                    >
                      {/* Issue text — multi-line support */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className={`text-[13px] break-words ${issue.resolved ? 'line-through text-muted-foreground' : 'text-foreground'}`} style={{ fontWeight: 500 }}>
                          {issue.subject}
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
              <span className="text-[13px] text-green-500" style={{ fontWeight: 600 }}>{feedback.positive}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ThumbsDown className="w-4 h-4 text-red-400" />
              <span className="text-[13px] text-red-400" style={{ fontWeight: 600 }}>{feedback.negative}</span>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(5 * 88px)' }}>
            {recentFeedback.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <div className="text-[32px] mb-2">💬</div>
                <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                  {t('No AI feedback yet', 'لا توجد تقييمات على رسائل الذكاء الاصطناعي بعد')}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {t('Customer thumbs up/down on AI replies will appear here', 'ستظهر هنا تقييمات العملاء على ردود الذكاء الاصطناعي')}
                </p>
              </div>
            ) : (
              recentFeedback.map((row) => {
                const isPositive = row.feedback === 'positive';
                return (
                  <div
                    key={row.id}
                    className="px-5 py-3.5 border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer flex items-start gap-3.5"
                    onClick={() => setFeedbackConvo(row)}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isPositive ? 'bg-green-500/12' : 'bg-red-500/12'}`}>
                      {isPositive ? (
                        <ThumbsUp className="w-4 h-4 text-green-500" />
                      ) : (
                        <ThumbsDown className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-muted-foreground mb-1" style={{ fontWeight: 500 }}>
                        {new Date(row.created_at).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </p>
                      <p className="text-[13px] text-foreground break-words line-clamp-5" style={{ fontWeight: 400 }}>
                        {row.body || t('(empty message)', '(رسالة فارغة)')}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
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
    </div>
  );
}