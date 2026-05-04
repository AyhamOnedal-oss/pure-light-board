/**
 * ChatMessage — renders a single chat bubble.
 *
 * Layout uses dir="ltr" on each row so positioning is explicit:
 *   • Agent (store) messages: avatar + bubble on the LEFT
 *   • User messages: bubble on the RIGHT
 *
 * Agent messages show thumbs up/down feedback icons.
 * User messages have no feedback icons.
 */

import type { Message } from './ChatWidget';
import type { Theme } from '../types/theme';
import { FileIcon, Download, CheckCircle2, ThumbsUp, ThumbsDown } from 'lucide-react';
import { ChatInlineTicketForm } from './ChatInlineTicketForm';
import { MessageTextWithLinks } from './MessageTextWithLinks';

interface ChatMessageProps {
  message: Message;
  /** Store icon — 32×32px avatar shown next to agent messages */
  storeIcon?: string;
  theme: Theme;
  onTicketFormSubmit?: (phone: string, dialCode: string) => void;
  /** Main color for AI bubbles */
  mainColor?: string;
  /** Dark mode flag */
  isDarkMode?: boolean;
  /** Mode colors for user bubbles and text */
  modeColors?: {
    userBubbleBackground: string;
    userBubbleText: string;
    primaryText: string;
    secondaryText: string;
  };
  /** Called when the user toggles thumbs up/down on an agent message */
  onFeedbackChange?: (messageId: string, feedback: 'up' | 'down' | null) => void;
}

const AVATAR_SIZE = 32;

/** Feedback icons for agent messages — thumbs up / thumbs down */
function MessageFeedback({
  messageId,
  mainColor,
  isDarkMode,
  feedback,
  onFeedbackChange,
}: {
  messageId: string;
  mainColor?: string;
  isDarkMode?: boolean;
  feedback?: 'up' | 'down' | null;
  onFeedbackChange?: (messageId: string, feedback: 'up' | 'down' | null) => void;
}) {
  const accentColor = mainColor || '#000000';
  const hoverBg = isDarkMode ? '#334155' : '#f3f4f6';

  const handleFeedback = (type: 'up' | 'down') => {
    const next = feedback === type ? null : type;
    onFeedbackChange?.(messageId, next);
    // TODO: BACKEND — POST /messages/{messageId}/feedback { type: next }
  };

  return (
    <div className="flex items-center gap-1" style={{ paddingTop: '3px' }}>
      <button
        type="button"
        onClick={() => handleFeedback('down')}
        className="p-1 rounded-full transition-all"
        style={{ WebkitTapHighlightColor: 'transparent' }}
        onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        aria-label="تقييم سلبي"
      >
        <ThumbsDown
          className="transition-colors"
          style={{
            width: '14px',
            height: '14px',
            color: feedback === 'down' ? '#ef4444' : '#d1d5db',
            fill: feedback === 'down' ? '#ef4444' : 'none',
            strokeWidth: 2,
          }}
        />
      </button>
      <button
        type="button"
        onClick={() => handleFeedback('up')}
        className="p-1 rounded-full transition-all"
        style={{ WebkitTapHighlightColor: 'transparent' }}
        onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        aria-label="تقييم إيجابي"
      >
        <ThumbsUp
          className="transition-colors"
          style={{
            width: '14px',
            height: '14px',
            color: feedback === 'up' ? accentColor : '#d1d5db',
            fill: feedback === 'up' ? accentColor : 'none',
            strokeWidth: 2,
          }}
        />
      </button>
    </div>
  );
}

/** Reusable agent avatar */
function AgentAvatar({ storeIcon }: { storeIcon?: string }) {
  if (!storeIcon) return null;
  return (
    <div className="flex-shrink-0" style={{ marginTop: '2px' }}>
      <img
        src={storeIcon}
        alt="Store"
        className="rounded-full object-cover"
        style={{
          width: `${AVATAR_SIZE}px`,
          height: `${AVATAR_SIZE}px`,
          border: '2px solid #e5e7eb',
        }}
      />
    </div>
  );
}

