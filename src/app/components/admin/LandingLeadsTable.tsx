import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Globe, MoreHorizontal, Trash2, Edit3, UserPlus, Loader2, Sun, Moon,
  CheckCircle2, AlertTriangle, XCircle, Info, RefreshCw, Search, Copy,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  fetchLandingLeads, deleteLandingLead, updateLandingLead, markCopiedToPipeline,
  type LandingLead, type LandingMatch, type LandingSource,
} from '../../services/adminLandingLeads';
import { SOURCE_META, type PipelineCustomer, type LeadSource } from './pipelineData';
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
  onCopyToPipeline: (data: Omit<PipelineCustomer, 'id' | 'createdAt' | 'viewed' | 'journey' | 'notes' | 'customValues'>) => string;
}

export function LandingLeadsTable({ onCopyToPipeline }: LandingLeadsTableProps) {
  const { t, language, dir, showToast } = useApp();
  const [leads, setLeads] = useState<LandingLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [rowMenuFor, setRowMenuFor] = useState<string | null>(null);
  const [editLead, setEditLead] = useState<LandingLead | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const menuRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const load = async () => {
    try { setLeads(await fetchLandingLeads()); }
    catch (e: any) { showToast(t('Failed to load landing leads', 'تعذر تحميل العملاء من صفحة الهبوط')); console.error(e); }
  };

  useEffect(() => {
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, []);

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

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleCopy = (lead: LandingLead) => {
    const mapped = mapSource(lead.source);
    const pipelineId = onCopyToPipeline({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      source: (mapped ?? 'manual') as any,
      status: 'new_lead',
    } as any);
    markCopiedToPipeline(lead.id, pipelineId).catch(console.error);
    setLeads(ls => ls.map(l => l.id === lead.id
      ? { ...l, copied_to_pipeline_at: new Date().toISOString(), pipeline_customer_id: pipelineId }
      : l));
    setRowMenuFor(null);
    showToast(t('Copied to Customer Pipeline', 'تم النسخ إلى سير العميل'));
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
      {/* Header strip styled like the screenshot */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap"
          style={{ background: '#0f6b78', color: '#fff' }}>
          <div className="inline-flex items-center gap-2">
            <Globe className="w-4 h-4" />
            <h2 className="text-[15px]" style={{ fontWeight: 700 }}>
              {t('Landing Page Leads', 'صفحة الهبوط')}
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/15">{filtered.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className={`w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 text-white/70 ${isRtl ? 'right-2' : 'left-2'}`} />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder={t('Search…', 'بحث…')}
                className={`bg-white/10 border border-white/20 rounded-lg text-[12px] py-1.5 ${isRtl ? 'pr-7 pl-2' : 'pl-7 pr-2'} text-white placeholder:text-white/60 outline-none focus:bg-white/15 w-44`} />
            </div>
            <button onClick={onRefresh}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[12px] border border-white/20"
              style={{ fontWeight: 600 }}>
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {t('Refresh', 'تحديث')}
            </button>
          </div>
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
            <table className="w-full text-[13px]">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <Th align="center">#</Th>
                  <Th>{t('Name', 'الإسم')}</Th>
                  <Th>{t('Phone', 'رقم الجوال')}</Th>
                  <Th>{t('Email', 'الإيميل')}</Th>
                  <Th align="center">{t('Customer Type', 'نوع العميل')}</Th>
                  <Th align="center">{t('Contact Time', 'وقت التواصل')}</Th>
                  <Th>{t('Source', 'المصدر')}</Th>
                  <Th>{t('Subject', 'الموضوع')}</Th>
                  <Th align="center">{t('Match', 'المطابقة')}</Th>
                  <Th align="center">{t('Actions', 'الإجراءات')}</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead, idx) => {
                  const isPartial = lead.match_status === 'partial';
                  const isNone = lead.match_status === 'none';
                  const basicColor = isNone ? '#D43A56' : isPartial ? '#C6802B' : undefined;
                  return (
                    <tr key={lead.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-center text-muted-foreground">{idx + 1}</td>
                      <td className="px-4 py-3" style={{ color: basicColor, fontWeight: 600 }}>
                        <div className="inline-flex items-center gap-2">
                          {lead.source && mapSource(lead.source) && mapSource(lead.source) !== 'manual' && (
                            <PlatformIcon platform={mapSource(lead.source) as any} size={14} />
                          )}
                          {lead.name}
                          {lead.copied_to_pipeline_at && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-border text-muted-foreground" style={{ fontWeight: 600 }}>
                              {t('Copied', 'منقول')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ color: basicColor, fontWeight: 600, direction: 'ltr' }}>{lead.phone}</td>
                      <td className="px-4 py-3" style={{ color: basicColor, fontWeight: 600 }}>{lead.email}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px]"
                          style={{
                            background: lead.customer_type === 'new' ? 'rgba(0,200,117,0.12)' : 'rgba(87,155,252,0.12)',
                            color: lead.customer_type === 'new' ? '#00A65A' : '#2F7BE6',
                            fontWeight: 700,
                          }}>
                          {lead.customer_type === 'new' ? t('New Lead', 'عميل جديد') : t('Existing', 'عميل حالي')}
                        </span>
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
                      <td className="px-4 py-3">
                        {lead.customer_type === 'existing'
                          ? <span className="text-[12.5px]">{lead.subject || <span className="text-muted-foreground">—</span>}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <MatchPill status={lead.match_status} />
                      </td>
                      <td className="px-4 py-3 text-center relative">
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
                                <button onClick={() => handleCopy(lead)}
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-[13px] text-start">
                                  <UserPlus className="w-3.5 h-3.5 text-[#043CC8]" />
                                  {t('Copy to Customer Pipeline', 'نسخ إلى سير العميل')}
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
              {t('Basic data: name • phone • email • customer type',
                 'البيانات الأساسية: الاسم • رقم الجوال • الإيميل • نوع العميل')}
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
