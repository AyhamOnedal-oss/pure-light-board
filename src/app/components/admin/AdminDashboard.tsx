import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AnimatedValue } from '../AnimatedNumber';
import { motion } from 'motion/react';
import {
  Users, UserCheck, UserX, Trash2, MousePointerClick, Clock,
  Download, Calendar, ChevronDown, Pencil, MessageSquare
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, LabelList
} from 'recharts';
import {
  fetchAdminDashboard,
  ADMIN_DASHBOARD_MOCK,
  type AdminDashboardData,
  type PlanTier,
  fetchAdminKpis,
  fetchServerHealth,
  type AdminKpis,
  type HealthCheck,
  fetchSupabaseUsage,
  fetchAdminServerUsage,
  setOpenAiWordBudget,
  type AdminServerUsage,
} from '../../services/adminDashboard';
import { OpenAIKeysCard } from './OpenAIKeysCard';

type AdminDonutDatum = { name: string; value: number; color: string };

// Mirrors `DashboardDonut` from DashboardPage.tsx so admin donuts replay
// the exact same counter-clockwise sweep as تصنيف المحادثات / تقييم الذكاء.
const AdminDonut = React.memo(function AdminDonut({
  data, theme, innerRadius = 50, outerRadius = 78,
}: { data: AdminDonutDatum[]; theme: string; innerRadius?: number; outerRadius?: number }) {
  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? '#1e2740' : '#ffffff',
    border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: '12px',
    color: theme === 'dark' ? '#ffffff' : '#1a1a2e',
    fontSize: '13px',
  };
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%" cy="50%"
          innerRadius={innerRadius} outerRadius={outerRadius}
          dataKey="value" paddingAngle={4} strokeWidth={0}
          isAnimationActive animationBegin={0} animationDuration={900} animationEasing="ease-out"
        >
          {data.map((entry, i) => <Cell key={`adm-donut-${i}`} fill={entry.color} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: tooltipStyle.color }} labelStyle={{ color: tooltipStyle.color }} />
      </PieChart>
    </ResponsiveContainer>
  );
});

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

  // Live data from Supabase (admin_dash_* tables). Falls back to the same
  // mock numbers shipped with the dashboard if Supabase is empty/unreachable.
  const [data, setData] = useState<AdminDashboardData>(ADMIN_DASHBOARD_MOCK);
  const [dataLoaded, setDataLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    fetchAdminDashboard().then(d => { if (alive) { setData(d); setDataLoaded(true); } });
    return () => { alive = false; };
  }, []);

  // ---- Live server health (latest row per provider) ----
  const [health, setHealth] = useState<HealthCheck[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => fetchServerHealth().then(h => { if (alive) setHealth(h); });
    load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // ---- Live Supabase DB usage (size vs 8 GB Pro-plan included disk) ----
  const [supaUsage, setSupaUsage] = useState<{ bytes: number; included_bytes: number; percent: number } | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => fetchSupabaseUsage().then(u => { if (alive) setSupaUsage(u); });
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // ---- Live server usage (Resend + OpenAI; Supabase via admin-server-usage too) ----
  const [serverUsageLive, setServerUsageLive] = useState<AdminServerUsage | null>(null);
  const loadServerUsage = () => fetchAdminServerUsage().then(u => setServerUsageLive(u));
  useEffect(() => {
    loadServerUsage();
    const id = setInterval(loadServerUsage, 5 * 60_000);
    return () => clearInterval(id);
  }, []);

  // ---- Date range derived from the top-right filter ----
  const range = useMemo<{ from: string | null; to: string | null }>(() => {
    const now = new Date();
    const startOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 1)).toISOString();
    const endOfMonth   = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 1) - 1 as any).toISOString();
    const y = now.getUTCFullYear(); const m = now.getUTCMonth();
    switch (dateFilter) {
      case 'current_month': return { from: startOfMonth(y, m), to: now.toISOString() };
      case 'prev_month':    return { from: startOfMonth(y, m - 1), to: endOfMonth(y, m - 1) };
      case 'last_3':        return { from: startOfMonth(y, m - 2), to: now.toISOString() };
      case 'last_6':        return { from: startOfMonth(y, m - 5), to: now.toISOString() };
      case 'current_year':  return { from: new Date(Date.UTC(y, 0, 1)).toISOString(), to: now.toISOString() };
      case 'custom':
        if (dateFrom && dateTo) {
          return {
            from: new Date(dateFrom + 'T00:00:00Z').toISOString(),
            to:   new Date(dateTo   + 'T23:59:59Z').toISOString(),
          };
        }
        return { from: null, to: null };
      default: return { from: null, to: null };
    }
  }, [dateFilter, dateFrom, dateTo]);

  // ---- Live KPI numbers from admin_kpis() ----
  const [liveKpis, setLiveKpis] = useState<AdminKpis | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setKpisLoading(true);
    fetchAdminKpis(range.from, range.to).then(k => {
      if (!alive) return;
      setLiveKpis(k);
      setKpisLoading(false);
    });
    return () => { alive = false; };
  }, [range.from, range.to]);


  const tickColor = theme === 'dark' ? '#94a3b8' : '#64748b';
  const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  // KPI cards ← admin_kpis() (with mock fallback for inactive_customers)
  const kpis = useMemo(() => {
    const totalCustomers = liveKpis?.total_customers ?? 0;
    const incompleteCustomers = liveKpis?.incomplete_customers ?? 0;
    const activeCustomers = liveKpis?.active_customers ?? 0;
    const uninstalls = liveKpis?.total_uninstalls ?? 0;
    const clicks = liveKpis?.total_bubble_clicks ?? 0;
    const avg = liveKpis?.avg_response_seconds ?? 0;
    const conversations = liveKpis?.total_conversations ?? 0;

    const pct = (curr: number, prev: number): { change: number | null; up: boolean } => {
      if (!liveKpis?.has_range) return { change: null, up: true };
      if (!prev) return { change: curr > 0 ? 100 : 0, up: curr >= 0 };
      const diff = ((curr - prev) / prev) * 100;
      return { change: Math.round(Math.abs(diff) * 10) / 10, up: diff >= 0 };
    };

    const totalC = pct(totalCustomers, liveKpis?.prev_total_customers ?? 0);
    const incC   = pct(incompleteCustomers, liveKpis?.prev_incomplete_customers ?? 0);
    const actC   = pct(activeCustomers, liveKpis?.prev_active_customers ?? 0);
    const uninC  = pct(uninstalls,     liveKpis?.prev_total_uninstalls ?? 0);
    const clickC = pct(clicks,         liveKpis?.prev_total_bubble_clicks ?? 0);
    const avgC   = pct(avg,            liveKpis?.prev_avg_response_seconds ?? 0);
    const convC  = pct(conversations,  liveKpis?.prev_total_conversations ?? 0);

    return [
      { icon: Users,             label: t('Total Customers',     'إجمالي العملاء'),        value: totalCustomers,    color: '#043CC8', change: totalC.change, up: totalC.up },
      { icon: UserX,             label: t('Incomplete Customers','العملاء غير المكتملين'), value: incompleteCustomers, color: '#ff4466', change: incC.change, up: !incC.up },
      { icon: Trash2,            label: t('Total Uninstalls',    'إجمالي إلغاء التثبيت'), value: uninstalls,        color: '#f97316', change: uninC.change,  up: !uninC.up },
      { icon: UserCheck,         label: t('Active Customers',    'العملاء النشطون'),       value: activeCustomers,   color: '#22c55e', change: actC.change, up: actC.up },
      { icon: MessageSquare,     label: t('Number of Conversations', 'عدد المحادثات'),     value: conversations,     color: '#0EA5E9', change: convC.change, up: convC.up },
      { icon: MousePointerClick, label: t('Total Bubble Clicks', 'إجمالي نقرات الفقاعة'), value: clicks,            color: '#a855f7', change: clickC.change, up: clickC.up },
      { icon: Clock,             label: t('Avg Response Time',   'متوسط وقت الاستجابة'),   value: Math.round(avg * 10) / 10, color: '#00C9BD', change: avgC.change, up: !avgC.up, suffix: 's' as string | undefined },
    ] as Array<{ icon: any; label: string; value: number; color: string; change: number | null; up: boolean; suffix?: string }>;
  }, [liveKpis, data.kpi, language]);

  // Reusable month label helper for chart x-axes
  const monthNames: Array<[string, string]> = [
    ['Jan','يناير'],['Feb','فبراير'],['Mar','مارس'],['Apr','أبريل'],['May','مايو'],['Jun','يونيو'],
    ['Jul','يوليو'],['Aug','أغسطس'],['Sep','سبتمبر'],['Oct','أكتوبر'],['Nov','نوفمبر'],['Dec','ديسمبر'],
  ];
  const planLabel = (p: PlanTier): string => ({
    trial:        t('Trial', 'تجريبي'),
    economy:      t('Economy', 'اقتصادي'),
    basic:        t('Basic', 'أساسي'),
    professional: t('Professional', 'احترافي'),
    business:     t('Business', 'أعمال'),
  }[p]);

  // #1 Words/Tokens monthly bars  ← admin_dash_words_monthly (kept)
  const wordsData = useMemo(() => {
    const byMonth = new Map(data.wordsMonthly.map(w => [w.month, w.words]));
    return monthNames.map(([en, ar], i) => ({ name: t(en, ar), words: byMonth.get(i + 1) ?? 0 }));
  }, [data.wordsMonthly, language]);

  // Current Customer Plans pie  ← admin_dash_plan_distribution (platform IS NULL)
  const currentPlansData = useMemo(() => {
    const order: PlanTier[] = ['economy', 'basic', 'professional', 'business'];
    return order.map(plan => {
      const row = data.planDistribution.find(p => p.platform === null && p.plan === plan);
      return { name: planLabel(plan), value: row?.subscribers ?? 0, color: PLAN_COLORS[plan] };
    });
  }, [data.planDistribution, language]);

  // Gate animated donuts so they mount fresh after data resolves and play
  // their sweep once on real values (no MOCK-flash count-down).
  const [chartsLoaded, setChartsLoaded] = useState(false);
  useEffect(() => {
    if (!dataLoaded) return;
    setChartsLoaded(false);
    const id = requestAnimationFrame(() => setChartsLoaded(true));
    return () => cancelAnimationFrame(id);
  }, [dataLoaded, range.from, range.to, data.planDistribution, data.firstSubType, data.customerSource]);

  // #3 Subscriptions by Platform  ← admin_dash_platform_subs
  const platformSubsData = useMemo(() => {
    const statuses: Array<['active'|'inactive'|'cancelled', string]> = [
      ['active',    t('Active', 'نشط')],
      ['cancelled', t('Cancelled', 'ملغي')],
    ];
    return statuses.map(([s, label]) => ({
      name: label,
      zid:   data.platformSubs.find(p => p.status === s && p.platform === 'zid')?.count ?? 0,
      salla: data.platformSubs.find(p => p.status === s && p.platform === 'salla')?.count ?? 0,
    }));
  }, [data.platformSubs, language]);

  // New Subscribers list  ← admin_dash_new_subscribers
  const newSubscribers = useMemo(() => data.newSubscribers.map(s => ({
    name: s.store_name,
    platform: s.platform === 'zid' ? 'Zid' : 'Salla',
    date: s.subscribed_on,
    totalTokens: s.total_tokens,
    usedTokens: s.used_tokens,
    logo: s.logo_initials,
  })), [data.newSubscribers]);

  // Server usage bars  ← admin_dash_servers
  const serverUsage = useMemo(() => data.servers.map(s => {
    if (s.name === 'Supabase' && supaUsage) {
      const usedGb = supaUsage.bytes / (1024 ** 3);
      const capGb  = supaUsage.included_bytes / (1024 ** 3);
      return {
        name: s.name,
        usage: supaUsage.percent,
        fill: s.color,
        tooltip: `${usedGb.toFixed(2)} GB / ${capGb.toFixed(0)} GB`,
      };
    }
    if (s.name === 'Resend' && serverUsageLive?.resend) {
      const r = serverUsageLive.resend;
      return { name: s.name, usage: r.percent, fill: s.color, tooltip: `${r.sent.toLocaleString()} / ${r.cap.toLocaleString()} ${t('emails this month','بريد هذا الشهر')}` };
    }
    if (s.name === 'OpenAI' && serverUsageLive?.openai) {
      const o = serverUsageLive.openai;
      return {
        name: s.name,
        usage: Number(o.percent ?? 0),
        fill: s.color,
        tooltip: o.budget_words > 0
          ? `${o.used_words.toLocaleString()} / ${o.budget_words.toLocaleString()} ${t('words this month','كلمة هذا الشهر')}`
          : `${o.used_words.toLocaleString()} ${t('words this month','كلمة هذا الشهر')}`,
      };
    }
    return { name: s.name, usage: s.usage_percent, fill: s.color, tooltip: undefined as string | undefined };
  }), [data.servers, supaUsage, serverUsageLive, language]);

  // First Subscription Type pie  ← admin_dash_first_sub_type
  const firstSubData = useMemo(() => {
    const order: PlanTier[] = ['trial', 'economy', 'basic', 'professional', 'business'];
    return order.map(plan => ({
      name: planLabel(plan),
      value: data.firstSubType.find(f => f.plan === plan)?.count ?? 0,
      color: PLAN_COLORS[plan],
    }));
  }, [data.firstSubType, language]);

  // Customer Source pie  ← admin_dash_customer_source
  const customerSourceData = useMemo(() => ([
    { name: t('Zid', 'زد'),   value: data.customerSource.find(s => s.platform === 'zid')?.count ?? 0,   color: '#043CC8' },
    { name: t('Salla', 'سلة'), value: data.customerSource.find(s => s.platform === 'salla')?.count ?? 0, color: '#22c55e' },
  ]), [data.customerSource, language]);

  // Uninstall comparison bar  ← admin_dash_uninstalls
  const uninstallData = useMemo(() => ([
    { name: t('Zid', 'زد'),   value: data.uninstalls.find(u => u.platform === 'zid')?.count ?? 0,   fill: '#ff4466' },
    { name: t('Salla', 'سلة'), value: data.uninstalls.find(u => u.platform === 'salla')?.count ?? 0, fill: '#f97316' },
  ]), [data.uninstalls, language]);

  const planColorArr = [PLAN_COLORS.economy, PLAN_COLORS.basic, PLAN_COLORS.professional, PLAN_COLORS.business];

  // Per-platform plan bars  ← admin_dash_plan_distribution (platform = 'zid' | 'salla')
  const buildPlatformPlan = (pf: 'zid' | 'salla') => {
    const order: PlanTier[] = ['economy', 'basic', 'professional', 'business'];
    return order.map(plan => ({
      name: planLabel(plan),
      value: data.planDistribution.find(p => p.platform === pf && p.plan === plan)?.subscribers ?? 0,
    }));
  };
  const zidPlanData = useMemo(() => buildPlatformPlan('zid'), [data.planDistribution, language]);
  const sallaPlanData = useMemo(() => buildPlatformPlan('salla'), [data.planDistribution, language]);

  // Server Status grid ← live admin_health_checks (fallback to seeded list)
  const serverStatus = useMemo(() => {
    const ordered = ['Supabase', 'Hostinger', 'Resend', 'OpenAI'];
    return ordered.map(name => {
      const h = health.find(x => x.provider === name);
      return {
        name,
        status: (h?.status ?? 'up') as 'up' | 'degraded' | 'down',
        error: h?.error ?? null,
        checkedAt: h?.checked_at ?? null,
        hasData: !!h,
      };
    });
  }, [health]);

  // #10 New Subscribers Over Time  ← admin_dash_new_subs_monthly
  const newSubsOverTime = useMemo(() => monthNames.map(([en, ar], i) => ({
    name: t(en, ar),
    zid:   data.newSubsMonthly.find(r => r.month === i + 1 && r.platform === 'zid')?.count ?? 0,
    salla: data.newSubsMonthly.find(r => r.month === i + 1 && r.platform === 'salla')?.count ?? 0,
  })), [data.newSubsMonthly, language]);

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
                {kpisLoading
                  ? <span className={textMuted}>—</span>
                  : <><AnimatedValue value={kpi.value} />{kpi.suffix || ''}</>}
              </p>
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
              <div
                key={`status-${i}`}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/30"
                title={[
                  s.error || '',
                  s.checkedAt ? `${t('Last checked', 'آخر فحص')}: ${new Date(s.checkedAt).toLocaleString(language === 'ar' ? 'ar' : 'en')}` : '',
                ].filter(Boolean).join('\n')}
              >
                <div className={`w-2 h-2 rounded-full animate-pulse ${
                  s.status === 'up' ? 'bg-green-500' : s.status === 'degraded' ? 'bg-amber-500' : 'bg-red-500'
                }`} />
                <div className="min-w-0">
                  <p className="text-[12px] truncate" style={{ fontWeight: 600 }}>{s.name}</p>
                  <p className={`text-[10px] ${
                    s.status === 'up' ? 'text-green-500' : s.status === 'degraded' ? 'text-amber-500' : 'text-red-500'
                  }`} style={{ fontWeight: 500 }}>
                    {s.status === 'up'
                      ? t('Connected', 'متصل')
                      : s.status === 'degraded'
                        ? t('Partially Operational', 'تقريباً متصل')
                        : t('Disconnected', 'غير متصل')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className={cardClass}>
          <h3 className="text-[14px] mb-3" style={{ fontWeight: 600 }}>{t('New Subscribers Over Time', 'المشتركون الجدد عبر الوقت')}</h3>
          <div style={{ height: 140 }}>
          {chartsLoaded && (
          <ResponsiveContainer width="100%" height="100%" key={`nsot-${newSubsOverTime.length}`}>
            <LineChart data={newSubsOverTime} margin={{ top: 10, right: 12, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} width={42} tickMargin={6} />
              <Tooltip content={<ChartTooltip theme={theme} />} cursor={false} />
              <Line type="monotone" dataKey="zid" stroke="#043CC8" strokeWidth={2} dot={{ r: 3, fill: '#043CC8' }} activeDot={{ r: 5 }}
                name={t('Zid', 'زد')} isAnimationActive animationDuration={1500} />
              <Line type="monotone" dataKey="salla" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} activeDot={{ r: 5 }}
                name={t('Salla', 'سلة')} isAnimationActive animationDuration={1500} animationBegin={300} />
            </LineChart>
          </ResponsiveContainer>
          )}
          </div>
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
          <div style={{ height: 200 }}>
          {chartsLoaded && (
          <ResponsiveContainer width="100%" height="100%" key={`words-${wordsData.length}`}>
            <BarChart data={wordsData} barCategoryGap="25%" margin={{ left: 5, right: 10, top: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} width={30} />
              <Tooltip content={<ChartTooltip theme={theme} />} cursor={false} />
              <Bar dataKey="words" fill="#043CC8" name={t('Words Used', 'الكلمات المستهلكة')} radius={[4, 4, 0, 0]} barSize={10} isAnimationActive animationDuration={1200} />
            </BarChart>
          </ResponsiveContainer>
          )}
          </div>
          <div className="flex items-center justify-center gap-6 mt-2">
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-[#043CC8]" /><span className="text-[11px]">{t('Words Used', 'الكلمات المستهلكة')}</span></div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className={cardClass}>
          <h3 className="text-[14px] mb-3" style={{ fontWeight: 600 }}>{t('Current Customer Plans', 'خطط العملاء الحالية')}</h3>
          <div style={{ height: 180 }}>
            {chartsLoaded && (
              <AdminDonut
                key={`plan-${currentPlansData.map(d => `${d.name}:${d.value}`).join('|')}`}
                data={currentPlansData}
                theme={theme}
                innerRadius={45}
                outerRadius={70}
              />
            )}
          </div>
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

      {/* OpenAI Keys management — between Words/Tokens panel and Current Plans card */}
      <OpenAIKeysCard />

      {/* #2 Subscriptions by Platform + #4 First Subscription Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className={cardClass}>
          <h3 className="text-[14px] mb-3" style={{ fontWeight: 600 }}>{t('Subscriptions by Platform', 'الاشتراكات حسب المنصة')}</h3>
          <div style={{ height: 220 }}>
          {chartsLoaded && (
          <ResponsiveContainer width="100%" height="100%" key={`plat-${platformSubsData.length}`}>
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
          )}
          </div>
          <div className="flex items-center justify-center gap-6 mt-2">
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-[#043CC8]" /><span className="text-[11px]">{t('Zid', 'زد')}</span></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-[#22c55e]" /><span className="text-[11px]">{t('Salla', 'سلة')}</span></div>
          </div>
        </motion.div>

        {/* #4 First Subscription Type */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className={cardClass}>
          <h3 className="text-[14px] mb-3" style={{ fontWeight: 600 }}>{t('First Subscription Type', 'نوع الاشتراك الأول')}</h3>
          <div style={{ aspectRatio: '1/1', maxHeight: 220 }} className="mx-auto">
            {chartsLoaded && (
              <AdminDonut
                key={`fst-${firstSubData.map(d => `${d.name}:${d.value}`).join('|')}`}
                data={firstSubData}
                theme={theme}
                innerRadius={40}
                outerRadius={65}
              />
            )}
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
          <h3 className="text-[14px] mb-1" style={{ fontWeight: 600 }}>{t('New Subscribers', 'المشتركون الجدد')}</h3>
          <p className={`text-[11px] ${textMuted} mb-2`}>{t('New Zid & Salla stores in the last 7 days', 'متاجر زد وسلة الجديدة خلال آخر 7 أيام')}</p>
          <div className="max-h-[240px] overflow-y-auto space-y-2">
            {newSubscribers.length === 0 && (
              <div className={`text-[12px] ${textMuted} text-center py-8`}>
                {t('No new subscribers in the last 7 days', 'لا يوجد مشتركون جدد خلال آخر 7 أيام')}
              </div>
            )}
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
              <div key={`srv-${i}`} title={s.tooltip}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] flex items-center gap-1.5" style={{ fontWeight: 500 }}>
                    {s.name}
                    {s.name === 'OpenAI' && (
                      <button
                        type="button"
                        title={t('Edit monthly word budget', 'تعديل سقف الكلمات الشهري')}
                        onClick={async () => {
                          const current = serverUsageLive?.openai?.budget_words ?? 0;
                          const input = window.prompt(
                            t('Set OpenAI monthly word budget (used to compute % bar)',
                              'أدخل سقف الكلمات الشهري لـ OpenAI (يُستخدم لحساب نسبة الاستهلاك)'),
                            String(current)
                          );
                          if (input == null) return;
                          const n = Number(input.replace(/[, ]/g, ''));
                          if (!Number.isFinite(n) || n < 0) return;
                          const ok = await setOpenAiWordBudget(Math.floor(n));
                          if (ok) loadServerUsage();
                        }}
                        className="opacity-60 hover:opacity-100 transition-opacity"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </span>
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
              {chartsLoaded && (
                <Pie data={customerSourceData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={5} dataKey="value" strokeWidth={0}
                  isAnimationActive animationDuration={1200}>
                  {customerSourceData.map((entry, i) => <Cell key={`src-${i}`} fill={entry.color} />)}
                </Pie>
              )}
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