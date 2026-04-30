import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Star, ArrowLeft, Download, MessageSquare, Ticket, CheckCircle, ThumbsUp, ThumbsDown, CircleDot, Lock, Unlock, Clock, User, Bot, Sparkles, Loader2 } from 'lucide-react';
import { AttachmentBubble } from './chat/AttachmentBubble';
import { ChatLogDownloadModal, getStoreName } from './ChatLogDownload';
import { CURRENT_USER_ID, notifKeys, getTs, setTs } from '../utils/notifications';
import { supabase } from '../../integrations/supabase/client';
import { seedDemoData } from '../services/seedDemoData';

interface Message {
  id: string; sender: 'customer' | 'ai'; text: string; time: string;
  type?: 'text' | 'image' | 'file'; fileName?: string;
  feedback?: 'positive' | 'negative';
}

type ChatCloseReason = 'customer_manual' | 'ai_request' | 'idle';
type ChatCategory = 'inquiry' | 'complaint' | 'request' | 'suggestion';

export interface Conversation {
  id: string; name: string; avatarColor: string; lastMessage: string;
  time: string; rating: number; hasTicket: boolean; ticketStatus?: 'open' | 'closed'; messages: Message[];
  ratingComment?: string;
  chatStatus: 'open' | 'closed';
  closeReason?: ChatCloseReason;
  category?: ChatCategory;
  createdAt: string;
  closedAt?: string;
}

// Kept for backwards compat with any legacy import; populated from DB now.
export const mockConversations: Conversation[] = [];

const COLORS = ['#043CC8', '#10b981', '#f59e0b', '#8b5cf6', '#ff4466', '#00C9BD', '#ec4899'];
function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

function relativeTime(iso: string, lang: 'en' | 'ar'): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return lang === 'ar' ? 'الآن' : 'now';
  if (m < 60) return lang === 'ar' ? `منذ ${m} د` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return lang === 'ar' ? `منذ ${h} س` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return lang === 'ar' ? `منذ ${d} ي` : `${d}d ago`;
}

