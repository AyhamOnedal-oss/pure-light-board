/**
 * RatingScreen — Post-chat rating.
 * Supports Dark Mode via isDarkMode prop.
 */

import { useState, useEffect } from 'react';
import { Star, ArrowRight } from 'lucide-react';
import type { Theme } from '../types/theme';

interface RatingScreenProps {
  onClose: () => void;
  onBack?: () => void;
  storeName: string;
  theme: Theme;
  isDarkMode?: boolean;
  mainColor?: string;
  /** Seconds of idle before auto-skip + close (default 900 = 15 min) */
  inactivitySeconds?: number;
  /** Fired when rating is actually submitted (after validation) */
  onRatingSubmit?: (stars: number, feedback: string) => void;
  /** Fired when user taps "Skip & Close" */
  onRatingSkip?: () => void;
  /** Fired when auto-closed by inactivity on the rating screen */
  onRatingAutoClose?: () => void;
}

export function RatingScreen({ onClose, onBack, storeName, theme, isDarkMode = false, mainColor, inactivitySeconds = 900, onRatingSubmit, onRatingSkip, onRatingAutoClose }: RatingScreenProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // ── Auto-skip on inactivity ─────────────────────────────────────────────
  // Timer resets whenever rating or feedback changes (user activity).
  useEffect(() => {
    if (submitted) return;
    const timer = setTimeout(() => {
      onRatingAutoClose?.();
      onClose();
    }, Math.max(30, inactivitySeconds) * 1000);
    return () => clearTimeout(timer);
  }, [rating, feedback, submitted, inactivitySeconds, onClose, onRatingAutoClose]);

  const isWhiteTheme = theme.background === '#FFFFFF';
  const isBlackTheme = theme.id === 'black';
  const accentColor = mainColor || ((isWhiteTheme || isBlackTheme) ? '#000000' : theme.background);
  const accentText  = (isWhiteTheme || isBlackTheme) ? '#FFFFFF' : theme.text;

  // Dark mode colors
  const pageBg = isDarkMode ? '#1e293b' : '#FFFFFF';
  const titleColor = isDarkMode ? '#f1f5f9' : '#1f2937';
  const descColor = isDarkMode ? '#94a3b8' : '#9ca3af';
  const borderColor = isDarkMode ? '#334155' : '#f3f4f6';
  const textareaBg = isDarkMode ? '#0f172a' : '#f9fafb';
  const textareaBorder = isDarkMode ? '#334155' : '#e5e7eb';
  const textareaColor = isDarkMode ? '#f1f5f9' : '#1f2937';
  const textareaPlaceholder = isDarkMode ? '#64748b' : '#d1d5db';
  const backBtnHover = isDarkMode ? '#334155' : '#f3f4f6';
  const backIconColor = isDarkMode ? '#94a3b8' : '#6b7280';
  const skipColor = isDarkMode ? '#94a3b8' : '#9ca3af';
  const skipHoverColor = isDarkMode ? '#cbd5e1' : '#4b5563';
  const skipHoverBg = isDarkMode ? '#334155' : '#f9fafb';

  const ratingLabels: Record<number, string> = {
    1: 'سيئة جداً',
    2: 'سيئة',
    3: 'مقبولة',
    4: 'جيدة',
    5: 'ممتازة',
  };

  const handleSubmit = () => {
    if (rating === 0) return;
    onRatingSubmit?.(rating, feedback);
    setSubmitted(true);
    setTimeout(() => onClose(), 1600);
  };

  const handleSkip = () => {
    onRatingSkip?.();
    onClose();
  };

  if (submitted) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center p-8"
        dir="rtl"
        style={{ WebkitFontSmoothing: 'antialiased', background: pageBg }}
      >
        <div className="text-center">
          <div style={{ fontSize: '56px', lineHeight: 1, marginBottom: '20px' }}>✨</div>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: titleColor, marginBottom: '8px' }}>
            شكراً لك!
          </h3>
          <p style={{ fontSize: '14px', lineHeight: '1.6', color: descColor }}>
            نقدّر وقتك ونسعى دائماً
            <br />
            لتقديم خدمة أفضل
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      dir="rtl"
      style={{ WebkitFontSmoothing: 'antialiased', overscrollBehavior: 'contain', touchAction: 'pan-y', background: pageBg }}
    >
      {/* Top accent line */}
      <div className="h-1 w-full flex-shrink-0" style={{ background: accentColor }} />

      {/* Header bar with back arrow */}
      {onBack && (
        <div
          className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
          style={{ borderBottom: `1px solid ${borderColor}` }}
        >
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 rounded-full transition-colors flex-shrink-0"
            style={{ background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = backBtnHover)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            aria-label="رجوع"
          >
            <ArrowRight className="w-5 h-5" style={{ color: backIconColor }} />
          </button>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: titleColor }}>
            تقييم التجربة
          </h3>
        </div>
      )}

      {/* Scrollable content */}
      <div
        data-chat-scrollable
        className="flex-1 flex flex-col items-center px-6 pt-5 pb-4 overflow-y-auto"
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="text-center mb-5">
          <div style={{ fontSize: '40px', lineHeight: 1, marginBottom: '12px' }}>⭐</div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: titleColor, marginBottom: '6px' }}>
            قيّم تجربتك
          </h3>
          <p style={{ fontSize: '13px', lineHeight: '1.6', color: descColor }}>
            كيف كانت تجربتك مع {storeName}؟
          </p>
        </div>

        {/* Stars */}
        <div className="flex gap-2 mb-2">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="transition-transform hover:scale-110 focus:outline-none active:scale-95"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <Star
                className={`transition-colors ${
                  star <= (hoveredRating || rating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : isDarkMode
                    ? 'text-gray-600 fill-gray-600'
                    : 'text-gray-200 fill-gray-200'
                }`}
                style={{ width: '36px', height: '36px' }}
              />
            </button>
          ))}
        </div>

        {/* Rating label */}
        <p
          className="mb-4 transition-opacity"
          style={{
            fontSize: '13px',
            color: accentColor,
            fontWeight: 600,
            minHeight: '20px',
            opacity: rating > 0 ? 1 : 0,
          }}
        >
          {ratingLabels[rating] ?? ''}
        </p>

        {/* Feedback textarea */}
        <div className="w-full mb-4">
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="أخبرنا برأيك... (اختياري)"
            rows={3}
            dir="rtl"
            className="w-full p-3.5 rounded-xl resize-none transition-colors"
            style={{
              fontSize: '14px',
              border: `1.5px solid ${textareaBorder}`,
              outline: 'none',
              background: textareaBg,
              lineHeight: '1.55',
              color: textareaColor,
            }}
            onFocus={e => (e.target.style.borderColor = accentColor)}
            onBlur={e => (e.target.style.borderColor = textareaBorder)}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div
        className="flex-shrink-0 px-6 pb-4 pt-2"
        style={{ borderTop: `1px solid ${borderColor}`, background: pageBg }}
      >
        <button
          onClick={handleSubmit}
          disabled={rating === 0}
          className="w-full py-3 rounded-xl transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-35 disabled:cursor-not-allowed"
          style={{
            background: accentColor,
            color: accentText,
            fontSize: '14px',
            fontWeight: 700,
          }}
        >
          إرسال التقييم
        </button>

        <button
          onClick={handleSkip}
          className="mt-2 w-full py-2.5 rounded-xl transition-colors"
          style={{ fontSize: '13px', fontWeight: 500, color: skipColor }}
          onMouseEnter={e => { e.currentTarget.style.color = skipHoverColor; e.currentTarget.style.background = skipHoverBg; }}
          onMouseLeave={e => { e.currentTarget.style.color = skipColor; e.currentTarget.style.background = 'transparent'; }}
        >
          تخطي وإغلاق
        </button>
      </div>
    </div>
  );
}
