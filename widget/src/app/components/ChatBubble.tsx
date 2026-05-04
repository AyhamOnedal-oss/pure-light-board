/**
 * ChatBubble — Floating chat bubble (closed state only).
 * Restored original design: colored circle + speech bubble path.
 * FloatingWidget hides this when chat is open — no X icon shown.
 *
 * Now supports custom widget colors from theme settings:
 * - widgetOuterColor: outer circle background
 * - widgetInnerColor: icon/chat bubble color
 */

import { motion } from 'motion/react';
import type { Theme } from '../types/theme';

interface ChatBubbleProps {
  theme: Theme;
  onClick: () => void;
  position: 'bottom-right' | 'bottom-left';
  /** Custom widget outer color (circle background) */
  widgetOuterColor?: string;
  /** Custom widget inner color (icon/speech bubble) */
  widgetInnerColor?: string;
}

/** Original inline SVG: circle background + chat speech shape */
function BubbleIcon({ bg, iconColor }: { bg: string; iconColor: string }) {
  return (
    <svg viewBox="0 0 1000 1000" style={{ width: '100%', height: '100%' }}>
      <circle fill={bg} cx="500" cy="500" r="475" />
      <path
        fill={iconColor}
        d="M500,217.35c-156.1,0-282.65,126.55-282.65,282.65s126.55,282.65,282.65,282.65v68.68s282.65-77.5,282.65-351.33c0-156.11-126.55-282.65-282.65-282.65Z"
      />
    </svg>
  );
}

/** Map theme id → original bubble colors */
function getBubbleColors(theme: Theme): { bg: string; icon: string } {
  switch (theme.id) {
    case 'white':    return { bg: '#FFFFFF', icon: '#222222' };
    case 'black':    return { bg: '#000000', icon: '#FFFFFF' };
    case 'gold':     return { bg: '#FFD700', icon: '#FFFFFF' };
    case 'sky':      return { bg: '#00BFFF', icon: '#FFFFFF' };
    case 'navy':     return { bg: '#0A1F44', icon: '#FFFFFF' };
    case 'red':      return { bg: '#FF0000', icon: '#FFFFFF' };
    case 'whatsapp': return { bg: '#25D366', icon: '#FFFFFF' };
    default:         return { bg: theme.background, icon: theme.text };
  }
}

export function ChatBubble({ theme, onClick, widgetOuterColor, widgetInnerColor }: ChatBubbleProps) {
  const defaultColors = getBubbleColors(theme);

  // Use custom colors if provided, otherwise fall back to theme colors
  const outerColor = widgetOuterColor || defaultColors.bg;
  const innerColor = widgetInnerColor || defaultColors.icon;

  const isWhite = outerColor === '#FFFFFF' || outerColor === '#ffffff';

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      whileHover={{ scale: 1.10 }}
      whileTap={{ scale: 0.90 }}
      onClick={onClick}
      style={{
        width: '60px',
        height: '60px',
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        display: 'block',
        boxShadow: isWhite
          ? '0 4px 24px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.08)'
          : `0 4px 24px ${outerColor}60`,
        borderRadius: '50%',
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
      }}
      aria-label="فتح المحادثة"
    >
      <BubbleIcon bg={outerColor} iconColor={innerColor} />
    </motion.button>
  );
}
