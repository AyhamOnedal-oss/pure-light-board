import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { DateRange } from '../../services/metrics';

export type RangePreset =
  | 'today'
  | 'last7'
  | 'last30'
  | 'last3m'
  | 'last6m'
  | 'lastYear'
  | 'custom';

const DAY = 24 * 60 * 60 * 1000;

export function computeRange(preset: RangePreset, custom?: DateRange): DateRange {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  switch (preset) {
    case 'today':
      return { from: startOfToday, to };
    case 'last7':
      return { from: new Date(to.getTime() - 7 * DAY), to };
    case 'last30':
      return { from: new Date(to.getTime() - 30 * DAY), to };
    case 'last3m':
      return { from: new Date(to.getTime() - 90 * DAY), to };
    case 'last6m':
      return { from: new Date(to.getTime() - 180 * DAY), to };
    case 'lastYear':
      return { from: new Date(to.getTime() - 365 * DAY), to };
    case 'custom':
      return custom ?? { from: new Date(to.getTime() - 30 * DAY), to };
  }
}

interface Props {
  preset: RangePreset;
  custom: DateRange;
  onChange: (preset: RangePreset, custom: DateRange) => void;
}

export function DateRangePicker({ preset, custom, onChange }: Props) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [fromStr, setFromStr] = useState(custom.from.toISOString().slice(0, 10));
  const [toStr, setToStr] = useState(custom.to.toISOString().slice(0, 10));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const presets: { key: RangePreset; label: string }[] = [
    { key: 'today', label: t('Today', 'اليوم') },
    { key: 'last7', label: t('Last 7 days', 'آخر 7 أيام') },
    { key: 'last30', label: t('Last 30 days', 'آخر 30 يوم') },
    { key: 'last3m', label: t('Last 3 months', 'آخر 3 أشهر') },
    { key: 'last6m', label: t('Last 6 months', 'آخر 6 أشهر') },
    { key: 'lastYear', label: t('Last year', 'آخر سنة') },
  ];

  const currentLabel =
    preset === 'custom'
      ? `${custom.from.toISOString().slice(0, 10)} → ${custom.to.toISOString().slice(0, 10)}`
      : presets.find(p => p.key === preset)?.label ?? '';

  const pick = (key: RangePreset) => {
    onChange(key, computeRange(key, custom));
    setOpen(false);
  };

  const applyCustom = () => {
    const from = new Date(fromStr);
    const to = new Date(toStr);
    to.setHours(23, 59, 59, 999);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return;
    onChange('custom', { from, to });
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border text-[13px] hover:border-border/80 transition-colors"
        style={{ fontWeight: 600 }}
      >
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <span>{currentLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute end-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-xl z-50 p-2">
          {presets.map(p => (
            <button
              key={p.key}
              onClick={() => pick(p.key)}
              className={`w-full text-start px-3 py-2 rounded-lg text-[13px] hover:bg-muted transition-colors ${
                preset === p.key ? 'bg-muted' : ''
              }`}
              style={{ fontWeight: preset === p.key ? 600 : 500 }}
            >
              {p.label}
            </button>
          ))}
          <div className="border-t border-border my-2" />
          <div className="px-2 pb-2">
            <p className="text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
              {t('Custom range', 'تخصيص فترة')}
            </p>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] text-muted-foreground">
                {t('From', 'من')}
                <input
                  type="date"
                  value={fromStr}
                  onChange={e => setFromStr(e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 rounded-md border border-border bg-background text-[12px]"
                />
              </label>
              <label className="text-[11px] text-muted-foreground">
                {t('To', 'إلى')}
                <input
                  type="date"
                  value={toStr}
                  onChange={e => setToStr(e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 rounded-md border border-border bg-background text-[12px]"
                />
              </label>
              <button
                onClick={applyCustom}
                className="mt-1 w-full py-1.5 rounded-md bg-[#043CC8] text-white text-[12px]"
                style={{ fontWeight: 600 }}
              >
                {t('Apply', 'تطبيق')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}