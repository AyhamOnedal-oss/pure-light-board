/**
 * CountryFlag — Real 4:3 SVG flags via `country-flag-icons`.
 *
 * Rendered inside a fixed-size <span> so flex parents with `items-stretch`
 * cannot deform the flag. Bundled, no network calls.
 */
import SA from 'country-flag-icons/react/3x2/SA';
import AE from 'country-flag-icons/react/3x2/AE';
import KW from 'country-flag-icons/react/3x2/KW';
import QA from 'country-flag-icons/react/3x2/QA';
import BH from 'country-flag-icons/react/3x2/BH';
import OM from 'country-flag-icons/react/3x2/OM';
import YE from 'country-flag-icons/react/3x2/YE';
import IQ from 'country-flag-icons/react/3x2/IQ';
import JO from 'country-flag-icons/react/3x2/JO';
import EG from 'country-flag-icons/react/3x2/EG';

const MAP: Record<string, React.ComponentType<{ title?: string; style?: React.CSSProperties }>> = {
  SA, AE, KW, QA, BH, OM, YE, IQ, JO, EG,
};

interface CountryFlagProps {
  /** ISO 3166-1 alpha-2 country code */
  code: string;
  /** Width in pixels (height auto-calculated from 3:2 aspect ratio) */
  size?: number;
  className?: string;
}

export function CountryFlag({ code, size = 20, className }: CountryFlagProps) {
  const Flag = MAP[code];
  const w = size;
  const h = Math.round((size * 2) / 3); // 3:2 aspect
  return (
    <span
      aria-label={code}
      role="img"
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${w}px`,
        height: `${h}px`,
        flex: `0 0 ${w}px`,
        flexShrink: 0,
        borderRadius: '3px',
        overflow: 'hidden',
        background: '#e5e7eb',
        lineHeight: 0,
      }}
    >
      {Flag ? (
        <Flag title={code} style={{ width: '100%', height: '100%', display: 'block' }} />
      ) : (
        <span style={{ fontSize: '10px', color: '#6b7280' }}>{code}</span>
      )}
    </span>
  );
}
