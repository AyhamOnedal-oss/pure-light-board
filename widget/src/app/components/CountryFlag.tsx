/**
 * CountryFlag — dependency-free flag chip for the standalone widget bundle.
 *
 * The deployed `widget.js` must build as a single file, so avoid importing the
 * optional `country-flag-icons` package here. Emoji flags keep the selector
 * visible and remove a fragile runtime/build dependency.
 */

const FLAG_EMOJI: Record<string, string> = {
  SA: '🇸🇦', AE: '🇦🇪', KW: '🇰🇼', QA: '🇶🇦', BH: '🇧🇭', OM: '🇴🇲',
  YE: '🇾🇪', IQ: '🇮🇶', JO: '🇯🇴', EG: '🇪🇬',
};

interface CountryFlagProps {
  /** ISO 3166-1 alpha-2 country code */
  code: string;
  /** Width in pixels (height auto-calculated from 3:2 aspect ratio) */
  size?: number;
  className?: string;
}

export function CountryFlag({ code, size = 20, className }: CountryFlagProps) {
  const flag = FLAG_EMOJI[code];
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
      {flag ? (
        <span aria-hidden="true" style={{ fontSize: `${Math.round(size * 0.72)}px`, lineHeight: 1 }}>
          {flag}
        </span>
      ) : (
        <span style={{ fontSize: '10px', color: '#6b7280' }}>{code}</span>
      )}
    </span>
  );
}
