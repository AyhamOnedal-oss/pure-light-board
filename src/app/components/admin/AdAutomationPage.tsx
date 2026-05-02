import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../../context/AppContext';
import {
  Megaphone, Plus, MoreHorizontal, Trash2, X, ChevronRight, Search,
  MousePointerClick, Eye, DollarSign, BarChart3, Check, Zap, RefreshCw,
  Link2, AlertCircle,
} from 'lucide-react';
import {
  Platform, PlatformId, PLATFORM_META, PLATFORM_CRED_FIELDS, Campaign,
  loadPlatforms, savePlatforms, loadCampaigns, saveCampaigns,
  syncPlatformCampaigns, refreshMetrics, timeAgo,
  fmtNum, fmtMoney,
} from './adAutomationData';
import { fetchAdPlatforms, fetchAdCampaigns } from '../../services/adminAdAutomation';
import { Eye as EyeIcon, EyeOff } from 'lucide-react';
import { AdAutomationAnalytics } from './AdAutomationAnalytics';
import { PLATFORM_ICONS, PlatformIcon } from './platformIcons';

function PlatformBadge({ id, size = 32 }: { id: PlatformId; size?: number }) {
  const meta = PLATFORM_META[id];
  if (PLATFORM_ICONS[id]) {
    return (
      <div
        className="rounded-lg flex items-center justify-center shrink-0 bg-white"
        style={{ width: size, height: size, padding: size * 0.12 }}
      >
        <PlatformIcon id={id} size={size * 0.78} />
      </div>
    );
  }
  return (
    <div
      className="rounded-lg flex items-center justify-center shrink-0 shadow-sm"
      style={{ width: size, height: size, background: meta.bg, color: meta.color, fontWeight: 800, fontSize: size * 0.45 }}
    >
      {meta.name.charAt(0)}
    </div>
  );
}

