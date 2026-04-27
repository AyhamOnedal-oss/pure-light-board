import React, { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import {
  Calendar, Download, BarChart3, ChevronDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import {
  Platform, PlatformId, Campaign, PLATFORM_META, fmtNum, fmtMoney,
} from './adAutomationData';
import { PLATFORM_ICONS, PlatformIcon } from './platformIcons';

type PresetKey =
  | 'all' | '7d' | '14d' | '30d' | '60d' | '180d' | '365d' | 'custom';

interface Props {
  platforms: Platform[];
  campaigns: Campaign[];
}

const DAY = 86_400_000;

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, days: number): string {
  return toISODate(new Date(new Date(iso).getTime() + days * DAY));
}
function daysBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY));
}
// seeded pseudo-random (stable per campaign+day) — keeps chart consistent across renders
function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Distributes campaign lifetime metrics across its active days with daily jitter.
 * Keeps the sum close to the campaign's current metric totals.
 */
function buildDaily(campaigns: Campaign[], fromISO: string, toISO: string) {
  const start = new Date(fromISO).getTime();
  const end = new Date(toISO).getTime();
  const dayMap: Record<string, Record<PlatformId, {
    impressions: number; clicks: number; spend: number; conversions: number;
  }>> = {};

  const keys: PlatformId[] = ['tiktok','snapchat','instagram','facebook','google'];
  for (let t = start; t <= end; t += DAY) {
    const k = toISODate(new Date(t));
    dayMap[k] = {
      tiktok: { impressions: 0, clicks: 0, spend: 0, conversions: 0 },
      snapchat: { impressions: 0, clicks: 0, spend: 0, conversions: 0 },
      instagram: { impressions: 0, clicks: 0, spend: 0, conversions: 0 },
      facebook: { impressions: 0, clicks: 0, spend: 0, conversions: 0 },
      google: { impressions: 0, clicks: 0, spend: 0, conversions: 0 },
    };
  }

  for (const c of campaigns) {
    const cStart = new Date(c.startDate).getTime();
    const cEndRaw = new Date(c.endDate).getTime();
    const today = Date.now();
    const cEnd = Math.min(cEndRaw, today);
    const liveDays = Math.max(1, Math.round((cEnd - cStart) / DAY) + 1);
    const imp = c.impressions / liveDays;
    const clk = c.clicks / liveDays;
    const spd = c.spend / liveDays;
    const cnv = c.conversions / liveDays;

    const from = Math.max(cStart, start);
    const to = Math.min(cEnd, end);
    for (let t = from; t <= to; t += DAY) {
      const dk = toISODate(new Date(t));
      if (!dayMap[dk]) continue;
      const plat = (campaignPlatformMap.get(c.platformRowId) as PlatformId) || 'tiktok';
      const jitter = 0.7 + seeded(c.id + dk) * 0.6; // 0.7x – 1.3x
      dayMap[dk][plat].impressions += Math.round(imp * jitter);
      dayMap[dk][plat].clicks += Math.round(clk * jitter);
      dayMap[dk][plat].spend += Math.round(spd * jitter);
      dayMap[dk][plat].conversions += Math.round(cnv * jitter);
    }
  }

  return Object.keys(dayMap).sort().map(date => {
    const row: any = { date };
    let total = 0;
    for (const k of keys) {
      row[`${k}_impressions`] = dayMap[date][k].impressions;
      row[`${k}_clicks`] = dayMap[date][k].clicks;
      row[`${k}_spend`] = dayMap[date][k].spend;
      row[`${k}_conversions`] = dayMap[date][k].conversions;
      total += dayMap[date][k].spend;
    }
    row.total_spend = total;
    return row;
  });
}

// campaign.platformRowId -> platformId (populated each render via closure below)
const campaignPlatformMap = new Map<string, PlatformId>();

