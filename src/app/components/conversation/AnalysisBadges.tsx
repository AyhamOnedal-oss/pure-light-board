import React from 'react';
import { Target, CheckCircle2, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export type IntentType = 'complaint' | 'inquiry' | 'request' | 'suggestion';

/**
 * Color mapping per spec:
 *  90–100 → green
 *  80–89  → light orange
 *  40–79  → dark orange
 *  <40    → red
 */
export function completionColor(score: number | null | undefined): string {
  if (score == null) return '#94a3b8';
  if (score >= 90) return '#10b981';
  if (score >= 80) return '#fbbf24';
  if (score >= 40) return '#ea580c';
  return '#ef4444';
}

interface CompletionPillProps {
  score: number | null | undefined;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

export function CompletionPill({ score, size = 'sm', showIcon = true }: CompletionPillProps) {
  const { t } = useApp();
  const color = completionColor(score);
  const isSm = size === 'sm';
  const text = score == null ? '—' : `${score}%`;
  const label = score == null ? t('Pending', 'قيد التحليل') : t('Completion', 'الإكمال');
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${isSm ? 'text-[10px] px-1.5 py-[1px]' : 'text-[11px] px-2 py-0.5'}`}
      style={{ backgroundColor: color + '18', color, fontWeight: 700 }}
      title={label}
    >
      {showIcon && <Target className={isSm ? 'w-2.5 h-2.5' : 'w-3 h-3'} />}
      {text}
    </span>
  );
}

const INTENT_LABELS: Record<IntentType, { en: string; ar: string; color: string }> = {
  complaint: { en: 'Complaint', ar: 'شكوى', color: '#ef4444' },
  inquiry: { en: 'Inquiry', ar: 'استفسار', color: '#043CC8' },
  request: { en: 'Request', ar: 'طلب', color: '#f59e0b' },
  suggestion: { en: 'Suggestion', ar: 'اقتراح', color: '#10b981' },
};

export function IntentBadge({ type, size = 'sm' }: { type: IntentType | null | undefined; size?: 'sm' | 'md' }) {
  const { t } = useApp();
  if (!type) return null;
  const meta = INTENT_LABELS[type];
  const isSm = size === 'sm';
  return (
    <span
      className={`inline-flex items-center rounded-full ${isSm ? 'text-[10px] px-1.5 py-[1px]' : 'text-[11px] px-2 py-0.5'}`}
      style={{ backgroundColor: meta.color + '12', color: meta.color, fontWeight: 600 }}
    >
      {t(meta.en, meta.ar)}
    </span>
  );
}

export function GoalMetBadge({ met }: { met: boolean | null | undefined }) {
  const { t } = useApp();
  if (met == null) return null;
  return met ? (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-600" style={{ fontWeight: 600 }}>
      <CheckCircle2 className="w-3 h-3" />
      {t('Goal met', 'تحقق الهدف')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-500" style={{ fontWeight: 600 }}>
      <XCircle className="w-3 h-3" />
      {t('Goal not met', 'لم يتحقق الهدف')}
    </span>
  );
}

export function visitorCustomerLabel(t: (en: string, ar: string) => string): string {
  return t('Visitor Customer', 'عميل زائر');
}

/**
 * Canonical placeholder names that the widget / external systems may save for
 * anonymous visitors. We treat all of these as "no real name" and fall back
 * to the localized visitor label.
 */
const VISITOR_PLACEHOLDERS = new Set<string>([
  'storefront visitor',
  'store visitor',
  'visitor',
  'visitor customer',
  'anonymous',
  'guest',
  'عميل زائر',
  'زائر',
  'زائر المتجر',
]);

export function resolveVisitorName(
  name: string | null | undefined,
  t: (en: string, ar: string) => string,
  phone?: string | null,
): string {
  const v = (name ?? '').trim();
  const phoneFallback = (phone ?? '').trim();
  const fallback = phoneFallback || visitorCustomerLabel(t);
  if (!v) return fallback;
  if (VISITOR_PLACEHOLDERS.has(v.toLowerCase())) return fallback;
  return v;
}