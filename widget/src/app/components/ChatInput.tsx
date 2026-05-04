/**
 * ChatInput — Message input area with multiline support.
 *
 * Desktop: Enter → send, Shift+Enter → new line
 * Mobile:  Enter → new line (NOT send), tap send button to send
 *
 * Layout (always LTR inside RTL chat):
 *   [ 📎 Attach ]  [ اكتب رسالتك...  ]  [ ➤ Send ]
 *     LEFT                MIDDLE              RIGHT
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Paperclip, X, FileIcon, ArrowUp } from 'lucide-react';
import type { MessageAttachment } from './ChatWidget';
import type { Theme } from '../types/theme';

interface ChatInputProps {
  onSendMessage: (message: string, attachment?: MessageAttachment) => void;
  isDisabled?: boolean;
  theme: Theme;
  /** Main color for send button */
  mainColor?: string;
  /** Dark mode flag */
  isDarkMode?: boolean;
  /** Mode colors for input area */
  modeColors?: {
    inputBackground: string;
    inputBorder: string;
    inputText: string;
    inputPlaceholder: string;
  };
}

export function ChatInput({ onSendMessage, isDisabled = false, theme, mainColor, isDarkMode, modeColors }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<MessageAttachment | null>(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const btnBg = mainColor || theme.background;
  const btnText = '#FFFFFF';

  const canSend = (message.trim() || attachment) && !isDisabled;

  // Detect mobile/tablet via touch + screen width
  useEffect(() => {
    const check = () => {
      const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < 1024;
      setIsMobileDevice(hasTouchScreen && isSmallScreen);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => { autoResize(); }, [message, autoResize]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const type = file.type.startsWith('image/') ? 'image' : 'file';
      setAttachment({ type, url, name: file.name, size: file.size });
    }
  };

  const doSend = () => {
    if (canSend) {
      onSendMessage(message.trim(), attachment || undefined);
      setMessage('');
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (isMobileDevice) return;
      if (!e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formBg = modeColors?.inputBackground || '#FFFFFF';
  const borderColor = modeColors?.inputBorder || '#e5e7eb';
  const textColor = modeColors?.inputText || '#1f2937';
  const placeholderColor = modeColors?.inputPlaceholder || '#9ca3af';

  return (
    <form
      onSubmit={handleSubmit}
      className="flex-shrink-0"
      style={{
        padding: '10px 14px 12px',
        borderTop: `1px solid ${borderColor}`,
        WebkitFontSmoothing: 'antialiased',
        background: formBg,
      }}
    >
      {/* Attachment preview */}
      {attachment && (
        <div
          className="mb-2 p-3 rounded-xl flex items-center gap-2"
          style={{
            background: isDarkMode ? '#0f172a' : '#f9fafb',
            border: `1px solid ${borderColor}`,
          }}
          dir="ltr"
        >
          {attachment.type === 'image' ? (
            <>
              <img src={attachment.url} alt={attachment.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }} className="truncate">
                  {attachment.name}
                </p>
              </div>
            </>
          ) : (
            <>
              <FileIcon className="w-7 h-7 text-gray-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }} className="truncate">
                  {attachment.name}
                </p>
                {attachment.size && (
                  <p style={{ fontSize: '11px', color: '#9ca3af' }}>
                    {(attachment.size / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>
            </>
          )}
          <button
            type="button"
            onClick={removeAttachment}
            className="p-1 rounded-full flex-shrink-0 transition-colors hover:bg-gray-200"
            aria-label="إزالة المرفق"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      )}

      {/* Input row — forced LTR: Attach LEFT | Textarea MIDDLE | Send RIGHT */}
      <div
        className="flex items-end gap-2"
        dir="ltr"
        style={{
          background: isDarkMode ? '#0f172a' : '#f3f4f6',
          borderRadius: '24px',
          padding: '5px 5px 5px 8px',
          border: `1px solid ${borderColor}`,
        }}
      >
        {/* Attach button — LEFT */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.txt"
          disabled={isDisabled}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isDisabled}
          className="flex-shrink-0 flex items-center justify-center rounded-full transition-colors hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ width: '34px', height: '34px' }}
          aria-label="إرفاق ملف"
        >
          <Paperclip className="w-[18px] h-[18px] text-gray-400" />
        </button>

        {/* Textarea — MIDDLE */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isDisabled ? 'جاري الكتابة...' : 'اكتب رسالتك...'}
          disabled={isDisabled}
          rows={1}
          className="flex-1 bg-transparent outline-none disabled:cursor-not-allowed resize-none no-scrollbar"
          style={{
            fontSize: '16px',
            color: textColor,
            caretColor: btnBg,
            lineHeight: '1.5',
            maxHeight: '120px',
            minHeight: '34px',
            paddingTop: '6px',
            paddingBottom: '6px',
            touchAction: 'manipulation',
          }}
          dir="rtl"
        />

        {/* Send button — RIGHT */}
        <button
          type="submit"
          disabled={!canSend}
          className="flex-shrink-0 flex items-center justify-center rounded-full transition-all"
          style={{
            width: '36px',
            height: '36px',
            background: canSend ? btnBg : `${btnBg}30`,
            color: canSend ? btnText : `${btnBg}60`,
            cursor: canSend ? 'pointer' : 'not-allowed',
            boxShadow: canSend ? `0 2px 8px ${btnBg}40` : 'none',
            transition: 'all 0.2s ease',
            opacity: canSend ? 1 : 0.6,
          }}
          aria-label="إرسال"
        >
          <ArrowUp strokeWidth={2.5} className="w-[17px] h-[17px]" />
        </button>
      </div>
    </form>
  );
}