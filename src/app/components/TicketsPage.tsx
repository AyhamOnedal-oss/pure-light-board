import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, MoreHorizontal, FolderOpen, CheckCircle, Trash2, ArrowLeft, Ticket, Download, ThumbsUp, ThumbsDown, Copy, Check, StickyNote, Sparkles, Loader2 } from 'lucide-react';
import whatsappIcon from '../../imports/whatsapp.png';
import { ChatLogDownloadModal, getStoreName } from './ChatLogDownload';
import { AttachmentBubble } from './chat/AttachmentBubble';
import { NotesActivityPanel, Activity, AuthorRole } from './chat/NotesActivityPanel';
import { CURRENT_USER_ID, CURRENT_USER_NAME, CURRENT_USER_ROLE, notifKeys, getTs, setTs } from '../utils/notifications';
import { supabase } from '../../integrations/supabase/client';
import { seedDemoData } from '../services/seedDemoData';

interface Message {
  id: string; sender: 'customer' | 'ai'; text: string; time: string;
  type?: 'text' | 'image' | 'file'; fileName?: string;
  feedback?: 'positive' | 'negative';
}

type UICategory = 'complaint' | 'inquiry' | 'request' | 'suggestion';
type UIPriority = 'low' | 'medium' | 'high';
type UIStatus = 'open' | 'closed';

interface TicketItem {
  id: string;
  customerId: string; // phone
  category: UICategory;
  priority: UIPriority;
  status: UIStatus;
  createdAt: string;
  closedAt?: string;
  customerName: string;
  avatarColor: string;
  conversationId?: string;
  messages: Message[];
  activities: Activity[];
}

const CURRENT_USER = { id: CURRENT_USER_ID, name: CURRENT_USER_NAME, role: CURRENT_USER_ROLE as AuthorRole };

