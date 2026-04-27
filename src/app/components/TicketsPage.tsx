import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, MoreHorizontal, FolderOpen, CheckCircle, Trash2, ArrowLeft, Ticket, Paperclip, Image, Download, ThumbsUp, ThumbsDown, Copy, Check, StickyNote } from 'lucide-react';
import { mockConversations } from './ConversationsPage';
import whatsappIcon from '../../imports/whatsapp.png';
import { ChatLogDownloadModal, getStoreName } from './ChatLogDownload';
import { AttachmentBubble } from './chat/AttachmentBubble';
import { NotesActivityPanel, Activity, AuthorRole } from './chat/NotesActivityPanel';
import { CURRENT_USER_ID, CURRENT_USER_NAME, CURRENT_USER_ROLE, notifKeys, getTs, setTs, toMs } from '../utils/notifications';

interface Message {
  id: string; sender: 'customer' | 'ai'; text: string; time: string;
  type?: 'text' | 'image' | 'file'; fileName?: string;
  feedback?: 'positive' | 'negative';
}

interface TicketItem {
  id: string; customerId: string; category: 'complaint' | 'inquiry' | 'request' | 'suggestion';
  priority: 'low' | 'medium' | 'high'; status: 'open' | 'closed';
  createdAt: string; closedAt?: string; customerName: string; avatarColor: string;
  conversationId?: string;
  messages: Message[];
  activities: Activity[];
}

const CURRENT_USER = { id: CURRENT_USER_ID, name: CURRENT_USER_NAME, role: CURRENT_USER_ROLE as AuthorRole };

function isoFromLocal(s: string): string {
  try { return new Date(s.replace(' ', 'T')).toISOString(); } catch { return new Date().toISOString(); }
}

const ACTIVITIES_KEY = 'fuqah.tickets.activities.v1';

function loadActivityStore(): Record<string, Activity[]> {
  try {
    const raw = localStorage.getItem(ACTIVITIES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveActivityStore(store: Record<string, Activity[]>) {
  try { localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(store)); } catch {}
}
function seedActivities(createdAt: string, closedAt?: string, status?: 'open' | 'closed'): Activity[] {
  const acts: Activity[] = [
    {
      id: `act-created-${createdAt}`,
      type: 'status',
      status: 'created',
      author: 'System',
      authorRole: 'admin',
      timestamp: isoFromLocal(createdAt),
    },
  ];
  if (closedAt && status === 'closed') {
    acts.push({
      id: `act-close-${closedAt}`,
      type: 'status',
      status: 'closed',
      author: 'System',
      authorRole: 'admin',
      timestamp: isoFromLocal(closedAt),
    });
  }
  return acts;
}

export function buildTicketsFromConversations(): TicketItem[] {
  const ticketConversations = mockConversations.filter(c => c.hasTicket);
  const manualTickets: TicketItem[] = [
    {
      id: 'TK-005', customerId: '+966 59 654 3210', category: 'complaint', priority: 'high', status: 'open',
      createdAt: '2026-04-14 07:00', customerName: 'Ali Saeed', avatarColor: '#8b5cf6',
      activities: seedActivities('2026-04-14 07:00'),
      messages: [
        { id: '1', sender: 'customer', text: 'طلبي متأخر أكثر من أسبوع. ذا محبط جداً.', time: '07:00 AM', type: 'text' },
        { id: '2', sender: 'ai', text: 'أعتذر بشدة عن التأخير. دعني أتحقق من حالة طلبك فوراً.', time: '07:00 AM', type: 'text', feedback: 'negative' },
        { id: '3', sender: 'ai', text: 'طلبك حالياً في مركز التوزيع. التسليم المتوقع غداً. تم تصنيفه كأولوية.', time: '07:01 AM', type: 'text', feedback: 'positive' },
      ]
    },
    {
      id: 'TK-006', customerId: '+966 58 111 2222', category: 'request', priority: 'medium', status: 'closed',
      createdAt: '2026-04-11 15:30', closedAt: '2026-04-12 09:00', customerName: 'Sara Mohammed', avatarColor: '#f59e0b',
      activities: [
        ...seedActivities('2026-04-11 15:30', '2026-04-12 09:00', 'closed'),
        {
          id: 'act-note-1',
          type: 'note',
          text: 'تمت مراجعة الطلب وتحديث العنوان بنجاح. لا حاجة لإجراء إضافي.',
          author: 'Ahmed Al-Rashid',
          authorRole: 'admin',
          timestamp: isoFromLocal('2026-04-12 09:05'),
        },
      ],
      messages: [
        { id: '1', sender: 'customer', text: 'هل يمكنني تغيير عنوان التوصيل؟ انتقلت الأسبوع الماضي.', time: '03:30 PM', type: 'text' },
        { id: '2', sender: 'ai', text: 'بالطبع! يرجى تقديم عنوانك الجديد وسأقوم بتحديثه فوراً.', time: '03:30 PM', type: 'text', feedback: 'positive' },
        { id: '3', sender: 'customer', text: 'العنوان الجديد: 123 طريق الملك فهد، الرياض', time: '03:31 PM', type: 'text' },
        { id: '4', sender: 'ai', text: 'تم تحديث العنوان بنجاح! سيتم توصيل طلبك إلى العنوان الجديد.', time: '03:32 PM', type: 'text', feedback: 'positive' },
      ]
    },
  ];

  const categoryMap: Record<string, 'complaint' | 'inquiry' | 'request' | 'suggestion'> = {
    'CV-001': 'inquiry',
    'CV-002': 'request',
    'CV-005': 'complaint',
  };
  const priorityMap: Record<string, 'low' | 'medium' | 'high'> = {
    'CV-001': 'low',
    'CV-002': 'medium',
    'CV-005': 'high',
  };
  const customerIdMap: Record<string, string> = {
    'CV-001': '+966 55 123 4567',
    'CV-002': '+966 54 456 7890',
    'CV-005': '+966 59 654 3210',
  };

  const fromConversations: TicketItem[] = ticketConversations.map((c, i) => ({
    id: `TK-00${i + 1}`,
    customerId: customerIdMap[c.id] || '+966 50 000 0000',
    category: categoryMap[c.id] || 'inquiry',
    priority: priorityMap[c.id] || 'medium',
    status: c.ticketStatus as 'open' | 'closed',
    createdAt: '2026-04-14 09:30',
    closedAt: c.ticketStatus === 'closed' ? '2026-04-14 16:45' : undefined,
    customerName: c.name,
    avatarColor: c.avatarColor,
    conversationId: c.id,
    activities: seedActivities(
      '2026-04-14 09:30',
      c.ticketStatus === 'closed' ? '2026-04-14 16:45' : undefined,
      c.ticketStatus as 'open' | 'closed',
    ),
    messages: c.messages.map(m => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      time: m.time,
      type: m.type,
      fileName: m.fileName,
      feedback: m.feedback,
    })),
  }));

  return [...fromConversations, ...manualTickets];
}

