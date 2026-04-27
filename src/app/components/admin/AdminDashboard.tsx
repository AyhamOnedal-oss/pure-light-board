import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AnimatedValue } from '../AnimatedNumber';
import { motion } from 'motion/react';
import {
  Users, UserCheck, UserX, Trash2, MousePointerClick, Clock,
  Download, Calendar, ChevronDown, TrendingUp, TrendingDown
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, LabelList
} from 'recharts';

const dateFilters = [
  { key: 'current_month', en: 'Current Month', ar: 'الشهر الحالي' },
  { key: 'prev_month', en: 'Previous Month', ar: 'الشهر السابق' },
  { key: 'last_3', en: 'Last 3 Months', ar: 'آخر 3 أشهر' },
  { key: 'last_6', en: 'Last 6 Months', ar: 'آخر 6 أشهر' },
  { key: 'current_year', en: 'Current Year', ar: 'السنة الحالية' },
  { key: 'custom', en: 'Custom Range', ar: 'نطاق مخصص' },
];

// Global plan color system
const PLAN_COLORS = {
  economy: '#22c55e',
  basic: '#043CC8',
  professional: '#ff4466',
  business: '#f97316',
  trial: '#94a3b8',
};

function ChartTooltip({ active, payload, label, theme }: any) {
  if (!active || !payload?.length) return null;
  const isDark = theme === 'dark';
  return (
    <div style={{
      backgroundColor: isDark ? '#1e293b' : '#fff',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
      borderRadius: '10px', padding: '10px 14px', fontSize: '12px',
      color: isDark ? '#fff' : '#1a1a2e', boxShadow: 'none',
    }}>
      {label && <p style={{ fontWeight: 600, marginBottom: 4, color: isDark ? '#fff' : '#1a1a2e' }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.fill, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: isDark ? '#cbd5e1' : '#64748b' }}>{p.name}:</span>
          <span style={{ fontWeight: 600, color: isDark ? '#fff' : '#1a1a2e' }}>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function AdminDashboard() {
  const { t, theme, language } = useApp();
  const [dateFilter, setDateFilter] = useState('current_month');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const tickColor = theme === 'dark' ? '#94a3b8' : '#64748b';
  const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const kpis = [
    { icon: Users, label: t('Total Customers', 'إجمالي العملاء'), value: 1247, color: '#043CC8', change: 12.5, up: true },
    { icon: UserX, label: t('Inactive Customers', 'العملاء غير النشطين'), value: 355, color: '#ff4466', change: 3.2, up: true },
    { icon: Trash2, label: t('Total Uninstalls', 'إجمالي إلغاء التثبيت'), value: 89, color: '#f97316', change: 8.1, up: true },
    { icon: UserCheck, label: t('Active Customers', 'العملاء النشطون'), value: 892, color: '#22c55e', change: 15.3, up: true },
    { icon: MousePointerClick, label: t('Total Bubble Clicks', 'إجمالي نقرات الفقاعة'), value: 45230, color: '#a855f7', change: 22.7, up: true },
    { icon: Clock, label: t('Avg Response Time', 'متوسط وقت الاستجابة'), value: 1.2, suffix: 's', color: '#00C9BD', change: 5.4, up: false },
  ];

  // #1 Words Usage - FULL 12 months
  const wordsData = [
    { name: t('Jan', 'يناير'), words: 165000 },
    { name: t('Feb', 'فبراير'), words: 173000 },
    { name: t('Mar', 'مارس'), words: 190000 },
    { name: t('Apr', 'أبريل'), words: 197000 },
    { name: t('May', 'مايو'), words: 208000 },
    { name: t('Jun', 'يونيو'), words: 223000 },
    { name: t('Jul', 'يوليو'), words: 235000 },
    { name: t('Aug', 'أغسطس'), words: 220000 },
    { name: t('Sep', 'سبتمبر'), words: 252000 },
    { name: t('Oct', 'أكتوبر'), words: 271000 },
    { name: t('Nov', 'نوفمبر'), words: 287000 },
    { name: t('Dec', 'ديسمبر'), words: 308000 },
  ];

  const currentPlansData = [
    { name: t('Economy', 'اقتصادي'), value: 312, color: PLAN_COLORS.economy },
    { name: t('Basic', 'أساسي'), value: 285, color: PLAN_COLORS.basic },
    { name: t('Professional', 'احترافي'), value: 198, color: PLAN_COLORS.professional },
    { name: t('Business', 'أعمال'), value: 97, color: PLAN_COLORS.business },
  ];

  // #3 Platform subs - proper colors per status
  const platformSubsData = [
    { name: t('Active', 'نشط'), zid: 520, salla: 372 },
    { name: t('Inactive', 'غير نشط'), zid: 180, salla: 175 },
    { name: t('Cancelled', 'ملغي'), zid: 45, salla: 44 },
  ];

  const newSubscribers = [
    { name: t('Elegant Store', 'متجر أنيق'), platform: 'Zid', date: '2026-04-15', totalTokens: 50000, usedTokens: 12000, logo: 'ES' },
    { name: t('Fashion Hub', 'مركز الموضة'), platform: 'Salla', date: '2026-04-14', totalTokens: 100000, usedTokens: 5000, logo: 'FH' },
    { name: t('Tech Galaxy', 'مجرة التقنية'), platform: 'Zid', date: '2026-04-13', totalTokens: 50000, usedTokens: 31000, logo: 'TG' },
    { name: t('Home Decor', 'ديكور المنزل'), platform: 'Salla', date: '2026-04-12', totalTokens: 200000, usedTokens: 89000, logo: 'HD' },
    { name: t('Sweet Treats', 'حلويات لذيذة'), platform: 'Zid', date: '2026-04-11', totalTokens: 50000, usedTokens: 2000, logo: 'ST' },
    { name: t('Auto Parts', 'قطع غيار'), platform: 'Salla', date: '2026-04-10', totalTokens: 100000, usedTokens: 67000, logo: 'AP' },
    { name: t('Book World', 'عالم الكتب'), platform: 'Zid', date: '2026-04-09', totalTokens: 50000, usedTokens: 44000, logo: 'BW' },
  ];

  const serverUsage = [
    { name: 'Supabase', usage: 72, fill: '#22c55e' },
    { name: 'Hostinger', usage: 45, fill: '#043CC8' },
    { name: 'Resend', usage: 38, fill: '#a855f7' },
    { name: 'OpenAI', usage: 85, fill: '#ff4466' },
  ];

  const firstSubData = [
    { name: t('Trial', 'تجريبي'), value: 580, color: PLAN_COLORS.trial },
    { name: t('Economy', 'اقتصادي'), value: 210, color: PLAN_COLORS.economy },
    { name: t('Basic', 'أساسي'), value: 185, color: PLAN_COLORS.basic },
    { name: t('Professional', 'احترافي'), value: 165, color: PLAN_COLORS.professional },
    { name: t('Business', 'أعمال'), value: 107, color: PLAN_COLORS.business },
  ];

  const customerSourceData = [
    { name: t('Zid', 'زد'), value: 745, color: '#043CC8' },
    { name: t('Salla', 'سلة'), value: 502, color: '#22c55e' },
  ];

  const uninstallData = [
    { name: t('Zid', 'زد'), value: 42, fill: '#ff4466' },
    { name: t('Salla', 'سلة'), value: 47, fill: '#f97316' },
  ];

  const planColorArr = [PLAN_COLORS.economy, PLAN_COLORS.basic, PLAN_COLORS.professional, PLAN_COLORS.business];

  const zidPlanData = [
    { name: t('Economy', 'اقتصادي'), value: 185 },
    { name: t('Basic', 'أساسي'), value: 165 },
    { name: t('Professional', 'احترافي'), value: 112 },
    { name: t('Business', 'أعمال'), value: 58 },
  ];
  const sallaPlanData = [
    { name: t('Economy', 'اقتصادي'), value: 127 },
    { name: t('Basic', 'أساسي'), value: 120 },
    { name: t('Professional', 'احترافي'), value: 86 },
    { name: t('Business', 'أعمال'), value: 39 },
  ];

  const serverStatus = [
    { name: 'Supabase', status: 'connected' },
    { name: 'OpenAI', status: 'connected' },
    { name: 'Hostinger', status: 'connected' },
    { name: 'Resend', status: 'disconnected' },
  ];

  // #10 New Subscribers Over Time - 12 months
  const newSubsOverTime = [
    { name: t('Jan', 'يناير'), zid: 35, salla: 28 },
    { name: t('Feb', 'فبراير'), zid: 42, salla: 31 },
    { name: t('Mar', 'مارس'), zid: 38, salla: 35 },
    { name: t('Apr', 'أبريل'), zid: 50, salla: 40 },
    { name: t('May', 'مايو'), zid: 55, salla: 43 },
    { name: t('Jun', 'يونيو'), zid: 48, salla: 46 },
    { name: t('Jul', 'يوليو'), zid: 60, salla: 50 },
    { name: t('Aug', 'أغسطس'), zid: 52, salla: 47 },
    { name: t('Sep', 'سبتمبر'), zid: 65, salla: 55 },
    { name: t('Oct', 'أكتوبر'), zid: 70, salla: 58 },
    { name: t('Nov', 'نوفمبر'), zid: 68, salla: 62 },
    { name: t('Dec', 'ديسمبر'), zid: 75, salla: 65 },
  ];

  const cardClass = "bg-card rounded-2xl border border-border p-4";
  const textMuted = "text-muted-foreground";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px]" style={{ fontWeight: 700 }}>{t('Admin Dashboard', 'لوحة تحكم الأدمن')}</h1>
          <p className={`text-[13px] ${textMuted}`}>{t('Overview of all platform metrics', 'نظرة عامة على جميع مقاييس المنصة')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <button onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border hover:bg-muted transition-colors text-[13px]" style={{ fontWeight: 500 }}>
              <Calendar className="w-4 h-4" />
              {dateFilters.find(f => f.key === dateFilter)?.[language === 'ar' ? 'ar' : 'en']}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showDatePicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowDatePicker(false)} />
                <div className="absolute top-full mt-2 end-0 bg-card border border-border rounded-xl shadow-2xl z-50 py-1 min-w-[200px]">
                  {dateFilters.map(f => (
                    <button key={f.key} onClick={() => { setDateFilter(f.key); if (f.key !== 'custom') setShowDatePicker(false); }}
                      className={`w-full text-start px-4 py-2 hover:bg-muted text-[13px] transition-colors ${dateFilter === f.key ? 'text-[#043CC8]' : ''}`} style={{ fontWeight: dateFilter === f.key ? 600 : 400 }}>
                      {t(f.en, f.ar)}
                    </button>
                  ))}
                  {dateFilter === 'custom' && (
                    <div className="px-4 py-3 border-t border-border space-y-2">
                      <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full px-3 py-1.5 rounded-lg bg-input-background border border-border text-[12px] text-foreground outline-none" />
                      <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full px-3 py-1.5 rounded-lg bg-input-background border border-border text-[12px] text-foreground outline-none" />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#043CC8] text-white hover:bg-[#0330a0] transition-colors text-[13px]" style={{ fontWeight: 600 }}>
            <Download className="w-4 h-4" /> {t('Export Excel', 'تصدير Excel')}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div key={`kpi-${i}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className={`${cardClass} relative overflow-hidden`}>
            <div className="absolute top-0 end-0 w-20 h-20 rounded-full opacity-10" style={{ background: kpi.color, transform: 'translate(30%, -30%)' }} />
            <kpi.icon className="w-5 h-5 mb-3" style={{ color: kpi.color }} />
            <p className={`text-[11px] ${textMuted} mb-1`}>{kpi.label}</p>
            <div className="flex items-center justify-between">
              <p className="text-[22px]" style={{ fontWeight: 700 }}>
                <AnimatedValue value={kpi.value} />{kpi.suffix || ''}
              </p>
              <div className={`flex items-center gap-1 ${kpi.up ? 'text-green-500' : 'text-red-500'}`}>
                {kpi.up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span className="text-[11px]" style={{ fontWeight: 600 }}>{kpi.change}%</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* #7 Server Status + #10 New Subscribers Over Time - Side by side SQUARE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={cardClass}>
          <h3 className="text-[14px] mb-3" style={{ fontWeight: 600 }}>{t('Server Status', 'حالة الخوادم')}</h3>
          <div className="grid grid-cols-2 gap-2">
            {serverStatus.map((s, i) => (
              <div key={`status-${i}`} className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/30">
                <div className={`w-2 h-2 rounded-full ${s.status === 'connected' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                <div>
                  <p className="text-[12px]" style={{ fontWeight: 600 }}>{s.name}</p>
                  <p className={`text-[10px] ${s.status === 'connected' ? 'text-green-500' : 'text-red-500'}`} style={{ fontWeight: 500 }}>
                    {s.status === 'connected' ? t('Connected', 'متصل') : t('Disconnected', 'غير متصل')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className={cardClass}>
          <h3 className="text-[14px] mb-3" style={{ fontWeight: 600 }}>{t('New Subscribers Over Time', 'المشتركون الجدد عبر الوقت')}</h3>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={newSubsOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} width={30} />
              <Tooltip content={<ChartTooltip theme={theme} />} cursor={false} />
              <Line type="monotone" dataKey="zid" stroke="#043CC8" strokeWidth={2} dot={{ r: 3, fill: '#043CC8' }} activeDot={{ r: 5 }}
                name={t('Zid', 'زد')} isAnimationActive animationDuration={1500} />
              <Line type="monotone" dataKey="salla" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} activeDot={{ r: 5 }}
                name={t('Salla', 'سلة')} isAnimationActive animationDuration={1500} animationBegin={300} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-2">
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-[#043CC8]" /><span className="text-[11px]">{t('Zid', 'زد')}</span></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-[#22c55e]" /><span className="text-[11px]">{t('Salla', 'سلة')}</span></div>
          </div>
        </motion.div>
      </div>

      {/* #1 Words Usage + Current Customer Plans */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={cardClass}>
          <h3 className="text-[14px] mb-3" style={{ fontWeight: 600 }}>{t('Words / Tokens Usage', 'استخدام الكلمات / التوكنز')}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={wordsData} barCategoryGap="25%" margin={{ left: 5, right: 10, top: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} width={30} />
              <Tooltip content={<ChartTooltip theme={theme} />} cursor={false} />
              <Bar dataKey="words" fill="#043CC8" name={t('Words Used', 'الكلمات المستهلكة')} radius={[4, 4, 0, 0]} barSize={10} isAnimationActive animationDuration={1200} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-2">
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-[#043CC8]" /><span className="text-[11px]">{t('Words Used', 'الكلمات المستهلكة')}</span></div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className={cardClass}>
          <h3 className="text-[14px] mb-3" style={{ fontWeight: 600 }}>{t('Current Customer Plans', 'خطط العملاء الحالية')}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={currentPlansData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value" strokeWidth={0}
                isAnimationActive animationDuration={1200}>
                {currentPlansData.map((entry, i) => <Cell key={`plan-${i}`} fill={entry.color} />)}
              </Pie>
              <Tooltip content={<ChartTooltip theme={theme} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-4 mt-1 flex-wrap">
            {currentPlansData.map((d, i) => (
              <div key={`plan-leg-${i}`} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: d.color }} />
                <span className="text-[12px]">{d.name}: <span style={{ fontWeight: 600 }}>{d.value}</span></span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* #2 Subscriptions by Platform + #4 First Subscription Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className={cardClass}>
          <h3 className="text-[14px] mb-3" style={{ fontWeight: 600 }}>{t('Subscriptions by Platform', 'الاشتراكات حسب المنصة')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={platformSubsData} barGap={6} barCategoryGap="35%" margin={{ left: 5, right: 10, top: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false}
                tick={({ x, y, payload, index }: any) => {
                  const colorMap: Record<string, string> = {
                    [t('Active', 'نشط')]: '#94a3b8',
                    [t('Inactive', 'غير نشط')]: '#f97316',
                    [t('Cancelled', 'ملغي')]: '#ef4444',
                  };
                  return (
                    <text key={`tick-${index ?? payload.value}`} x={x} y={y + 14} textAnchor="middle" fontSize={12} fontWeight={600} fill={colorMap[payload.value] || tickColor}>
                      {payload.value}
                    </text>
                  );
                }}
              />
              <YAxis tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} width={30} />
              <Tooltip content={<ChartTooltip theme={theme} />} cursor={false} />
              <Bar dataKey="zid" fill="#043CC8" name={t('Zid', 'زد')} radius={[4, 4, 0, 0]} barSize={24} isAnimationActive animationDuration={1200} />
              <Bar dataKey="salla" fill="#22c55e" name={t('Salla', 'سلة')} radius={[4, 4, 0, 0]} barSize={24} isAnimationActive animationDuration={1200} animationBegin={200} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-2">
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-[#043CC8]" /><span className="text-[11px]">{t('Zid', 'زد')}</span></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-[#22c55e]" /><span className="text-[11px]">{t('Salla', 'سلة')}</span></div>
          </div>
        </motion.div>

        {/* #4 First Subscription Type */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className={cardClass}>
          <h3 className="text-[14px] mb-3" style={{ fontWeight: 600 }}>{t('First Subscription Type', 'نوع الاشتراك الأول')}</h3>
          <div style={{ aspectRatio: '1/1', maxHeight: 220 }} className="mx-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={firstSubData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={4} dataKey="value" strokeWidth={0}
                  isAnimationActive animationDuration={1200}>
                  {firstSubData.map((entry, i) => <Cell key={`fst-${i}`} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<ChartTooltip theme={theme} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-3 mt-1 flex-wrap">
            {firstSubData.map((d, i) => (
              <div key={`fst-leg-${i}`} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                <span className="text-[11px]">{d.name}: <span style={{ fontWeight: 600 }}>{d.value}</span></span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* New Subscribers list + Server Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className={cardClass}>
          <h3 className="text-[14px] mb-3" style={{ fontWeight: 600 }}>{t('New Subscribers', 'المشتركون الجدد')}</h3>
          <div className="max-h-[240px] overflow-y-auto space-y-2">
            {newSubscribers.map((sub, i) => (
              <div key={`sub-${i}`} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#043CC8] to-[#00C9BD] flex items-center justify-center text-white text-[11px] shrink-0" style={{ fontWeight: 700 }}>{sub.logo}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] truncate" style={{ fontWeight: 600 }}>{sub.name}</p>
                  <p className={`text-[11px] ${textMuted}`}>{sub.platform} • {sub.date}</p>
                </div>
                <div className="text-end shrink-0">
                  <p className="text-[12px]" style={{ fontWeight: 600 }}>{sub.usedTokens.toLocaleString()}</p>
                  <p className={`text-[10px] ${textMuted}`}>/ {sub.totalTokens.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className={cardClass}>
          <h3 className="text-[14px] mb-3" style={{ fontWeight: 600 }}>{t('Server / Service Usage', 'استخدام الخوادم / الخدمات')}</h3>
          <div className="space-y-3">
            {serverUsage.map((s, i) => (
              <div key={`srv-${i}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px]" style={{ fontWeight: 500 }}>{s.name}</span>
                  <span className="text-[13px]" style={{ fontWeight: 600, color: s.fill }}>{s.usage}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${s.usage}%` }} transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
                    className="h-full rounded-full" style={{ backgroundColor: s.fill }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* #9 Customer Source + #5 Uninstall */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className={cardClass}>
          <h3 className="text-[14px] mb-3" style={{ fontWeight: 600 }}>{t('Customer Source Comparison', 'مقارنة مصادر العملاء')}</h3>
          <p className={`text-[11px] ${textMuted} -mt-2 mb-3`}>{t('All customers: subscribed, unsubscribed & uninstalled', 'جميع العملاء: مشتركين وغير مشتركين وملغيين')}</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={customerSourceData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={5} dataKey="value" strokeWidth={0}
                isAnimationActive animationDuration={1200}>
                {customerSourceData.map((entry, i) => <Cell key={`src-${i}`} fill={entry.color} />)}
              </Pie>
              <Tooltip content={<ChartTooltip theme={theme} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-1">
            {customerSourceData.map((d, i) => (
              <div key={`src-leg-${i}`} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: d.color }} />
                <span className="text-[12px]">{d.name}: <span style={{ fontWeight: 600 }}>{d.value}</span></span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* #5 Uninstall */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className={cardClass}>
          <h3 className="text-[14px] mb-3" style={{ fontWeight: 600 }}>{t('Uninstall Comparison', 'مقارنة إلغاء التثبيت')}</h3>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={uninstallData} barSize={30} barCategoryGap="40%">
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip theme={theme} />} cursor={false} />
              <Bar dataKey="value" name={t('Uninstalls', 'إلغاء التثبيت')} radius={[6, 6, 0, 0]} isAnimationActive animationDuration={1200}>
                {uninstallData.map((entry, i) => <Cell key={`un-${i}`} fill={entry.fill} />)}
                <LabelList dataKey="value" position="top" style={{ fontSize: 13, fontWeight: 700, fill: tickColor }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-1">
            {uninstallData.map((d, i) => (
              <div key={`un-leg-${i}`} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: d.fill }} />
                <span className="text-[12px]">{d.name} → <span style={{ fontWeight: 700 }}>{d.value}</span></span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* #6 Zid & Salla Plans */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { data: zidPlanData, title: t('Subscribers by Plan – Zid', 'المشتركين حسب الخطة – زد'), prefix: 'zid' },
          { data: sallaPlanData, title: t('Subscribers by Plan – Salla', 'المشتركين حسب الخطة – سلة'), prefix: 'salla' },
        ].map((chart) => (
          <motion.div key={chart.prefix} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }} className={cardClass}>
            <h3 className="text-[14px] mb-3" style={{ fontWeight: 600 }}>{chart.title}</h3>
            <div className="flex items-center justify-between mb-3 p-2.5 rounded-xl bg-muted/30">
              <span className={`text-[12px] ${textMuted}`}>{t('Total', 'الإجمالي')}</span>
              <span className="text-[15px]" style={{ fontWeight: 700 }}>{chart.data.reduce((s, d) => s + d.value, 0)}</span>
            </div>
            {/* Vertical bar chart with labels below */}
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chart.data} barSize={28} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip theme={theme} />} cursor={false} />
                <Bar dataKey="value" name={t('Subscribers', 'مشتركين')} radius={[6, 6, 0, 0]} isAnimationActive animationDuration={1200}>
                  {chart.data.map((_, i) => <Cell key={`${chart.prefix}-cell-${i}`} fill={planColorArr[i]} />)}
                  <LabelList dataKey="value" position="top" style={{ fontSize: 12, fontWeight: 700, fill: tickColor }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-3 mt-2 flex-wrap">
              {chart.data.map((d, i) => (
                <div key={`${chart.prefix}-leg-${i}`} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: planColorArr[i] }} />
                  <span className="text-[11px]">{d.name}</span>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}