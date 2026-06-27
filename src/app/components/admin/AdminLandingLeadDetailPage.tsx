import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft, ChevronRight, Globe, Mail, Phone, Sun, Moon, StickyNote,
  Send, Clock, Trash2, MessageSquare, Edit3, UserPlus, Loader2,
  CheckCircle2, AlertTriangle, XCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  fetchLandingLead, deleteLandingLead, markCopiedToPipeline,
  addLandingLeadNote, deleteLandingLeadNote,
  type LandingLead, type LandingMatch, type LandingNote,
} from '../../services/adminLandingLeads';
import { fmtDate, loadCustomers, saveCustomers, type PipelineCustomer } from './pipelineData';
import { supabase } from '@/integrations/supabase/client';

// Format a date in both Gregorian and Hijri (Arabic) calendars.
function fmtDateBoth(iso: string, language: string): { greg: string; hijri: string } {
  const d = new Date(iso);
  const greg = fmtDate(iso, language as any);
  let hijri = '';
  try {
    hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(d);
  } catch { hijri = ''; }
  return { greg, hijri };
}

const MATCH_META: Record<LandingMatch, { ar: string; en: string; bg: string; fg: string; border: string }> = {
  full:    { ar: 'مطابق',         en: 'Matched',       bg: 'rgba(0,200,117,0.12)',  fg: '#00A65A', border: 'rgba(0,200,117,0.35)' },
  partial: { ar: 'مطابق جزئياً',  en: 'Partial match', bg: 'rgba(253,171,61,0.14)', fg: '#C6802B', border: 'rgba(253,171,61,0.4)' },
  none:    { ar: 'غير مطابق',     en: 'No match',      bg: 'rgba(226,68,92,0.12)',  fg: '#D43A56', border: 'rgba(226,68,92,0.35)' },
};

function MatchPill({ status, language }: { status: LandingMatch; language: string }) {
  const m = MATCH_META[status];
  const Icon = status === 'full' ? CheckCircle2 : status === 'partial' ? AlertTriangle : XCircle;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] border"
      style={{ background: m.bg, color: m.fg, borderColor: m.border, fontWeight: 700 }}>
      <Icon className="w-3.5 h-3.5" />
      {language === 'ar' ? m.ar : m.en}
    </span>
  );
}

