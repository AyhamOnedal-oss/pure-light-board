/**
 * ConfirmationModal — shown when user clicks the X button (if messages exist).
 * Three choices (centered layout):
 *   1. "إغلاق المحادثة"      → title at the top
 *   2. "سأعود للمحادثة"       → secondary: return to chat, keep messages
 *   3. "رفع تذكرة"           → converts conversation to a support ticket
 * Supports Dark Mode.
 */

import { useEffect, useRef } from 'react';
import { X as CloseIcon, Undo2, Ticket, MessageSquareOff } from 'lucide-react';
import type { Theme } from '../types/theme';

interface ConfirmationModalProps {
  isOpen: boolean;
  theme: Theme;
  onClose: () => void;
  onConfirmClose: () => void;
  onConvertToTicket: () => void;
  onReturnToChat?: () => void;
  isDarkMode?: boolean;
  mainColor?: string;
}

export function ConfirmationModal({
  isOpen,
  theme,
  onClose,
  onConfirmClose,
  onConvertToTicket,
  onReturnToChat,
  isDarkMode = false,
  mainColor,
}: ConfirmationModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const el = overlayRef.current;
    if (!el) return;
    const block = (e: TouchEvent) => { e.preventDefault(); e.stopPropagation(); };
    el.addEventListener('touchmove', block, { passive: false });
    return () => el.removeEventListener('touchmove', block);
  }, [isOpen]);

  if (!isOpen) return null;

  const isWhiteTheme = theme.background === '#FFFFFF';
  const isBlackTheme = theme.id === 'black';
  const accentColor = mainColor || ((isWhiteTheme || isBlackTheme) ? '#000000' : theme.background);
  const accentText  = (isWhiteTheme || isBlackTheme) ? '#FFFFFF' : theme.text;

  // Dark mode colors
  const cardBg = isDarkMode ? '#1e293b' : '#FFFFFF';
  const titleColor = isDarkMode ? '#f1f5f9' : '#1f2937';
  const descColor = isDarkMode ? '#94a3b8' : '#9ca3af';
  const closeBtnHover = isDarkMode ? '#334155' : '#f3f4f6';
  const closeIconColor = isDarkMode ? '#64748b' : '#9ca3af';
  const secondaryBg = isDarkMode ? '#0f172a' : '#f9fafb';
  const secondaryBorder = isDarkMode ? '#334155' : '#e5e7eb';
  const secondaryText = isDarkMode ? '#cbd5e1' : '#4b5563';
  const secondaryIconColor = isDarkMode ? '#64748b' : '#9ca3af';
  const tertiaryBorder = isDarkMode ? '#334155' : '#e5e7eb';
  const tertiaryText = isDarkMode ? '#94a3b8' : '#6b7280';
  const iconBg = isDarkMode ? `${accentColor}20` : `${accentColor}10`;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', zIndex: 99999, touchAction: 'none', fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}
      dir="rtl"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      ref={overlayRef}
    >
      <div
        className="rounded-2xl w-full shadow-2xl overflow-hidden"
        style={{ maxWidth: '340px', WebkitFontSmoothing: 'antialiased', background: cardBg }}
      >
        {/* Top accent bar */}
        <div style={{ height: '4px', background: accentColor }} />

        <div className="p-6">
          {/* Close (X) button */}
          <div className="flex justify-end mb-1">
            <button
              onClick={onClose}
              className="p-1.5 rounded-full transition-colors flex-shrink-0"
              style={{ background: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = closeBtnHover)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              aria-label="إلغاء"
            >
              <CloseIcon className="w-4 h-4" style={{ color: closeIconColor }} />
            </button>
          </div>

          {/* Centered content */}
          <div className="text-center mb-6">
            <div
              className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4"
              style={{ background: iconBg }}
            >
              <MessageSquareOff className="w-6 h-6" style={{ color: accentColor }} />
            </div>

            <h3 style={{ fontSize: '17px', fontWeight: 700, color: titleColor, marginBottom: '8px' }}>
              إغلاق المحادثة
            </h3>
            <p style={{ fontSize: '13px', lineHeight: '1.7', color: descColor }}>
              يمكنك رفع تذكرة، إغلاق المحادثة، أو العودة لاحقاً
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2.5">
            {/* Primary: Close Chat */}
            <button
              onClick={onConfirmClose}
              className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
              style={{
                background: accentColor,
                color: accentText,
                fontSize: '14px',
                fontWeight: 700,
              }}
            >
              <MessageSquareOff className="w-4 h-4 flex-shrink-0" />
              إغلاق المحادثة
            </button>

            {/* Secondary: Return to Chat */}
            {onReturnToChat && (
              <button
                onClick={onReturnToChat}
                className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                style={{
                  background: secondaryBg,
                  border: `1.5px solid ${secondaryBorder}`,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: secondaryText,
                }}
              >
                <Undo2 className="w-4 h-4 flex-shrink-0" style={{ color: secondaryIconColor }} />
                سأعود للمحادثة
              </button>
            )}

            {/* Tertiary: Create Ticket */}
            <button
              onClick={onConvertToTicket}
              className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{
                fontSize: '13px',
                fontWeight: 600,
                border: `1.5px solid ${tertiaryBorder}`,
                color: tertiaryText,
                background: 'transparent',
              }}
            >
              <Ticket className="w-4 h-4 flex-shrink-0" style={{ color: secondaryIconColor }} />
              رفع تذكرة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
