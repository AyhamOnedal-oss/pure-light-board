/**
 * TicketCreatedScreen — Confirmation after a ticket is created.
 * Supports Dark Mode via isDarkMode prop.
 */

import type { Theme } from '../types/theme';
import { CheckCircle2, Clock, Tag, ArrowRight, Download } from 'lucide-react';

interface TicketCreatedScreenProps {
  theme: Theme;
  ticketId: string;
  conversationId: string;
  storeName: string;
  onClose: () => void;
  onBackToChat: () => void;
  onDownload: () => void;
  isDarkMode?: boolean;
  mainColor?: string;
}

export function TicketCreatedScreen({
  theme, ticketId, conversationId, storeName,
  onClose, onBackToChat, onDownload,
  isDarkMode = false, mainColor,
}: TicketCreatedScreenProps) {
  const isWhiteTheme = theme.background === '#FFFFFF';
  const isBlackTheme = theme.id === 'black';
  const accentColor = mainColor || ((isWhiteTheme || isBlackTheme) ? '#000000' : theme.background);
  const accentText  = (isWhiteTheme || isBlackTheme) ? '#FFFFFF' : theme.text;

  const pageBg = isDarkMode ? '#1e293b' : '#FFFFFF';
  const titleColor = isDarkMode ? '#f1f5f9' : '#1f2937';
  const descColor = isDarkMode ? '#94a3b8' : '#9ca3af';
  const borderColor = isDarkMode ? '#334155' : '#f3f4f6';
  const cardBg = isDarkMode ? '#0f172a' : '#f9fafb';
  const cardBorder = isDarkMode ? '#334155' : '#e5e7eb';
  const labelColor = isDarkMode ? '#94a3b8' : '#6b7280';
  const iconColor = isDarkMode ? '#64748b' : '#9ca3af';
  const valueColor = isDarkMode ? '#cbd5e1' : '#374151';
  const backBtnHover = isDarkMode ? '#334155' : '#f3f4f6';
  const backIconColor = isDarkMode ? '#94a3b8' : '#6b7280';
  const dlBtnBorder = isDarkMode ? '#334155' : '#e5e7eb';
  const dlBtnColor = isDarkMode ? '#94a3b8' : '#6b7280';
  const successBg = isDarkMode ? '#052e16' : '#f0fdf4';
  const successBorder = isDarkMode ? '#166534' : '#bbf7d0';
  const successText = '#16a34a';
  const iconBg = isDarkMode ? `${accentColor}20` : `${accentColor}12`;

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      dir="rtl"
      style={{ WebkitFontSmoothing: 'antialiased', background: pageBg }}
    >
      {/* Top accent bar */}
      <div className="h-1 w-full flex-shrink-0" style={{ background: accentColor }} />

      {/* Header bar */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: `1px solid ${borderColor}` }}
      >
        <button
          type="button"
          onClick={onBackToChat}
          className="p-1.5 rounded-full transition-colors flex-shrink-0"
          style={{ background: 'transparent' }}
          onMouseEnter={e => (e.currentTarget.style.background = backBtnHover)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          aria-label="رجوع"
        >
          <ArrowRight className="w-5 h-5" style={{ color: backIconColor }} />
        </button>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: titleColor }}>
          تم إنشاء التذكرة
        </h3>
      </div>

      {/* Scrollable content */}
      <div data-chat-scrollable className="flex-1 flex flex-col items-center px-6 py-5 overflow-y-auto">
        {/* Success icon */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
          style={{ background: iconBg }}
        >
          <CheckCircle2 className="w-8 h-8" style={{ color: accentColor }} strokeWidth={2} />
        </div>

        <h3 style={{ fontSize: '17px', fontWeight: 700, color: titleColor, marginBottom: '8px', textAlign: 'center' }}>
          تم تحويل محادثتك إلى تذكرة
        </h3>
        <p style={{ fontSize: '13px', lineHeight: '1.7', color: descColor, textAlign: 'center', marginBottom: '24px' }}>
          سيتولى فريق {storeName} متابعة طلبك
          <br />
          وسنرد عليك في أقرب وقت ممكن
        </p>

        {/* Ticket info card */}
        <div
          className="w-full rounded-2xl p-4 mb-6"
          style={{ background: cardBg, border: `1.5px solid ${cardBorder}` }}
        >
          {/* Ticket number */}
          <div
            className="flex items-center justify-between mb-3 pb-3"
            style={{ borderBottom: `1px solid ${cardBorder}` }}
          >
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4" style={{ color: iconColor }} />
              <span style={{ fontSize: '13px', color: labelColor }}>رقم التذكرة</span>
            </div>
            <span
              className="px-3 py-1 rounded-full"
              style={{
                background: iconBg,
                color: accentColor,
                fontSize: '13px',
                fontWeight: 700,
              }}
            >
              {ticketId}
            </span>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: iconColor }} />
              <span style={{ fontSize: '13px', color: labelColor }}>الحالة</span>
            </div>
            <span
              className="px-3 py-1 rounded-full"
              style={{
                background: successBg,
                color: successText,
                border: `1px solid ${successBorder}`,
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              مفتوحة
            </span>
          </div>

          {/* Response time */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" style={{ color: iconColor }} />
              <span style={{ fontSize: '13px', color: labelColor }}>وقت الاستجابة</span>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: valueColor }}>
              خلال 24 ساعة
            </span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div
        className="flex-shrink-0 px-6 pb-4 pt-2"
        style={{ borderTop: `1px solid ${borderColor}`, background: pageBg }}
      >
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl transition-all hover:opacity-90 active:scale-[0.98] mb-2.5"
          style={{
            background: accentColor,
            color: accentText,
            fontSize: '14px',
            fontWeight: 700,
          }}
        >
          حسناً، شكراً لك
        </button>

        <button
          onClick={onDownload}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-colors"
          style={{ fontSize: '13px', fontWeight: 500, border: `1.5px solid ${dlBtnBorder}`, color: dlBtnColor, background: 'transparent' }}
          aria-label="تحميل التذكرة"
        >
          <Download className="w-4 h-4" />
          تحميل التذكرة
        </button>
      </div>
    </div>
  );
}
