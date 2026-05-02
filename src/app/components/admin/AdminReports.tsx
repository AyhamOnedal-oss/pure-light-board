import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useParams } from 'react-router';
import { motion } from 'motion/react';
import { AnimatedValue } from '../AnimatedNumber';
import { Download, Calendar, ChevronDown, DollarSign, Users, Clock, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, AreaChart, Area } from 'recharts';
import { fetchAdminReports, MOCK_REPORTS, type AdminReportsData } from '../../services/adminReports';

const dateFilters = [
  { key: 'current_month', en: 'Current Month', ar: 'الشهر الحالي' },
  { key: 'prev_month', en: 'Previous Month', ar: 'الشهر السابق' },
  { key: 'last_3', en: 'Last 3 Months', ar: 'آخر 3 أشهر' },
  { key: 'last_6', en: 'Last 6 Months', ar: 'آخر 6 أشهر' },
  { key: 'current_year', en: 'Current Year', ar: 'السنة الحالية' },
  { key: 'custom', en: 'Custom Range', ar: 'نطاق مخصص' },
];

function ReportTooltip({ active, payload, label, theme }: any) {
  if (!active || !payload?.length) return null;
  const isDark = theme === 'dark';
  return (
    <div style={{
      backgroundColor: isDark ? '#1e293b' : '#fff',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
      borderRadius: '10px', padding: '10px 14px', fontSize: '12px',
      color: isDark ? '#fff' : '#1a1a2e',
    }}>
      {label && <p style={{ fontWeight: 600, marginBottom: 4, color: isDark ? '#fff' : '#1a1a2e' }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2" style={{ marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.fill, display: 'inline-block' }} />
          <span style={{ color: isDark ? '#cbd5e1' : '#64748b' }}>{p.name}:</span>
          <span style={{ fontWeight: 600, color: isDark ? '#fff' : '#1a1a2e' }}>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function AdminReports() {
  const { t, theme, language } = useApp();
  const { platform } = useParams<{ platform: string }>();
  const [dateFilter, setDateFilter] = useState('current_year');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState<AdminReportsData>(MOCK_REPORTS);

  useEffect(() => {
    let alive = true;
    fetchAdminReports()
      .then(d => { if (alive) setData(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const zidPlans = data.zidPlans;
  const sallaPlans = data.sallaPlans;
  const revenueByMonth = data.revenueByMonth;

  const cardClass = "bg-card rounded-2xl border border-border p-5 shadow-sm";
  const tooltipStyle = { backgroundColor: theme === 'dark' ? '#1e293b' : '#fff', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '12px' };

  const isAll = platform === 'all';
  const isZid = platform === 'zid';
  const isSalla = platform === 'salla';

  const plans = useMemo(() => {
    if (isZid) return zidPlans;
    if (isSalla) return sallaPlans;
    // 'all' — combine by index, guarding against length mismatches
    return zidPlans.map((z, i) => {
      const s = sallaPlans[i];
      return {
        ...z,
        subscribers: z.subscribers + (s?.subscribers ?? 0),
        total: z.total + (s?.total ?? 0),
      };
    });
  }, [zidPlans, sallaPlans, isZid, isSalla]);

  const totalSubs = plans.reduce((s, p) => s + p.subscribers, 0);
  const totalRevenue = plans.reduce((s, p) => s + p.total, 0);
  const pendingAmount = Math.round(totalRevenue * 0.12); // Mock: 12% pending
  const tax = Math.round(totalRevenue * 0.15);
  const revenueExTax = totalRevenue - tax;
  const netProfit = Math.round(revenueExTax * 0.7);

  const title = isAll ? t('All Reports', 'جميع التقارير') : isZid ? t('Zid Reports', 'تقارير زد') : t('Salla Reports', 'تقارير سلة');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px]" style={{ fontWeight: 700 }}>{title}</h1>
          <p className="text-[13px] text-muted-foreground">{t('Financial and subscription reports', 'التقارير المالية والاشتراكات')}</p>
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
                      className={`w-full text-start px-4 py-2 hover:bg-muted text-[13px] transition-colors ${dateFilter === f.key ? 'text-[#043CC8]' : ''}`}>
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

      {/* KPIs */}
      <div className={`grid gap-4 ${isAll ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6' : 'grid-cols-1 sm:grid-cols-3'}`}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${cardClass} relative overflow-hidden`}>
          <Users className="w-5 h-5 mb-2 text-[#043CC8]" />
          <p className="text-[11px] text-muted-foreground mb-1">{t('Total Subscribers', 'إجمالي المشتركين')}</p>
          <p className="text-[22px]" style={{ fontWeight: 700 }}><AnimatedValue value={totalSubs} /></p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={`${cardClass} relative overflow-hidden`}>
          <DollarSign className="w-5 h-5 mb-2 text-[#22c55e]" />
          <p className="text-[11px] text-muted-foreground mb-1">{t('Total Revenue', 'إجمالي الإيرادات')}</p>
          <p className="text-[22px]" style={{ fontWeight: 700 }}><AnimatedValue value={totalRevenue} /> <span className="text-[12px] text-muted-foreground">{t('SAR', 'ر.س')}</span></p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`${cardClass} relative overflow-hidden`}>
          <Clock className="w-5 h-5 mb-2 text-[#f97316]" />
          <p className="text-[11px] text-muted-foreground mb-1">{t('Pending Amount', 'المبلغ المعلق')}</p>
          <p className="text-[22px]" style={{ fontWeight: 700 }}><AnimatedValue value={pendingAmount} /> <span className="text-[12px] text-muted-foreground">{t('SAR', 'ر.س')}</span></p>
        </motion.div>
        {isAll && (
          <>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={`${cardClass} relative overflow-hidden`}>
              <DollarSign className="w-5 h-5 mb-2 text-red-400" />
              <p className="text-[11px] text-muted-foreground mb-1">{t('Tax (15%)', 'الضريبة (15%)')}</p>
              <p className="text-[22px]" style={{ fontWeight: 700 }}><AnimatedValue value={tax} /> <span className="text-[12px] text-muted-foreground">{t('SAR', 'ر.س')}</span></p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={`${cardClass} relative overflow-hidden`}>
              <TrendingUp className="w-5 h-5 mb-2 text-[#a855f7]" />
              <p className="text-[11px] text-muted-foreground mb-1">{t('Revenue Ex. Tax', 'الإيرادات بدون ضريبة')}</p>
              <p className="text-[22px]" style={{ fontWeight: 700 }}><AnimatedValue value={revenueExTax} /> <span className="text-[12px] text-muted-foreground">{t('SAR', 'ر.س')}</span></p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className={`${cardClass} relative overflow-hidden`}>
              <DollarSign className="w-5 h-5 mb-2 text-[#00FFF4]" />
              <p className="text-[11px] text-muted-foreground mb-1">{t('Net Profit', 'صافي الربح')}</p>
              <p className="text-[22px]" style={{ fontWeight: 700 }}><AnimatedValue value={netProfit} /> <span className="text-[12px] text-muted-foreground">{t('SAR', 'ر.س')}</span></p>
            </motion.div>
          </>
        )}
      </div>

      {/* Platform Comparison (All only) */}
      {isAll && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className={cardClass}>
          <h3 className="text-[15px] mb-4" style={{ fontWeight: 600 }}>{t('Platform Comparison', 'مقارنة المنصات')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[{ name: t('Zid', 'زد'), data: zidPlans, color: '#043CC8' }, { name: t('Salla', 'سلة'), data: sallaPlans, color: '#22c55e' }].map(p => (
              <div key={p.name} className="p-4 rounded-xl bg-muted/30 space-y-2">
                <p className="text-[14px] mb-3" style={{ fontWeight: 600, color: p.color }}>{p.name}</p>
                <div className="flex justify-between text-[12px]">
                  <span className="text-muted-foreground">{t('Subscribers', 'المشتركين')}</span>
                  <span style={{ fontWeight: 600 }}>{p.data.reduce((s, d) => s + d.subscribers, 0)}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-muted-foreground">{t('Revenue', 'الإيرادات')}</span>
                  <span style={{ fontWeight: 600 }}>{p.data.reduce((s, d) => s + d.total, 0).toLocaleString()} {t('SAR', 'ر.س')}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-muted-foreground">{t('Pending', 'معلق')}</span>
                  <span style={{ fontWeight: 600 }}>{Math.round(p.data.reduce((s, d) => s + d.total, 0) * 0.12).toLocaleString()} {t('SAR', 'ر.س')}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Plan Details Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className={cardClass}>
        <h3 className="text-[15px] mb-4" style={{ fontWeight: 600 }}>{t('Plan Details', 'تفاصيل الخطط')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Plan', 'الخطة')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Price', 'السعر')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Subscribers', 'المشتركين')}</th>
                <th className="text-start py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>{t('Total Amount', 'إجمالي المبلغ')}</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4" style={{ fontWeight: 600 }}>{language === 'ar' ? (p as any).nameAr || p.name : p.name}</td>
                  <td className="py-3 px-4">{p.price === 0 ? t('Free', 'مجاني') : `${p.price} ${t('SAR', 'ر.س')}`}</td>
                  <td className="py-3 px-4">{p.subscribers}</td>
                  <td className="py-3 px-4" style={{ fontWeight: 600 }}>{p.total.toLocaleString()} {t('SAR', 'ر.س')}</td>
                </tr>
              ))}
              <tr className="bg-muted/30">
                <td className="py-3 px-4" style={{ fontWeight: 700 }}>{t('Total', 'الإجمالي')}</td>
                <td className="py-3 px-4">-</td>
                <td className="py-3 px-4" style={{ fontWeight: 700 }}>{totalSubs}</td>
                <td className="py-3 px-4" style={{ fontWeight: 700 }}>{totalRevenue.toLocaleString()} {t('SAR', 'ر.س')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Revenue Chart */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className={cardClass}>
        <h3 className="text-[15px] mb-4" style={{ fontWeight: 600 }}>{t('Revenue Over Time', 'الإيرادات عبر الوقت')}</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={revenueByMonth.map(d => ({ ...d, label: language === 'ar' ? d.nameAr : d.name }))} barGap={4} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<ReportTooltip theme={theme} />} cursor={false} />
            {(isAll || isZid) && <Bar dataKey="zid" fill="#043CC8" name={t('Zid', 'زد')} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={1200} />}
            {(isAll || isSalla) && <Bar dataKey="salla" fill="#22c55e" name={t('Salla', 'سلة')} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={1200} animationBegin={200} />}
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-6 mt-3">
          {(isAll || isZid) && <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#043CC8]" /><span className="text-[12px]">{t('Zid', 'زد')}</span></div>}
          {(isAll || isSalla) && <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#22c55e]" /><span className="text-[12px]">{t('Salla', 'سلة')}</span></div>}
        </div>
      </motion.div>
    </div>
  );
}