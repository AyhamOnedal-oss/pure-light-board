/**
 * QuickReplies — small themed pill buttons rendered under an AI bubble
 * for binary follow-ups like "Do you need anything else?" (نعم / لا).
 */

import type { Theme } from '../types/theme';

export interface QuickReplyOption {
  label: string;
  value: 'yes' | 'no';
}

interface QuickRepliesProps {
  options: QuickReplyOption[];
  onPick: (value: 'yes' | 'no') => void;
  theme: Theme;
  mainColor?: string;
  isDarkMode?: boolean;
}

export function QuickReplies({ options, onPick, theme, mainColor, isDarkMode }: QuickRepliesProps) {
  const isWhiteTheme = theme.background === '#FFFFFF';
  const isBlackTheme = theme.id === 'black';
  const accentColor = mainColor || ((isWhiteTheme || isBlackTheme) ? '#000000' : theme.background);
  const borderColor = isDarkMode ? '#334155' : '#e5e7eb';
  const bg = isDarkMode ? '#1e293b' : '#ffffff';
  const text = isDarkMode ? '#f1f5f9' : '#1f2937';

  return (
    <div className="flex gap-2" style={{ marginTop: '6px', flexWrap: 'wrap' }} dir="rtl">
      {options.map((opt) => {
        const isYes = opt.value === 'yes';
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onPick(opt.value)}
            className="rounded-full transition-all hover:opacity-90 active:scale-[0.97]"
            style={{
              background: isYes ? accentColor : bg,
              color: isYes ? '#ffffff' : text,
              border: `1.5px solid ${isYes ? accentColor : borderColor}`,
              padding: '6px 18px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              minWidth: '64px',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}