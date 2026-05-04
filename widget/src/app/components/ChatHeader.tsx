import { X, Download } from 'lucide-react';
import type { Theme } from '../types/theme';

interface ChatHeaderProps {
  storeName: string;
  /** Store icon — 32×32px avatar shown in header (max 2MB, jpeg/jpg/png) */
  storeIcon?: string;
  onClose: () => void;
  onDownload: () => void;
  currentTheme: Theme;
  /** Main color from theme settings (controls header background) */
  mainColor?: string;
  /** Dark mode flag */
  isDarkMode?: boolean;
}

export function ChatHeader({ storeName, storeIcon, onClose, onDownload, currentTheme, mainColor, isDarkMode }: ChatHeaderProps) {
  const isWhiteTheme = currentTheme.background === '#FFFFFF';
  const isBlackTheme = currentTheme.id === 'black';

  // Use mainColor if provided, otherwise fall back to theme color logic
  const headerBg = mainColor || (isWhiteTheme ? '#000000' : isBlackTheme ? '#FFFFFF' : currentTheme.background);
  const headerText = '#FFFFFF'; // Always white text for better contrast

  return (
    <div
      className="px-4 py-3 flex items-center justify-between flex-shrink-0"
      style={{
        background: headerBg,
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <div className="flex items-center gap-3">
        {storeIcon && (
          <img
            src={storeIcon}
            alt={storeName}
            className="rounded-full object-cover"
            style={{ width: '44px', height: '44px', border: `2px solid ${headerText}40` }}
          />
        )}
        <div>
          <h2
            className="truncate"
            style={{ color: headerText, fontSize: '18px', fontWeight: 700, lineHeight: 1.2, maxWidth: '220px', letterSpacing: '-0.01em' }}
          >
            {storeName}
          </h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#22c55e', boxShadow: '0 0 0 2px rgba(34,197,94,0.25)' }}
            />
            <span style={{ color: headerText, fontSize: '11px', fontWeight: 500, opacity: 0.9, textShadow: '0 1px 2px rgba(0,0,0,0.12)' }}>
              وكيل الذكاء الاصطناعي
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onDownload}
          className="p-2 rounded-full transition-colors"
          style={{ color: headerText }}
          onMouseEnter={e => (e.currentTarget.style.background = `${headerText}20`)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          aria-label="تحميل المحادثة"
        >
          <Download className="w-5 h-5" />
        </button>
        <button
          onClick={onClose}
          className="p-2 rounded-full transition-colors"
          style={{ color: headerText }}
          onMouseEnter={e => (e.currentTarget.style.background = `${headerText}20`)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          aria-label="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}