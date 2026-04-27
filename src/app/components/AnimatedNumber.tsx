import { useState, useEffect, useRef, useCallback } from 'react';

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function useAnimatedNumber(target: number, duration = 1800, delay = 0) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const hasStarted = useRef(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      hasStarted.current = true;
      startTimeRef.current = performance.now();

      const animate = (now: number) => {
        const elapsed = now - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutExpo(progress);
        setValue(Math.round(eased * target));

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        } else {
          setValue(target);
        }
      };

      rafRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, delay]);

  return value;
}

/**
 * Parses display strings like "2,847", "94.2%", "1.2M", "8,432" into a numeric target
 * and formats the animated value back to the same pattern.
 */
export function AnimatedValue({
  value,
  duration = 1800,
  delay = 0,
  className,
  style,
}: {
  value: string | number;
  duration?: number;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const displayStr = typeof value === 'number' ? value.toString() : value;
  const parsed = parseDisplayValue(displayStr);
  const animated = useAnimatedNumber(parsed.numericTarget, duration, delay);

  return (
    <span className={className} style={style}>
      {formatAnimatedValue(animated, parsed)}
    </span>
  );
}

interface ParsedValue {
  numericTarget: number;
  suffix: string;
  isPercent: boolean;
  hasDecimal: boolean;
  decimalPlaces: number;
  useCommas: boolean;
  multiplier: number;
}

function parseDisplayValue(display: string): ParsedValue {
  let cleaned = display.trim();
  let suffix = '';
  let isPercent = false;
  let multiplier = 1;

  if (cleaned.endsWith('%')) {
    isPercent = true;
    suffix = '%';
    cleaned = cleaned.slice(0, -1);
  }

  if (cleaned.endsWith('M')) {
    suffix = 'M';
    multiplier = 10;
    cleaned = cleaned.slice(0, -1);
  } else if (cleaned.endsWith('K')) {
    suffix = 'K';
    multiplier = 10;
    cleaned = cleaned.slice(0, -1);
  }

  const hasCommas = cleaned.includes(',');
  cleaned = cleaned.replace(/,/g, '');

  const dotIdx = cleaned.indexOf('.');
  const hasDecimal = dotIdx !== -1;
  const decimalPlaces = hasDecimal ? cleaned.length - dotIdx - 1 : 0;

  let numericVal = parseFloat(cleaned);
  if (isNaN(numericVal)) numericVal = 0;

  // Scale up to animate as integer then scale back
  const numericTarget = hasDecimal
    ? Math.round(numericVal * Math.pow(10, decimalPlaces))
    : numericVal;

  return {
    numericTarget,
    suffix,
    isPercent,
    hasDecimal,
    decimalPlaces,
    useCommas: hasCommas,
    multiplier: 1,
  };
}

function formatAnimatedValue(animated: number, parsed: ParsedValue): string {
  let val: string;

  if (parsed.hasDecimal) {
    const scaled = animated / Math.pow(10, parsed.decimalPlaces);
    val = scaled.toFixed(parsed.decimalPlaces);
  } else {
    val = animated.toString();
  }

  if (parsed.useCommas) {
    const parts = val.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    val = parts.join('.');
  }

  return val + parsed.suffix;
}