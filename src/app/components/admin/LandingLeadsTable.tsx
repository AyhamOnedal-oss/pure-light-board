import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ChevronRight, MoreHorizontal, Trash2, Edit3, UserPlus, Loader2, Sun, Moon, Globe,
  CheckCircle2, AlertTriangle, XCircle, Info, Search, Copy, UserCheck, Check, StickyNote,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  fetchLandingLeads, deleteLandingLead, updateLandingLead, markCopiedToPipeline, assignLandingLead,
  type LandingLead, type LandingMatch, type LandingSource,
} from '../../services/adminLandingLeads';
import {
  markListSeen, markLeadOpened, isLeadNewFor, unseenNotesCountFor,
} from '../../utils/landingNotifications';
import {
  SOURCE_META, type PipelineCustomer, type LeadSource,
  loadMembers, loadSettings, saveSettings, pickRoundRobinMember,
  getCurrentUserId, type TeamMember,
} from './pipelineData';
import { PlatformIcon } from './platformIcons';

const MATCH_META: Record<LandingMatch, { labelAr: string; labelEn: string; bg: string; fg: string; border: string }> = {
  full:    { labelAr: 'مطابق',         labelEn: 'Matched',         bg: 'rgba(0,200,117,0.12)',  fg: '#00A65A', border: 'rgba(0,200,117,0.35)' },
  partial: { labelAr: 'مطابق جزئياً',  labelEn: 'Partial match',   bg: 'rgba(253,171,61,0.14)', fg: '#C6802B', border: 'rgba(253,171,61,0.4)' },
  none:    { labelAr: 'غير مطابق',     labelEn: 'No match',        bg: 'rgba(226,68,92,0.12)',  fg: '#D43A56', border: 'rgba(226,68,92,0.35)' },
};

// Maps landing-form source values to pipeline LeadSource keys used by SOURCE_META.
function mapSource(s: LandingSource | null): LeadSource | null {
  if (!s) return null;
  if (s === 'ecommerce') return 'manual';
  if (s === 'other') return 'manual';
  return s as LeadSource;
}

function SourceCell({ source }: { source: LandingSource | null }) {
  const { t } = useApp();
  if (!source) return <span className="text-muted-foreground">—</span>;
  const mapped = mapSource(source);
  const meta = mapped ? SOURCE_META[mapped] : null;
  const label =
    source === 'ecommerce' ? t('Online Store', 'متجر إلكتروني') :
    source === 'other'     ? t('Other', 'أخرى') :
    meta ? t(meta.label, meta.labelAr) : source;
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px]" style={{ fontWeight: 600 }}>
      {mapped && mapped !== 'manual' ? (
        <PlatformIcon platform={mapped as any} size={16} />
      ) : (
        <Globe className="w-4 h-4 text-muted-foreground" />
      )}
      <span>{label}</span>
    </span>
  );
}

function MatchPill({ status }: { status: LandingMatch }) {
  const { language } = useApp();
  const m = MATCH_META[status];
  const Icon = status === 'full' ? CheckCircle2 : status === 'partial' ? AlertTriangle : XCircle;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] border"
      style={{ background: m.bg, color: m.fg, borderColor: m.border, fontWeight: 700 }}>
      <Icon className="w-3.5 h-3.5" />
      {language === 'ar' ? m.labelAr : m.labelEn}
    </span>
  );
}

function Th({ children, align = 'start' }: { children: React.ReactNode; align?: 'start' | 'center' | 'end' }) {
  const cls = align === 'center' ? 'text-center' : align === 'end' ? 'text-end' : 'text-start';
  return <th className={`${cls} px-4 py-3 text-[12px] text-muted-foreground uppercase tracking-wider`} style={{ fontWeight: 600 }}>{children}</th>;
}

export interface LandingLeadsTableProps {
  onCopyToPipeline: (data: Omit<PipelineCustomer, 'id' | 'createdAt' | 'viewed' | 'journey' | 'notes' | 'customValues'>, forcedId?: string) => string;
}

