/**
 * InactivityPrompt — Inline banner shown inside the messages area
 * when the user has been inactive for a configurable duration.
 * Offers two actions: Continue Chat / End Chat.
 */

import { motion } from 'motion/react';

interface InactivityPromptProps {
  onContinue: () => void;
  onEnd: () => void;
  isDarkMode?: boolean;
  mainColor?: string;
}

export function InactivityPrompt({ onContinue, onEnd, isDarkMode, mainColor }: InactivityPromptProps) {
  const bg = isDarkMode ? '#0f172a' : '#f9fafb';
  const border = isDarkMode ? '#334155' : '#e5e7eb';
  const text = isDarkMode ? '#f1f5f9' : '#1f2937';
  const secondary = isDarkMode ? '#94a3b8' : '#6b7280';
  const darkBtn = isDarkMode ? '#FFFFFF' : '#000000';
  const darkBtnText = isDarkMode ? '#0f172a' : '#FFFFFF';
  const accent = mainColor || darkBtn;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: '14px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        alignItems: 'stretch',
        direction: 'rtl',
      }}
      role="dialog"
      aria-label="تنبيه الخمول"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'center' }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: text }}>
          هل ما زلت معنا؟ 👋
        </span>
        <span style={{ fontSize: '12px', color: secondary }}>
          لاحظنا عدم وجود نشاط، هل تود متابعة المحادثة؟
        </span>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onContinue}
          style={{
            flex: 1,
            background: accent,
            color: mainColor ? '#FFFFFF' : darkBtnText,
            border: 'none',
            borderRadius: '10px',
            padding: '10px 12px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          متابعة المحادثة
        </button>
        <button
          onClick={onEnd}
          style={{
            flex: 1,
            background: 'transparent',
            color: text,
            border: `1px solid ${border}`,
            borderRadius: '10px',
            padding: '10px 12px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          إنهاء المحادثة
        </button>
      </div>
    </motion.div>
  );
}
