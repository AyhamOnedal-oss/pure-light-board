import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../../context/AppContext';
import {
  Users, MoreHorizontal, Trash2, X, ChevronRight, Search, Check, CheckCheck, Dot,
  Eye, Mail, Phone, AlertCircle, UserPlus, Filter, Sparkles, BellRing, StickyNote,
  Settings as SettingsIcon, UserCheck, Ban, XCircle,
} from 'lucide-react';
import {
  PipelineCustomer, LeadStatus, LeadSource, TeamMember, AssignmentMode, PipelineSettings,
  STATUS_META, SOURCE_META,
  loadCustomers, saveCustomers,
  reconcileCustomers, fmtDate, daysRemaining,
  appendJourney, hasNotes,
  loadMembers, saveMembers, loadSettings, saveSettings, getCurrentUserId, setCurrentUserId,
  pickRoundRobinMember,
  isNewFor, hasUnseenNotesFor, hasUnseenTerminalFor, markSeenBy,
  hasAnyUnseenFor, markUnreadBy, isForcedUnreadFor,
} from './pipelineData';
import { PlatformIcon, PLATFORM_ICONS } from './platformIcons';

const ALL_STATUSES: LeadStatus[] = [
  'new_lead', 'contacted', 'not_interested',
  'trial', 'trial_expired',
  'subscribed', 'subscription_expired',
  'cancelled',
];
const ALL_SOURCES: LeadSource[] = ['tiktok','facebook','instagram','snapchat','google','zid','salla','manual'];

