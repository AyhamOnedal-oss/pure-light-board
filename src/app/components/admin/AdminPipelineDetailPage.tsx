import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useApp } from '../../context/AppContext';
import {
  ArrowLeft, Mail, Phone, Calendar, DollarSign, ChevronRight,
  StickyNote, Send, Clock, Trash2, CheckCircle2, CircleDot, Zap,
  AlertCircle, Sparkles, MessageSquare, Edit3, Check, X as XIcon,
  Paperclip, Download, Link2, FileText, Image as ImageIcon, Eye, XCircle, Ban,
  UserCheck as UserCheckIcon, UserPlus as UserPlusIcon, Lock,
} from 'lucide-react';
import {
  PipelineCustomer, LeadStatus, CustomerNote, NoteAttachment, TeamMember,
  STATUS_META, SOURCE_META,
  loadCustomers, saveCustomers, reconcileCustomers,
  fmtDate, daysRemaining, appendJourney, monthsActive, totalPaid,
  loadMembers, loadSettings, getCurrentUserId, markSeenBy,
} from './pipelineData';
import { PlatformIcon, PLATFORM_ICONS } from './platformIcons';

const JOURNEY_STEPS: LeadStatus[] = ['new_lead', 'contacted', 'trial', 'subscribed'];

/** Derives the visual journey path including terminal branches. */
function derivePath(customer: PipelineCustomer): { key: LeadStatus; reached: boolean; isCurrent: boolean; isTerminal?: boolean }[] {
  const reachedStatuses = new Set((customer.journey || []).map(e => e.status));
  reachedStatuses.add(customer.status);
  const s = customer.status;

  const reachedOnPath = (step: LeadStatus, maxIndex: number) => {
    const idx = JOURNEY_STEPS.indexOf(step);
    return idx <= maxIndex;
  };

  // Compute how far along the happy path the customer actually went.
  let furthestIdx = -1;
  JOURNEY_STEPS.forEach((step, i) => { if (reachedStatuses.has(step)) furthestIdx = Math.max(furthestIdx, i); });

  // Build base path (happy-path nodes, reached up to furthestIdx)
  const path: { key: LeadStatus; reached: boolean; isCurrent: boolean; isTerminal?: boolean }[] =
    JOURNEY_STEPS.map((step, i) => ({
      key: step,
      reached: reachedOnPath(step, furthestIdx),
      isCurrent: s === step,
    }));

  // Append terminal node depending on current status
  if (s === 'not_interested') {
    path.push({ key: 'not_interested', reached: true, isCurrent: true, isTerminal: true });
  } else if (s === 'trial_expired') {
    path.push({ key: 'trial_expired', reached: true, isCurrent: true, isTerminal: true });
  } else if (s === 'subscription_expired') {
    path.push({ key: 'subscription_expired', reached: true, isCurrent: true, isTerminal: true });
  } else if (s === 'cancelled') {
    path.push({ key: 'cancelled', reached: true, isCurrent: true, isTerminal: true });
  }
  return path;
}