export function TicketsPage() {
  const { t, showToast, dir } = useApp();
  const [tickets, setTickets] = useState<TicketItem[]>(() => {
    const base = buildTicketsFromConversations();
    const store = loadActivityStore();
    return base.map(tk => store[tk.id] ? { ...tk, activities: store[tk.id] } : tk);
  });
  const [selected, setSelected] = useState<TicketItem | null>(null);
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [bumpV, setBumpV] = useState(0);
  const bump = () => setBumpV(v => v + 1);

  useEffect(() => {
    const store: Record<string, Activity[]> = {};
    tickets.forEach(tk => { store[tk.id] = tk.activities; });
    saveActivityStore(store);
  }, [tickets]);

  const unreadCount = (tk: TicketItem): number => {
    const seen = getTs(notifKeys.ticketNotesSeen(CURRENT_USER.id, tk.id));
    return tk.activities.reduce((n, a) => (new Date(a.timestamp).getTime() > seen ? n + 1 : n), 0);
  };

  const isNewTicket = (tk: TicketItem): boolean => {
    const opened = getTs(notifKeys.ticketOpened(CURRENT_USER.id, tk.id));
    return opened === 0;
  };
  // re-render when bumpV changes
  React.useMemo(() => bumpV, [bumpV]);

  const openNotes = () => {
    if (selected) {
      setTs(notifKeys.ticketNotesSeen(CURRENT_USER.id, selected.id));
      bump();
    }
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

  const filtered = tickets.filter(tk =>
    tk.id.toLowerCase().includes(search.toLowerCase()) ||
    tk.customerId.includes(search) ||
    tk.customerName.toLowerCase().includes(search.toLowerCase())
  );

  const toggleStatus = (id: string) => {
    const nowIso = new Date().toISOString();
    setTickets(tk => tk.map(x => {
      if (x.id !== id) return x;
      const newStatus = x.status === 'open' ? 'closed' as const : 'open' as const;
      const act: Activity = {
        id: `act-${Date.now()}`,
        type: 'status',
        status: newStatus,
        author: CURRENT_USER.name,
        authorRole: CURRENT_USER.role,
        timestamp: nowIso,
      };
      return {
        ...x,
        status: newStatus,
        closedAt: newStatus === 'closed' ? '2026-04-14 12:00' : undefined,
        activities: [...x.activities, act],
      };
    }));
    if (selected?.id === id) {
      setSelected(prev => {
        if (!prev) return null;
        const newStatus = prev.status === 'open' ? 'closed' as const : 'open' as const;
        const act: Activity = {
          id: `act-${Date.now()}`,
          type: 'status',
          status: newStatus,
          author: CURRENT_USER.name,
          authorRole: CURRENT_USER.role,
          timestamp: nowIso,
        };
        return {
          ...prev,
          status: newStatus,
          closedAt: newStatus === 'closed' ? '2026-04-14 12:00' : undefined,
          activities: [...prev.activities, act],
        };
      });
    }
    setMenuOpen(null);
    showToast(t('Ticket status updated', 'تم تحديث حالة التذكرة'));
  };

  const addNote = (text: string, attachment?: import('./chat/NotesActivityPanel').Activity['attachment']) => {
    if (!selected) return;
    if (!text && !attachment) return;
    const act: Activity = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'note',
      text,
      attachment,
      author: CURRENT_USER.name,
      authorRole: CURRENT_USER.role,
      timestamp: new Date().toISOString(),
    };
    setTickets(tk => tk.map(x => x.id === selected.id ? { ...x, activities: [...x.activities, act] } : x));
    setSelected(prev => prev ? { ...prev, activities: [...prev.activities, act] } : null);
    setLastSeen(s => ({ ...s, [selected.id]: Date.now() }));
    showToast(t('Note added', 'تمت إضافة الملاحظة'));
  };

  const editNote = (noteId: string, text: string) => {
    if (!selected) return;
    const editedAt = new Date().toISOString();
    const mutate = (acts: Activity[]) => acts.map(a =>
      a.id === noteId && a.type === 'note' && a.author === CURRENT_USER.name
        ? { ...a, text, editedAt }
        : a
    );
    setTickets(tk => tk.map(x => x.id === selected.id ? { ...x, activities: mutate(x.activities) } : x));
    setSelected(prev => prev ? { ...prev, activities: mutate(prev.activities) } : null);
    showToast(t('Note updated', 'تم تعديل الملاحظة'));
  };

  const deleteNote = (noteId: string) => {
    if (!selected) return;
    const mutate = (acts: Activity[]) => acts.filter(a =>
      !(a.id === noteId && a.type === 'note' && a.author === CURRENT_USER.name)
    );
    setTickets(tk => tk.map(x => x.id === selected.id ? { ...x, activities: mutate(x.activities) } : x));
    setSelected(prev => prev ? { ...prev, activities: mutate(prev.activities) } : null);
    showToast(t('Note deleted', 'تم حذف الملاحظة'));
  };

  const deleteTicket = (id: string) => {
    setTickets(tk => tk.filter(x => x.id !== id));
    if (selected?.id === id) setSelected(null);
    setMenuOpen(null);
    showToast(t('Ticket deleted', 'تم حذف التذكرة'));
  };

  const getAiBubbleStyle = (msg: Message) => {
    if (msg.sender !== 'ai') return '';
    return 'bg-[#043CC8] text-white rounded-br-sm';
  };

  return (
    <div className="h-[calc(100vh-7rem)]">
      <h1 className="text-[24px] mb-4" style={{ fontWeight: 700 }}>{t('Tickets', 'التذاكر')}</h1>

      <div className="flex h-[calc(100%-3rem)] bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Ticket List */}
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
            {filtered.map(tk => {
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
                      <span className="text-[10px] text-muted-foreground/60" style={{ fontWeight: 500 }}>{tk.id}</span>
                      <span className="text-[9px] px-1.5 py-[1px] rounded" style={{ backgroundColor: cat.color + '12', color: cat.color, fontWeight: 600 }}>
                        {t(cat.en, cat.ar)}
                      </span>
                    </div>
                    <p className="text-[12px] text-muted-foreground truncate mt-1">
                      {tk.messages[tk.messages.length - 1]?.text || tk.messages[tk.messages.length - 1]?.fileName}
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

        {/* Ticket Detail View */}
        {selected ? (
          <div className="flex flex-col flex-1 min-w-0">
            {/* Ticket Info Header */}
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
                    <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md" style={{ fontWeight: 500 }}>{selected.id}</span>
                  </div>
                  <button
                    type="button"
                    dir="ltr"
                    onClick={async () => {
                      const text = selected.customerId;
                      let ok = false;
                      try {
                        if (navigator.clipboard && window.isSecureContext) {
                          await navigator.clipboard.writeText(text);
                          ok = true;
                        }
                      } catch {}
                      if (!ok) {
                        try {
                          const ta = document.createElement('textarea');
                          ta.value = text;
                          ta.setAttribute('readonly', '');
                          ta.style.position = 'fixed';
                          ta.style.top = '-1000px';
                          ta.style.opacity = '0';
                          document.body.appendChild(ta);
                          ta.select();
                          document.execCommand('copy');
                          document.body.removeChild(ta);
                          ok = true;
                        } catch {}
                      }
                      if (ok) {
                        setCopiedPhone(true);
                        setTimeout(() => setCopiedPhone(false), 1500);
                      }
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
                  <a
                    href={`https://wa.me/${selected.customerId.replace(/\s|\+/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 hover:bg-green-500/10 rounded-xl transition-colors"
                    title="WhatsApp"
                  >
                    <img src={whatsappIcon} alt="WhatsApp" className="w-8 h-8 object-contain drop-shadow-sm" />
                  </a>
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

              {/* Ticket Meta */}
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

            {/* Conversation Messages */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-5 space-y-3">
              {selected.messages.map(msg => (
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
                    {/* Feedback indicator — icons only */}
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
            dateISO: new Date(selected.createdAt.replace(' ', 'T')).toISOString(),
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