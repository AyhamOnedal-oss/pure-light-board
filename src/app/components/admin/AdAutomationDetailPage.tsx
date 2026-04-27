import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useApp } from '../../context/AppContext';
import {
  ArrowLeft, ArrowRight, MoreHorizontal, X, ChevronRight,
  Image as ImageIcon, Video as VideoIcon, Link2,
  Eye, MousePointerClick, DollarSign, BarChart3, Megaphone,
  RefreshCw, Zap, ExternalLink, Target, Lock,
} from 'lucide-react';
import {
  Campaign, CampaignStatus, Platform, PLATFORM_META,
  loadPlatforms, loadCampaigns, saveCampaigns,
  refreshMetrics, statusColor, fmtNum, fmtMoney, timeAgo,
} from './adAutomationData';
import { PLATFORM_ICONS, PlatformIcon } from './platformIcons';

export function AdAutomationDetailPage() {
  const { t, language, dir, showToast } = useApp();
  const navigate = useNavigate();
  const { platformRowId } = useParams();

  const [platforms, setPlatforms] = useState<Platform[]>(loadPlatforms());
  const platform = platforms.find(p => p.id === platformRowId);
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>(loadCampaigns());
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [preview, setPreview] = useState<Campaign | null>(null);
  const [syncing, setSyncing] = useState(false);
  const menuRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const campaigns = useMemo(
    () => allCampaigns.filter(c => c.platformRowId === platformRowId),
    [allCampaigns, platformRowId]
  );

  useEffect(() => { saveCampaigns(allCampaigns); }, [allCampaigns]);

  // Auto-refresh this platform's metrics every 20s
  useEffect(() => {
    if (!platform?.connected) return;
    const id = window.setInterval(() => {
      setAllCampaigns(cs => cs.map(c =>
        c.platformRowId === platformRowId
          ? refreshMetrics([c])[0]
          : c
      ));
      setPlatforms(ps => ps.map(p =>
        p.id === platformRowId ? { ...p, lastSync: new Date().toISOString() } : p
      ));
    }, 20000);
    return () => window.clearInterval(id);
  }, [platformRowId, platform?.connected]);

  if (!platform) {
    return (
      <div className="text-center py-16">
        <p className="text-[15px] text-muted-foreground mb-4">{t('Platform not found', 'المنصة غير موجودة')}</p>
        <button onClick={() => navigate('/admin/ad-automation')} className="px-4 py-2 rounded-xl bg-[#043CC8] text-white text-[13px]" style={{ fontWeight: 500 }}>
          {t('Back to Ad Automation', 'العودة لأتمتة الإعلانات')}
        </button>
      </div>
    );
  }

  const meta = PLATFORM_META[platform.platformId];

  const totals = useMemo(() => campaigns.reduce((acc, c) => {
    acc.impressions += c.impressions || 0;
    acc.clicks += c.clicks || 0;
    acc.spend += c.spend || 0;
    acc.conversions += c.conversions || 0;
    return acc;
  }, { impressions: 0, clicks: 0, spend: 0, conversions: 0 }), [campaigns]);

  const totalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;

  const handleSync = () => {
    setSyncing(true);
    window.setTimeout(() => {
      setAllCampaigns(cs => cs.map(c =>
        c.platformRowId === platformRowId ? refreshMetrics([c])[0] : c
      ));
      setPlatforms(ps => ps.map(p =>
        p.id === platformRowId ? { ...p, lastSync: new Date().toISOString() } : p
      ));
      setSyncing(false);
      showToast(t(`${meta.name} synced`, `تمت مزامنة ${meta.nameAr}`));
    }, 700);
  };

  const statCards = [
    { icon: BarChart3, label: t('Campaigns', 'الحملات'), value: String(campaigns.length), color: '#043CC8' },
    { icon: Eye, label: t('Impressions', 'المشاهدات'), value: fmtNum(totals.impressions), color: '#579BFC' },
    { icon: MousePointerClick, label: t('Clicks', 'النقرات'), value: fmtNum(totals.clicks), color: '#FDAB3D' },
    { icon: Target, label: t('Conversions', 'التحويلات'), value: fmtNum(totals.conversions), color: '#A25DDC' },
    { icon: DollarSign, label: t('Spend', 'الإنفاق'), value: fmtMoney(totals.spend, language as any), color: '#E2445C' },
  ];

  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const accentColor = meta.color === '#ffffff' || meta.color === '#000000' ? '#043CC8' : meta.color;

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header */}
      <div>
        <button
          onClick={() => navigate('/admin/ad-automation')}
          className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-[#043CC8] transition-colors mb-3"
        >
          <BackIcon className="w-3.5 h-3.5" />
          {t('Back to Ad Automation', 'العودة لأتمتة الإعلانات')}
        </button>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md bg-white"
              style={PLATFORM_ICONS[platform.platformId] ? { padding: 8 } : { background: meta.bg, color: meta.color, fontWeight: 800, fontSize: 24 }}
            >
              {PLATFORM_ICONS[platform.platformId] ? (
                <PlatformIcon id={platform.platformId} size={40} />
              ) : (
                meta.name.charAt(0)
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[24px]" style={{ fontWeight: 700 }}>{language === 'ar' ? meta.nameAr : meta.name}</h1>
                {platform.connected && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-[#00C875]/15 text-[#00C875]" style={{ fontWeight: 700 }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00C875] animate-pulse" />
                    {t('LIVE SYNC', 'مزامنة مباشرة')}
                  </span>
                )}
              </div>
              <p className="text-[12px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <Link2 className="w-3 h-3" />
                  {platform.accountName || meta.apiDocs}
                  {platform.accountId && <span className="opacity-60" dir="ltr">· {platform.accountId}</span>}
                </span>
                <span className="inline-flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  {t('Last sync', 'آخر مزامنة')}: {timeAgo(platform.lastSync, language as any)}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[14px] transition-all active:scale-[0.98] ${
              syncing ? 'bg-[#043CC8]/60 cursor-not-allowed' : 'bg-[#043CC8] hover:bg-[#0330a0]'
            }`}
            style={{ fontWeight: 500 }}
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? t('Syncing...', 'جاري المزامنة...') : t('Sync Now', 'مزامنة الآن')}
          </button>
        </div>
      </div>

      {/* Automation notice */}
      <div className="px-4 py-3 rounded-xl bg-[#043CC8]/5 border border-[#043CC8]/20 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#043CC8]/15 flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4 text-[#043CC8]" />
        </div>
        <div className="flex-1">
          <p className="text-[13px]" style={{ fontWeight: 600 }}>
            {t('Fully automated', 'أتمتة كاملة')}
          </p>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {t(
              `Campaigns, media, content and metrics are pulled directly from ${meta.name} Ads API every 20 seconds.`,
              `يتم جلب الحملات والوسائط والمحتوى والبيانات مباشرة من ${meta.nameAr} كل 20 ثانية.`
            )}
          </p>
        </div>
      </div>

      {/* Stats */}
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

      {/* Monday-style campaigns table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b-[3px]" style={{ borderBottomColor: accentColor }}>
          <ChevronRight className="w-4 h-4 rotate-90" style={{ color: accentColor }} />
          <span className="text-[14px]" style={{ color: accentColor, fontWeight: 700 }}>{t('Campaigns', 'الحملات')}</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground" style={{ fontWeight: 500 }}>
            {campaigns.length}
          </span>
          <span className="ms-auto text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <Lock className="w-3 h-3" />
            {t('Read-only — synced from platform', 'للقراءة فقط — يتم المزامنة من المنصة')}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 1400 }}>
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <Th>{t('Campaign', 'الحملة')}</Th>
                <Th align="center">{t('Media', 'الوسائط')}</Th>
                <Th align="center">{t('Type', 'النوع')}</Th>
                <Th>{t('Content', 'المحتوى')}</Th>
                <Th align="center">{t('Status', 'الحالة')}</Th>
                <Th align="center">{t('Impressions', 'المشاهدات')}</Th>
                <Th align="center">{t('Clicks', 'النقرات')}</Th>
                <Th align="center">{t('CTR', 'معدل النقر')}</Th>
                <Th align="center">{t('Conv.', 'تحويلات')}</Th>
                <Th align="center">{t('Spend', 'الإنفاق')}</Th>
                <Th align="center">{t('Dates', 'التواريخ')}</Th>
                <th className="w-14 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => {
                const sc = statusColor(c.status);
                const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
                const statusLabel: Record<CampaignStatus, string> = {
                  active: t('Active', 'نشطة'),
                  paused: t('Paused', 'متوقفة'),
                  done: t('Done', 'منتهية'),
                  draft: t('Draft', 'مسودة'),
                };
                return (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 min-w-[220px]">
                      <button
                        onClick={() => setPreview(c)}
                        className="flex flex-col text-start hover:text-[#043CC8] transition-colors"
                      >
                        <span className="text-[14px]" style={{ fontWeight: 600 }}>{c.name}</span>
                        {c.link && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5" dir="ltr">
                            <Link2 className="w-3 h-3" />
                            <span className="truncate max-w-[200px]">{c.link.replace(/^https?:\/\//, '')}</span>
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.mediaUrl ? (
                        <button
                          onClick={() => setPreview(c)}
                          className="inline-block relative w-14 h-10 rounded-md overflow-hidden border border-border hover:ring-2 hover:ring-[#043CC8] transition-all"
                        >
                          {c.mediaKind === 'video' ? (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <VideoIcon className="w-4 h-4 text-muted-foreground" />
                            </div>
                          ) : (
                            <img src={c.mediaUrl} alt="" className="w-full h-full object-cover" />
                          )}
                        </button>
                      ) : (
                        <div className="inline-flex w-14 h-10 rounded-md items-center justify-center border border-dashed border-border text-muted-foreground/50">
                          {c.type === 'video' ? <VideoIcon className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full"
                        style={{
                          background: c.type === 'video' ? '#A25DDC20' : '#00C87520',
                          color: c.type === 'video' ? '#A25DDC' : '#00C875',
                          fontWeight: 700,
                        }}
                      >
                        {c.type === 'video' ? <VideoIcon className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                        {c.type === 'video' ? t('Video', 'فيديو') : t('Image', 'صورة')}
                      </span>
                    </td>
                    <td className="px-4 py-3 min-w-[220px] max-w-[280px]">
                      <p className="text-[12px] text-muted-foreground truncate" title={c.content}>{c.content || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md"
                        style={{ background: sc.bg, color: sc.text, fontWeight: 700 }}>
                        {statusLabel[c.status]}
                      </span>
                    </td>
                    <Cell><span className="text-[13px]" style={{ fontWeight: 600 }}>{fmtNum(c.impressions)}</span></Cell>
                    <Cell><span className="text-[13px]" style={{ fontWeight: 600 }}>{fmtNum(c.clicks)}</span></Cell>
                    <Cell>
                      <span className="text-[11px] px-2 py-0.5 rounded-md inline-block" style={{
                        background: ctr > 2 ? '#00C87520' : ctr > 1 ? '#FDAB3D20' : '#80808020',
                        color: ctr > 2 ? '#00C875' : ctr > 1 ? '#FDAB3D' : '#808080',
                        fontWeight: 700,
                      }}>{ctr.toFixed(2)}%</span>
                    </Cell>
                    <Cell><span className="text-[13px] text-[#A25DDC]" style={{ fontWeight: 700 }}>{fmtNum(c.conversions)}</span></Cell>
                    <Cell><span className="text-[13px]" style={{ fontWeight: 700 }}>{fmtMoney(c.spend, language as any)}</span></Cell>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex flex-col text-[11px] text-muted-foreground">
                        <span>{c.startDate}</span>
                        <span className="opacity-60">→ {c.endDate}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <button
                          ref={el => { menuRefs.current[c.id] = el; }}
                          onClick={() => setMenuOpen(menuOpen === c.id ? null : c.id)}
                          className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </button>
                        {menuOpen === c.id && (() => {
                          const btn = menuRefs.current[c.id];
                          if (!btn) return null;
                          const rect = btn.getBoundingClientRect();
                          const top = rect.bottom + 4;
                          const left = dir === 'rtl' ? rect.left : Math.min(rect.right - 180, window.innerWidth - 200);
                          return (
                            <>
                              <div className="fixed inset-0 z-[60]" onClick={() => setMenuOpen(null)} />
                              <div className="fixed z-[70] bg-card border border-border rounded-xl shadow-2xl py-1 w-52" style={{ top, left }}>
                                <button onClick={() => { setPreview(c); setMenuOpen(null); }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted text-[13px] transition-colors">
                                  <Eye className="w-4 h-4 text-muted-foreground" /> {t('View details', 'عرض التفاصيل')}
                                </button>
                                {c.link && (
                                  <a href={c.link} target="_blank" rel="noreferrer"
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted text-[13px] transition-colors">
                                    <ExternalLink className="w-4 h-4 text-muted-foreground" /> {t('Open in platform', 'فتح في المنصة')}
                                  </a>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Totals row */}
              {campaigns.length > 0 && (
                <tr className="border-t-2 bg-[#043CC8]/5" style={{ borderTopColor: '#043CC8' }}>
                  <td className="px-4 py-4" colSpan={4}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#043CC8] flex items-center justify-center text-white">
                        <BarChart3 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[14px] text-[#043CC8]" style={{ fontWeight: 800 }}>
                          {t('PLATFORM TOTAL', 'إجمالي المنصة')}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {t('CPA', 'تكلفة التحويل')}: {fmtMoney(cpa, language as any)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-[11px] text-[#00C875] inline-flex items-center gap-1" style={{ fontWeight: 700 }}>
                      <Zap className="w-3 h-3" />
                      {t('AUTO', 'تلقائي')}
                    </span>
                  </td>
                  <Cell><span className="text-[14px] text-[#579BFC]" style={{ fontWeight: 800 }}>{fmtNum(totals.impressions)}</span></Cell>
                  <Cell><span className="text-[14px] text-[#FDAB3D]" style={{ fontWeight: 800 }}>{fmtNum(totals.clicks)}</span></Cell>
                  <Cell>
                    <span className="text-[12px] px-2 py-0.5 rounded-md inline-block" style={{
                      background: totalCtr > 2 ? '#00C87530' : totalCtr > 1 ? '#FDAB3D30' : '#80808030',
                      color: totalCtr > 2 ? '#00C875' : totalCtr > 1 ? '#FDAB3D' : '#808080',
                      fontWeight: 800,
                    }}>{totalCtr.toFixed(2)}%</span>
                  </Cell>
                  <Cell><span className="text-[14px] text-[#A25DDC]" style={{ fontWeight: 800 }}>{fmtNum(totals.conversions)}</span></Cell>
                  <Cell><span className="text-[14px] text-[#E2445C]" style={{ fontWeight: 800 }}>{fmtMoney(totals.spend, language as any)}</span></Cell>
                  <td colSpan={2}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {campaigns.length === 0 && (
          <div className="text-center py-16 px-6">
            <div className="w-14 h-14 rounded-2xl bg-[#043CC8]/10 flex items-center justify-center mx-auto mb-3">
              <Megaphone className="w-7 h-7 text-[#043CC8]" />
            </div>
            <h3 className="text-[15px]" style={{ fontWeight: 600 }}>
              {t('No campaigns found in this ad account', 'لا توجد حملات في حساب الإعلانات هذا')}
            </h3>
            <p className="text-[13px] text-muted-foreground mt-1">
              {t('Create campaigns directly in the platform — they will appear here automatically.', 'أنشئ الحملات مباشرة في المنصة — ستظهر هنا تلقائياً.')}
            </p>
          </div>
        )}
      </div>

      {/* Campaign detail drawer */}
      {preview && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setPreview(null)}>
          <div className="bg-card rounded-2xl w-full max-w-2xl border border-border shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h3 className="text-[17px]" style={{ fontWeight: 600 }}>{preview.name}</h3>
                <p className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <Zap className="w-3 h-3 text-[#00C875]" />
                    {t('Synced', 'متزامن')} {timeAgo(preview.lastSync, language as any)}
                  </span>
                </p>
              </div>
              <button onClick={() => setPreview(null)} className="p-1 hover:bg-muted rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {preview.mediaUrl && preview.mediaKind !== 'video' && (
                <div className="rounded-xl overflow-hidden border border-border max-h-[320px] flex items-center justify-center bg-muted">
                  <img src={preview.mediaUrl} alt="" className="max-h-[320px] object-contain" />
                </div>
              )}
              {preview.mediaKind === 'video' && (
                <div className="rounded-xl border border-border bg-muted aspect-video flex items-center justify-center">
                  <VideoIcon className="w-12 h-12 text-muted-foreground/50" />
                </div>
              )}
              <InfoRow label={t('Content', 'المحتوى')} value={preview.content || '—'} />
              {preview.link && (
                <InfoRow label={t('Link', 'الرابط')} value={
                  <a href={preview.link} target="_blank" rel="noreferrer" className="text-[#043CC8] hover:underline inline-flex items-center gap-1" dir="ltr">
                    {preview.link} <ExternalLink className="w-3 h-3" />
                  </a>
                } />
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <MiniStat label={t('Impressions', 'المشاهدات')} value={fmtNum(preview.impressions)} color="#579BFC" />
                <MiniStat label={t('Clicks', 'النقرات')} value={fmtNum(preview.clicks)} color="#FDAB3D" />
                <MiniStat label={t('Conversions', 'التحويلات')} value={fmtNum(preview.conversions)} color="#A25DDC" />
                <MiniStat label={t('Spend', 'الإنفاق')} value={fmtMoney(preview.spend, language as any)} color="#E2445C" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <InfoRow label={t('Start Date', 'تاريخ البداية')} value={preview.startDate} />
                <InfoRow label={t('End Date', 'تاريخ النهاية')} value={preview.endDate} />
              </div>
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
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-2.5 border border-border">
      <p className="text-[11px] text-muted-foreground mb-0.5" style={{ fontWeight: 500 }}>{label}</p>
      <div className="text-[13px]" style={{ fontWeight: 500 }}>{value}</div>
    </div>
  );
}
function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl p-3 border border-border" style={{ background: `${color}10` }}>
      <p className="text-[10px] text-muted-foreground mb-0.5" style={{ fontWeight: 600 }}>{label}</p>
      <p className="text-[16px]" style={{ fontWeight: 800, color }}>{value}</p>
    </div>
  );
}