export function AdAutomationPage() {
  const { t, language, dir, showToast } = useApp();
  const navigate = useNavigate();
  const [platforms, setPlatforms] = useState<Platform[]>(loadPlatforms());
  const [campaigns, setCampaigns] = useState<Campaign[]>(loadCampaigns());

  // Hydrate from Supabase on mount; falls back to localStorage cache when DB
  // returns no rows (so mock-driven flows keep working).
  useEffect(() => {
    let alive = true;
    (async () => {
      const [dbPlatforms, dbCampaigns] = await Promise.all([
        fetchAdPlatforms(),
        fetchAdCampaigns(),
      ]);
      if (!alive) return;
      if (dbPlatforms && dbPlatforms.length > 0) setPlatforms(dbPlatforms);
      if (dbCampaigns && dbCampaigns.length > 0) setCampaigns(dbCampaigns);
    })();
    return () => { alive = false; };
  }, []);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addSelection, setAddSelection] = useState<PlatformId | null>(null);
  const [addStep, setAddStep] = useState<'pick' | 'creds'>('pick');
  const [credForm, setCredForm] = useState<Record<string, string>>({});
  const [credErrors, setCredErrors] = useState<Record<string, string>>({});
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [connecting, setConnecting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [syncing, setSyncing] = useState(false);
  const menuRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => { savePlatforms(platforms); }, [platforms]);
  useEffect(() => { saveCampaigns(campaigns); }, [campaigns]);

  // Auto-sync every 30s — simulates background platform API polling
  useEffect(() => {
    const id = window.setInterval(() => {
      setCampaigns(cs => refreshMetrics(cs));
      setPlatforms(ps => ps.map(p => p.connected ? { ...p, lastSync: new Date().toISOString() } : p));
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  const availablePlatforms: PlatformId[] = useMemo(() => {
    const used = new Set(platforms.map(p => p.platformId));
    return (['tiktok','snapchat','instagram','facebook','google'] as PlatformId[]).filter(id => !used.has(id));
  }, [platforms]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return platforms
      .filter(p => {
        if (!q) return true;
        const meta = PLATFORM_META[p.platformId];
        return meta.name.toLowerCase().includes(q) || meta.nameAr.includes(q);
      })
      .map(p => {
        const cs = campaigns.filter(c => c.platformRowId === p.id);
        const active = cs.filter(c => c.status === 'active').length;
        const impressions = cs.reduce((s, c) => s + (c.impressions || 0), 0);
        const clicks = cs.reduce((s, c) => s + (c.clicks || 0), 0);
        const spend = cs.reduce((s, c) => s + (c.spend || 0), 0);
        const conversions = cs.reduce((s, c) => s + (c.conversions || 0), 0);
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        return { platform: p, count: cs.length, active, impressions, clicks, spend, conversions, ctr };
      });
  }, [platforms, campaigns, query]);

  const totals = useMemo(() => {
    return rows.reduce((acc, r) => {
      acc.count += r.count;
      acc.active += r.active;
      acc.impressions += r.impressions;
      acc.clicks += r.clicks;
      acc.spend += r.spend;
      acc.conversions += r.conversions;
      return acc;
    }, { count: 0, active: 0, impressions: 0, clicks: 0, spend: 0, conversions: 0 });
  }, [rows]);
  const totalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

  const toggleSel = (id: string) => {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleSelAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map(r => r.platform.id)));
  };

  const resetAddFlow = () => {
    setShowAdd(false);
    setAddSelection(null);
    setAddStep('pick');
    setCredForm({});
    setCredErrors({});
    setShowSecret({});
  };

  const goToCredsStep = () => {
    if (!addSelection) return;
    setCredForm({});
    setCredErrors({});
    setAddStep('creds');
  };

  const validateCreds = (): boolean => {
    if (!addSelection) return false;
    const fields = PLATFORM_CRED_FIELDS[addSelection];
    const errs: Record<string, string> = {};
    for (const f of fields) {
      if (f.required && !credForm[f.key]?.trim()) {
        errs[f.key] = t('Required', 'مطلوب');
      }
    }
    setCredErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleConnect = () => {
    if (!addSelection) return;
    if (!validateCreds()) return;
    setConnecting(true);
    // Simulated token verification — replace with real API ping in production
    window.setTimeout(() => {
      const meta = PLATFORM_META[addSelection];
      const newPlatform: Platform = {
        id: Date.now().toString(),
        platformId: addSelection,
        addedAt: new Date().toISOString(),
        connected: true,
        accountId: credForm.accountId,
        accountName: credForm.accountName?.trim() || `${meta.name} Ad Account`,
        accessToken: credForm.accessToken,
        developerToken: credForm.developerToken,
        refreshToken: credForm.refreshToken,
        lastSync: new Date().toISOString(),
      };
      const fetched = syncPlatformCampaigns(newPlatform);
      setPlatforms(ps => [...ps, newPlatform]);
      setCampaigns(cs => [...cs, ...fetched]);
      setConnecting(false);
      resetAddFlow();
      showToast(t(
        `${meta.name} connected · ${fetched.length} campaigns imported`,
        `تم ربط ${meta.nameAr} · تم جلب ${fetched.length} حملة`
      ));
    }, 900);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    setPlatforms(ps => ps.filter(p => p.id !== deleteId));
    setCampaigns(cs => cs.filter(c => c.platformRowId !== deleteId));
    setDeleteId(null);
    showToast(t('Platform disconnected', 'تم فصل المنصة'));
  };

  const bulkDelete = () => {
    if (selected.size === 0) return;
    setPlatforms(ps => ps.filter(p => !selected.has(p.id)));
    setCampaigns(cs => cs.filter(c => !selected.has(c.platformRowId)));
    showToast(t(`${selected.size} disconnected`, `تم فصل ${selected.size}`));
    setSelected(new Set());
  };

  const handleSyncAll = () => {
    setSyncing(true);
    window.setTimeout(() => {
      setCampaigns(cs => refreshMetrics(cs));
      setPlatforms(ps => ps.map(p => p.connected ? { ...p, lastSync: new Date().toISOString() } : p));
      setSyncing(false);
      showToast(t('All platforms synced', 'تمت مزامنة جميع المنصات'));
    }, 700);
  };

  const statCards = [
    { icon: Megaphone, label: t('Platforms', 'المنصات'), value: String(rows.length), color: '#043CC8' },
    { icon: BarChart3, label: t('Campaigns', 'الحملات'), value: String(totals.count), color: '#00C875' },
    { icon: Eye, label: t('Impressions', 'المشاهدات'), value: fmtNum(totals.impressions), color: '#579BFC' },
    { icon: MousePointerClick, label: t('Clicks', 'النقرات'), value: fmtNum(totals.clicks), color: '#FDAB3D' },
    { icon: DollarSign, label: t('Total Spend', 'إجمالي الإنفاق'), value: fmtMoney(totals.spend, language as any), color: '#E2445C' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground mb-1.5">
            <Megaphone className="w-3.5 h-3.5" />
            <span>{t('Admin', 'الأدمن')}</span>
            <ChevronRight className={`w-3 h-3 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
            <span>{t('Ad Automation', 'أتمتة الإعلانات')}</span>
          </div>
          <h1 className="text-[24px] flex items-center gap-2" style={{ fontWeight: 700 }}>
            {t('Ad Automation', 'أتمتة الإعلانات')}
            <span className="text-[10px] px-2 py-1 rounded-full bg-[#00C875]/15 text-[#00C875] inline-flex items-center gap-1" style={{ fontWeight: 700 }}>
              <Zap className="w-3 h-3" />
              {t('AUTO-SYNC', 'مزامنة تلقائية')}
            </span>
          </h1>
          <p className="text-muted-foreground text-[14px] mt-1">
            {t('Data is fetched automatically from each platform — no manual entry needed.', 'يتم جلب البيانات تلقائياً من كل منصة — لا حاجة لإدخال يدوي.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncAll}
            disabled={syncing || platforms.length === 0}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[14px] transition-all ${
              syncing || platforms.length === 0
                ? 'border-border text-muted-foreground/50 cursor-not-allowed'
                : 'border-border hover:bg-muted'
            }`}
            style={{ fontWeight: 500 }}
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {t('Sync Now', 'مزامنة الآن')}
          </button>
          <button
            onClick={() => { setShowAdd(true); setAddSelection(null); }}
            disabled={availablePlatforms.length === 0}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[14px] transition-all active:scale-[0.98] ${
              availablePlatforms.length === 0 ? 'bg-[#043CC8]/40 cursor-not-allowed' : 'bg-[#043CC8] hover:bg-[#0330a0]'
            }`}
            style={{ fontWeight: 500 }}
          >
            <Plus className="w-4 h-4" /> {t('Connect Platform', 'ربط منصة')}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${s.color}20`, color: s.color }}>
                <s.icon className="w-4 h-4" />
              </div>
              <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>{s.label}</span>
            </div>
            <p className="text-[20px]" style={{ fontWeight: 700 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('Search platforms...', 'بحث في المنصات...')}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-input-background border border-border text-[14px] outline-none focus:border-[#043CC8] focus:ring-2 focus:ring-[#043CC8]/20 transition-all"
          />
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#043CC8]/10 border border-[#043CC8]/30">
            <span className="text-[13px] text-[#043CC8]" style={{ fontWeight: 600 }}>
              {selected.size} {t('selected', 'محدد')}
            </span>
            <button onClick={bulkDelete} className="text-[12px] px-2.5 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors" style={{ fontWeight: 600 }}>
              {t('Disconnect', 'فصل')}
            </button>
          </div>
        )}
      </div>

      {/* Analytics & reports — date filter, charts, Excel export */}
      <AdAutomationAnalytics platforms={platforms} campaigns={campaigns} />

      {/* Monday-style table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b-[3px]" style={{ borderBottomColor: '#043CC8' }}>
          <ChevronRight className={`w-4 h-4 text-[#043CC8] rotate-90`} />
          <span className="text-[14px]" style={{ color: '#043CC8', fontWeight: 700 }}>
            {t('Connected Platforms', 'المنصات المتصلة')}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground" style={{ fontWeight: 500 }}>
            {rows.length} {t('items', 'عنصر')}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 1200 }}>
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selected.size === rows.length}
                    onChange={toggleSelAll}
                    className="w-4 h-4 accent-[#043CC8] cursor-pointer"
                  />
                </th>
                <Th>{t('Platform', 'المنصة')}</Th>
                <Th align="center">{t('Campaigns', 'الحملات')}</Th>
                <Th align="center">{t('Active', 'نشطة')}</Th>
                <Th align="center">{t('Impressions', 'المشاهدات')}</Th>
                <Th align="center">{t('Clicks', 'النقرات')}</Th>
                <Th align="center">{t('CTR', 'معدل النقر')}</Th>
                <Th align="center">{t('Spend', 'الإنفاق')}</Th>
                <Th align="center">{t('Last Sync', 'آخر مزامنة')}</Th>
                <th className="w-14 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const meta = PLATFORM_META[r.platform.platformId];
                const isSel = selected.has(r.platform.id);
                return (
                  <tr
                    key={r.platform.id}
                    className={`border-b border-border last:border-0 transition-colors group ${
                      isSel ? 'bg-[#043CC8]/5' : 'hover:bg-muted/40'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={isSel} onChange={() => toggleSel(r.platform.id)} className="w-4 h-4 accent-[#043CC8] cursor-pointer" />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/admin/ad-automation/${r.platform.id}`)}
                        className="flex items-center gap-3 hover:text-[#043CC8] transition-colors"
                      >
                        <PlatformBadge id={r.platform.platformId} />
                        <div className="text-start">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[14px]" style={{ fontWeight: 600 }}>
                              {language === 'ar' ? meta.nameAr : meta.name}
                            </p>
                            {r.platform.connected && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md bg-[#00C875]/15 text-[#00C875]" style={{ fontWeight: 700 }}>
                                <span className="w-1.5 h-1.5 rounded-full bg-[#00C875] animate-pulse" />
                                {t('LIVE', 'مباشر')}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Link2 className="w-2.5 h-2.5" />
                            {r.platform.accountName || meta.apiDocs}
                          </p>
                        </div>
                      </button>
                    </td>
                    <Cell><CountPill value={r.count} color="#043CC8" /></Cell>
                    <Cell><CountPill value={r.active} color={r.active > 0 ? '#00C875' : '#808080'} /></Cell>
                    <Cell><span className="text-[13px]" style={{ fontWeight: 600 }}>{fmtNum(r.impressions)}</span></Cell>
                    <Cell><span className="text-[13px]" style={{ fontWeight: 600 }}>{fmtNum(r.clicks)}</span></Cell>
                    <Cell>
                      <span className="text-[12px] px-2 py-0.5 rounded-md inline-block" style={{
                        background: r.ctr > 2 ? '#00C87520' : r.ctr > 1 ? '#FDAB3D20' : '#80808020',
                        color: r.ctr > 2 ? '#00C875' : r.ctr > 1 ? '#FDAB3D' : '#808080',
                        fontWeight: 700,
                      }}>
                        {r.ctr.toFixed(2)}%
                      </span>
                    </Cell>
                    <Cell><span className="text-[13px]" style={{ fontWeight: 700 }}>{fmtMoney(r.spend, language as any)}</span></Cell>
                    <Cell>
                      <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" />
                        {timeAgo(r.platform.lastSync, language as any)}
                      </span>
                    </Cell>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <button
                          ref={el => { menuRefs.current[r.platform.id] = el; }}
                          onClick={() => setMenuOpen(menuOpen === r.platform.id ? null : r.platform.id)}
                          className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </button>
                        {menuOpen === r.platform.id && (() => {
                          const btn = menuRefs.current[r.platform.id];
                          if (!btn) return null;
                          const rect = btn.getBoundingClientRect();
                          const top = rect.bottom + 4;
                          const left = dir === 'rtl' ? rect.left : Math.min(rect.right - 180, window.innerWidth - 200);
                          return (
                            <>
                              <div className="fixed inset-0 z-[60]" onClick={() => setMenuOpen(null)} />
                              <div className="fixed z-[70] bg-card border border-border rounded-xl shadow-2xl py-1 w-44" style={{ top, left }}>
                                <button onClick={() => { navigate(`/admin/ad-automation/${r.platform.id}`); setMenuOpen(null); }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted text-[13px] transition-colors">
                                  <BarChart3 className="w-4 h-4 text-muted-foreground" /> {t('View campaigns', 'عرض الحملات')}
                                </button>
                                <div className="my-1 border-t border-border" />
                                <button onClick={() => { setDeleteId(r.platform.id); setMenuOpen(null); }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-red-500/10 text-red-400 text-[13px] transition-colors">
                                  <Trash2 className="w-4 h-4" /> {t('Disconnect', 'فصل')}
                                </button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Totals row — grand totals across all platforms */}
              {rows.length > 0 && (
                <tr className="border-t-2 border-[#043CC8] bg-[#043CC8]/5">
                  <td className="px-4 py-4"></td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#043CC8] flex items-center justify-center text-white">
                        <BarChart3 className="w-4 h-4" />
                      </div>
                      <span className="text-[14px] text-[#043CC8]" style={{ fontWeight: 800 }}>
                        {t('GRAND TOTAL', 'الإجمالي')}
                      </span>
                    </div>
                  </td>
                  <Cell><span className="text-[14px] text-[#043CC8]" style={{ fontWeight: 800 }}>{totals.count}</span></Cell>
                  <Cell><span className="text-[14px] text-[#00C875]" style={{ fontWeight: 800 }}>{totals.active}</span></Cell>
                  <Cell><span className="text-[14px] text-[#579BFC]" style={{ fontWeight: 800 }}>{fmtNum(totals.impressions)}</span></Cell>
                  <Cell><span className="text-[14px] text-[#FDAB3D]" style={{ fontWeight: 800 }}>{fmtNum(totals.clicks)}</span></Cell>
                  <Cell>
                    <span className="text-[12px] px-2 py-0.5 rounded-md inline-block" style={{
                      background: totalCtr > 2 ? '#00C87530' : totalCtr > 1 ? '#FDAB3D30' : '#80808030',
                      color: totalCtr > 2 ? '#00C875' : totalCtr > 1 ? '#FDAB3D' : '#808080',
                      fontWeight: 800,
                    }}>
                      {totalCtr.toFixed(2)}%
                    </span>
                  </Cell>
                  <Cell><span className="text-[14px] text-[#E2445C]" style={{ fontWeight: 800 }}>{fmtMoney(totals.spend, language as any)}</span></Cell>
                  <Cell>
                    <span className="text-[11px] text-[#00C875] inline-flex items-center gap-1" style={{ fontWeight: 700 }}>
                      <Zap className="w-3 h-3" />
                      {t('Auto', 'تلقائي')}
                    </span>
                  </Cell>
                  <td></td>
                </tr>
              )}

              {/* + Add row */}
              <tr>
                <td colSpan={10} className="px-4 py-3">
                  <button
                    onClick={() => { setShowAdd(true); setAddSelection(null); }}
                    disabled={availablePlatforms.length === 0}
                    className={`flex items-center gap-2 text-[13px] transition-colors ${
                      availablePlatforms.length === 0
                        ? 'text-muted-foreground/40 cursor-not-allowed'
                        : 'text-muted-foreground hover:text-[#043CC8] cursor-pointer'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    <span style={{ fontWeight: 500 }}>{t('+ Connect Platform', '+ ربط منصة')}</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <div className="text-center py-16 px-6">
            <div className="w-14 h-14 rounded-2xl bg-[#043CC8]/10 flex items-center justify-center mx-auto mb-3">
              <Zap className="w-7 h-7 text-[#043CC8]" />
            </div>
            <h3 className="text-[15px]" style={{ fontWeight: 600 }}>
              {t('Connect your first ad platform', 'اربط أول منصة إعلانية')}
            </h3>
            <p className="text-[13px] text-muted-foreground mt-1 max-w-md mx-auto">
              {t('Once connected, campaigns and metrics are pulled automatically from the platform\'s API.', 'بمجرد الربط، يتم جلب الحملات وبياناتها تلقائياً من API المنصة.')}
            </p>
          </div>
        )}
      </div>

      {/* Connect Platform Modal — 2-step flow */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => !connecting && resetAddFlow()}>
          <div className="bg-card rounded-2xl w-full max-w-lg border border-border shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                {addStep === 'creds' && addSelection && !connecting && (
                  <button
                    onClick={() => setAddStep('pick')}
                    className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                    title={t('Back', 'رجوع')}
                  >
                    {dir === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronRight className="w-4 h-4 rotate-180" />}
                  </button>
                )}
                <div>
                  <h3 className="text-[17px]" style={{ fontWeight: 600 }}>
                    {addStep === 'pick'
                      ? t('Connect Ad Platform', 'ربط منصة إعلانية')
                      : t('Enter Account Credentials', 'أدخل بيانات الحساب')}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`w-6 h-1 rounded-full ${addStep === 'pick' ? 'bg-[#043CC8]' : 'bg-[#00C875]'}`} />
                    <span className={`w-6 h-1 rounded-full ${addStep === 'creds' ? 'bg-[#043CC8]' : 'bg-border'}`} />
                    <span className="text-[10px] text-muted-foreground ms-1">
                      {t(`Step ${addStep === 'pick' ? 1 : 2} of 2`, `الخطوة ${addStep === 'pick' ? 1 : 2} من 2`)}
                    </span>
                  </div>
                </div>
              </div>
              {!connecting && (
                <button onClick={resetAddFlow} className="p-1 hover:bg-muted rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {addStep === 'pick' ? (
                <>
                  <div className="mb-4 px-3 py-2.5 rounded-xl bg-[#043CC8]/10 border border-[#043CC8]/20 flex items-start gap-2">
                    <Zap className="w-4 h-4 text-[#043CC8] mt-0.5 shrink-0" />
                    <p className="text-[12px] text-[#043CC8]" style={{ fontWeight: 500 }}>
                      {t('Select the platform you want to connect your ad account to.', 'اختر المنصة التي تريد ربط حسابك الإعلاني بها.')}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {availablePlatforms.length === 0 && (
                      <div className="col-span-2 text-center py-8 text-[13px] text-muted-foreground">
                        {t('All platforms already connected', 'تم ربط جميع المنصات')}
                      </div>
                    )}
                    {availablePlatforms.map(id => {
                      const meta = PLATFORM_META[id];
                      const isSel = addSelection === id;
                      return (
                        <button
                          key={id}
                          onClick={() => setAddSelection(id)}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-start ${
                            isSel ? 'border-[#043CC8] bg-[#043CC8]/5' : 'border-border hover:border-[#043CC8]/40 hover:bg-muted/40'
                          }`}
                        >
                          <PlatformBadge id={id} size={40} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px]" style={{ fontWeight: 600 }}>
                              {language === 'ar' ? meta.nameAr : meta.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">{meta.apiDocs}</p>
                          </div>
                          {isSel && (
                            <div className="w-5 h-5 rounded-full bg-[#043CC8] flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* Credentials step */
                addSelection && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                      <PlatformBadge id={addSelection} size={40} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px]" style={{ fontWeight: 600 }}>
                          {language === 'ar' ? PLATFORM_META[addSelection].nameAr : PLATFORM_META[addSelection].name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{PLATFORM_META[addSelection].apiDocs}</p>
                      </div>
                    </div>

                    <div className="px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <div className="text-[11px] text-amber-600 dark:text-amber-400" style={{ fontWeight: 500 }}>
                        <p>{t('Credentials are used only to fetch your ad data.', 'تُستخدم البيانات فقط لجلب بيانات إعلاناتك.')}</p>
                        <p className="opacity-80 mt-0.5">{t('In production, tokens are stored encrypted on the server.', 'في النسخة النهائية، تُخزَّن الرموز مشفرة على الخادم.')}</p>
                      </div>
                    </div>

                    {PLATFORM_CRED_FIELDS[addSelection].map(field => {
                      const isSecret = !!field.secret;
                      const visible = !isSecret || showSecret[field.key];
                      const err = credErrors[field.key];
                      return (
                        <div key={field.key}>
                          <label className="text-[12px] text-muted-foreground mb-1.5 flex items-center gap-1.5" style={{ fontWeight: 500 }}>
                            {language === 'ar' ? field.labelAr : field.label}
                            {field.required && <span className="text-red-500">*</span>}
                          </label>
                          <div className={`flex items-center rounded-xl bg-input-background border transition-all focus-within:ring-2 ${
                            err ? 'border-red-500 focus-within:ring-red-500/20' : 'border-border focus-within:border-[#043CC8] focus-within:ring-[#043CC8]/20'
                          }`}>
                            <input
                              type={visible ? 'text' : 'password'}
                              value={credForm[field.key] || ''}
                              onChange={e => setCredForm(f => ({ ...f, [field.key]: e.target.value }))}
                              placeholder={field.placeholder}
                              dir="ltr"
                              className="flex-1 px-4 py-3 bg-transparent text-[13px] outline-none font-mono"
                            />
                            {isSecret && (
                              <button
                                type="button"
                                onClick={() => setShowSecret(s => ({ ...s, [field.key]: !s[field.key] }))}
                                className="px-3 text-muted-foreground hover:text-foreground transition-colors"
                                title={visible ? t('Hide', 'إخفاء') : t('Show', 'إظهار')}
                              >
                                {visible ? <EyeOff className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                              </button>
                            )}
                          </div>
                          {(field.help || field.helpAr) && (
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {language === 'ar' ? field.helpAr : field.help}
                            </p>
                          )}
                          {err && <p className="text-red-400 text-[11px] mt-1">{err}</p>}
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>

            {/* Footer actions */}
            <div className="flex gap-3 p-5 border-t border-border">
              <button
                onClick={resetAddFlow}
                disabled={connecting}
                className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-[14px] transition-colors disabled:opacity-50"
                style={{ fontWeight: 500 }}
              >
                {t('Cancel', 'إلغاء')}
              </button>
              {addStep === 'pick' ? (
                <button
                  onClick={goToCredsStep}
                  disabled={!addSelection}
                  className={`flex-1 py-2.5 rounded-xl text-white text-[14px] transition-colors inline-flex items-center justify-center gap-2 ${
                    addSelection ? 'bg-[#043CC8] hover:bg-[#0330a0]' : 'bg-[#043CC8]/40 cursor-not-allowed'
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  {t('Next', 'التالي')}
                  {dir === 'rtl' ? <ChevronRight className="w-4 h-4 rotate-180" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className={`flex-1 py-2.5 rounded-xl text-white text-[14px] transition-colors inline-flex items-center justify-center gap-2 ${
                    connecting ? 'bg-[#043CC8]/60 cursor-not-allowed' : 'bg-[#043CC8] hover:bg-[#0330a0]'
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  {connecting ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> {t('Verifying...', 'جاري التحقق...')}</>
                  ) : (
                    <><Zap className="w-4 h-4" /> {t('Connect & Sync', 'ربط ومزامنة')}</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-md border border-border shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-[17px] mb-2" style={{ fontWeight: 600 }}>{t('Disconnect Platform?', 'فصل المنصة؟')}</h3>
            <p className="text-[14px] text-muted-foreground">
              {t('All imported campaigns under this platform will be removed. You can reconnect anytime.', 'سيتم حذف جميع الحملات المستوردة من هذه المنصة. يمكنك إعادة الربط في أي وقت.')}
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-[14px] transition-colors" style={{ fontWeight: 500 }}>
                {t('Cancel', 'إلغاء')}
              </button>
              <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 text-[14px] transition-colors" style={{ fontWeight: 500 }}>
                {t('Disconnect', 'فصل')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children, align = 'start' }: { children: React.ReactNode; align?: 'start' | 'center' | 'end' }) {
  const cls = align === 'center' ? 'text-center' : align === 'end' ? 'text-end' : 'text-start';
  return <th className={`${cls} px-4 py-3 text-[12px] text-muted-foreground uppercase tracking-wider`} style={{ fontWeight: 600 }}>{children}</th>;
}
function Cell({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 text-center">{children}</td>;
}
function CountPill({ value, color }: { value: number; color: string }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[32px] h-6 px-2 rounded-md text-[12px]"
      style={{ background: `${color}20`, color, fontWeight: 700 }}>
      {value}
    </span>
  );
}