export function AdminPipelineDetailPage() {
  const { t, language, dir, showToast } = useApp();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [customers, setCustomers] = useState<PipelineCustomer[]>(() => reconcileCustomers(loadCustomers()));
  const [members] = useState<TeamMember[]>(() => loadMembers());
  const [settings] = useState(() => loadSettings());
  const [currentUserId] = useState<string>(() => getCurrentUserId());
  const currentUser = members.find(m => m.id === currentUserId);
  const isAdminUser = currentUser?.role === 'admin';
  const [assignPickerOpen, setAssignPickerOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<NoteAttachment[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState<Partial<PipelineCustomer>>({});
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [previewImg, setPreviewImg] = useState<NoteAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { saveCustomers(customers); }, [customers]);

  // Per-user "seen" stamp — hides badges only for THIS user; other team members still see them
  useEffect(() => {
    if (!id) return;
    setCustomers(cs => cs.map(c => c.id === id ? markSeenBy(c, currentUserId) : c));
  }, [id, currentUserId]);

  const customer = useMemo(() => customers.find(c => c.id === id), [customers, id]);

  // Lock background scroll when image preview is open
  useEffect(() => {
    if (previewImg) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [previewImg]);

  if (!customer) {
    return (
      <div className="text-center py-20">
        <p className="text-[15px] text-muted-foreground mb-3">{t('Customer not found', 'العميل غير موجود')}</p>
        <button onClick={() => navigate('/admin/pipeline')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#043CC8] text-white text-[13px]" style={{ fontWeight: 600 }}>
          <ArrowLeft className="w-4 h-4" /> {t('Back to Pipeline', 'العودة للسير')}
        </button>
      </div>
    );
  }

  // Access control: non-admins can only view customers assigned to them
  // (or unassigned customers in self-claim mode so they can pick them up).
  {
    const isAdminUser = currentUser?.role === 'admin';
    const assigned = customer.assignedMemberIds || [];
    const isAssignedToMe = assigned.includes(currentUserId);
    const isUnassignedClaimable = settings.assignmentMode === 'self_claim' && assigned.length === 0;
    if (!isAdminUser && !isAssignedToMe && !isUnassignedClaimable) {
      return (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10 text-red-500 mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <p className="text-[16px] mb-1" style={{ fontWeight: 700 }}>
            {t('Access denied', 'غير مصرح بالوصول')}
          </p>
          <p className="text-[13px] text-muted-foreground mb-4 max-w-md mx-auto">
            {t(
              'This customer is assigned to another team member. You can only view customers assigned to you.',
              'هذا العميل مُكلَّف بعضو آخر من الفريق. يمكنك فقط عرض العملاء المُكلَّفين بك.'
            )}
          </p>
          <button
            onClick={() => navigate('/admin/pipeline')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#043CC8] text-white text-[13px]"
            style={{ fontWeight: 600 }}
          >
            <ArrowLeft className="w-4 h-4" /> {t('Back to Pipeline', 'العودة للسير')}
          </button>
        </div>
      );
    }
  }

  const sMeta = STATUS_META[customer.status];
  const srcMeta = SOURCE_META[customer.source];
  const rem = daysRemaining(customer.endDate);
  const months = monthsActive(customer.startDate, customer.endDate);
  const paid = totalPaid(customer);

  const update = (patch: Partial<PipelineCustomer>) => {
    setCustomers(cs => cs.map(c => c.id === customer.id ? { ...c, ...patch } : c));
  };
  const changeStatus = (status: LeadStatus) => {
    setCustomers(cs => cs.map(c => c.id === customer.id ? appendJourney(c, status) : c));
    showToast(t('Status updated', 'تم تحديث الحالة'));
  };

  const onFilesSelected = async (files: FileList | null) => {
    if (!files) return;
    const next: NoteAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(f);
      });
      next.push({
        id: `att_${Date.now()}_${i}`,
        kind: f.type.startsWith('image/') ? 'image' : 'file',
        name: f.name,
        dataUrl, mime: f.type, size: f.size,
      });
    }
    setPendingAttachments(p => [...p, ...next]);
  };
  const addLinkAttachment = () => {
    if (!linkUrl.trim()) return;
    setPendingAttachments(p => [...p, {
      id: `att_${Date.now()}`, kind: 'link',
      name: linkLabel.trim() || linkUrl.trim(), url: linkUrl.trim(),
    }]);
    setLinkUrl(''); setLinkLabel(''); setLinkOpen(false);
  };
  const removePending = (aid: string) => {
    setPendingAttachments(p => p.filter(a => a.id !== aid));
  };

  const addNote = () => {
    if (!noteText.trim() && pendingAttachments.length === 0) return;
    const note: CustomerNote = {
      id: `n_${Date.now()}`,
      author: 'Super Admin',
      text: noteText.trim(),
      createdAt: new Date().toISOString(),
      attachments: pendingAttachments.length ? pendingAttachments : undefined,
    };
    update({ notes: [...(customer.notes || []), note] });
    setNoteText('');
    setPendingAttachments([]);
    showToast(t('Note added — team notified', 'تم إضافة الملاحظة — تم تنبيه الفريق'));
  };
  const removeNote = (noteId: string) => {
    update({ notes: (customer.notes || []).filter(n => n.id !== noteId) });
  };

  const startEdit = () => {
    setEditForm({
      name: customer.name, email: customer.email, phone: customer.phone,
      subscriptionPlan: customer.subscriptionPlan, subscriptionPrice: customer.subscriptionPrice,
      startDate: customer.startDate, endDate: customer.endDate,
    });
    setEditingProfile(true);
  };
  const saveEdit = () => {
    update(editForm);
    setEditingProfile(false);
    showToast(t('Saved', 'تم الحفظ'));
  };

  const path = derivePath(customer);
  const currency = language === 'ar' ? 'ر.س' : 'SAR';

  return (
    <div className="space-y-6" dir={dir}>
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground mb-1.5">
            <button onClick={() => navigate('/admin/pipeline')} className="hover:text-foreground inline-flex items-center gap-1 transition-colors">
              <ArrowLeft className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
              {t('Customer Pipeline', 'سير العملاء')}
            </button>
            <ChevronRight className={`w-3 h-3 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
            <span>{customer.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editingProfile ? (
            <button onClick={startEdit}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:bg-muted text-[13px]" style={{ fontWeight: 500 }}>
              <Edit3 className="w-4 h-4 text-muted-foreground" /> {t('Edit', 'تعديل')}
            </button>
          ) : (
            <>
              <button onClick={() => setEditingProfile(false)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:bg-muted text-[13px]" style={{ fontWeight: 500 }}>
                <XIcon className="w-4 h-4" /> {t('Cancel', 'إلغاء')}
              </button>
              <button onClick={saveEdit}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#043CC8] text-white text-[13px]" style={{ fontWeight: 600 }}>
                <Check className="w-4 h-4" /> {t('Save', 'حفظ')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Profile card */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#043CC8] to-[#579BFC] flex items-center justify-center text-white text-[16px] shrink-0" style={{ fontWeight: 700 }}>
                {customer.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
              </div>
              <div>
                {editingProfile ? (
                  <input value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    className="text-[20px] bg-input-background border border-border rounded-lg px-2 py-1 outline-none focus:border-[#043CC8]" style={{ fontWeight: 700 }} />
                ) : (
                  <h1 className="text-[22px]" style={{ fontWeight: 700 }}>{customer.name}</h1>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {PLATFORM_ICONS[customer.source] ? (
                    <span className="inline-flex items-center gap-1.5">
                      <PlatformIcon id={customer.source} size={18} />
                      <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 600 }}>
                        {language === 'ar' ? srcMeta.labelAr : srcMeta.label}
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px]"
                      style={{ background: srcMeta.bg, color: srcMeta.color, fontWeight: 700 }}>
                      {language === 'ar' ? srcMeta.labelAr : srcMeta.label}
                    </span>
                  )}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px]"
                    style={{ background: sMeta.color, color: '#fff', fontWeight: 700 }}>
                    {language === 'ar' ? sMeta.labelAr : sMeta.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {t('Added', 'تم إضافته')} {fmtDate(customer.createdAt, language as any)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick contact info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
            <InfoCard icon={Mail} label={t('Email', 'البريد')}
              value={editingProfile
                ? <input type="email" value={editForm.email || ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                    className="bg-transparent outline-none w-full text-[13px] font-mono" />
                : customer.email} />
            <InfoCard icon={Phone} label={t('Phone', 'الجوال')}
              value={editingProfile
                ? <input value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                    className="bg-transparent outline-none w-full text-[13px] font-mono" />
                : customer.phone} />
            <InfoCard icon={DollarSign} label={t('Plan / Price', 'الباقة / السعر')}
              value={editingProfile
                ? <div className="flex gap-1.5">
                    <input value={editForm.subscriptionPlan || ''}
                      onChange={e => setEditForm(f => ({ ...f, subscriptionPlan: e.target.value }))}
                      placeholder="Plan"
                      className="bg-transparent outline-none text-[13px] w-1/2 border-b border-border" />
                    <input type="number" value={editForm.subscriptionPrice || ''}
                      onChange={e => setEditForm(f => ({ ...f, subscriptionPrice: e.target.value ? Number(e.target.value) : undefined }))}
                      placeholder="Price"
                      className="bg-transparent outline-none text-[13px] w-1/2 border-b border-border" />
                  </div>
                : customer.subscriptionPlan
                  ? `${customer.subscriptionPlan} · ${customer.subscriptionPrice?.toLocaleString('en-US')} ${currency}`
                  : '—'} />
          </div>

          {/* Subscription summary: months + total paid */}
          {(customer.subscriptionPrice && (customer.status === 'subscribed' || customer.status === 'subscription_expired' || customer.status === 'cancelled')) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <InfoCard icon={Calendar} label={t('Months Active', 'عدد الأشهر')}
                value={<span className="text-[#043CC8]" style={{ fontWeight: 700 }}>{months} {t(months === 1 ? 'month' : 'months', months === 1 ? 'شهر' : 'أشهر')}</span>} />
              <InfoCard icon={DollarSign} label={t('Total Paid', 'إجمالي المدفوع')}
                value={<span className="text-[#00C875]" style={{ fontWeight: 700 }}>{paid.toLocaleString('en-US')} {currency}</span>} />
            </div>
          )}

          {/* Dates */}
          {(customer.startDate || customer.endDate || editingProfile) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <InfoCard icon={Calendar} label={t('Start Date', 'تاريخ البداية')}
                value={editingProfile
                  ? <input type="date" value={editForm.startDate || ''} onChange={e => setEditForm(f => ({ ...f, startDate: e.target.value }))}
                      className="bg-transparent outline-none text-[13px]" />
                  : fmtDate(customer.startDate, language as any)} />
              <InfoCard icon={Calendar} label={t('End Date', 'تاريخ النهاية')}
                value={editingProfile
                  ? <input type="date" value={editForm.endDate || ''} onChange={e => setEditForm(f => ({ ...f, endDate: e.target.value }))}
                      className="bg-transparent outline-none text-[13px]" />
                  : <span className="inline-flex items-center gap-2">
                      {fmtDate(customer.endDate, language as any)}
                      {customer.status === 'trial' && rem !== null && rem <= 3 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${rem <= 1 ? 'bg-red-500 text-white' : 'bg-amber-500/20 text-amber-500'}`} style={{ fontWeight: 700 }}>
                          {rem <= 0 ? t('Ending today', 'ينتهي اليوم') : t(`${rem}d left`, `${rem}ي`)}
                        </span>
                      )}
                    </span>} />
            </div>
          )}
        </div>
      </div>

      {/* Expiry banners */}
      {(customer.status === 'trial_expired' && !customer.trialExpiredAcknowledged) && (
        <ExpiryBanner
          title={t('Trial expired — needs follow-up', 'انتهى التجريبي — يحتاج متابعة')}
          subtitle={t('Reach out to the customer and log the conversation below.', 'تواصل مع العميل وسجّل المحادثة أدناه.')}
          onAcknowledge={() => update({ trialExpiredAcknowledged: true })}
        />
      )}
      {(customer.status === 'subscription_expired' && !customer.subscriptionExpiredAcknowledged) && (
        <ExpiryBanner
          title={t('Subscription ended — reach out to retain', 'انتهى الاشتراك — تواصل للاحتفاظ بالعميل')}
          subtitle={t('Contact the customer and update status after the call.', 'تواصل مع العميل وحدّث الحالة بعد المكالمة.')}
          onAcknowledge={() => update({ subscriptionExpiredAcknowledged: true })}
        />
      )}

      {/* Assignment & Follow */}
      {(() => {
        const assignedMembers = (customer.assignedMemberIds || [])
          .map(mid => members.find(m => m.id === mid))
          .filter(Boolean) as TeamMember[];
        const meAssigned = assignedMembers.some(m => m.id === currentUserId);
        const canSelfClaim =
          settings.assignmentMode === 'self_claim' &&
          !isAdminUser && currentUser?.role === 'member' &&
          assignedMembers.length === 0;
        const canReleaseClaim = settings.assignmentMode === 'self_claim' && meAssigned && !isAdminUser;
        const claimSelf = () => {
          update({ assignedMemberIds: [currentUserId] });
          showToast(t('You are now following this customer', 'أصبحت مسؤولاً عن متابعة هذا العميل'));
        };
        const releaseSelf = () => {
          update({ assignedMemberIds: (customer.assignedMemberIds || []).filter(id => id !== currentUserId) });
          showToast(t('You released this customer', 'تخلّيت عن هذا العميل'));
        };
        const toggleAssign = (mid: string) => {
          const cur = customer.assignedMemberIds || [];
          update({ assignedMemberIds: cur.includes(mid) ? cur.filter(x => x !== mid) : [...cur, mid] });
        };
        return (
          <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <UserCheckIcon className="w-4 h-4 text-[#00C875]" />
                  <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 600 }}>
                    {t('ASSIGNED TO', 'المسؤولون عن المتابعة')}
                  </span>
                </div>
                {assignedMembers.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">
                    {t('No one is following this customer yet.', 'لا يوجد مسؤول عن هذا العميل حتى الآن.')}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {assignedMembers.map(m => (
                      <span key={m.id}
                        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-white text-[12px]"
                        style={{ background: m.color, fontWeight: 700 }}>
                        <span className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center text-[9px]">
                          {m.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </span>
                        {m.name}
                        {isAdminUser && (
                          <button onClick={() => toggleAssign(m.id)} className="hover:bg-white/20 rounded p-0.5">
                            <XIcon className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-2">
                  {t('Mode:', 'الوضع:')}{' '}
                  <span style={{ fontWeight: 700, color: '#043CC8' }}>
                    {settings.assignmentMode === 'manual' ? t('Manual (admin assigns)', 'يدوي (المسؤول يُكلّف)')
                      : settings.assignmentMode === 'self_claim' ? t('Self-claim by member', 'التقاط بواسطة العضو')
                      : t('Auto round-robin', 'توزيع تلقائي دوري')}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                {canSelfClaim && (
                  <button onClick={claimSelf}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00C875] hover:bg-[#00b368] text-white text-[13px] transition-colors shadow-lg shadow-[#00C875]/30"
                    style={{ fontWeight: 700 }}>
                    <UserCheckIcon className="w-4 h-4" />
                    {t('Follow this customer', 'متابعة هذا العميل')}
                  </button>
                )}
                {canReleaseClaim && (
                  <button onClick={releaseSelf}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:bg-muted text-[13px]"
                    style={{ fontWeight: 500 }}>
                    <XIcon className="w-4 h-4" />
                    {t('Release', 'تخلٍّ')}
                  </button>
                )}
                {isAdminUser && (
                  <div className="relative">
                    <button onClick={() => setAssignPickerOpen(o => !o)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#043CC8] text-white text-[13px]"
                      style={{ fontWeight: 600 }}>
                      <UserPlusIcon className="w-4 h-4" />
                      {t('Manage Assignees', 'إدارة المسؤولين')}
                    </button>
                    {assignPickerOpen && (
                      <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setAssignPickerOpen(false)} />
                        <div className="absolute z-[70] end-0 mt-1 bg-card border border-border rounded-xl shadow-2xl py-1 w-60">
                          <p className="px-3 py-2 text-[10px] text-muted-foreground uppercase tracking-wider" style={{ fontWeight: 700 }}>
                            {t('Toggle members', 'تبديل الأعضاء')}
                          </p>
                          {members.filter(m => m.role === 'member').map(m => {
                            const isAssigned = (customer.assignedMemberIds || []).includes(m.id);
                            return (
                              <button key={m.id} onClick={() => toggleAssign(m.id)}
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
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Journey visualisation */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b-[3px]" style={{ borderBottomColor: '#00C875' }}>
          <Sparkles className="w-4 h-4 text-[#00C875]" />
          <span className="text-[14px]" style={{ color: '#00C875', fontWeight: 700 }}>
            {t('Customer Journey', 'مسار العميل')}
          </span>
        </div>

        <div className="p-6 overflow-x-auto">
          <div className="flex items-start gap-0 min-w-max">
            {path.map((node, idx) => {
              const meta = STATUS_META[node.key];
              const reached = node.reached;
              const reachedEvent = customer.journey?.find(e => e.status === node.key);
              const isLast = idx === path.length - 1;
              const nextReached = !isLast && path[idx + 1].reached;
              return (
                <React.Fragment key={`${node.key}_${idx}`}>
                  <div className="flex flex-col items-center relative" style={{ minWidth: 120 }}>
                    <div className="relative">
                      <div
                        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${node.isCurrent ? 'scale-110' : ''}`}
                        style={{
                          background: reached ? meta.color : 'transparent',
                          border: `3px solid ${reached ? meta.color : 'var(--border)'}`,
                          color: reached ? '#fff' : 'var(--muted-foreground)',
                          boxShadow: node.isCurrent ? `0 0 0 6px ${meta.color}22` : undefined,
                        }}
                      >
                        {node.isTerminal
                          ? (node.key === 'not_interested' ? <XCircle className="w-6 h-6" />
                              : node.key === 'cancelled' ? <Ban className="w-6 h-6" />
                              : <AlertCircle className="w-6 h-6" />)
                          : reached ? <CheckCircle2 className="w-6 h-6" /> : <CircleDot className="w-6 h-6" />}
                      </div>
                      {node.isCurrent && (
                        <span className="absolute -inset-1 rounded-full border-2 animate-ping" style={{ borderColor: meta.color }} />
                      )}
                    </div>
                    <p className="text-[12px] mt-3 text-center whitespace-nowrap" style={{ fontWeight: 700, color: reached ? meta.color : undefined }}>
                      {language === 'ar' ? meta.labelAr : meta.label}
                    </p>
                    {reachedEvent && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">{fmtDate(reachedEvent.date, language as any)}</p>
                    )}
                  </div>
                  {!isLast && (
                    <div className="flex-shrink-0 self-start mt-[27px] h-1 rounded-full transition-all" style={{
                      width: 64,
                      background: nextReached && reached ? meta.color : 'var(--border)',
                    }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Quick status change */}
          <div className="mt-6 pt-5 border-t border-border">
            <p className="text-[11px] text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
              {t('MOVE TO STAGE', 'الانتقال إلى مرحلة')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(['new_lead','contacted','not_interested','trial','trial_expired','subscribed','subscription_expired','cancelled'] as LeadStatus[])
                .filter(s => s !== customer.status).map(s => {
                  const m = STATUS_META[s];
                  return (
                    <button key={s} onClick={() => changeStatus(s)}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] border-2 transition-all hover:scale-[1.03]"
                      style={{ color: m.color, borderColor: m.color, fontWeight: 700 }}>
                      {language === 'ar' ? m.labelAr : m.label}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Chronological timeline */}
        <div className="border-t border-border px-6 py-5">
          <p className="text-[11px] text-muted-foreground mb-3" style={{ fontWeight: 600 }}>
            {t('EVENT LOG', 'سجل الأحداث')}
          </p>
          <div className="space-y-3">
            {(customer.journey || []).slice().reverse().map((evt) => {
              const m = STATUS_META[evt.status];
              return (
                <div key={evt.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: m.color, color: '#fff' }}>
                    {evt.automatic ? <Zap className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0 pb-3 border-b border-border last:border-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] px-2 py-0.5 rounded-md" style={{ background: m.color, color: '#fff', fontWeight: 700 }}>
                        {language === 'ar' ? m.labelAr : m.label}
                      </span>
                      {evt.automatic && (
                        <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5" /> {t('Automatic', 'تلقائي')}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1 ms-auto">
                        <Clock className="w-2.5 h-2.5" />
                        {fmtDate(evt.date, language as any)}
                      </span>
                    </div>
                    {evt.note && <p className="text-[12px] text-muted-foreground mt-1">{evt.note}</p>}
                  </div>
                </div>
              );
            })}
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
            {(customer.notes || []).length}
          </span>
        </div>

        {/* Add note */}
        <div className="p-5 border-b border-border bg-muted/10">
          <div className="flex gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-[11px] shrink-0" style={{ fontWeight: 700 }}>
              SA
            </div>
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder={t('Add a note about this customer... (conversation summary, next steps, etc.)',
                               'اكتب ملاحظة عن هذا العميل... (ملخص المحادثة، الخطوات القادمة، إلخ)')}
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-input-background border border-border text-[13px] outline-none focus:border-[#FDAB3D] focus:ring-2 focus:ring-[#FDAB3D]/20 resize-none"
              />

              {/* Pending attachments preview */}
              {pendingAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pendingAttachments.map(a => (
                    <AttachmentChip key={a.id} att={a} onRemove={() => removePending(a.id)} onPreview={(img) => setPreviewImg(img)} />
                  ))}
                </div>
              )}

              {/* Link input */}
              {linkOpen && (
                <div className="flex flex-col sm:flex-row gap-2 p-2 rounded-xl bg-muted/30 border border-border">
                  <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..."
                    className="flex-1 bg-input-background rounded-lg px-3 py-2 text-[13px] outline-none border border-border" />
                  <input value={linkLabel} onChange={e => setLinkLabel(e.target.value)} placeholder={t('Label (optional)', 'التسمية (اختياري)')}
                    className="sm:w-44 bg-input-background rounded-lg px-3 py-2 text-[13px] outline-none border border-border" />
                  <div className="flex gap-1.5">
                    <button onClick={addLinkAttachment} className="px-3 py-2 bg-[#043CC8] text-white rounded-lg text-[12px]" style={{ fontWeight: 600 }}>
                      {t('Attach', 'إرفاق')}
                    </button>
                    <button onClick={() => { setLinkOpen(false); setLinkUrl(''); setLinkLabel(''); }} className="px-2 py-2 hover:bg-muted rounded-lg">
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1">
                  <input ref={fileInputRef} type="file" multiple hidden onChange={e => { onFilesSelected(e.target.files); e.target.value = ''; }} />
                  <button onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-muted text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>
                    <Paperclip className="w-3.5 h-3.5" /> {t('Attach file', 'إرفاق ملف')}
                  </button>
                  <button onClick={() => setLinkOpen(o => !o)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-muted text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>
                    <Link2 className="w-3.5 h-3.5" /> {t('Attach link', 'إرفاق رابط')}
                  </button>
                </div>
                <button onClick={addNote} disabled={!noteText.trim() && pendingAttachments.length === 0}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-[12px] transition-colors ${
                    (noteText.trim() || pendingAttachments.length > 0) ? 'bg-[#FDAB3D] hover:bg-[#e0962f]' : 'bg-[#FDAB3D]/40 cursor-not-allowed'
                  }`}
                  style={{ fontWeight: 600 }}>
                  <Send className="w-3.5 h-3.5" />
                  {t('Add Note', 'إضافة ملاحظة')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Notes list */}
        <div className="divide-y divide-border">
          {(customer.notes || []).length === 0 ? (
            <div className="text-center py-10 px-6">
              <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-[13px] text-muted-foreground">
                {t('No notes yet. Add the first note above.', 'لا توجد ملاحظات. أضف أول ملاحظة بالأعلى.')}
              </p>
            </div>
          ) : (customer.notes || []).slice().reverse().map(note => (
            <div key={note.id} className="p-5 group">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#043CC8] to-[#579BFC] flex items-center justify-center text-white text-[11px] shrink-0" style={{ fontWeight: 700 }}>
                  {note.author.split(' ').map(n => n[0]).slice(0, 2).join('')}
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
                  {note.attachments && note.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {note.attachments.map(a => (
                        <AttachmentChip key={a.id} att={a} onPreview={(img) => setPreviewImg(img)} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Image preview modal */}
      {previewImg && previewImg.dataUrl && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewImg(null)}>
          <div className="absolute top-4 end-4 flex items-center gap-2 z-10">
            <a
              href={previewImg.dataUrl}
              download={previewImg.name}
              onClick={e => e.stopPropagation()}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur transition-colors"
              title={t('Download', 'تحميل')}
            >
              <Download className="w-5 h-5" />
            </a>
            <button
              onClick={() => setPreviewImg(null)}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur transition-colors"
              title={t('Close', 'إغلاق')}
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
          <img
            src={previewImg.dataUrl}
            alt={previewImg.name}
            onClick={e => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}

// ---------- Subcomponents ----------
function InfoCard({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="p-3 rounded-xl border border-border bg-muted/20">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 600 }}>{label}</span>
      </div>
      <div className="text-[13px]" style={{ fontWeight: 600 }}>{value || '—'}</div>
    </div>
  );
}

function ExpiryBanner({ title, subtitle, onAcknowledge }: {
  title: string; subtitle: string; onAcknowledge: () => void;
}) {
  const { t } = useApp();
  return (
    <div className="bg-gradient-to-r from-red-500/10 to-amber-500/5 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
        <AlertCircle className="w-5 h-5 text-red-500" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-[14px] text-red-500" style={{ fontWeight: 700 }}>{title}</h3>
        <p className="text-[12px] text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      <button onClick={onAcknowledge}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-muted text-[12px] self-center"
        style={{ fontWeight: 600 }}>
        <Check className="w-3.5 h-3.5" /> {t('Acknowledge', 'تم الاطلاع')}
      </button>
    </div>
  );
}

function AttachmentChip({ att, onRemove, onPreview }: {
  att: NoteAttachment;
  onRemove?: () => void;
  onPreview?: (a: NoteAttachment) => void;
}) {
  const { t } = useApp();
  if (att.kind === 'image' && att.dataUrl) {
    return (
      <div className="relative group">
        <button onClick={() => onPreview?.(att)} className="block">
          <img src={att.dataUrl} alt={att.name}
            className="w-24 h-24 object-cover rounded-xl border border-border" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-xl flex items-center justify-center transition-colors">
            <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>
        <div className="absolute top-1 end-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <a href={att.dataUrl} download={att.name}
            onClick={e => e.stopPropagation()}
            className="p-1 rounded-md bg-black/60 text-white hover:bg-black/80" title={t('Download', 'تحميل')}>
            <Download className="w-3 h-3" />
          </a>
          {onRemove && (
            <button onClick={onRemove} className="p-1 rounded-md bg-black/60 text-white hover:bg-red-500">
              <XIcon className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  }
  if (att.kind === 'link') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#043CC8]/10 border border-[#043CC8]/30 max-w-xs">
        <Link2 className="w-3.5 h-3.5 text-[#043CC8] shrink-0" />
        <a href={att.url} target="_blank" rel="noopener noreferrer"
          className="text-[12px] text-[#043CC8] truncate hover:underline" style={{ fontWeight: 600 }}>
          {att.name}
        </a>
        {onRemove && (
          <button onClick={onRemove} className="p-0.5 hover:bg-red-500/20 rounded">
            <XIcon className="w-3 h-3 text-muted-foreground" />
          </button>
        )}
      </div>
    );
  }
  // file
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted border border-border max-w-xs">
      <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-[12px] truncate" style={{ fontWeight: 600 }}>{att.name}</span>
      {att.dataUrl && (
        <a href={att.dataUrl} download={att.name} className="p-0.5 hover:bg-muted-foreground/10 rounded" title="Download">
          <Download className="w-3 h-3 text-muted-foreground" />
        </a>
      )}
      {onRemove && (
        <button onClick={onRemove} className="p-0.5 hover:bg-red-500/20 rounded">
          <XIcon className="w-3 h-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