export function LandingLeadsTable({ onCopyToPipeline }: LandingLeadsTableProps) {
  const { t, language, dir, showToast } = useApp();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<LandingLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [rowMenuFor, setRowMenuFor] = useState<string | null>(null);
  const [editLead, setEditLead] = useState<LandingLead | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [assignMenuFor, setAssignMenuFor] = useState<string | null>(null);
  const [copyingIds, setCopyingIds] = useState<Set<string>>(() => new Set());
  const menuRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const assignRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [members] = useState<TeamMember[]>(() => loadMembers());
  const currentUserId = getCurrentUserId();
  // Bump to force re-render of per-row indicators after we mark something as seen.
  const [, setSeenTick] = useState(0);
  const currentUser = useMemo(() => members.find(m => m.id === currentUserId) || members[0], [members, currentUserId]);
  const isAdminUser = currentUser?.role === 'admin';
  const eligibleMembers = useMemo(() => members.filter(m => m.role === 'member'), [members]);

  const load = async () => {
    try { setLeads(await fetchLandingLeads()); }
    catch (e: any) { showToast(t('Failed to load landing leads', 'تعذر تحميل العملاء من صفحة الهبوط')); console.error(e); }
  };

  useEffect(() => {
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, []);

  // Mark the landing list as seen on mount so the sidebar badge clears once
  // the admin opens this view. Per-row red dots stay until each row is opened.
  useEffect(() => {
    if (loading) return;
    markListSeen(currentUserId);
    setSeenTick(t => t + 1);
  }, [loading, currentUserId]);

  // Round-robin: when assignment mode is "round_robin", auto-assign any unassigned
  // landing lead to the next eligible member. Runs once after the list loads.
  useEffect(() => {
    if (loading || leads.length === 0) return;
    const settings = loadSettings();
    if (settings.assignmentMode !== 'round_robin' || eligibleMembers.length === 0) return;
    const unassigned = leads.filter(l => !(l.assigned_member_ids || []).length);
    if (unassigned.length === 0) return;
    let cursor = settings.roundRobinCursor;
    const updates: Array<{ id: string; ids: string[] }> = [];
    for (const l of unassigned) {
      const { member, nextCursor } = pickRoundRobinMember(members, cursor);
      if (!member) break;
      updates.push({ id: l.id, ids: [member.id] });
      cursor = nextCursor;
    }
    if (updates.length === 0) return;
    saveSettings({ ...settings, roundRobinCursor: cursor });
    setLeads(ls => ls.map(l => {
      const u = updates.find(x => x.id === l.id);
      return u ? { ...l, assigned_member_ids: u.ids } : l;
    }));
    updates.forEach(u => { assignLandingLead(u.id, u.ids).catch(console.error); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      l.phone.toLowerCase().includes(q) ||
      (l.subject ?? '').toLowerCase().includes(q),
    );
  }, [leads, query]);

  const setLeadAssignment = (leadId: string, memberId: string) => {
    setLeads(ls => ls.map(l => {
      if (l.id !== leadId) return l;
      const cur = l.assigned_member_ids || [];
      const next = cur.includes(memberId) ? cur.filter(x => x !== memberId) : [...cur, memberId];
      assignLandingLead(leadId, next).catch(console.error);
      return { ...l, assigned_member_ids: next };
    }));
  };

  const handleCopy = async (lead: LandingLead) => {
    if (lead.copied_to_pipeline_at || lead.pipeline_customer_id || copyingIds.has(lead.id)) {
      showToast(t('This lead was already copied', 'تم نسخ هذا الطلب مسبقاً'));
      setRowMenuFor(null);
      return;
    }
    setCopyingIds(ids => new Set(ids).add(lead.id));
    const pipelineId = `cus_${Date.now()}`;
    try {
      const copied = await markCopiedToPipeline(lead.id, pipelineId);
      if (!copied) {
        await load();
        showToast(t('This lead was already copied', 'تم نسخ هذا الطلب مسبقاً'));
        return;
      }
    const mapped = mapSource(lead.source);
    onCopyToPipeline({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      source: (mapped ?? 'manual') as any,
      status: 'new_lead',
    } as any, pipelineId);
    setLeads(ls => ls.map(l => l.id === lead.id
      ? { ...l, copied_to_pipeline_at: new Date().toISOString(), pipeline_customer_id: pipelineId }
      : l));
    showToast(t('Copied to Customer Pipeline', 'تم النسخ إلى سير العميل'));
    } catch (e) {
      console.error(e);
      showToast(t('Failed to copy lead', 'تعذر نسخ الطلب'));
    } finally {
      setCopyingIds(ids => { const next = new Set(ids); next.delete(lead.id); return next; });
      setRowMenuFor(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteLandingLead(deleteId);
      setLeads(ls => ls.filter(l => l.id !== deleteId));
      showToast(t('Lead deleted', 'تم حذف الطلب'));
    } catch (e) { showToast(t('Delete failed', 'تعذر الحذف')); console.error(e); }
    setDeleteId(null);
  };

  const isRtl = dir === 'rtl';

  return (
    <div className="space-y-3">
      {/* Toolbar matched to the pipeline page */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder={t('Search by name, email, phone, subject...', 'بحث بالاسم، الإيميل، الجوال، الموضوع...')}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-input-background border border-border text-[14px] outline-none focus:border-[#043CC8] focus:ring-2 focus:ring-[#043CC8]/20 transition-all" />
        </div>
      </div>

      {/* Monday-style table — matches Customer Pipeline */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b-[3px]" style={{ borderBottomColor: '#043CC8' }}>
          <ChevronRight className="w-4 h-4 text-[#043CC8] rotate-90" />
          <span className="text-[14px]" style={{ color: '#043CC8', fontWeight: 700 }}>
            {t('Landing Page Leads', 'صفحة الهبوط')}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground" style={{ fontWeight: 500 }}>
            {filtered.length} / {leads.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-[13px]">{t('Loading…', 'جارٍ التحميل…')}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-2">
                <Globe className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-[13px] text-muted-foreground">
                {t('No landing page submissions yet.', 'لا توجد طلبات من صفحة الهبوط بعد.')}
              </p>
            </div>
          ) : (
            <table className="w-full text-[13px]" style={{ minWidth: 1200 }}>
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <Th align="center">#</Th>
                  <Th>{t('Name', 'الإسم')}</Th>
                  <Th>{t('Phone', 'رقم الجوال')}</Th>
                  <Th>{t('Email', 'الإيميل')}</Th>
                  <Th align="center">{t('Customer Type', 'نوع العميل')}</Th>
                  <Th align="center">{t('Contact Time', 'وقت التواصل')}</Th>
                  <Th>{t('Source', 'المصدر')}</Th>
                  <Th align="center">{t('Assign Employee', 'تكليف موظف')}</Th>
                  <Th>{t('Subject', 'الموضوع')}</Th>
                  <Th align="center">{t('Match', 'المطابقة')}</Th>
                  <Th align="center">{t('Actions', 'الإجراءات')}</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead, idx) => {
                  // Match is computed from email + phone ONLY (name is never used as identifier).
                  // Color phone & email red when they fail to match.
                  const isNone = lead.match_status === 'none';
                  const isPartial = lead.match_status === 'partial';
                  const mismatchColor = isNone ? '#D43A56' : isPartial ? '#C6802B' : undefined;
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => {
                        markLeadOpened(currentUserId, lead.id, (lead.notes || []).length);
                        setSeenTick(t => t + 1);
                        navigate(`/admin/pipeline/landing/${lead.id}`);
                      }}
                      className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 text-center text-muted-foreground">{idx + 1}</td>
                      <td className="px-4 py-3" style={{ fontWeight: 600 }}>
                        <span className="inline-flex items-center gap-2">
                          {isLeadNewFor(currentUserId, lead) && (
                            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" title={t('New', 'جديد')} />
                          )}
                          <span>{lead.name}</span>
                          {(() => {
                            const n = unseenNotesCountFor(currentUserId, lead);
                            if (!n) return null;
                            return (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px]"
                                style={{ background: 'rgba(253,171,61,0.15)', color: '#C6802B', fontWeight: 700 }}
                                title={t('New notes', 'ملاحظات جديدة')}
                              >
                                <StickyNote className="w-3 h-3" />
                                {n}
                              </span>
                            );
                          })()}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: mismatchColor, fontWeight: 600, direction: 'ltr' }}>{lead.phone}</td>
                      <td className="px-4 py-3" style={{ color: mismatchColor, fontWeight: 600 }}>{lead.email}</td>
                      <td className="px-4 py-3 text-center text-[13px]" style={{ color: mismatchColor, fontWeight: mismatchColor ? 600 : undefined }}>
                        {lead.customer_type === 'new' ? t('New Lead', 'عميل جديد') : t('Existing', 'عميل حالي')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                          {lead.contact_time === 'morning'
                            ? <><Sun className="w-3.5 h-3.5 text-amber-500" />{t('Morning', 'صباحاً')}</>
                            : <><Moon className="w-3.5 h-3.5 text-indigo-400" />{t('Evening', 'مساءً')}</>}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {lead.customer_type === 'new'
                          ? <SourceCell source={lead.source} />
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      {/* Assign Employee */}
                      <td className="px-4 py-3 text-center relative" onClick={e => e.stopPropagation()}>
                        {(() => {
                          const assigned = (lead.assigned_member_ids || [])
                            .map(id => members.find(m => m.id === id))
                            .filter(Boolean) as TeamMember[];
                          return (
                            <div className="inline-flex items-center gap-1">
                              {assigned.length > 0 ? (
                                <div className="flex -space-s-2">
                                  {assigned.slice(0, 3).map(m => (
                                    <span key={m.id} title={m.name}
                                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] border-2 border-card"
                                      style={{ background: m.color, fontWeight: 700 }}>
                                      {m.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                    </span>
                                  ))}
                                  {assigned.length > 3 && (
                                    <span className="w-7 h-7 rounded-full bg-muted text-[10px] flex items-center justify-center border-2 border-card" style={{ fontWeight: 700 }}>
                                      +{assigned.length - 3}
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
                                  ref={el => { assignRefs.current[lead.id] = el; }}
                                  onClick={() => setAssignMenuFor(assignMenuFor === lead.id ? null : lead.id)}
                                  className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                                  title={t('Assign employee', 'تكليف موظف')}>
                                  <UserPlus className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })()}
                        {assignMenuFor === lead.id && (() => {
                          const btn = assignRefs.current[lead.id];
                          if (!btn) return null;
                          const rect = btn.getBoundingClientRect();
                          const menuH = Math.max(1, eligibleMembers.length) * 44 + 60;
                          const flipUp = (window.innerHeight - rect.bottom) < menuH + 12 && rect.top > menuH + 12;
                          const top = flipUp ? Math.max(8, rect.top - menuH - 4) : rect.bottom + 4;
                          return (
                            <>
                              <div className="fixed inset-0 z-[60]" onClick={() => setAssignMenuFor(null)} />
                              <div className="fixed z-[70] bg-card border border-border rounded-xl shadow-2xl py-1 w-56 text-start max-h-[70vh] overflow-y-auto"
                                style={{ top, left: Math.min(window.innerWidth - 232, Math.max(8, rect.right - 220)) }}>
                                <p className="px-3 py-2 text-[10px] text-muted-foreground uppercase tracking-wider" style={{ fontWeight: 700 }}>
                                  {t('Assign to employee', 'تكليف موظف')}
                                </p>
                                {eligibleMembers.length === 0 && (
                                  <p className="px-3 py-2 text-[12px] text-muted-foreground">
                                    {t('No employees available', 'لا يوجد موظفون متاحون')}
                                  </p>
                                )}
                                {eligibleMembers.map(m => {
                                  const isAssigned = (lead.assigned_member_ids || []).includes(m.id);
                                  return (
                                    <button key={m.id}
                                      onClick={() => setLeadAssignment(lead.id, m.id)}
                                      className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted text-[13px] text-start">
                                      <span className="inline-flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px]"
                                          style={{ background: m.color, fontWeight: 700 }}>
                                          {m.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                        </span>
                                        <span className="text-[12px]" style={{ fontWeight: 600 }}>{m.name}</span>
                                      </span>
                                      {isAssigned && <Check className="w-3.5 h-3.5 text-[#043CC8]" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 max-w-[360px]">
                        {lead.subject
                          ? <p className="text-[12.5px] whitespace-pre-wrap leading-relaxed line-clamp-2">{lead.subject}</p>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <MatchPill status={lead.match_status} />
                      </td>
                      <td className="px-4 py-3 text-center relative" onClick={e => e.stopPropagation()}>
                        <button
                          ref={el => { menuRefs.current[lead.id] = el; }}
                          onClick={() => setRowMenuFor(rowMenuFor === lead.id ? null : lead.id)}
                          className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-border hover:bg-muted">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {rowMenuFor === lead.id && (() => {
                          const btn = menuRefs.current[lead.id];
                          if (!btn) return null;
                          const rect = btn.getBoundingClientRect();
                          return (
                            <>
                              <div className="fixed inset-0 z-[60]" onClick={() => setRowMenuFor(null)} />
                              <div className="fixed z-[70] bg-card border border-border rounded-xl shadow-2xl py-1 w-56 text-start"
                                style={{ top: rect.bottom + 4, left: Math.min(window.innerWidth - 232, Math.max(8, rect.right - 220)) }}>
                                <button onClick={() => handleCopy(lead)} disabled={Boolean(lead.copied_to_pipeline_at || lead.pipeline_customer_id || copyingIds.has(lead.id))}
                                  className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] text-start ${lead.copied_to_pipeline_at || lead.pipeline_customer_id || copyingIds.has(lead.id) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted'}`}>
                                  {lead.copied_to_pipeline_at || lead.pipeline_customer_id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <UserPlus className="w-3.5 h-3.5 text-[#043CC8]" />}
                                  {lead.copied_to_pipeline_at || lead.pipeline_customer_id ? t('Already copied', 'تم النسخ مسبقاً') : t('Copy to Customer Pipeline', 'نسخ إلى سير العميل')}
                                </button>
                                <button onClick={() => { setEditLead(lead); setRowMenuFor(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-[13px] text-start">
                                  <Edit3 className="w-3.5 h-3.5" />
                                  {t('Edit', 'تعديل')}
                                </button>
                                <button onClick={() => { setDeleteId(lead.id); setRowMenuFor(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-[13px] text-start text-red-500">
                                  <Trash2 className="w-3.5 h-3.5" />
                                  {t('Delete', 'حذف')}
                                </button>
                              </div>
                            </>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Legend strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[12px]">
        <div className="rounded-2xl border border-border bg-card p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div>
            <p style={{ fontWeight: 700 }}>{t('Match status guide', 'دليل حالة المطابقة')}</p>
            <p className="text-muted-foreground mt-0.5">
              {t('Identifiers used: phone • email (name is never used).',
                 'المعرّفات المستخدمة: رقم الجوال • الإيميل (لا يُستخدم الاسم).')}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-300/40 bg-emerald-50/40 dark:bg-emerald-500/5 p-3 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
          <div>
            <p style={{ fontWeight: 700, color: '#00A65A' }}>{t('Matched', 'مطابق')}</p>
            <p className="text-muted-foreground mt-0.5">
              {t('All data fully matched. No red color.',
                 'البيانات مطابقة بالكامل. لا يوجد تلوين باللون الأحمر.')}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-amber-300/40 bg-amber-50/40 dark:bg-amber-500/5 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
          <div>
            <p style={{ fontWeight: 700, color: '#C6802B' }}>{t('Partial match', 'مطابق جزئياً')}</p>
            <p className="text-muted-foreground mt-0.5">
              {t('Some data did not match. Only the mismatched fields are colored.',
                 'جزء من البيانات غير مطابق. يتم تلوين الحقول غير المطابقة فقط.')}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-rose-300/40 bg-rose-50/40 dark:bg-rose-500/5 p-3 flex items-start gap-2">
          <XCircle className="w-4 h-4 text-rose-600 mt-0.5" />
          <div>
            <p style={{ fontWeight: 700, color: '#D43A56' }}>{t('No match', 'غير مطابق')}</p>
            <p className="text-muted-foreground mt-0.5">
              {t('Basic data or customer type incorrect. Colored red.',
                 'البيانات غير مطابقة أو نوع العميل غير صحيح. يتم تلوين البيانات الأساسية باللون الأحمر.')}
            </p>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editLead && (
        <EditLeadModal lead={editLead} onClose={() => setEditLead(null)} onSaved={(updated) => {
          setLeads(ls => ls.map(l => l.id === updated.id ? updated : l));
          setEditLead(null);
        }} />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-md border border-border shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-[17px] mb-2" style={{ fontWeight: 600 }}>{t('Delete lead?', 'حذف الطلب؟')}</h3>
            <p className="text-[14px] text-muted-foreground">
              {t('This action cannot be undone.', 'لا يمكن التراجع عن هذا الإجراء.')}
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-[14px]" style={{ fontWeight: 500 }}>
                {t('Cancel', 'إلغاء')}
              </button>
              <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 text-[14px]" style={{ fontWeight: 500 }}>
                {t('Delete', 'حذف')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditLeadModal({ lead, onClose, onSaved }: {
  lead: LandingLead; onClose: () => void; onSaved: (l: LandingLead) => void;
}) {
  const { t, showToast } = useApp();
  const [subject, setSubject] = useState(lead.subject ?? '');
  const [source, setSource] = useState<LandingSource>(lead.source ?? 'other');
  const [contactTime, setContactTime] = useState(lead.contact_time);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    setSaving(true);
    try {
      const patch: any = { contact_time: contactTime };
      if (lead.customer_type === 'new') patch.source = source;
      if (lead.customer_type === 'existing') patch.subject = subject || null;
      await updateLandingLead(lead.id, patch);
      onSaved({ ...lead, ...patch });
      showToast(t('Saved', 'تم الحفظ'));
    } catch (e) { console.error(e); showToast(t('Save failed', 'تعذر الحفظ')); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-md border border-border shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border">
          <h3 className="text-[16px]" style={{ fontWeight: 700 }}>{t('Edit Lead', 'تعديل الطلب')}</h3>
          <p className="text-[12px] text-muted-foreground mt-1">{lead.name} · {lead.email}</p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[12px] text-muted-foreground mb-1.5 block">{t('Contact time', 'وقت التواصل')}</label>
            <div className="flex gap-2">
              {(['morning','evening'] as const).map(v => (
                <button key={v} onClick={() => setContactTime(v)}
                  className={`flex-1 py-2 rounded-xl border text-[13px] ${contactTime === v ? 'bg-[#043CC8] text-white border-[#043CC8]' : 'border-border hover:bg-muted'}`}>
                  {v === 'morning' ? t('Morning', 'صباحاً') : t('Evening', 'مساءً')}
                </button>
              ))}
            </div>
          </div>
          {lead.customer_type === 'new' ? (
            <div>
              <label className="text-[12px] text-muted-foreground mb-1.5 block">{t('Source', 'المصدر')}</label>
              <select value={source} onChange={e => setSource(e.target.value as LandingSource)}
                className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border text-[13px] outline-none focus:border-[#043CC8]">
                <option value="tiktok">TikTok</option>
                <option value="instagram">Instagram</option>
                <option value="snapchat">Snapchat</option>
                <option value="facebook">Facebook</option>
                <option value="google">Google</option>
                <option value="ecommerce">{t('Online Store', 'متجر إلكتروني')}</option>
                <option value="other">{t('Other', 'أخرى')}</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="text-[12px] text-muted-foreground mb-1.5 block">{t('Subject', 'الموضوع')}</label>
              <textarea value={subject} onChange={e => setSubject(e.target.value)} rows={3}
                className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border text-[13px] outline-none focus:border-[#043CC8] resize-none" />
            </div>
          )}
        </div>
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-[14px]" style={{ fontWeight: 500 }}>
            {t('Cancel', 'إلغاء')}
          </button>
          <button onClick={onSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#043CC8] text-white text-[14px] inline-flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontWeight: 600 }}>
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t('Save', 'حفظ')}
          </button>
        </div>
      </div>
    </div>
  );
}
