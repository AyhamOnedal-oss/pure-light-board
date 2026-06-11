/**
 * ChatWidget — Main entry point
 *
 * THEME CONTROL (Backend / Dashboard):
 *   The active theme is set via ACTIVE_THEME_ID in /src/app/types/theme.ts
 *   and will be passed from the backend via the widget initialization script.
 *
 *   Example backend integration:
 *     window.ChatWidgetConfig = {
 *       themeId: 'gold',
 *       storeName: 'My Store',
 *       storeLogo: 'https://...',
 *       apiEndpoint: 'https://api.mystore.com/chat',
 *     };
 *
 * The 7 available themes:
 *   'white' | 'black' | 'gold' | 'sky' | 'navy' | 'red' | 'whatsapp'
 *
 * Users CANNOT change the theme from inside the chat UI.
 */

import { useState, useRef, useEffect } from 'react';
import { ChatHeader } from './ChatHeader';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ConfirmationModal } from './ConfirmationModal';
import { RatingScreen } from './RatingScreen';
import { EmptyState } from './EmptyState';
import { TypingIndicator } from './TypingIndicator';
import { TicketCreatedScreen } from './TicketCreatedScreen';
import { ChatFooter } from './ChatFooter';
import { THEMES, ACTIVE_THEME_ID, getThemeById } from '../types/theme';
import { sendMessage } from '../utils/chatApi';
import { closeConversation as analyticsCloseConversation } from '../utils/analytics';

// ─── Types ───────────────────────────────────────────────��──────────────────

export interface MessageAttachment {
  type: 'image' | 'file';
  url: string;
  name: string;
  size?: number;
  /** base64 data URL of image content, used for sending to vision-capable backend */
  dataUrl?: string;
  /** MIME type, e.g. image/jpeg */
  content_type?: string;
}

export interface Message {
  id: string;
  text: string;
  sender: 'store' | 'customer';
  attachment?: MessageAttachment;
  timestamp: Date;
  /** 'ticket-form' renders an inline phone-number form in the chat */
  type?: 'text' | 'ticket-form' | 'ticket-success';
  /** true after the inline ticket form has been submitted */
  ticketFormSubmitted?: boolean;
  /** Parent conversation ID — links this message to a conversation session */
  conversationId?: string;
  /** Optional product cards (rendered under the text bubble for AI messages) */
  products?: import('../utils/chatApi').ProductCard[];
  /** Quick-reply chips rendered under an AI bubble (e.g. نعم / لا) */
  quickReplies?: { label: string; value: 'yes' | 'no' }[];
  /** Set to true once the user picked a quick reply, to hide the chips */
  quickReplyPicked?: boolean;
  /** Optional action flag attached to this AI message */
  action?: 'offer_ticket' | 'offer_close';
  /** Optional feedback state on agent message */
  feedback?: 'up' | 'down' | null;
}

type ScreenView = 'chat' | 'rating' | 'ticket-form' | 'ticket-created';