export function AdminLandingLeadDetailPage() {
  const { t, language, dir, showToast } = useApp();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [lead, setLead] = useState<LandingLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorName, setAuthorName] = useState<string>('');
  const [authorId, setAuthorId] = useState<string>('');
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      setLoading(true);
      try { setLead(await fetchLandingLead(id)); }
      catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [id]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      if (!u) return;
      setAuthorId(u.id);
      setAuthorName((u.user_metadata?.display_name as string) || (u.email?.split('@')[0]) || 'Admin');
    })();
  }, []);

  const initials = useMemo(() =>
    authorName.split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'A',
  [authorName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-[13px]">{t('Loading…', 'جارٍ التحميل…')}</span>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-24">
        <h3 className="text-[16px] mb-2" style={{ fontWeight: 600 }}>
          {t('Lead not found', 'الطلب غير موجود')}
        </h3>
        <button onClick={() => navigate('/admin/pipeline')}
          className="text-[13px] text-[#043CC8] hover:underline" style={{ fontWeight: 600 }}>
          {t('Back to Landing Page leads', 'العودة إلى صفحة الهبوط')}
        </button>
      </div>
    );
  }

  const isNone = lead.match_status === 'none';
  const isPartial = lead.match_status === 'partial';
  const mismatchColor = isNone ? '#D43A56' : isPartial ? '#C6802B' : undefined;

  const addNote = async () => {
    const text = noteText.trim();
    if (!text || !lead) return;
    setSaving(true);
    const note: LandingNote = {
      id: `n_${Date.now()}`,
      author: authorName || 'Admin',
      authorId,
      text,
      createdAt: new Date().toISOString(),
    };
    try {
      const notes = await addLandingLeadNote(lead.id, note);
      setLead({ ...lead, notes });
      setNoteText('');
      showToast(t('Note added', 'تم إضافة الملاحظة'));
    } catch (e) { console.error(e); showToast(t('Failed to add note', 'تعذر إضافة الملاحظة')); }
    finally { setSaving(false); }
  };

  const removeNote = async (noteId: string) => {
    if (!lead) return;
    try {
      const notes = await deleteLandingLeadNote(lead.id, noteId);
      setLead({ ...lead, notes });
    } catch (e) { console.error(e); showToast(t('Delete failed', 'تعذر الحذف')); }
  };

  const copyToPipeline = () => {
    const customers = loadCustomers();
    const now = new Date().toISOString();
    const mappedSource =
      lead.source === 'ecommerce' || lead.source === 'other' || !lead.source
        ? 'manual'
        : lead.source;
    const nu: PipelineCustomer = {
      id: `cus_${Date.now()}`,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      source: mappedSource as any,
      status: 'new_lead',
      createdAt: now,
      viewed: true,
      notes: (lead.notes || []).map(n => ({
        id: n.id, author: n.author, text: n.text, createdAt: n.createdAt, attachments: [],
      })) as any,
      customValues: {},
      journey: [{ id: `j_init_${Date.now()}`, status: 'new_lead', date: now, note: 'Copied from Landing Page' }],
    } as PipelineCustomer;
    saveCustomers([nu, ...customers]);
    markCopiedToPipeline(lead.id, nu.id).catch(console.error);
    showToast(t('Copied to Customer Pipeline', 'تم النسخ إلى سير العميل'));
    navigate(`/admin/pipeline/${nu.id}`);
  };

  const onDelete = async () => {
    if (!lead) return;
    try {
      await deleteLandingLead(lead.id);
      showToast(t('Lead deleted', 'تم حذف الطلب'));
      navigate('/admin/pipeline');
    } catch (e) { console.error(e); showToast(t('Delete failed', 'تعذر الحذف')); }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground mb-1.5">
          <Globe className="w-3.5 h-3.5" />
          <button onClick={() => navigate('/admin/pipeline/landing')} className="hover:text-foreground">
            {t('Landing Page', 'صفحة الهبوط')}
          </button>
          <ChevronRight className={`w-3 h-3 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
          <span className="text-foreground">{lead.name}</span>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button onClick={() => navigate('/admin/pipeline/landing')}
            className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground">
            <ArrowLeft className={`w-4 h-4 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
            {t('Back', 'رجوع')}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={copyToPipeline}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-white bg-[#043CC8] hover:bg-[#0330a0] text-[13px]" style={{ fontWeight: 600 }}>
              <UserPlus className="w-4 h-4" /> {t('Copy to Pipeline', 'نسخ إلى سير العميل')}
            </button>
            <button onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:bg-muted text-[13px] text-red-500" style={{ fontWeight: 500 }}>
              <Trash2 className="w-4 h-4" /> {t('Delete', 'حذف')}
            </button>
          </div>
        </div>
      </div>

      {/* Summary card */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b-[3px]" style={{ borderBottomColor: '#043CC8' }}>
          <ChevronRight className="w-4 h-4 text-[#043CC8] rotate-90" />
          <span className="text-[14px]" style={{ color: '#043CC8', fontWeight: 700 }}>
            {t('Lead Details', 'تفاصيل الطلب')}
          </span>
          <span className="ms-auto"><MatchPill status={lead.match_status} language={language} /></span>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-[13px]">
          <Row label={t('Name', 'الإسم')} value={lead.name} />
          <Row label={t('Customer Type', 'نوع العميل')}
               value={lead.customer_type === 'new' ? t('New Lead', 'عميل جديد') : t('Existing', 'عميل حالي')} />
          <Row label={t('Phone', 'رقم الجوال')} value={lead.phone} valueStyle={{ color: mismatchColor, direction: 'ltr' as const }} icon={<Phone className="w-3.5 h-3.5 text-muted-foreground" />} />
          <Row label={t('Email', 'الإيميل')} value={lead.email} valueStyle={{ color: mismatchColor }} icon={<Mail className="w-3.5 h-3.5 text-muted-foreground" />} />
          <Row label={t('Contact Time', 'وقت التواصل')}
               value={lead.contact_time === 'morning' ? t('Morning', 'صباحاً') : t('Evening', 'مساءً')}
               icon={lead.contact_time === 'morning' ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5 text-indigo-400" />} />
          {(() => {
            const { greg, hijri } = fmtDateBoth(lead.created_at, language);
            return (
              <div>
                <p className="text-[11.5px] text-muted-foreground mb-1" style={{ fontWeight: 500 }}>
                  {t('Submitted', 'تاريخ الإرسال')}
                </p>
                <p className="text-[13.5px]" style={{ fontWeight: 600 }}>{greg}</p>
                {hijri && <p className="text-[11.5px] text-muted-foreground mt-0.5" style={{ direction: 'rtl' }}>{hijri} هـ</p>}
              </div>
            );
          })()}
          {lead.customer_type === 'new' && (
            <Row label={t('Source', 'المصدر')} value={lead.source || '—'} />
          )}
          <div className="md:col-span-2">
            <p className="text-[11.5px] text-muted-foreground mb-1.5" style={{ fontWeight: 500 }}>
              {t('Title', 'الموضوع')}
            </p>
            <p className="text-[13.5px] whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-xl p-3 border border-border">
              {lead.subject || '—'}
            </p>
          </div>
          <div className="md:col-span-2">
            <p className="text-[11.5px] text-muted-foreground mb-1.5" style={{ fontWeight: 500 }}>
              {t('Description', 'الوصف')}
            </p>
            <p className="text-[13.5px] whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-xl p-3 border border-border">
              {lead.description || '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b-[3px]" style={{ borderBottomColor: '#FDAB3D' }}>
          <StickyNote className="w-4 h-4 text-[#FDAB3D]" />
          <span className="text-[14px]" style={{ color: '#FDAB3D', fontWeight: 700 }}>
            {t('Team Notes', 'ملاحظات الفريق')}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground" style={{ fontWeight: 500 }}>
            {(lead.notes || []).length}
          </span>
        </div>

        <div className="p-5 border-b border-border bg-muted/10">
          <div className="flex gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-[11px] shrink-0" style={{ fontWeight: 700 }}>
              {initials}
            </div>
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder={t('Add a note about this lead...', 'اكتب ملاحظة عن هذا الطلب...')}
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-input-background border border-border text-[13px] outline-none focus:border-[#FDAB3D] focus:ring-2 focus:ring-[#FDAB3D]/20 resize-none"
              />
              <div className="flex items-center justify-end">
                <button onClick={addNote} disabled={!noteText.trim() || saving}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-[12px] transition-colors ${
                    noteText.trim() && !saving ? 'bg-[#FDAB3D] hover:bg-[#e0962f]' : 'bg-[#FDAB3D]/40 cursor-not-allowed'
                  }`}
                  style={{ fontWeight: 600 }}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {t('Add Note', 'إضافة ملاحظة')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="divide-y divide-border">
          {(lead.notes || []).length === 0 ? (
            <div className="text-center py-10 px-6">
              <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-[13px] text-muted-foreground">
                {t('No notes yet. Add the first note above.', 'لا توجد ملاحظات. أضف أول ملاحظة بالأعلى.')}
              </p>
            </div>
          ) : (lead.notes || []).slice().reverse().map(note => (
            <div key={note.id} className="p-5 group">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#043CC8] to-[#579BFC] flex items-center justify-center text-white text-[11px] shrink-0" style={{ fontWeight: 700 }}>
                  {note.author.split(/\s+/).map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px]" style={{ fontWeight: 600 }}>{note.author}</p>
                    <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {fmtDate(note.createdAt, language as any)}
                    </span>
                    <button onClick={() => removeNote(note.id)}
                      className="ms-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/10 rounded-md text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {note.text && (
                    <p className="text-[13px] text-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                      {note.text}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setConfirmDelete(false)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-md border border-border shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-[17px] mb-2" style={{ fontWeight: 600 }}>{t('Delete lead?', 'حذف الطلب؟')}</h3>
            <p className="text-[14px] text-muted-foreground">
              {t('This action cannot be undone.', 'لا يمكن التراجع عن هذا الإجراء.')}
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-[14px]" style={{ fontWeight: 500 }}>
                {t('Cancel', 'إلغاء')}
              </button>
              <button onClick={onDelete} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 text-[14px]" style={{ fontWeight: 500 }}>
                {t('Delete', 'حذف')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, valueStyle, icon }: {
  label: string; value: React.ReactNode; valueStyle?: React.CSSProperties; icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11.5px] text-muted-foreground mb-1" style={{ fontWeight: 500 }}>{label}</p>
      <p className="text-[13.5px] inline-flex items-center gap-1.5" style={{ fontWeight: 600, ...valueStyle }}>
        {icon}
        {value}
      </p>
    </div>
  );
}

export default AdminLandingLeadDetailPage;