function formatTimeOnly(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}
function formatDateTime(iso: string): string {
  try { const d = new Date(iso); return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 5)}`; } catch { return ''; }
}

function dbCategoryToUI(c: string | null): UICategory {
  if (c === 'complaint' || c === 'inquiry' || c === 'request' || c === 'suggestion') return c;
  return 'inquiry';
}
function dbPriorityToUI(p: string): UIPriority {
  if (p === 'low' || p === 'medium' || p === 'high') return p;
  if (p === 'urgent') return 'high';
  return 'medium';
}
function dbStatusToUI(s: string): UIStatus {
  return s === 'closed' || s === 'resolved' ? 'closed' : 'open';
}

export function TicketsPage() {
  const { t, showToast, dir, tenantId } = useApp();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [selected, setSelected] = useState<TicketItem | null>(null);
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [bumpV, setBumpV] = useState(0);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const bump = () => setBumpV(v => v + 1);
  React.useMemo(() => bumpV, [bumpV]);

  const loadTickets = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data: rows } = await supabase
        .from('tickets_main')
        .select('id, subject, conversation_id, category, priority, status, customer_name, customer_phone, customer_avatar_color, created_at, resolved_at, number')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (!rows || rows.length === 0) { setTickets([]); setLoading(false); return; }

      const ticketIds = rows.map(r => r.id);
      const convIds = rows.map(r => r.conversation_id).filter(Boolean) as string[];

      const [{ data: activities }, { data: messages }] = await Promise.all([
        supabase.from('tickets_activities')
          .select('id, ticket_id, type, status, text, attachment, author_name, author_role, created_at, edited_at')
          .in('ticket_id', ticketIds)
          .order('created_at', { ascending: true }),
        convIds.length > 0
          ? supabase.from('conversations_messages')
              .select('id, conversation_id, sender, body, kind, file_name, feedback, created_at')
              .in('conversation_id', convIds)
              .order('created_at', { ascending: true })
          : Promise.resolve({ data: [] as Array<{ id: string; conversation_id: string; sender: string; body: string; kind: string; file_name: string | null; feedback: string | null; created_at: string }> }),
      ]);

      const actsByTk = new Map<string, Activity[]>();
      (activities || []).forEach(a => {
        const arr = actsByTk.get(a.ticket_id) || [];
        arr.push({
          id: a.id,
          type: (a.type === 'note' ? 'note' : 'status'),
          text: a.text || undefined,
          status: (a.status === 'open' || a.status === 'closed' || a.status === 'created') ? a.status : undefined,
          author: a.author_name,
          authorRole: (a.author_role === 'admin' ? 'admin' : 'team'),
          timestamp: a.created_at,
          editedAt: a.edited_at || undefined,
          attachment: (a.attachment as Activity['attachment']) || undefined,
        });
        actsByTk.set(a.ticket_id, arr);
      });

      const msgsByConv = new Map<string, Message[]>();
      (messages || []).forEach(m => {
        const arr = msgsByConv.get(m.conversation_id) || [];
        arr.push({
          id: m.id,
          sender: m.sender === 'customer' ? 'customer' : 'ai',
          text: m.body || '',
          time: formatTimeOnly(m.created_at),
          type: (m.kind as 'text' | 'image' | 'file') || 'text',
          fileName: m.file_name || undefined,
          feedback: m.feedback === 'positive' ? 'positive' : m.feedback === 'negative' ? 'negative' : undefined,
        });
        msgsByConv.set(m.conversation_id, arr);
      });

      const mapped: TicketItem[] = rows.map(r => ({
        id: r.id,
        customerId: r.customer_phone || '',
        category: dbCategoryToUI(r.category),
        priority: dbPriorityToUI(r.priority),
        status: dbStatusToUI(r.status),
        createdAt: formatDateTime(r.created_at),
        closedAt: r.resolved_at ? formatDateTime(r.resolved_at) : undefined,
        customerName: r.customer_name || t('Unknown', 'مجهول'),
        avatarColor: r.customer_avatar_color || '#043CC8',
        conversationId: r.conversation_id || undefined,
        messages: r.conversation_id ? (msgsByConv.get(r.conversation_id) || []) : [],
        activities: actsByTk.get(r.id) || [],
      }));

      setTickets(mapped);
      if (selected) {
        const fresh = mapped.find(m => m.id === selected.id);
        if (fresh) setSelected(fresh);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTickets(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tenantId]);

  const handleSeed = async () => {
    if (!tenantId) return;
    setSeeding(true);
    const res = await seedDemoData(tenantId);
    setSeeding(false);
    if (res.ok) { showToast(t('Demo data added', 'تمت إضافة بيانات تجريبية')); await loadTickets(); }
    else showToast(res.error || t('Failed to seed', 'فشل التحميل'));
  };

  const unreadCount = (tk: TicketItem): number => {
    const seen = getTs(notifKeys.ticketNotesSeen(CURRENT_USER.id, tk.id));
    return tk.activities.reduce((n, a) => (new Date(a.timestamp).getTime() > seen ? n + 1 : n), 0);
  };
  const isNewTicket = (tk: TicketItem): boolean => {
    const opened = getTs(notifKeys.ticketOpened(CURRENT_USER.id, tk.id));
    return opened === 0;
  };

  const openNotes = () => {
    if (selected) { setTs(notifKeys.ticketNotesSeen(CURRENT_USER.id, selected.id)); bump(); }
    setNotesOpen(true);
  };

  const handleSelect = (tk: TicketItem) => {
    setTs(notifKeys.ticketOpened(CURRENT_USER.id, tk.id));
    setSelected(tk);
    bump();
  };

  const getDisplayName = (name: string) => name?.trim() || t('Unknown Customer', 'عميل غير معروف');
  const getInitials = (name: string) => {
    const display = name?.trim();
    if (!display) return '?';
    return display.split(' ').map(n => n[0]).join('').slice(0, 2);
  };

  const categoryMap: Record<string, { en: string; ar: string; color: string }> = {
    complaint: { en: 'Complaint', ar: 'شكوى', color: '#ff4466' },
    inquiry: { en: 'Inquiry', ar: 'استفسار', color: '#043CC8' },
    request: { en: 'Request', ar: 'طلب', color: '#f59e0b' },
    suggestion: { en: 'Suggestion', ar: 'اقتراح', color: '#10b981' },
  };
  const priorityMap: Record<string, { en: string; ar: string; color: string }> = {
    low: { en: 'Low', ar: 'منخفض', color: '#043CC8' },
    medium: { en: 'Medium', ar: 'متوسط', color: '#f59e0b' },
    high: { en: 'High', ar: 'عالي', color: '#ff4466' },
  };

  const filtered = useMemo(() => tickets.filter(tk =>
    tk.id.toLowerCase().includes(search.toLowerCase()) ||
    tk.customerId.includes(search) ||
    tk.customerName.toLowerCase().includes(search.toLowerCase())
  ), [tickets, search]);

  const toggleStatus = async (id: string) => {
    const tk = tickets.find(x => x.id === id);
    if (!tk || !tenantId) return;
    const newStatus: UIStatus = tk.status === 'open' ? 'closed' : 'open';
    const dbStatus = newStatus === 'closed' ? 'closed' : 'open';
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('tickets_main')
      .update({ status: dbStatus, resolved_at: newStatus === 'closed' ? nowIso : null })
      .eq('id', id);
    if (error) { showToast(error.message); return; }
    await supabase.from('tickets_activities').insert({
      tenant_id: tenantId, ticket_id: id, type: 'status', status: newStatus,
      author_name: CURRENT_USER.name, author_role: CURRENT_USER.role,
    });
    setMenuOpen(null);
    showToast(t('Ticket status updated', 'تم تحديث حالة التذكرة'));
    await loadTickets();
  };

  const addNote = async (text: string, attachment?: import('./chat/NotesActivityPanel').Activity['attachment']) => {
    if (!selected || !tenantId) return;
    if (!text && !attachment) return;
    const { error } = await supabase.from('tickets_activities').insert({
      tenant_id: tenantId,
      ticket_id: selected.id,
      type: 'note',
      text: text || null,
      attachment: (attachment ? (attachment as unknown as Record<string, unknown>) : null) as never,
      author_name: CURRENT_USER.name,
      author_role: CURRENT_USER.role,
    });
    if (error) { showToast(error.message); return; }
    showToast(t('Note added', 'تمت إضافة الملاحظة'));
    await loadTickets();
  };

  const editNote = async (noteId: string, text: string) => {
    if (!selected) return;
    const { error } = await supabase
      .from('tickets_activities')
      .update({ text, edited_at: new Date().toISOString() })
      .eq('id', noteId)
      .eq('author_name', CURRENT_USER.name);
    if (error) { showToast(error.message); return; }
    showToast(t('Note updated', 'تم تعديل الملاحظة'));
    await loadTickets();
  };

  const deleteNote = async (noteId: string) => {
    if (!selected) return;
    const { error } = await supabase
      .from('tickets_activities')
      .delete()
      .eq('id', noteId)
      .eq('author_name', CURRENT_USER.name);
    if (error) { showToast(error.message); return; }
    showToast(t('Note deleted', 'تم حذف الملاحظة'));
    await loadTickets();
  };

  const deleteTicket = async (id: string) => {
    await supabase.from('tickets_activities').delete().eq('ticket_id', id);
    const { error } = await supabase.from('tickets_main').delete().eq('id', id);
    if (error) { showToast(error.message); return; }
    if (selected?.id === id) setSelected(null);
    setMenuOpen(null);
    showToast(t('Ticket deleted', 'تم حذف التذكرة'));
    await loadTickets();
  };

  const getAiBubbleStyle = (msg: Message) => {
    if (msg.sender !== 'ai') return '';
    return 'bg-[#043CC8] text-white rounded-br-sm';
  };

  return (
    <div className="h-[calc(100vh-7rem)]">
      <h1 className="text-[24px] mb-4" style={{ fontWeight: 700 }}>{t('Tickets', 'التذاكر')}</h1>

      <div className="flex h-[calc(100%-3rem)] bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className={`${selected ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-[320px] lg:w-[340px] border-e border-border shrink-0`}>
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('Search by ID, name or phone...', 'بحث بالمعرف أو الاسم أو الهاتف...')}
                className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-input-background border border-border text-[13px] outline-none focus:border-[#043CC8] focus:ring-2 focus:ring-[#043CC8]/20 transition-all text-foreground"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 flex items-center justify-center text-muted-foreground text-[13px]"><Loader2 className="w-4 h-4 animate-spin me-2" /> {t('Loading...', 'جاري التحميل...')}</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <Ticket className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-[13px] text-muted-foreground mb-3">{t('No tickets yet', 'لا توجد تذاكر بعد')}</p>
                <button
                  onClick={handleSeed}
                  disabled={seeding || !tenantId}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#043CC8] hover:bg-[#043CC8]/90 disabled:opacity-50 text-white text-[12px] transition-colors"
                  style={{ fontWeight: 600 }}
                >
                  {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {t('Add demo data', 'إضافة بيانات تجريبية')}
                </button>
              </div>
            ) : filtered.map(tk => {
              const cat = categoryMap[tk.category];
              const pri = priorityMap[tk.priority];
              return (
                <button
                  key={tk.id}
                  onClick={() => handleSelect(tk)}
                  className={`relative w-full flex items-start gap-3 px-4 py-3.5 hover:bg-muted/40 border-b border-border transition-colors text-start ${selected?.id === tk.id ? 'bg-muted/60' : ''}`}
                >
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px]" style={{ backgroundColor: tk.avatarColor, fontWeight: 700 }}>
                      {getInitials(tk.customerName)}
                    </div>
                    {unreadCount(tk) > 0 && (
                      <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center border-2 border-card" style={{ fontWeight: 700 }}>
                        {unreadCount(tk)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center gap-2">
                      <p className="text-[14px] truncate" style={{ fontWeight: 500 }}>{getDisplayName(tk.customerName)}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        {isNewTicket(tk) && (
                          <span className="text-[9px] px-1.5 py-[1px] rounded-full bg-red-500 text-white" style={{ fontWeight: 700 }}>
                            {t('NEW', 'جديد')}
                          </span>
                        )}
                        <span className={`text-[9px] px-1.5 py-[1px] rounded-full ${tk.status === 'open' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-500'}`} style={{ fontWeight: 600 }}>
                          {tk.status === 'open' ? t('Open', 'مفتوحة') : t('Closed', 'مغلقة')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[10px] text-muted-foreground/60" style={{ fontWeight: 500 }}>#{tk.id.slice(0, 8)}</span>
                      <span className="text-[9px] px-1.5 py-[1px] rounded" style={{ backgroundColor: cat.color + '12', color: cat.color, fontWeight: 600 }}>
                        {t(cat.en, cat.ar)}
                      </span>
                    </div>
                    <p className="text-[12px] text-muted-foreground truncate mt-1">
                      {tk.messages[tk.messages.length - 1]?.text || tk.messages[tk.messages.length - 1]?.fileName || ''}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[9px] px-1.5 py-[1px] rounded" style={{ backgroundColor: pri.color + '12', color: pri.color, fontWeight: 600 }}>
                        {t(pri.en, pri.ar)}
                      </span>
                      <span className="text-[9px] text-muted-foreground/50">·</span>
                      <span className="text-[9px] text-muted-foreground/50">{tk.createdAt}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selected ? (
          <div className="flex flex-col flex-1 min-w-0">
            <div className="px-4 lg:px-5 py-3 border-b border-border bg-muted/20 space-y-2">
              <div className="flex items-center gap-3">
                <button className="md:hidden p-1" onClick={() => setSelected(null)}>
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px]" style={{ backgroundColor: selected.avatarColor, fontWeight: 700 }}>
                  {getInitials(selected.customerName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[14px]" style={{ fontWeight: 600 }}>{getDisplayName(selected.customerName)}</p>
                    <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md" style={{ fontWeight: 500 }}>#{selected.id.slice(0, 8)}</span>
                  </div>
                  <button
                    type="button"
                    dir="ltr"
                    onClick={async () => {
                      const text = selected.customerId;
                      let ok = false;
                      try {
                        if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); ok = true; }
                      } catch {}
                      if (!ok) {
                        try {
                          const ta = document.createElement('textarea');
                          ta.value = text; ta.setAttribute('readonly', '');
                          ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
                          document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
                          ok = true;
                        } catch {}
                      }
                      if (ok) { setCopiedPhone(true); setTimeout(() => setCopiedPhone(false), 1500); }
                    }}
                    className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                    title={t('Copy phone', 'نسخ الهاتف')}
                  >
                    <span>{selected.customerId}</span>
                    {copiedPhone ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 opacity-60" />}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setDownloadOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/70 text-foreground text-[12px] transition-colors"
                    style={{ fontWeight: 600 }}
                    title={t('Download Ticket', 'تحميل التذكرة')}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t('Download Ticket', 'تحميل التذكرة')}</span>
                  </button>
                  <button
                    onClick={openNotes}
                    className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#043CC8]/10 hover:bg-[#043CC8]/20 text-[#043CC8] text-[12px] transition-colors"
                    style={{ fontWeight: 600 }}
                    title={t('Notes', 'ملاحظات')}
                  >
                    <StickyNote className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t('Notes', 'ملاحظات')}</span>
                    {unreadCount(selected) > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center" style={{ fontWeight: 700 }}>
                        {unreadCount(selected)}
                      </span>
                    )}
                  </button>
                  {selected.customerId && (
                    <a
                      href={`https://wa.me/${selected.customerId.replace(/\s|\+/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 hover:bg-green-500/10 rounded-xl transition-colors"
                      title="WhatsApp"
                    >
                      <img src={whatsappIcon} alt="WhatsApp" className="w-8 h-8 object-contain drop-shadow-sm" />
                    </a>
                  )}
                  <div className="relative">
                    <button onClick={() => setMenuOpen(menuOpen === selected.id ? null : selected.id)} className="p-2 hover:bg-muted rounded-xl transition-colors">
                      <MoreHorizontal className="w-[18px] h-[18px] text-muted-foreground" />
                    </button>
                    {menuOpen === selected.id && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(null)} />
                        <div className={`absolute z-40 ${dir === 'rtl' ? 'left-0' : 'right-0'} top-full mt-1 bg-card border border-border rounded-xl shadow-2xl py-1 w-44`}>
                          <button className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted text-[13px] transition-colors" onClick={() => { toggleStatus(selected.id); }}>
                            {selected.status === 'open' ? <CheckCircle className="w-4 h-4 text-muted-foreground" /> : <FolderOpen className="w-4 h-4 text-muted-foreground" />}
                            {selected.status === 'open' ? t('Close Ticket', 'إغلاق التذكرة') : t('Open Ticket', 'فتح التذكرة')}
                          </button>
                          <div className="my-1 border-t border-border" />
                          <button className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-red-500/10 text-red-400 text-[13px] transition-colors" onClick={() => deleteTicket(selected.id)}>
                            <Trash2 className="w-4 h-4" /> {t('Delete', 'حذف')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap ps-12 md:ps-0">
                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: categoryMap[selected.category].color + '12', color: categoryMap[selected.category].color, fontWeight: 600 }}>
                  {t(categoryMap[selected.category].en, categoryMap[selected.category].ar)}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: priorityMap[selected.priority].color + '12', color: priorityMap[selected.priority].color, fontWeight: 600 }}>
                  {t(priorityMap[selected.priority].en, priorityMap[selected.priority].ar)}
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${selected.status === 'open' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-500'}`} style={{ fontWeight: 600 }}>
                  {selected.status === 'open' ? t('Open', 'مفتوحة') : t('Closed', 'مغلقة')}
                </span>
                <span className="text-[10px] text-muted-foreground/60">
                  {t('Created:', 'أُنشئت:')} {selected.createdAt}
                </span>
                {selected.closedAt && (
                  <span className="text-[10px] text-muted-foreground/60">
                    {t('Closed:', 'أُغلقت:')} {selected.closedAt}
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 lg:p-5 space-y-3">
              {selected.messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center">
                  <p className="text-[13px] text-muted-foreground">{t('No linked conversation messages', 'لا توجد رسائل محادثة مرتبطة')}</p>
                </div>
              ) : selected.messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === 'customer' ? 'justify-start' : 'justify-end'}`}>
                  <div className="max-w-[75%]">
                    <div className={`rounded-2xl text-[14px] ${
                      msg.sender === 'customer'
                        ? 'bg-muted text-foreground rounded-bl-sm'
                        : getAiBubbleStyle(msg)
                    }`}>
                      {msg.type === 'image' || msg.type === 'file' ? (
                        <AttachmentBubble
                          attachment={{ type: msg.type, fileName: msg.fileName }}
                          onAi={msg.sender !== 'customer'}
                        />
                      ) : (
                        <div className="px-4 py-3">{msg.text}</div>
                      )}
                      <p className={`px-4 pb-2 text-[10px] ${msg.sender === 'customer' ? 'text-muted-foreground' : 'text-white/50'}`}>
                        {msg.time}
                      </p>
                    </div>
                    {msg.feedback && msg.sender === 'ai' && (
                      <div className="flex items-center mt-1.5 justify-end">
                        {msg.feedback === 'positive' ? (
                          <ThumbsUp className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <ThumbsDown className="w-3.5 h-3.5 text-red-400" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-border bg-muted/20">
              <p className="text-[12px] text-muted-foreground text-center" style={{ fontWeight: 500 }}>
                {t('This conversation is read-only', 'هذه المحادثة للقراءة فقط')}
              </p>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center">
            <div className="text-center">
              <Ticket className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-muted-foreground text-[14px]">{t('Select a ticket to view', 'اختر تذكرة للعرض')}</p>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <NotesActivityPanel
          open={notesOpen}
          onClose={() => setNotesOpen(false)}
          ticketId={selected.id}
          activities={selected.activities}
          onAddNote={addNote}
          onEditNote={editNote}
          onDeleteNote={deleteNote}
          currentUser={CURRENT_USER.name}
          currentUserRole={CURRENT_USER.role}
        />
      )}

      {selected && (
        <ChatLogDownloadModal
          open={downloadOpen}
          onClose={() => setDownloadOpen(false)}
          data={{
            kind: 'ticket',
            ticketId: selected.id,
            conversationId: selected.conversationId,
            storeName: getStoreName(),
            dateISO: new Date().toISOString(),
            status: selected.status,
            messages: selected.messages.map(m => ({
              id: m.id, sender: m.sender, text: m.text, time: m.time, type: m.type, fileName: m.fileName,
            })),
          }}
        />
      )}
    </div>
  );
}