export function AdminPipelinePage() {
  const { t, language, dir, showToast } = useApp();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<PipelineCustomer[]>(() => reconcileCustomers(loadCustomers()));
  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'all'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [statusMenuFor, setStatusMenuFor] = useState<string | null>(null);
  const [sourceMenuFor, setSourceMenuFor] = useState<string | null>(null);
  const [rowMenuFor, setRowMenuFor] = useState<string | null>(null);

  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [assignMenuFor, setAssignMenuFor] = useState<string | null>(null);

  const [members, setMembers] = useState<TeamMember[]>(() => loadMembers());
  const [settings, setSettings] = useState<PipelineSettings>(() => loadSettings());
  const [currentUserId, setCurrentUserIdState] = useState<string>(() => getCurrentUserId());
  const currentUser = useMemo(() => members.find(m => m.id === currentUserId) || members[0], [members, currentUserId]);
  const isAdminUser = currentUser?.role === 'admin';

  useEffect(() => { saveMembers(members); }, [members]);
  useEffect(() => { saveSettings(settings); }, [settings]);

  const menuRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => { saveCustomers(customers); }, [customers]);

  // Lock background scroll while Add Customer modal is open
  useEffect(() => {
    if (showAddCustomer || deleteId) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [showAddCustomer, deleteId]);
  useEffect(() => {
    const id = window.setInterval(() => setCustomers(cs => reconcileCustomers(cs)), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const visibleToUser = useMemo(() => {
    if (isAdminUser) return customers;
    // Non-admin members only see customers assigned to them.
    // In self_claim mode they can additionally see unassigned customers (to pick up).
    return customers.filter(c => {
      const assigned = c.assignedMemberIds || [];
      if (assigned.includes(currentUserId)) return true;
      if (settings.assignmentMode === 'self_claim' && assigned.length === 0) return true;
      return false;
    });
  }, [customers, isAdminUser, currentUserId, settings.assignmentMode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visibleToUser.filter(c => {
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(q)
      );
    });
  }, [visibleToUser, query, filterStatus]);

  const expiredNeedingFollowup = useMemo(() => customers.filter(c =>
    (c.status === 'trial_expired' && !c.trialExpiredAcknowledged) ||
    (c.status === 'subscription_expired' && !c.subscriptionExpiredAcknowledged)
  ), [customers]);

  const statsByStatus = useMemo(() => {
    const src = visibleToUser;
    const out: Record<LeadStatus | 'total', number> = {
      total: src.length,
      new_lead: 0, contacted: 0, not_interested: 0,
      trial: 0, trial_expired: 0,
      subscribed: 0, subscription_expired: 0,
      cancelled: 0,
    };
    src.forEach(c => { out[c.status] = (out[c.status] || 0) + 1; });
    return out;
  }, [visibleToUser]);
  const newLeadCount = statsByStatus.new_lead;

  const headerCounts = useMemo(() => {
    let newCount = 0, notesCount = 0, trialExpiredCount = 0;
    for (const c of visibleToUser) {
      if (isNewFor(c, currentUserId)) newCount++;
      if (hasUnseenNotesFor(c, currentUserId)) notesCount++;
      if (hasUnseenTerminalFor(c, currentUserId) === 'trial_expired') trialExpiredCount++;
    }
    return { newCount, notesCount, trialExpiredCount };
  }, [visibleToUser, currentUserId]);

  // ---------- Handlers ----------
  const changeStatus = (id: string, status: LeadStatus) => {
    setCustomers(cs => cs.map(c => c.id === id ? appendJourney(c, status) : c));
  };
  const updateCustomer = (id: string, patch: Partial<PipelineCustomer>) => {
    setCustomers(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c));
  };
  const removeCustomer = (id: string) => {
    setCustomers(cs => cs.filter(c => c.id !== id));
    setDeleteId(null);
    showToast(t('Customer removed', 'تم حذف العميل'));
  };
  const addCustomer = (data: Omit<PipelineCustomer, 'id' | 'createdAt' | 'viewed' | 'journey' | 'notes' | 'customValues'>) => {
    const now = new Date().toISOString();
    // Round-robin auto-assignment
    let assignedMemberIds: string[] = [];
    if (settings.assignmentMode === 'round_robin') {
      const { member, nextCursor } = pickRoundRobinMember(members, settings.roundRobinCursor);
      if (member) {
        assignedMemberIds = [member.id];
        setSettings(s => ({ ...s, roundRobinCursor: nextCursor }));
      }
    }
    const nu: PipelineCustomer = {
      id: `cus_${Date.now()}`,
      ...data,
      createdAt: now, viewed: true,
      notes: [], customValues: {},
      assignedMemberIds,
      journey: [{ id: `j_init_${Date.now()}`, status: data.status, date: now, note: 'Created manually' }],
    };
    setCustomers(cs => [nu, ...cs]);
    setShowAddCustomer(false);
    const assignName = assignedMemberIds[0] ? members.find(m => m.id === assignedMemberIds[0])?.name : null;
    showToast(assignName
      ? t(`Customer added — assigned to ${assignName}`, `تم إضافة العميل — مُكلّف لـ${assignName}`)
      : t('Customer added', 'تم إضافة العميل'));
  };

  const toggleAssignment = (customerId: string, memberId: string) => {
    setCustomers(cs => cs.map(c => {
      if (c.id !== customerId) return c;
      const cur = c.assignedMemberIds || [];
      const next = cur.includes(memberId) ? cur.filter(x => x !== memberId) : [...cur, memberId];
      return { ...c, assignedMemberIds: next };
    }));
  };
  const setSingleAssignment = (customerId: string, memberId: string) => {
    setCustomers(cs => cs.map(c => c.id === customerId ? { ...c, assignedMemberIds: [memberId] } : c));
  };

  // NOTE: In production, the following flows feed this pipeline automatically:
  //  • Zid / Salla OAuth tokens → trial/subscription webhook → append customer via backend
  //  • Ad platforms (TikTok/Facebook/Instagram/Snapchat/Google) lead forms → webhook → append new_lead
  // Only "Add Customer" stays a manual action; its source is locked to "manual".
  // Simulation buttons have been removed as requested.
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const _simulateNewLead = () => {
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    const names = ['Reem Al-Otaibi','Yousef Al-Harbi','Mona Al-Shammari','Turki Al-Dosari','Huda Abdullah'];
    const sources: LeadSource[] = ['facebook','tiktok','instagram','google','snapchat'];
    const name = pick(names);
    const now = new Date().toISOString();
    const nu: PipelineCustomer = {
      id: `cus_${Date.now()}`,
      name, email: `${name.split(' ')[0].toLowerCase()}@example.sa`,
      phone: `+9665${Math.floor(Math.random() * 90000000 + 10000000)}`,
      source: pick(sources), status: 'new_lead',
      createdAt: now, viewed: false,
      notes: [], customValues: {},
      journey: [{ id: `j_${Date.now()}`, status: 'new_lead', date: now, note: 'Arrived from ad platform' }],
    };
    setCustomers(cs => [nu, ...cs]);
    showToast(t('New lead received', 'عميل محتمل جديد'));
  };

  const simulateZidSalla = (source: 'zid' | 'salla') => {
    const name = source === 'zid' ? 'New Zid Merchant' : 'New Salla Merchant';
    const now = new Date().toISOString();
    const nu: PipelineCustomer = {
      id: `cus_${Date.now()}`,
      name,
      email: `merchant_${Date.now()}@${source}shop.sa`,
      phone: `+9665${Math.floor(Math.random() * 90000000 + 10000000)}`,
      source, status: 'trial',
      subscriptionPlan: 'Growth', subscriptionPrice: 299,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
      createdAt: now, viewed: false,
      notes: [], customValues: {},
      journey: [{ id: `j_${Date.now()}`, status: 'trial', date: now, note: `Trial started via ${source} token` }],
    };
    setCustomers(cs => [nu, ...cs]);
    showToast(t(`${source === 'zid' ? 'Zid' : 'Salla'} token received — 3-day trial`,
                `توكن ${source === 'zid' ? 'زد' : 'سلة'} — تجريبي 3 أيام`));
  };
  /* eslint-enable @typescript-eslint/no-unused-vars */

  const acknowledgeExpiry = (id: string, kind: 'trial' | 'subscription') => {
    updateCustomer(id, kind === 'trial' ? { trialExpiredAcknowledged: true } : { subscriptionExpiredAcknowledged: true });
  };

  const toggleSel = (id: string) => {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const openDetail = (id: string) => {
    // Per-user acknowledge: hides badges only for THIS user, others still see them
    setCustomers(cs => cs.map(c => c.id === id ? markSeenBy(c, currentUserId) : c));
    navigate(`/admin/pipeline/${id}`);
  };

  const statCards = [
    { key: 'total' as const, label: t('Total', 'الإجمالي'), value: statsByStatus.total, color: '#043CC8' },
    ...ALL_STATUSES.map(s => ({
      key: s,
      label: language === 'ar' ? STATUS_META[s].labelAr : STATUS_META[s].label,
      value: statsByStatus[s],
      color: STATUS_META[s].color,
      pulse: s === 'new_lead' && statsByStatus.new_lead > 0,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb & title */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground mb-1.5">
            <Users className="w-3.5 h-3.5" />
            <span>{t('Customer Management', 'إدارة العملاء')}</span>
            <ChevronRight className={`w-3 h-3 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
            <span>{t('Customer Pipeline', 'سير العملاء')}</span>
          </div>
          <h1 className="text-[24px] flex items-center gap-2 flex-wrap" style={{ fontWeight: 700 }}>
            {t('Customer Pipeline', 'سير العملاء')}
            {headerCounts.newCount > 0 && (
              <span className="text-[10px] px-2 py-1 rounded-full bg-red-500 text-white inline-flex items-center gap-1 animate-pulse" style={{ fontWeight: 700 }}>
                <Sparkles className="w-3 h-3" />
                {headerCounts.newCount} {t('NEW', 'جديد')}
              </span>
            )}
            {headerCounts.notesCount > 0 && (
              <span className="text-[10px] px-2 py-1 rounded-full bg-orange-500 text-white inline-flex items-center gap-1" style={{ fontWeight: 700 }}>
                <StickyNote className="w-3 h-3" />
                {headerCounts.notesCount} {t('NOTES', 'ملاحظات')}
              </span>
            )}
            {headerCounts.trialExpiredCount > 0 && (
              <span className="text-[10px] px-2 py-1 rounded-full bg-red-600 text-white inline-flex items-center gap-1" style={{ fontWeight: 700 }}>
                <AlertCircle className="w-3 h-3" />
                {headerCounts.trialExpiredCount} {t('TRIAL ENDED', 'انتهى التجريبي')}
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-[14px] mt-1">
            {t('Leads from ad platforms + subscribers from Zid / Salla arrive here automatically.',
               'يصل العملاء من المنصات الإعلانية والمشتركون من زد/سلة هنا تلقائياً.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdminUser && (
            <button
              onClick={() => setShowSettings(true)}
              className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border hover:bg-muted text-[13px]"
              style={{ fontWeight: 500 }}
            >
              <SettingsIcon className="w-4 h-4 text-muted-foreground" />
              {t('Assignment Rules', 'قواعد التكليف')}
            </button>
          )}
          <button
            onClick={() => setShowAddCustomer(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[13px] bg-[#043CC8] hover:bg-[#0330a0] transition-colors active:scale-[0.98] shadow-lg shadow-[#043CC8]/20"
            style={{ fontWeight: 600 }}
          >
            <UserPlus className="w-4 h-4" />
            {t('Add Customer', 'إضافة عميل')}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
        {statCards.map(s => (
          <div key={s.key} className="bg-card border border-border rounded-xl p-3 relative overflow-hidden">
            {s.pulse && <div className="absolute top-2 end-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
            <span className="text-[10px] text-muted-foreground block leading-tight" style={{ fontWeight: 500 }}>{s.label}</span>
            <p className="text-[18px] mt-0.5" style={{ color: s.color, fontWeight: 700 }}>{s.value}</p>
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
            placeholder={t('Search by name, email, phone...', 'بحث بالاسم، البريد، الجوال...')}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-input-background border border-border text-[14px] outline-none focus:border-[#043CC8] focus:ring-2 focus:ring-[#043CC8]/20 transition-all"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] transition-colors ${
              filterStatus === 'all' ? 'bg-[#043CC8] text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
            style={{ fontWeight: 600 }}
          >
            {t('All', 'الكل')}
          </button>
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] transition-colors ${
                filterStatus === s ? 'text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
              style={filterStatus === s ? { background: STATUS_META[s].color, fontWeight: 600 } : { fontWeight: 600 }}
            >
              {language === 'ar' ? STATUS_META[s].labelAr : STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Monday-style table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b-[3px]" style={{ borderBottomColor: '#043CC8' }}>
          <ChevronRight className="w-4 h-4 text-[#043CC8] rotate-90" />
          <span className="text-[14px]" style={{ color: '#043CC8', fontWeight: 700 }}>
            {t('Customer Pipeline', 'سير العملاء')}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground" style={{ fontWeight: 500 }}>
            {filtered.length} / {visibleToUser.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 1200 }}>
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="w-10 px-3 py-3"></th>
                <Th>{t('Customer', 'العميل')}</Th>
                <Th align="center">{t('Source', 'المصدر')}</Th>
                <Th align="center">{t('Status', 'الحالة')}</Th>
                <Th align="center">{t('Assigned', 'المسؤول')}</Th>
                <Th align="center">{t('Plan / Price', 'الباقة / السعر')}</Th>
                <Th align="center">{t('Start', 'البداية')}</Th>
                <Th align="center">{t('End', 'النهاية')}</Th>
                <Th align="center">{t('Created', 'تاريخ الإضافة')}</Th>
                <th className="w-14 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(cust => {
                const sMeta = STATUS_META[cust.status];
                const srcMeta = SOURCE_META[cust.source];
                const rem = daysRemaining(cust.endDate);
                const isNew = isNewFor(cust, currentUserId);
                const isForcedUnread = isForcedUnreadFor(cust, currentUserId);
                const hasTerminal = !!hasUnseenTerminalFor(cust, currentUserId);
                const hasNoteBadge = hasUnseenNotesFor(cust, currentUserId);
                const rowTint =
                  hasTerminal ? 'bg-red-500/[0.06] hover:bg-red-500/[0.09]'
                    : (isNew || isForcedUnread) ? 'bg-red-500/[0.05] hover:bg-red-500/[0.08]'
                    : hasNoteBadge ? 'bg-orange-500/[0.06] hover:bg-orange-500/[0.09]'
                    : 'hover:bg-muted/30';
                const showAvatarDot = isNew || isForcedUnread || hasTerminal;
                const assignedMembers = (cust.assignedMemberIds || []).map(id => members.find(m => m.id === id)).filter(Boolean) as TeamMember[];
                return (
                  <tr
                    key={cust.id}
                    className={`border-b border-border last:border-0 transition-colors group ${rowTint}`}
                  >
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={selected.has(cust.id)} onChange={() => toggleSel(cust.id)} className="w-4 h-4 accent-[#043CC8] cursor-pointer" />
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openDetail(cust.id)} className="flex items-center gap-3 text-start hover:text-[#043CC8] transition-colors">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#043CC8] to-[#579BFC] flex items-center justify-center text-white text-[12px]" style={{ fontWeight: 700 }}>
                            {cust.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                          </div>
                          {showAvatarDot && (
                            <span className="absolute -top-0.5 -end-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-card animate-pulse" />
                          )}
                          {!showAvatarDot && hasNoteBadge && (
                            <span className="absolute -top-0.5 -end-0.5 w-3 h-3 rounded-full bg-orange-500 border-2 border-card" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 flex-wrap">
                            <p className="text-[14px]" style={{ fontWeight: 600 }}>{cust.name}</p>
                            <RowBadges customer={cust} userId={currentUserId} t={t} />
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1"><Mail className="w-2.5 h-2.5" />{cust.email}</span>
                            <span className="inline-flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{cust.phone}</span>
                          </div>
                        </div>
                      </button>
                    </td>

                    {/* Source */}
                    <td className="px-4 py-3 text-center relative">
                      <button
                        ref={el => { menuRefs.current[`src_${cust.id}`] = el; }}
                        onClick={() => setSourceMenuFor(sourceMenuFor === cust.id ? null : cust.id)}
                        className="inline-flex items-center justify-center p-1.5 rounded-lg hover:bg-muted transition-colors"
                        title={language === 'ar' ? srcMeta.labelAr : srcMeta.label}
                      >
                        {PLATFORM_ICONS[cust.source] ? (
                          <PlatformIcon id={cust.source} size={22} />
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[11px]" style={{ background: srcMeta.bg, color: srcMeta.color, fontWeight: 700 }}>
                            {language === 'ar' ? srcMeta.labelAr : srcMeta.label}
                          </span>
                        )}
                      </button>
                      {sourceMenuFor === cust.id && (() => {
                        const btn = menuRefs.current[`src_${cust.id}`];
                        if (!btn) return null;
                        const rect = btn.getBoundingClientRect();
                        const menuH = ALL_SOURCES.length * 38 + 12;
                        const flipUp = (window.innerHeight - rect.bottom) < menuH + 12 && rect.top > menuH + 12;
                        const top = flipUp ? Math.max(8, rect.top - menuH - 4) : rect.bottom + 4;
                        return (
                          <>
                            <div className="fixed inset-0 z-[60]" onClick={() => setSourceMenuFor(null)} />
                            <div className="fixed z-[70] bg-card border border-border rounded-xl shadow-2xl py-1 w-48 max-h-[70vh] overflow-y-auto" style={{ top, left: Math.min(window.innerWidth - 200, Math.max(8, rect.left - 40)) }}>
                              {ALL_SOURCES.map(s => {
                                const m = SOURCE_META[s];
                                return (
                                  <button key={s}
                                    onClick={() => { updateCustomer(cust.id, { source: s }); setSourceMenuFor(null); }}
                                    className="w-full flex items-center justify-between gap-2.5 px-3 py-2 hover:bg-muted text-[13px] text-start">
                                    <span className="inline-flex items-center gap-2">
                                      {PLATFORM_ICONS[s]
                                        ? <PlatformIcon id={s} size={18} />
                                        : <span className="inline-block px-1.5 py-0.5 rounded-md text-[11px]" style={{ background: m.bg, color: m.color, fontWeight: 700 }}>
                                            {language === 'ar' ? m.labelAr : m.label}
                                          </span>}
                                      <span className="text-[12px]" style={{ fontWeight: 600 }}>{language === 'ar' ? m.labelAr : m.label}</span>
                                    </span>
                                    {cust.source === s && <Check className="w-3.5 h-3.5 text-[#043CC8]" />}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        );
                      })()}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center relative">
                      <button
                        ref={el => { menuRefs.current[`st_${cust.id}`] = el; }}
                        onClick={() => setStatusMenuFor(statusMenuFor === cust.id ? null : cust.id)}
                        className="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[11px] hover:opacity-90 transition-opacity"
                        style={{ background: sMeta.color, color: '#fff', fontWeight: 700 }}
                      >
                        {language === 'ar' ? sMeta.labelAr : sMeta.label}
                      </button>
                      {statusMenuFor === cust.id && (() => {
                        const btn = menuRefs.current[`st_${cust.id}`];
                        if (!btn) return null;
                        const rect = btn.getBoundingClientRect();
                        const menuH = ALL_STATUSES.length * 38 + 12; // ~items * row height + padding
                        const spaceBelow = window.innerHeight - rect.bottom;
                        const flipUp = spaceBelow < menuH + 12 && rect.top > menuH + 12;
                        const top = flipUp ? Math.max(8, rect.top - menuH - 4) : rect.bottom + 4;
                        return (
                          <>
                            <div className="fixed inset-0 z-[60]" onClick={() => setStatusMenuFor(null)} />
                            <div className="fixed z-[70] bg-card border border-border rounded-xl shadow-2xl py-1 w-56 max-h-[70vh] overflow-y-auto" style={{ top, left: Math.min(window.innerWidth - 232, Math.max(8, rect.left - 60)) }}>
                              {ALL_STATUSES.map(s => {
                                const m = STATUS_META[s];
                                return (
                                  <button key={s}
                                    onClick={() => { changeStatus(cust.id, s); setStatusMenuFor(null); }}
                                    className="w-full flex items-center justify-between gap-2.5 px-3 py-2 hover:bg-muted text-[13px] text-start">
                                    <span className="px-2 py-0.5 rounded-md text-[11px]" style={{ background: m.color, color: '#fff', fontWeight: 700 }}>
                                      {language === 'ar' ? m.labelAr : m.label}
                                    </span>
                                    {cust.status === s && <Check className="w-3.5 h-3.5 text-[#043CC8]" />}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        );
                      })()}
                    </td>

                    {/* Assigned */}
                    <td className="px-4 py-3 text-center relative">
                      <div className="inline-flex items-center gap-1">
                        {assignedMembers.length > 0 ? (
                          <div className="flex -space-s-2">
                            {assignedMembers.slice(0, 3).map(m => (
                              <span key={m.id} title={m.name}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] border-2 border-card"
                                style={{ background: m.color, fontWeight: 700 }}>
                                {m.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                              </span>
                            ))}
                            {assignedMembers.length > 3 && (
                              <span className="w-7 h-7 rounded-full bg-muted text-[10px] flex items-center justify-center border-2 border-card" style={{ fontWeight: 700 }}>
                                +{assignedMembers.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                            <UserCheck className="w-3 h-3" /> {t('Unassigned', 'غير مُكلَّف')}
                          </span>
                        )}
                        {isAdminUser && (
                          <button
                            ref={el => { menuRefs.current[`as_${cust.id}`] = el; }}
                            onClick={() => setAssignMenuFor(assignMenuFor === cust.id ? null : cust.id)}
                            className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                            title={t('Assign members', 'تكليف أعضاء')}>
                            <UserPlus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      {assignMenuFor === cust.id && (() => {
                        const btn = menuRefs.current[`as_${cust.id}`];
                        if (!btn) return null;
                        const rect = btn.getBoundingClientRect();
                        const memberCount = members.filter(m => m.role === 'member').length;
                        const menuH = memberCount * 44 + 60;
                        const flipUp = (window.innerHeight - rect.bottom) < menuH + 12 && rect.top > menuH + 12;
                        const top = flipUp ? Math.max(8, rect.top - menuH - 4) : rect.bottom + 4;
                        return (
                          <>
                            <div className="fixed inset-0 z-[60]" onClick={() => setAssignMenuFor(null)} />
                            <div className="fixed z-[70] bg-card border border-border rounded-xl shadow-2xl py-1 w-56 text-start max-h-[70vh] overflow-y-auto" style={{ top, left: Math.min(window.innerWidth - 232, Math.max(8, rect.right - 220)) }}>
                              <p className="px-3 py-2 text-[10px] text-muted-foreground uppercase tracking-wider" style={{ fontWeight: 700 }}>
                                {t('Assign to members', 'تكليف أعضاء')}
                              </p>
                              {members.filter(m => m.role === 'member').map(m => {
                                const isAssigned = (cust.assignedMemberIds || []).includes(m.id);
                                return (
                                  <button key={m.id}
                                    onClick={() => toggleAssignment(cust.id, m.id)}
                                    className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted text-[13px] text-start">
                                    <span className="inline-flex items-center gap-2">
                                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px]"
                                        style={{ background: m.color, fontWeight: 700 }}>
                                        {m.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                      </span>
                                      {m.name}
                                    </span>
                                    {isAssigned && <Check className="w-3.5 h-3.5 text-[#00C875]" />}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        );
                      })()}
                    </td>

                    {/* Plan / Price */}
                    <td className="px-4 py-3 text-center">
                      {cust.subscriptionPlan ? (
                        <div>
                          <p className="text-[12px]" style={{ fontWeight: 600 }}>{cust.subscriptionPlan}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {cust.subscriptionPrice?.toLocaleString('en-US')} {language === 'ar' ? 'ر.س' : 'SAR'}
                          </p>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>

                    {/* Start */}
                    <td className="px-4 py-3 text-center">
                      <span className="text-[12px]">{fmtDate(cust.startDate, language as any)}</span>
                    </td>

                    {/* End */}
                    <td className="px-4 py-3 text-center">
                      {cust.endDate ? (
                        <div>
                          <span className="text-[12px]">{fmtDate(cust.endDate, language as any)}</span>
                          {cust.status === 'trial' && rem !== null && (
                            <p className={`text-[10px] ${rem <= 1 ? 'text-red-500' : rem <= 3 ? 'text-amber-500' : 'text-muted-foreground'}`} style={{ fontWeight: 600 }}>
                              {rem <= 0 ? t('Ending today', 'ينتهي اليوم') : t(`${rem}d left`, `${rem}ي متبقي`)}
                            </p>
                          )}
                          {(cust.status === 'trial_expired' || cust.status === 'subscription_expired') && (
                            <p className="text-[10px] text-red-500 inline-flex items-center gap-1" style={{ fontWeight: 700 }}>
                              <AlertCircle className="w-2.5 h-2.5" />
                              {t('Expired', 'انتهى')}
                            </p>
                          )}
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3 text-center">
                      <span className="text-[11px] text-muted-foreground">{fmtDate(cust.createdAt, language as any)}</span>
                    </td>

                    {/* Row menu */}
                    <td className="px-4 py-3 text-center">
                      <div className="relative">
                        <button
                          ref={el => { menuRefs.current[`row_${cust.id}`] = el; }}
                          onClick={() => setRowMenuFor(rowMenuFor === cust.id ? null : cust.id)}
                          className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </button>
                        {rowMenuFor === cust.id && (() => {
                          const btn = menuRefs.current[`row_${cust.id}`];
                          if (!btn) return null;
                          const rect = btn.getBoundingClientRect();
                          const menuH = 3 * 44 + 12;
                          const flipUp = (window.innerHeight - rect.bottom) < menuH + 12 && rect.top > menuH + 12;
                          const top = flipUp ? Math.max(8, rect.top - menuH - 4) : rect.bottom + 4;
                          return (
                            <>
                              <div className="fixed inset-0 z-[60]" onClick={() => setRowMenuFor(null)} />
                              <div className="fixed z-[70] bg-card border border-border rounded-xl shadow-2xl py-1 w-52 max-h-[70vh] overflow-y-auto" style={{ top, left: Math.min(window.innerWidth - 216, Math.max(8, rect.right - 200)) }}>
                                <button onClick={() => { openDetail(cust.id); setRowMenuFor(null); }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted text-[13px] text-start">
                                  <Eye className="w-4 h-4 text-muted-foreground" /> {t('Open customer page', 'فتح صفحة العميل')}
                                </button>
                                {(() => {
                                  const unread = hasAnyUnseenFor(cust, currentUserId);
                                  return (
                                    <button
                                      onClick={() => {
                                        setCustomers(cs => cs.map(c => c.id === cust.id
                                          ? (unread ? markSeenBy(c, currentUserId) : markUnreadBy(c, currentUserId))
                                          : c));
                                        setRowMenuFor(null);
                                      }}
                                      className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted text-[13px] text-start"
                                    >
                                      {unread
                                        ? <><CheckCheck className="w-4 h-4 text-muted-foreground" /> {t('Mark as read', 'وضع كمقروء')}</>
                                        : <><Dot className="w-4 h-4 text-muted-foreground" /> {t('Mark as unread', 'وضع كغير مقروء')}</>}
                                    </button>
                                  );
                                })()}
                                <div className="my-1 border-t border-border" />
                                <button onClick={() => { setDeleteId(cust.id); setRowMenuFor(null); }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-red-500/10 text-red-400 text-[13px] text-start">
                                  <Trash2 className="w-4 h-4" /> {t('Delete', 'حذف')}
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
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 px-6">
            <div className="w-14 h-14 rounded-2xl bg-[#043CC8]/10 flex items-center justify-center mx-auto mb-3">
              <Users className="w-7 h-7 text-[#043CC8]" />
            </div>
            <h3 className="text-[15px]" style={{ fontWeight: 600 }}>
              {t('No customers match your filter', 'لا يوجد عملاء يطابقون الفلتر')}
            </h3>
            <p className="text-[13px] text-muted-foreground mt-1">
              {t('Click Add Customer to create one manually, or wait for inbound leads.',
                 'اضغط إضافة عميل لإضافته يدوياً، أو انتظر وصول العملاء تلقائياً.')}
            </p>
          </div>
        )}
      </div>

      {/* Add customer modal */}
      {showAddCustomer && (
        <AddCustomerModal onClose={() => setShowAddCustomer(false)} onSave={addCustomer} />
      )}

      {/* Assignment settings modal */}
      {showSettings && (
        <SettingsModal
          settings={settings} onSettings={setSettings}
          members={members}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-md border border-border shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-[17px] mb-2" style={{ fontWeight: 600 }}>{t('Delete Customer?', 'حذف العميل؟')}</h3>
            <p className="text-[14px] text-muted-foreground">
              {t('This action cannot be undone.', 'لا يمكن التراجع عن هذا الإجراء.')}
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-[14px]" style={{ fontWeight: 500 }}>
                {t('Cancel', 'إلغاء')}
              </button>
              <button onClick={() => removeCustomer(deleteId)} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 text-[14px]" style={{ fontWeight: 500 }}>
                {t('Delete', 'حذف')}
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

// ---------- Add customer modal ----------
function AddCustomerModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (data: Omit<PipelineCustomer, 'id' | 'createdAt' | 'viewed' | 'journey' | 'notes' | 'customValues'>) => void;
}) {
  const { t, dir, language } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  // Source is always "manual" when created from this modal — other sources
  // arrive automatically via Zid/Salla webhooks and ad-platform integrations.
  const source: LeadSource = 'manual';
  const [status, setStatus] = useState<LeadStatus>('new_lead');
  const [subscriptionPlan, setSubscriptionPlan] = useState('');
  const [subscriptionPrice, setSubscriptionPrice] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const canSave = name.trim() && email.trim() && phone.trim();

  const submit = () => {
    if (!canSave) return;
    onSave({
      name: name.trim(), email: email.trim(), phone: phone.trim(),
      source, status,
      subscriptionPlan: subscriptionPlan.trim() || undefined,
      subscriptionPrice: subscriptionPrice ? Number(subscriptionPrice) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose} dir={dir}>
      <div className="bg-card rounded-2xl w-full max-w-xl border border-border shadow-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-[17px]" style={{ fontWeight: 600 }}>{t('Add Customer', 'إضافة عميل')}</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {t('Manually create a customer record', 'إنشاء عميل يدوياً')}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          <Field label={t('Name *', 'الاسم *')} value={name} onChange={setName} placeholder="Ahmed Al-Saud" />
          <Field label={t('Email *', 'البريد *')} value={email} onChange={setEmail} placeholder="customer@example.com" type="email" />
          <Field label={t('Phone *', 'الجوال *')} value={phone} onChange={setPhone} placeholder="+966501234567" />

          <div>
            <label className="text-[12px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>{t('Source', 'المصدر')}</label>
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border">
              <span className="inline-block px-2 py-0.5 rounded-md text-[11px]"
                style={{ background: SOURCE_META.manual.bg, color: SOURCE_META.manual.color, fontWeight: 700 }}>
                {language === 'ar' ? SOURCE_META.manual.labelAr : SOURCE_META.manual.label}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {t('Set automatically for manual entries', 'يتم تعيينه تلقائياً للإضافة اليدوية')}
              </span>
            </div>
          </div>

          <div>
            <label className="text-[12px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>{t('Status', 'الحالة')}</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.map(s => {
                const m = STATUS_META[s];
                const active = status === s;
                return (
                  <button key={s} onClick={() => setStatus(s)}
                    className="px-2.5 py-1 rounded-md text-[11px] border-2 transition-all"
                    style={{
                      background: active ? m.color : 'transparent',
                      color: active ? '#fff' : m.color,
                      borderColor: m.color,
                      fontWeight: 700,
                    }}>
                    {language === 'ar' ? m.labelAr : m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('Plan', 'الباقة')} value={subscriptionPlan} onChange={setSubscriptionPlan} placeholder="Pro" />
            <Field label={t('Monthly Price (SAR)', 'السعر الشهري (ر.س)')} value={subscriptionPrice} onChange={setSubscriptionPrice} placeholder="299" type="number" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('Start Date', 'تاريخ البداية')} value={startDate} onChange={setStartDate} type="date" />
            <Field label={t('End Date', 'تاريخ النهاية')} value={endDate} onChange={setEndDate} type="date" />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-[14px]" style={{ fontWeight: 500 }}>
            {t('Cancel', 'إلغاء')}
          </button>
          <button onClick={submit} disabled={!canSave}
            className={`flex-1 py-2.5 rounded-xl text-white text-[14px] ${canSave ? 'bg-[#043CC8] hover:bg-[#0330a0]' : 'bg-[#043CC8]/40 cursor-not-allowed'}`}
            style={{ fontWeight: 600 }}>
            {t('Add Customer', 'إضافة عميل')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Row badges (NEW / NOTE / TRIAL EXPIRED / SUB EXPIRED / CANCELLED) ----------
function RowBadges({ customer, userId, t }: { customer: PipelineCustomer; userId: string; t: (en: string, ar: string) => string }) {
  const isNew = isNewFor(customer, userId);
  const isForcedUnread = isForcedUnreadFor(customer, userId);
  const hasNote = hasUnseenNotesFor(customer, userId);
  const terminal = hasUnseenTerminalFor(customer, userId);
  const termLabel = terminal === 'trial_expired' ? t('TRIAL ENDED', 'انتهى التجريبي')
    : terminal === 'subscription_expired' ? t('SUB ENDED', 'انتهى الاشتراك')
    : terminal === 'cancelled' ? t('CANCELLED', 'ملغي') : null;
  const termIcon = terminal === 'cancelled' ? <Ban className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />;
  const termColor = terminal === 'cancelled' ? '#808080' : '#E2445C';
  return (
    <>
      {isNew && !isForcedUnread && (
        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-red-500/15 text-red-500 inline-flex items-center gap-0.5" style={{ fontWeight: 800 }}>
          <Sparkles className="w-2.5 h-2.5" /> {t('NEW', 'جديد')}
        </span>
      )}
      {isForcedUnread && (
        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-red-500/15 text-red-500 inline-flex items-center gap-0.5" style={{ fontWeight: 800 }}>
          <Dot className="w-3 h-3" /> {t('UNREAD', 'غير مقروء')}
        </span>
      )}
      {hasNote && (
        <span title={t('Unread team notes', 'ملاحظات لم تُقرأ')}
          className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md bg-[#FDAB3D]/15 text-[#FDAB3D] animate-pulse" style={{ fontWeight: 800 }}>
          <StickyNote className="w-2.5 h-2.5" />
          {(customer.notes || []).length}
        </span>
      )}
      {termLabel && (
        <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md" style={{ background: `${termColor}26`, color: termColor, fontWeight: 800 }}>
          {termIcon} {termLabel}
        </span>
      )}
    </>
  );
}

// ---------- Assignment settings modal ----------
function SettingsModal({ settings, onSettings, members, onClose }: {
  settings: PipelineSettings;
  onSettings: (s: PipelineSettings) => void;
  members: TeamMember[];
  onClose: () => void;
}) {
  const { t, dir, language } = useApp();
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  const modes: { id: AssignmentMode; label: string; labelAr: string; desc: string; descAr: string }[] = [
    { id: 'manual', label: 'Manual', labelAr: 'يدوي',
      desc: 'Admin assigns each customer to one or more members.',
      descAr: 'المسؤول يُكلّف كل عميل لعضو أو أكثر يدوياً.' },
    { id: 'self_claim', label: 'Self-claim', labelAr: 'التقاط بواسطة العضو',
      desc: 'Members click a green "Follow" button to take responsibility. One member per customer.',
      descAr: 'العضو يضغط زر المتابعة الأخضر ليتولّى العميل. عضو واحد لكل عميل.' },
    { id: 'round_robin', label: 'Auto round-robin', labelAr: 'توزيع تلقائي دوري',
      desc: 'New customers cycle through members automatically (1 → 2 → 3 → 1 …).',
      descAr: 'يتم توزيع العملاء الجدد تلقائياً بالتناوب (1 ← 2 ← 3 ← 1 ...).' },
  ];
  const memberOnly = members.filter(m => m.role === 'member');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose} dir={dir}>
      <div className="bg-card rounded-2xl w-full max-w-xl border border-border shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-[17px]" style={{ fontWeight: 600 }}>{t('Customer Assignment Rules', 'قواعد تكليف العملاء')}</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {t('Choose how incoming customers get distributed to your team.',
                 'اختر كيف يتم توزيع العملاء الواردين على فريقك.')}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          {modes.map(m => {
            const active = settings.assignmentMode === m.id;
            return (
              <button key={m.id}
                onClick={() => onSettings({ ...settings, assignmentMode: m.id })}
                className={`w-full text-start p-4 rounded-xl border-2 transition-all ${active ? 'border-[#043CC8] bg-[#043CC8]/5' : 'border-border hover:border-[#043CC8]/40'}`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${active ? 'border-[#043CC8]' : 'border-border'}`}>
                    {active && <div className="w-2 h-2 rounded-full bg-[#043CC8]" />}
                  </div>
                  <p className="text-[14px]" style={{ fontWeight: 700 }}>
                    {language === 'ar' ? m.labelAr : m.label}
                  </p>
                </div>
                <p className="text-[12px] text-muted-foreground mt-1.5 ms-6">
                  {language === 'ar' ? m.descAr : m.desc}
                </p>
              </button>
            );
          })}

          <div className="p-3 rounded-xl bg-muted/40 border border-border">
            <p className="text-[11px] text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
              {t('ELIGIBLE MEMBERS (round-robin)', 'الأعضاء المؤهلون (التوزيع الدوري)')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {memberOnly.map(m => (
                <span key={m.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] text-white" style={{ background: m.color, fontWeight: 700 }}>
                  {m.name}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {t('You can still manually override assignments at any time from each customer row.',
                 'يمكنك تجاوز التكليف يدوياً لأي عميل من صفّه في الجدول.')}
            </p>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-[#043CC8] text-white text-[14px]" style={{ fontWeight: 600 }}>
            {t('Done', 'تم')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[12px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border text-[13px] outline-none focus:border-[#043CC8] focus:ring-2 focus:ring-[#043CC8]/20" />
    </div>
  );
}