// ─── Store configuration ──────────────────────────────────────────────────────
// In production, these values come from the backend initialization config.
const STORE_CONFIG = {
  name: 'متجر الهدايا الحديث',
  logo: 'https://images.unsplash.com/photo-1634578198204-a3a28778cfb6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBzdG9yZSUyMHNob3AlMjBsb2dvfGVufDF8fHx8MTc3NTk3MTAzNHww&ixlib=rb-4.1.0&q=80&w=1080',
  /** Store icon — 32×32px avatar for header and agent messages */
  icon: 'https://images.unsplash.com/photo-1634578198204-a3a28778cfb6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBzdG9yZSUyMHNob3AlMjBsb2dvfGVufDF8fHx8MTc3NTk3MTAzNHww&ixlib=rb-4.1.0&q=80&w=1080',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateTicketId(): string {
  return '#TKT-' + Math.floor(10000 + Math.random() * 90000);
}

function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeAssistantTriggerText(text?: string): string {
  return (text ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[.!؟?،,؛:]/g, '')
    .replace(/\s+/g, ' ');
}

function isShortAffirmative(text: string): boolean {
  const normalized = normalizeAssistantTriggerText(text);
  return /^(نعم|اي|اي نعم|ايه|ايوه|تمام|تم|اكيد|yes|yeah|yep|ok|okay)$/.test(normalized);
}

function isTicketOfferPrompt(text?: string): boolean {
  const normalized = normalizeAssistantTriggerText(text);
  return normalized.includes('يتواصل معك احد موظفي خدمه العملاء')
    || normalized.includes('اكلم خدمه العملاء')
    || (normalized.includes('customer service') && normalized.includes('contact'));
}

function isCloseOfferPrompt(text?: string): boolean {
  const normalized = normalizeAssistantTriggerText(text);
  return normalized.includes('هل تحتاج اي مساعده اخري')
    || normalized.includes('هل تحتاج اي مساعده اخرى')
    || normalized.includes('do you need any other help');
}

function isCloseDoneReply(text?: string): boolean {
  const normalized = normalizeAssistantTriggerText(text);
  return normalized.includes('شكرا لتواصلك معنا')
    || normalized.includes('يومك سعيد')
    || normalized.includes('في امان الله');
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatWidget() {
  // Active theme — controlled from backend/dashboard, NOT by the user
  const currentTheme = getThemeById(ACTIVE_THEME_ID);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<ScreenView>('chat');
  const [ticketId] = useState(generateTicketId);
  const [conversationId] = useState(generateConversationId);

  /** Tracks whether the conversation has already been closed server-side. */
  const closedRef = useRef(false);

  // ── Tab-close / pagehide: signal "inactivity" so the row closes server-side
  //    instead of waiting for the idle cron.
  useEffect(() => {
    const fireClose = () => {
      if (closedRef.current || !conversationId) return;
      closedRef.current = true;
      try {
        analyticsCloseConversation(
          { storeId: storeConfig.storeId, conversationId },
          'inactivity',
        );
      } catch {
        /* swallow — best effort */
      }
    };
    const onPageHide = () => fireClose();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') fireClose();
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [conversationId, storeConfig.storeId]);

  /** Tracks how the current ticket was created: 'inline' or 'form' */
  const ticketSourceRef = useRef<'inline' | 'form'>('form');

  /** Serializes send calls so multi-line sends are processed in order. */
  const sendQueueRef = useRef<Promise<void>>(Promise.resolve());

  /** Always-current snapshot of messages, for serialized sends. */
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ── Auto-scroll refs ────────────────────────────────────────────────────────
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Immediate
    container.scrollTop = container.scrollHeight;

    // After DOM paint
    const raf = requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });

    // After animations / image loads
    const t = setTimeout(() => {
      container.scrollTop = container.scrollHeight;
      messagesEndRef.current?.scrollIntoView({ block: 'end' });
    }, 150);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [messages, isTyping]);

  // ── Message handlers ────────────────────────────────────────────────────────

  const sendOne = async (text: string, attachment?: MessageAttachment) => {
    const currentMessages = messagesRef.current;
    const lastAssistantMessage = [...currentMessages].reverse().find(m => m.sender === 'store');
    const hasOpenTicketForm = currentMessages.some(m => m.type === 'ticket-form' && !m.ticketFormSubmitted);
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'customer',
      attachment,
      timestamp: new Date(),
      conversationId,
    };
    setMessages(prev => {
      const next = [...prev, newMessage];
      messagesRef.current = next;
      return next;
    });

    const lastAssistantOfferedTicket = lastAssistantMessage?.action === 'offer_ticket'
      || isTicketOfferPrompt(lastAssistantMessage?.text);

    if (!attachment && lastAssistantOfferedTicket && isShortAffirmative(text)) {
      if (hasOpenTicketForm) return;
      const ticketForm: Message = {
        id: `ticket-form-${Date.now()}`,
        text: 'يرجى إدخال رقم هاتفك ليتم إنشاء تذكرة دعم لك:',
        sender: 'store',
        timestamp: new Date(),
        conversationId,
        type: 'ticket-form',
        ticketFormSubmitted: false,
      };
      ticketSourceRef.current = 'inline';
      setMessages(prev => [...prev, ticketForm]);
      return;
    }

    setIsTyping(true);
    const history = messagesRef.current.slice(-10).map(m => ({
      sender: m.sender,
      text: m.text,
    }));
    const { reply, rateLimited, error, attachments, action } = await sendMessage(conversationId, text, history, attachment);
    setIsTyping(false);

    let responseText = reply;
    if (rateLimited) {
      responseText = 'لقد تجاوزت الحد المسموح من الرسائل. الرجاء الانتظار دقيقة قبل المحاولة مجدداً.';
    } else if (error || !reply) {
      responseText = 'عذراً، حدث خطأ مؤقت. الرجاء المحاولة مجدداً.';
    }

    const isOfferClose = action?.type === 'offer_close' || isCloseOfferPrompt(responseText);
    const isOfferTicket = action?.type === 'offer_ticket' || isTicketOfferPrompt(responseText);
    const isCloseDone = action?.type === 'offer_close_done'
      || (!isOfferTicket && !isOfferClose && isCloseDoneReply(responseText));

    const response: Message = {
      id: (Date.now() + 1).toString(),
      text: responseText,
      sender: 'store',
      timestamp: new Date(),
      conversationId,
      products: (attachments ?? []).filter((a) => a?.type === 'product_card'),
      quickReplies: isOfferClose
        ? [
            { label: 'نعم', value: 'yes' },
            { label: 'لا', value: 'no' },
          ]
        : undefined,
      action: isOfferClose ? 'offer_close' : isOfferTicket ? 'offer_ticket' : undefined,
    };

    if (isOfferTicket && !rateLimited && !error) {
      // Append AI bubble + inline phone form as a second message.
      const ticketForm: Message = {
        id: `${response.id}-form`,
        text: 'يرجى إدخال رقم هاتفك ليتم إنشاء تذكرة دعم لك:',
        sender: 'store',
        timestamp: new Date(),
        conversationId,
        type: 'ticket-form',
        ticketFormSubmitted: false,
      };
      ticketSourceRef.current = 'inline';
      setMessages(prev => {
        const next = [...prev, response, ticketForm];
        messagesRef.current = next;
        return next;
      });
    } else {
      setMessages(prev => {
        const next = [...prev, response];
        messagesRef.current = next;
        return next;
      });
    }

    if (isCloseDone) {
      setTimeout(() => setCurrentScreen('rating'), 700);
    }
  };

  /** Public entry: queues sends so multi-line bursts execute sequentially. */
  const handleSendMessage = (text: string, attachment?: MessageAttachment) => {
    const next = sendQueueRef.current.then(() => sendOne(text, attachment)).catch(() => {});
    sendQueueRef.current = next;
    return next;
  };

  // ── Quick-reply handler (نعم / لا for "Do you need anything else?") ────────
  const handleQuickReplyPick = (messageId: string, value: 'yes' | 'no') => {
    setMessages(prev =>
      prev.map(m => (m.id === messageId ? { ...m, quickReplyPicked: true } : m)),
    );
    if (value === 'no') {
      setCurrentScreen('rating');
    } else {
      handleSendMessage('نعم');
    }
  };

  // ── Inline ticket-form submit (from offer_ticket flow) ─────────────────────
  const handleInlineTicketSubmit = (_phone: string, _dialCode: string) => {
    // Mark the ticket-form message as submitted, then show the ticket screen.
    setMessages(prev =>
      prev.map(m =>
        m.type === 'ticket-form' && !m.ticketFormSubmitted
          ? { ...m, ticketFormSubmitted: true }
          : m,
      ),
    );
    setCurrentScreen('ticket-created');
  };

  // ── Download ────────────────────────────────────────────────────────────────

  const handleDownload = () => {
    const lines = messages.map(m => {
      const sender = m.sender === 'store' ? STORE_CONFIG.name : 'العميل';
      const time = m.timestamp.toLocaleTimeString('ar-SA');
      return `[${time}] ${sender}: ${m.text || '[مرفق]'}`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `محادثة-${STORE_CONFIG.name}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Modal / Rating / Ticket flow ───────────────────────────────────────────

  const handleCloseClick = () => setShowConfirmModal(true);

  const handleConvertToTicket = () => {
    setShowConfirmModal(false);
    ticketSourceRef.current = 'form';
    setCurrentScreen('ticket-form');
  };

  const handleConfirmClose = () => {
    setShowConfirmModal(false);
    setCurrentScreen('rating');
  };

  const handleRatingSubmit = (_rating: number, _feedback?: string) => {
    // In production: POST rating to API, then close widget
    setCurrentScreen('chat');
  };

  const handleTicketClose = () => {
    // In production: signal backend that user acknowledged ticket
    setCurrentScreen('chat');
    setMessages([]);
  };

  const handleTicketBackToChat = () => {
    // Only inject success message for the X → Create Ticket flow.
    // The inline flow already shows a green badge on the ticket-form message.
    if (ticketSourceRef.current === 'form') {
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.type === 'ticket-success') return prev;
        return [
          ...prev,
          {
            id: `ticket-success-${Date.now()}`,
            text: 'تم إرسال طلبك بنجاح',
            sender: 'store' as const,
            timestamp: new Date(),
            type: 'ticket-success' as const,
          },
        ];
      });
    }
    setCurrentScreen('chat');
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="chat-root flex items-center justify-center min-h-screen bg-gray-100 p-4"
      dir="rtl"
    >
      {/* Widget card */}
      <div
        className="chat-widget-card w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100"
        style={{ height: '620px' }}
      >
        {/* ── Rating screen ── */}
        {currentScreen === 'rating' && (
          <RatingScreen
            onClose={() => setCurrentScreen('chat')}
            onBack={() => setCurrentScreen('chat')}
            storeName={STORE_CONFIG.name}
            theme={currentTheme}
          />
        )}

        {/* ── Ticket created screen ── */}
        {currentScreen === 'ticket-created' && (
          <TicketCreatedScreen
            theme={currentTheme}
            ticketId={ticketId}
            conversationId={conversationId}
            storeName={STORE_CONFIG.name}
            onClose={handleTicketClose}
            onBackToChat={handleTicketBackToChat}
            onDownload={() => {}}
          />
        )}

        {/* ── Main chat screen ── */}
        {currentScreen === 'chat' && (
          <>
            <ChatHeader
              storeName={STORE_CONFIG.name}
              storeIcon={STORE_CONFIG.icon}
              onClose={handleCloseClick}
              onDownload={handleDownload}
              currentTheme={currentTheme}
            />

            {/* Messages — always white background, no scrollbar */}
            <div
              ref={messagesContainerRef}
              data-chat-scrollable
              className="no-scrollbar flex-1 overflow-y-auto"
              style={{
                background: '#FFFFFF', /* always white — all 7 themes */
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-y',
              }}
              onTouchMove={e => e.stopPropagation()}
            >
              {messages.length === 0 ? (
                <EmptyState storeLogo={STORE_CONFIG.logo} />
              ) : (
                messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    storeIcon={STORE_CONFIG.icon}
                    theme={currentTheme}
                    onTicketFormSubmit={handleInlineTicketSubmit}
                    onQuickReplyPick={handleQuickReplyPick}
                  />
                ))
              )}

              {isTyping && (
                <TypingIndicator storeIcon={STORE_CONFIG.icon} theme={currentTheme} />
              )}

              {/* Scroll anchor */}
              <div ref={messagesEndRef} style={{ height: 1, flexShrink: 0 }} />
            </div>

            <ChatInput
              onSendMessage={handleSendMessage}
              isDisabled={isTyping}
              theme={currentTheme}
            />
          </>
        )}

        {/* Branding footer — shown on all screens */}
        <ChatFooter />
      </div>

      {/* Confirmation modal */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        theme={currentTheme}
        onClose={() => setShowConfirmModal(false)}
        onConfirmClose={handleConfirmClose}
        onConvertToTicket={handleConvertToTicket}
      />
    </div>
  );
}

// ─── Theme exports (for backend integration reference) ────────────────────────
export { THEMES };