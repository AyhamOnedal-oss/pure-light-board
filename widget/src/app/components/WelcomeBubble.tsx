/**
 * WelcomeBubble — Compact teaser shown above the floating chat icon.
 * Two-line layout, mirrors correctly for bottom-right / bottom-left,
 * and stays within the viewport on mobile (iPhone / Android) by using
 * a fixed anchor relative to the 60px bubble wrapper.
 */

import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface WelcomeBubbleProps {
  line1: string;
  line2: string;
  position: 'bottom-right' | 'bottom-left';
  isDarkMode?: boolean;
  onClick: () => void;
}

export function WelcomeBubble({ line1, line2, position, isDarkMode, onClick }: WelcomeBubbleProps) {
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(t);
  }, []);

  if (dismissed || !visible) return null;
  const l1 = (line1 || '').trim();
  const l2 = (line2 || '').trim();
  if (!l1 && !l2) return null;

  const bg = isDarkMode ? '#1e293b' : '#FFFFFF';
  const color = isDarkMode ? '#f1f5f9' : '#111827';
  const subColor = isDarkMode ? '#cbd5e1' : '#4b5563';
  const border = isDarkMode ? '#334155' : '#e5e7eb';

  const isRight = position === 'bottom-right';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 360, damping: 26 }}
      style={{
        position: 'absolute',
        bottom: '64px',
        // Anchor to the same edge as the bubble; tiny inset so the tail aligns
        [isRight ? 'right' : 'left']: '2px',
        // Hard cap width so iPhone 12 mini (≤375px) still fits with 20px side margin
        width: 'max-content',
        maxWidth: 'min(180px, calc(100vw - 40px))',
        background: bg,
        color,
        padding: '7px 22px 7px 10px',
        borderRadius: '14px',
        border: `1px solid ${border}`,
        boxShadow: isDarkMode
          ? '0 6px 18px rgba(0,0,0,0.45)'
          : '0 6px 18px rgba(0,0,0,0.12)',
        fontFamily: "'IBM Plex Sans Arabic', sans-serif",
        cursor: 'pointer',
        direction: 'rtl',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        zIndex: 10000,
        WebkitTapHighlightColor: 'transparent',
      }}
      onClick={onClick}
      role="button"
      aria-label="فتح المحادثة"
    >
      {l1 && (
        <span
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 700,
            lineHeight: 1.25,
            color,
          }}
        >
          {l1}
        </span>
      )}
      {l2 && (
        <span
          style={{
            display: 'block',
            fontSize: '11px',
            fontWeight: 500,
            lineHeight: 1.3,
            color: subColor,
            marginTop: '1px',
          }}
        >
          {l2}
        </span>
      )}

      {/* Dismiss — mirrored: appears on the side OPPOSITE to the bubble edge */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setDismissed(true);
        }}
        aria-label="إغلاق رسالة الترحيب"
        style={{
          position: 'absolute',
          top: '3px',
          [isRight ? 'left' : 'right']: '3px',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          border: 'none',
          background: 'transparent',
          color: isDarkMode ? '#94a3b8' : '#9ca3af',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        <X size={12} />
      </button>

      {/* Pointer tail — aligned above the bubble icon (same edge) */}
      <span
        style={{
          position: 'absolute',
          bottom: '-5px',
          [isRight ? 'right' : 'left']: '18px',
          width: '10px',
          height: '10px',
          background: bg,
          borderRight: `1px solid ${border}`,
          borderBottom: `1px solid ${border}`,
          transform: 'rotate(45deg)',
        }}
      />
    </motion.div>
  );
}