function formatTimeOnly(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 5)}`;
  } catch { return ''; }
}

export function ConversationsPage() {
  const { t, language, tenantId, showToast } = useApp();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [search, setSearch] = useState('');
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [, setBumpV] = useState(0);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const loadConversations = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data: convs } = await supabase
        .from('conversations_main')
        .select('id, customer_id, subject, category, status, ticket_status, csat_rating, rating_comment, close_reason, created_at, resolved_at, last_message_at')
        .eq('tenant_id', tenantId)
        .order('last_message_at', { ascending: false });

      if (!convs || convs.length === 0) { setConversations([]); setLoading(false); return; }

      const customerIds = Array.from(new Set(convs.map(c => c.customer_id).filter(Boolean) as string[]));
      const convIds = convs.map(c => c.id);

      const [{ data: customers }, { data: messages }] = await Promise.all([
        customerIds.length > 0
          ? supabase.from('conversations_customers').select('id, display_name, display_name_ar, phone, avatar_color').in('id', customerIds)
          : Promise.resolve({ data: [] as { id: string; display_name: string | null; display_name_ar: string | null; phone: string | null; avatar_color: string | null }[] }),
        supabase.from('conversations_messages')
          .select('id, conversation_id, sender, body, kind, file_name, feedback, created_at')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: true }),
      ]);

      const cMap = new Map((customers || []).map(c => [c.id, c]));
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

      const mapped: Conversation[] = convs.map(c => {
        const cust = c.customer_id ? cMap.get(c.customer_id) : null;
        const name = (language === 'ar' ? (cust?.display_name_ar || cust?.display_name) : cust?.display_name) || cust?.phone || t('Unknown', 'مجهول');
        const msgs = msgsByConv.get(c.id) || [];
        const last = msgs[msgs.length - 1];
        const isClosed = c.status === 'closed' || c.status === 'resolved';
        return {
          id: c.id,
          name,
          avatarColor: cust?.avatar_color || colorFor(c.id),
          lastMessage: last?.text || (last?.fileName ? last.fileName : ''),
          time: relativeTime(c.last_message_at || c.created_at, language),
          rating: c.csat_rating || 0,
          ratingComment: c.rating_comment || undefined,
          hasTicket: !!c.ticket_status,
          ticketStatus: (c.ticket_status === 'open' || c.ticket_status === 'closed') ? c.ticket_status : undefined,
          chatStatus: isClosed ? 'closed' : 'open',
          closeReason: (c.close_reason as ChatCloseReason | null) || undefined,
          category: (['inquiry', 'complaint', 'request', 'suggestion'].includes(c.category || '') ? c.category : 'inquiry') as ChatCategory,
          createdAt: formatDateTime(c.created_at),
          closedAt: c.resolved_at ? formatDateTime(c.resolved_at) : undefined,
          messages: msgs,
        };
      });

      setConversations(mapped);
      // Refresh selected if needed
      if (selected) {
        const fresh = mapped.find(m => m.id === selected.id);
        if (fresh) setSelected(fresh);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConversations(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tenantId, language]);

  const handleSeed = async () => {
    if (!tenantId) return;
    setSeeding(true);
    const res = await seedDemoData(tenantId);
    setSeeding(false);
    if (res.ok) { showToast(t('Demo data added', 'تمت إضافة بيانات تجريبية')); await loadConversations(); }
    else showToast(res.error || t('Failed to seed', 'فشل التحميل'));
  };

  const isNewConversation = (c: Conversation): boolean => {
    const opened = getTs(notifKeys.conversationOpened(CURRENT_USER_ID, c.id));
    return opened === 0;
  };
  const handleSelect = (c: Conversation) => {
    setTs(notifKeys.conversationOpened(CURRENT_USER_ID, c.id));
    setSelected(c);
    setBumpV(v => v + 1);
  };

  const getDisplayName = (name: string) => name?.trim() || t('Unknown Customer', 'عميل غير معروف');
  const getInitials = (name: string) => {
    const display = name?.trim();
    if (!display) return '?';
    return display.split(' ').map(n => n[0]).join('').slice(0, 2);
  };

  const categoryMap: Record<ChatCategory, { en: string; ar: string; color: string }> = {
    complaint: { en: 'Complaint', ar: 'شكوى', color: '#ff4466' },
    inquiry: { en: 'Inquiry', ar: 'استفسار', color: '#043CC8' },
    request: { en: 'Request', ar: 'طلب', color: '#f59e0b' },
    suggestion: { en: 'Suggestion', ar: 'اقتراح', color: '#10b981' },
  };

  const closeReasonMap: Record<ChatCloseReason, { en: string; ar: string; icon: React.ComponentType<{ className?: string }> }> = {
    customer_manual: { en: 'Closed by customer', ar: 'أغلقها العميل', icon: User },
    ai_request: { en: 'Closed by AI request', ar: 'أغلقت بطلب من الذكاء', icon: Bot },
    idle: { en: 'Closed due to inactivity', ar: 'أُغلقت بسبب الخمول', icon: Clock },
  };

  const filtered = useMemo(() => conversations.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.id.toLowerCase().includes(search.toLowerCase())
  ), [conversations, search]);

  return (
    <div className="h-[calc(100vh-7rem)]">
      <h1 className="text-[24px] mb-4" style={{ fontWeight: 700 }}>{t('Conversations', 'المحادثات')}</h1>

      <div className="flex h-[calc(100%-3rem)] bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* List */}
        <div className={`${selected ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-[320px] lg:w-[340px] border-e border-border shrink-0`}>
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('Search by name or ID...', 'بحث بالاسم أو المعرف...')}
                className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-input-background border border-border text-[13px] outline-none focus:border-[#043CC8] focus:ring-2 focus:ring-[#043CC8]/20 transition-all text-foreground"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 flex items-center justify-center text-muted-foreground text-[13px]"><Loader2 className="w-4 h-4 animate-spin me-2" /> {t('Loading...', 'جاري التحميل...')}</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-[13px] text-muted-foreground mb-3">{t('No conversations yet', 'لا توجد محادثات بعد')}</p>
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
            ) : filtered.map(c => (
              <button
                key={c.id}
                onClick={() => handleSelect(c)}
                className={`w-full flex items-start gap-3 px-4 py-3.5 hover:bg-muted/40 border-b border-border transition-colors text-start ${selected?.id === c.id ? 'bg-muted/60' : ''}`}
              >
                <div className="relative shrink-0 mt-0.5">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px]" style={{ backgroundColor: c.avatarColor, fontWeight: 700 }}>
                    {getInitials(c.name)}
                  </div>
                  {isNewConversation(c) && (
                    <span className="absolute -top-1 -end-1 w-3 h-3 rounded-full bg-red-500 border-2 border-card" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center gap-2">
                    <p className="text-[14px] truncate" style={{ fontWeight: 500 }}>{getDisplayName(c.name)}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      {isNewConversation(c) && (
                        <span className="text-[9px] px-1.5 py-[1px] rounded-full bg-red-500 text-white" style={{ fontWeight: 700 }}>
                          {t('NEW', 'جديد')}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">{c.time}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5" style={{ fontWeight: 500 }}>{c.id.slice(0, 8)}</p>
                  <p className="text-[13px] text-muted-foreground truncate mt-0.5">{c.lastMessage}</p>
                  <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                    {c.hasTicket && c.ticketStatus === 'open' ? (
                      <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-[1px] rounded-full bg-red-500/10 text-red-400" style={{ fontWeight: 600 }}>
                        <CircleDot className="w-2.5 h-2.5" />
                        {t('Open Ticket', 'تذكرة مفتوحة')}
                      </span>
                    ) : c.hasTicket && c.ticketStatus === 'closed' ? (
                      <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-[1px] rounded-full bg-green-500/10 text-green-500" style={{ fontWeight: 600 }}>
                        <CheckCircle className="w-2.5 h-2.5" />
                        {t('Closed Ticket', 'تذكرة مغلقة')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-[1px] rounded-full bg-muted text-muted-foreground" style={{ fontWeight: 600 }}>
                        <Ticket className="w-2.5 h-2.5" />
                        {t('No Ticket', 'لا تذكرة')}
                      </span>
                    )}
                    {c.chatStatus === 'open' ? (
                      <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-[1px] rounded-full bg-[#043CC8]/10 text-[#043CC8] dark:text-[#6b8bff]" style={{ fontWeight: 600 }} title={t('Chat Open', 'المحادثة مفتوحة')}>
                        <Unlock className="w-2.5 h-2.5" />
                        {t('Chat Open', 'محادثة مفتوحة')}
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-[1px] rounded-full bg-muted text-muted-foreground"
                        style={{ fontWeight: 600 }}
                        title={c.closeReason ? t(closeReasonMap[c.closeReason].en, closeReasonMap[c.closeReason].ar) : ''}
                      >
                        <Lock className="w-2.5 h-2.5" />
                        {t('Chat Closed', 'محادثة مغلقة')}
                      </span>
                    )}
                    {c.rating > 0 && (
                      <span className="inline-flex items-center gap-0.5 ms-auto">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} className={`w-2 h-2 ${s <= c.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20'}`} />
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat */}
        {selected ? (
          <div className="flex flex-col flex-1 min-w-0">
            <div className="px-4 lg:px-5 py-3 border-b border-border bg-muted/20 space-y-2">
            <div className="flex items-center gap-3">
              <button className="md:hidden p-1" onClick={() => setSelected(null)}>
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px]" style={{ backgroundColor: selected.avatarColor, fontWeight: 700 }}>
                {getInitials(selected.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[14px]" style={{ fontWeight: 600 }}>{getDisplayName(selected.name)}</p>
                  <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md" style={{ fontWeight: 500 }}>{selected.id.slice(0, 8)}</span>
                </div>
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} className={`w-3 h-3 ${s <= selected.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20'}`} />
                  ))}
                  <span className="text-[11px] text-muted-foreground ms-1">{selected.rating}/5</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDownloadOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/70 text-foreground text-[12px] transition-colors"
                  style={{ fontWeight: 600 }}
                  title={t('Download Chat', 'تحميل المحادثة')}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('Download Chat', 'تحميل المحادثة')}</span>
                </button>
                {selected.hasTicket && selected.ticketStatus === 'open' ? (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 text-red-400 text-[12px]" style={{ fontWeight: 600 }}>
                    <CircleDot className="w-3.5 h-3.5" /> {t('Open Ticket', 'تذكرة مفتوحة')}
                  </span>
                ) : selected.hasTicket && selected.ticketStatus === 'closed' ? (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500/10 text-green-500 text-[12px]" style={{ fontWeight: 600 }}>
                    <CheckCircle className="w-3.5 h-3.5" /> {t('Closed Ticket', 'تذكرة مغلقة')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-muted-foreground text-[12px]" style={{ fontWeight: 600 }}>
                    <Ticket className="w-3.5 h-3.5" /> {t('No Ticket', 'لا تذكرة')}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap ps-12 md:ps-0">
              {selected.category && (
                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: categoryMap[selected.category].color + '12', color: categoryMap[selected.category].color, fontWeight: 600 }}>
                  {t(categoryMap[selected.category].en, categoryMap[selected.category].ar)}
                </span>
              )}
              <span className={`text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${selected.chatStatus === 'open' ? 'bg-[#043CC8]/10 text-[#043CC8] dark:text-[#6b8bff]' : 'bg-muted text-muted-foreground'}`} style={{ fontWeight: 600 }}>
                {selected.chatStatus === 'open' ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {selected.chatStatus === 'open' ? t('Open', 'مفتوحة') : t('Closed', 'مغلقة')}
              </span>
              {selected.chatStatus === 'closed' && selected.closeReason && (() => {
                const r = closeReasonMap[selected.closeReason];
                const Icon = r.icon;
                return (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted/70 text-muted-foreground inline-flex items-center gap-1" style={{ fontWeight: 500 }}>
                    <Icon className="w-3 h-3" />
                    {t(r.en, r.ar)}
                  </span>
                );
              })()}
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

            {selected.ratingComment && (
              <div className="px-4 lg:px-5 py-2.5 border-b border-border bg-yellow-500/5 flex items-start gap-2">
                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-[12px] text-muted-foreground" style={{ fontWeight: 400 }}>
                  "{selected.ratingComment}"
                </p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 lg:p-5 space-y-3">
              {selected.messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === 'customer' ? 'justify-start' : 'justify-end'}`}>
                  <div className="max-w-[75%]">
                    <div className={`rounded-2xl text-[14px] ${
                      msg.sender === 'customer'
                        ? 'bg-muted text-foreground rounded-bl-sm'
                        : 'bg-[#043CC8] text-white rounded-br-sm'
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
                    {msg.feedback && (
                      <div className={`flex items-center mt-1.5 ${msg.sender === 'ai' ? 'justify-end' : ''}`}>
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
              <MessageSquare className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-muted-foreground text-[14px]">{t('Select a conversation to view', 'اختر محادثة للعرض')}</p>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <ChatLogDownloadModal
          open={downloadOpen}
          onClose={() => setDownloadOpen(false)}
          data={{
            kind: 'chat',
            conversationId: selected.id,
            storeName: getStoreName(),
            dateISO: new Date().toISOString(),
            messages: selected.messages.map(m => ({
              id: m.id, sender: m.sender, text: m.text, time: m.time, type: m.type, fileName: m.fileName,
            })),
          }}
        />
      )}
    </div>
  );
}