export function AdAutomationAnalytics({ platforms, campaigns }: Props) {
  const { t, language, dir } = useApp();
  const [preset, setPreset] = useState<PresetKey>('all');
  const [presetOpen, setPresetOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [activeChart, setActiveChart] = useState<PlatformId | 'all'>('all');

  // refresh the id -> platformId map
  campaignPlatformMap.clear();
  platforms.forEach(p => campaignPlatformMap.set(p.id, p.platformId));

  // Resolve range
  const { fromISO, toISO } = useMemo(() => {
    const today = toISODate(new Date());
    if (preset === 'custom' && customFrom && customTo) {
      const [a, b] = customFrom <= customTo ? [customFrom, customTo] : [customTo, customFrom];
      return { fromISO: a, toISO: b };
    }
    if (preset === 'all') {
      // earliest campaign start date, or 30d fallback
      const earliest = campaigns.reduce<string | null>((acc, c) => {
        if (!acc || c.startDate < acc) return c.startDate;
        return acc;
      }, null);
      return { fromISO: earliest || addDays(today, -30), toISO: today };
    }
    const map: Record<Exclude<PresetKey, 'all' | 'custom'>, number> = {
      '7d': 7, '14d': 14, '30d': 30, '60d': 60, '180d': 180, '365d': 365,
    };
    const span = map[preset as Exclude<PresetKey, 'all' | 'custom'>] || 30;
    return { fromISO: addDays(today, -span + 1), toISO: today };
  }, [preset, customFrom, customTo, campaigns]);

  const daily = useMemo(() => buildDaily(campaigns, fromISO, toISO), [campaigns, fromISO, toISO]);
  const spanDays = daysBetween(fromISO, toISO) + 1;

  // Totals in range
  const rangeTotals = useMemo(() => {
    const totals = { impressions: 0, clicks: 0, spend: 0, conversions: 0 };
    const perPlatform: Record<PlatformId, typeof totals> = {
      tiktok: { ...totals }, snapchat: { ...totals }, instagram: { ...totals },
      facebook: { ...totals }, google: { ...totals },
    };
    for (const d of daily) {
      (['tiktok','snapchat','instagram','facebook','google'] as PlatformId[]).forEach(k => {
        perPlatform[k].impressions += d[`${k}_impressions`] || 0;
        perPlatform[k].clicks += d[`${k}_clicks`] || 0;
        perPlatform[k].spend += d[`${k}_spend`] || 0;
        perPlatform[k].conversions += d[`${k}_conversions`] || 0;
        totals.impressions += d[`${k}_impressions`] || 0;
        totals.clicks += d[`${k}_clicks`] || 0;
        totals.spend += d[`${k}_spend`] || 0;
        totals.conversions += d[`${k}_conversions`] || 0;
      });
    }
    return { totals, perPlatform };
  }, [daily]);

  const connectedPlatforms = useMemo(() => {
    const ids = new Set(platforms.map(p => p.platformId));
    return (['tiktok','snapchat','instagram','facebook','google'] as PlatformId[]).filter(id => ids.has(id));
  }, [platforms]);

  const presetLabel = (k: PresetKey): string => {
    switch (k) {
      case 'all':    return t('All time (since campaigns started)', 'كل الأيام (منذ بداية الحملات)');
      case '7d':     return t('Last 7 days', 'آخر 7 أيام');
      case '14d':    return t('Last 14 days', 'آخر 14 يوم');
      case '30d':    return t('Last month', 'آخر شهر');
      case '60d':    return t('Last 2 months', 'آخر شهرين');
      case '180d':   return t('Last 6 months', 'آخر 6 أشهر');
      case '365d':   return t('Last year', 'آخر سنة');
      case 'custom': return t('Custom range', 'نطاق مخصص');
    }
  };

  const exportExcel = () => {
    const platformSheet = connectedPlatforms.map(pid => {
      const meta = PLATFORM_META[pid];
      const p = rangeTotals.perPlatform[pid];
      const ctr = p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0;
      return {
        Platform: meta.name,
        المنصة: meta.nameAr,
        Impressions: p.impressions,
        Clicks: p.clicks,
        'CTR (%)': Number(ctr.toFixed(2)),
        Conversions: p.conversions,
        'Spend (SAR)': p.spend,
      };
    });

    const dailySheet = daily.map(d => {
      const row: Record<string, any> = { Date: d.date };
      connectedPlatforms.forEach(pid => {
        const name = PLATFORM_META[pid].name;
        row[`${name} Impressions`] = d[`${pid}_impressions`] || 0;
        row[`${name} Clicks`] = d[`${pid}_clicks`] || 0;
        row[`${name} Spend`] = d[`${pid}_spend`] || 0;
        row[`${name} Conversions`] = d[`${pid}_conversions`] || 0;
      });
      row['Total Spend'] = d.total_spend;
      return row;
    });

    const totalsSheet = [{
      'Date From': fromISO,
      'Date To': toISO,
      Days: spanDays,
      Impressions: rangeTotals.totals.impressions,
      Clicks: rangeTotals.totals.clicks,
      Conversions: rangeTotals.totals.conversions,
      'Spend (SAR)': rangeTotals.totals.spend,
      'CTR (%)': rangeTotals.totals.impressions > 0
        ? Number(((rangeTotals.totals.clicks / rangeTotals.totals.impressions) * 100).toFixed(2))
        : 0,
      Preset: presetLabel(preset),
    }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(totalsSheet), 'Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(platformSheet), 'By Platform');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dailySheet), 'Daily Breakdown');

    const fname = `ad-automation_${fromISO}_to_${toISO}.xlsx`;
    XLSX.writeFile(wb, fname);
  };

  const presets: PresetKey[] = ['all','7d','14d','30d','60d','180d','365d','custom'];

  // Chart data for active tab
  const chartData = useMemo(() => {
    return daily.map(d => {
      if (activeChart === 'all') {
        const row: any = { date: d.date };
        connectedPlatforms.forEach(pid => {
          row[PLATFORM_META[pid].name] =
            (d[`${pid}_impressions`] || 0);
        });
        return row;
      }
      return {
        date: d.date,
        [t('Impressions', 'المشاهدات')]: d[`${activeChart}_impressions`] || 0,
        [t('Clicks', 'النقرات')]: d[`${activeChart}_clicks`] || 0,
        [t('Conversions', 'التحويلات')]: d[`${activeChart}_conversions`] || 0,
      };
    });
  }, [daily, activeChart, connectedPlatforms, language]);

  const formatAxisDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b-[3px]" style={{ borderBottomColor: '#579BFC' }}>
        <BarChart3 className="w-4 h-4 text-[#579BFC]" />
        <span className="text-[14px]" style={{ color: '#579BFC', fontWeight: 700 }}>
          {t('Analytics & Reports', 'التحليلات والتقارير')}
        </span>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground" style={{ fontWeight: 500 }}>
          {spanDays} {t('days', 'يوم')}
        </span>
      </div>

      {/* Filter toolbar */}
      <div className="p-5 border-b border-border space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset dropdown */}
          <div className="relative">
            <button
              onClick={() => setPresetOpen(o => !o)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:bg-muted text-[13px] transition-colors"
              style={{ fontWeight: 500 }}
            >
              <Calendar className="w-4 h-4 text-muted-foreground" />
              {presetLabel(preset)}
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            {presetOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPresetOpen(false)} />
                <div className={`absolute z-50 top-full mt-1 ${dir === 'rtl' ? 'right-0' : 'left-0'} w-60 bg-card border border-border rounded-xl shadow-2xl py-1 overflow-hidden`}>
                  {presets.map(p => (
                    <button
                      key={p}
                      onClick={() => { setPreset(p); setPresetOpen(false); }}
                      className={`w-full text-start px-4 py-2 text-[13px] hover:bg-muted transition-colors ${
                        preset === p ? 'bg-[#043CC8]/10 text-[#043CC8]' : ''
                      }`}
                      style={{ fontWeight: preset === p ? 600 : 500 }}
                    >
                      {presetLabel(p)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Quick-preset pills */}
          <div className="flex items-center gap-1 flex-wrap">
            {(['7d','14d','30d','60d','180d','365d'] as PresetKey[]).map(p => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] transition-colors ${
                  preset === p
                    ? 'bg-[#043CC8] text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
                style={{ fontWeight: 600 }}
              >
                {presetLabel(p)}
              </button>
            ))}
          </div>

          {/* Custom range */}
          {preset === 'custom' && (
            <div className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-xl border border-border bg-muted/30">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="bg-transparent text-[12px] outline-none px-1 py-0.5"
              />
              <span className="text-[12px] text-muted-foreground">—</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="bg-transparent text-[12px] outline-none px-1 py-0.5"
              />
            </div>
          )}

          <div className="ms-auto" />

          {/* Export */}
          <button
            onClick={exportExcel}
            disabled={connectedPlatforms.length === 0}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-[13px] transition-colors ${
              connectedPlatforms.length === 0 ? 'bg-[#00C875]/40 cursor-not-allowed' : 'bg-[#00C875] hover:bg-[#00a862]'
            }`}
            style={{ fontWeight: 600 }}
          >
            <Download className="w-4 h-4" />
            {t('Export Excel', 'تحميل Excel')}
          </button>
        </div>

        {/* Range summary */}
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted">
            {t('From', 'من')} <span className="font-mono" style={{ fontWeight: 600 }}>{fromISO}</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted">
            {t('To', 'إلى')} <span className="font-mono" style={{ fontWeight: 600 }}>{toISO}</span>
          </span>
          <span>·</span>
          <span>{t(`${fmtNum(rangeTotals.totals.impressions)} impressions`, `${fmtNum(rangeTotals.totals.impressions)} مشاهدة`)}</span>
          <span>·</span>
          <span>{t(`${fmtNum(rangeTotals.totals.clicks)} clicks`, `${fmtNum(rangeTotals.totals.clicks)} نقرة`)}</span>
          <span>·</span>
          <span style={{ color: '#E2445C', fontWeight: 700 }}>{fmtMoney(rangeTotals.totals.spend, language as any)}</span>
        </div>
      </div>

      {/* Chart tabs */}
      <div className="px-5 pt-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveChart('all')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] transition-all ${
              activeChart === 'all'
                ? 'bg-[#043CC8] text-white shadow'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
            style={{ fontWeight: 600 }}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            {t('All Platforms', 'جميع المنصات')}
          </button>
          {connectedPlatforms.map(pid => {
            const meta = PLATFORM_META[pid];
            const active = activeChart === pid;
            return (
              <button
                key={pid}
                onClick={() => setActiveChart(pid)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] transition-all border ${
                  active
                    ? 'border-[#043CC8] bg-[#043CC8]/5 text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
                style={{ fontWeight: 600 }}
              >
                {PLATFORM_ICONS[pid] ? (
                  <PlatformIcon id={pid} size={16} />
                ) : (
                  <span className="w-4 h-4 rounded flex items-center justify-center text-[9px]" style={{ background: meta.bg, color: meta.color, fontWeight: 800 }}>
                    {meta.name.charAt(0)}
                  </span>
                )}
                {language === 'ar' ? meta.nameAr : meta.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <div className="p-5 pt-3">
        {connectedPlatforms.length === 0 || daily.length === 0 ? (
          <div className="h-[280px] flex flex-col items-center justify-center text-center">
            <BarChart3 className="w-10 h-10 text-muted-foreground/30 mb-2" />
            <p className="text-[13px] text-muted-foreground">
              {t('No data in the selected range.', 'لا توجد بيانات في الفترة المحددة.')}
            </p>
          </div>
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatAxisDate}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  fontSize={11}
                />
                <YAxis
                  stroke="currentColor"
                  className="text-muted-foreground"
                  fontSize={11}
                  tickFormatter={(v: number) => fmtNum(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelFormatter={formatAxisDate}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {activeChart === 'all' ? (
                  connectedPlatforms.map(pid => (
                    <Line
                      key={pid}
                      type="monotone"
                      dataKey={PLATFORM_META[pid].name}
                      stroke={PLATFORM_META[pid].color === '#ffffff' || PLATFORM_META[pid].color === '#000000'
                        ? '#043CC8'
                        : PLATFORM_META[pid].color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))
                ) : (
                  <>
                    <Line type="monotone" dataKey={t('Impressions', 'المشاهدات')} stroke="#579BFC" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey={t('Clicks', 'النقرات')} stroke="#FDAB3D" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey={t('Conversions', 'التحويلات')} stroke="#00C875" strokeWidth={2} dot={false} />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
