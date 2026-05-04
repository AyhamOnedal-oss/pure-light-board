import type { Theme } from '../types/theme';

interface TypingIndicatorProps {
  storeIcon?: string;
  theme: Theme;
  mainColor?: string;
  isDarkMode?: boolean;
}

export function TypingIndicator({ storeIcon, theme, mainColor, isDarkMode }: TypingIndicatorProps) {
  const bubbleBg = mainColor || theme.background;

  return (
    <div className="flex gap-2.5 items-start justify-start" dir="ltr">
      {/* Avatar — LEFT */}
      {storeIcon && (
        <div className="flex-shrink-0" style={{ marginTop: '2px' }}>
          <img
            src={storeIcon}
            alt="Store"
            className="rounded-full object-cover"
            style={{ width: '32px', height: '32px', border: '2px solid #e5e7eb' }}
          />
        </div>
      )}
      {/* Typing dots bubble */}
      <div
        className="px-4 py-3 rounded-2xl rounded-tl-md"
        style={{ background: bubbleBg }}
      >
        <div className="flex gap-1 items-center">
          {[0, 150, 300].map((delay, i) => (
            <div
              key={i}
              className="w-2 h-2 bg-white rounded-full animate-bounce"
              style={{ animationDelay: `${delay}ms`, opacity: 0.85 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}