export function ChatMessage({ message, storeIcon, theme, onTicketFormSubmit, mainColor, isDarkMode, modeColors, onFeedbackChange }: ChatMessageProps) {
  const isStore = message.sender === 'store';

  // AI message bubbles use mainColor, user messages use mode colors
  const bubbleBg   = isStore
    ? (mainColor || theme.background)
    : (modeColors?.userBubbleBackground || '#f3f4f6');
  const bubbleText = isStore
    ? '#FFFFFF'
    : (modeColors?.userBubbleText || '#1f2937');

  /* ── Ticket-success message ─────────────────────────────────────── */
  if (message.type === 'ticket-success') {
    const successBg = isDarkMode ? '#052e16' : '#f0fdf4';
    const successBorder = isDarkMode ? '#166534' : '#bbf7d0';
    return (
      <div className="flex gap-2.5 items-start justify-start" dir="ltr">
        <AgentAvatar storeIcon={storeIcon} />
        <div className="flex flex-col gap-1 items-start" style={{ maxWidth: '80%', minWidth: 0 }}>
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl rounded-tl-md"
            dir="rtl"
            style={{
              background: successBg,
              border: `1px solid ${successBorder}`,
              fontSize: '13px',
              color: '#16a34a',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            <CheckCircle2 style={{ width: '15px', height: '15px', flexShrink: 0 }} />
            {message.text || 'تم إرسال طلبك بنجاح'}
          </div>
          <MessageFeedback messageId={message.id} mainColor={mainColor} isDarkMode={isDarkMode} feedback={message.feedback} onFeedbackChange={onFeedbackChange} />
        </div>
      </div>
    );
  }

  /* ── Ticket-form message ────────────────────────────────────────── */
  if (message.type === 'ticket-form') {
    return (
      <div className="flex gap-2.5 items-start justify-start" dir="ltr">
        <AgentAvatar storeIcon={storeIcon} />
        <div className="flex flex-col gap-1 items-start" style={{ maxWidth: '85%', minWidth: 0 }}>
          <div
            className="px-4 py-2.5 rounded-2xl rounded-tl-md"
            dir="rtl"
            style={{
              background: bubbleBg,
              color: bubbleText,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              WebkitFontSmoothing: 'antialiased',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            <MessageTextWithLinks text={message.text} style={{ margin: 0 }} />
          </div>

          {message.ticketFormSubmitted ? (
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl rounded-tl-md"
              dir="rtl"
              style={{
                background: isDarkMode ? '#052e16' : '#f0fdf4',
                border: `1px solid ${isDarkMode ? '#166534' : '#bbf7d0'}`,
                fontSize: '13px',
                color: '#16a34a',
              }}
            >
              <CheckCircle2 style={{ width: '15px', height: '15px', flexShrink: 0 }} />
              تم إرسال طلبك بنجاح
            </div>
          ) : (
            <ChatInlineTicketForm
              theme={theme}
              onSubmit={(phone, dialCode) => {
                onTicketFormSubmit?.(phone, dialCode);
              }}
              isDarkMode={isDarkMode}
              mainColor={mainColor}
            />
          )}

          <MessageFeedback messageId={message.id} mainColor={mainColor} isDarkMode={isDarkMode} feedback={message.feedback} onFeedbackChange={onFeedbackChange} />
        </div>
      </div>
    );
  }

  /* ── Agent (store) message — LEFT side ──────────────────────────── */
  if (isStore) {
    return (
      <div className="flex gap-2.5 items-start justify-start" dir="ltr">
        <AgentAvatar storeIcon={storeIcon} />
        <div className="flex flex-col gap-0.5 items-start" style={{ maxWidth: '75%', minWidth: 0 }}>
          <div
            className="px-4 py-2.5 rounded-2xl rounded-tl-md"
            dir="rtl"
            style={{
              background: bubbleBg,
              color: bubbleText,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              WebkitFontSmoothing: 'antialiased',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            {message.attachment && renderAttachment(message)}
            {message.text && (
              <MessageTextWithLinks text={message.text} style={{ margin: 0 }} />
            )}
          </div>
          <MessageFeedback messageId={message.id} mainColor={mainColor} isDarkMode={isDarkMode} feedback={message.feedback} onFeedbackChange={onFeedbackChange} />
        </div>
      </div>
    );
  }

  /* ── User (customer) message — RIGHT side ───────────────────────── */
  return (
    <div className="flex gap-2.5 items-start justify-end" dir="ltr">
      <div className="flex flex-col gap-0.5 items-end" style={{ maxWidth: '75%', minWidth: 0 }}>
        <div
          className="px-4 py-2.5 rounded-2xl rounded-tr-md"
          dir="rtl"
          style={{
            background: bubbleBg,
            color: bubbleText,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            WebkitFontSmoothing: 'antialiased',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
          }}
        >
          {message.attachment && renderAttachment(message)}
          {message.text && (
            <MessageTextWithLinks text={message.text} style={{ margin: 0 }} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Shared attachment renderer */
function renderAttachment(message: Message) {
  if (!message.attachment) return null;
  return (
    <div className="mb-2">
      {message.attachment.type === 'image' ? (
        <img
          src={message.attachment.url}
          alt={message.attachment.name}
          className="rounded-xl block"
          style={{
            maxWidth: '200px',
            width: '100%',
            height: 'auto',
          }}
        />
      ) : (
        <div
          className="flex items-center gap-2 p-2.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.15)' }}
        >
          <FileIcon className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{message.attachment.name}</p>
            {message.attachment.size && (
              <p className="text-xs opacity-60">
                {(message.attachment.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>
          <a
            href={message.attachment.url}
            download={message.attachment.name}
            className="p-1 rounded-full flex-shrink-0 hover:opacity-80 transition-opacity"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}