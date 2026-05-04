/**
 * CountryFlag — Cross-platform SVG flag icons for Gulf + Arabic countries.
 *
 * Replaces emoji flags (🇸🇦 etc.) which render inconsistently on Windows.
 * These inline SVGs render identically on all platforms: Windows, macOS,
 * iOS, Android, and all browsers.
 *
 * Supports: SA, AE, KW, QA, BH, OM, YE, IQ, JO, EG
 *
 * Usage:
 *   <CountryFlag code="SA" size={20} />
 */

interface CountryFlagProps {
  /** ISO 3166-1 alpha-2 country code */
  code: string;
  /** Width in pixels (height auto-calculated from 4:3 aspect ratio) */
  size?: number;
  className?: string;
}

export function CountryFlag({ code, size = 20, className }: CountryFlagProps) {
  const h = size * 0.75;  // 4:3 aspect ratio

  return (
    <svg
      viewBox="0 0 40 30"
      width={size}
      height={h}
      className={className}
      style={{ flexShrink: 0, borderRadius: '3px', overflow: 'hidden', display: 'block' }}
      role="img"
      aria-label={code}
    >
      {getFlagContent(code)}
    </svg>
  );
}

function getFlagContent(code: string) {
  switch (code) {

    /* ── Saudi Arabia ─────────────────────────────────────────────────── */
    case 'SA':
      return (
        <>
          <rect width="40" height="30" fill="#006C35" />
          {/* Shahada text area (simplified) */}
          <rect x="8" y="8" width="24" height="8" rx="1" fill="#FFFFFF" opacity="0.9" />
          {/* Sword */}
          <rect x="12" y="18" width="16" height="1.5" rx="0.75" fill="#FFFFFF" opacity="0.9" />
          <rect x="12" y="17" width="1.5" height="4" rx="0.5" fill="#FFFFFF" opacity="0.9" />
        </>
      );

    /* ── UAE ───────────────────────────────────────────────────────────── */
    case 'AE':
      return (
        <>
          <rect width="40" height="10" fill="#00732F" />
          <rect y="10" width="40" height="10" fill="#FFFFFF" />
          <rect y="20" width="40" height="10" fill="#000000" />
          <rect width="10" height="30" fill="#FF0000" />
        </>
      );

    /* ── Kuwait ────────────────────────────────────────────────────────── */
    case 'KW':
      return (
        <>
          <rect width="40" height="10" fill="#007A3D" />
          <rect y="10" width="40" height="10" fill="#FFFFFF" />
          <rect y="20" width="40" height="10" fill="#CE1126" />
          <polygon points="0,0 12,7.5 12,22.5 0,30" fill="#000000" />
        </>
      );

    /* ── Qatar ─────────────────────────────────────────────────────────── */
    case 'QA':
      return (
        <>
          <rect width="40" height="30" fill="#8A1538" />
          <polygon points="0,0 14,0 18,3.33 14,6.66 18,10 14,13.33 18,16.66 14,20 18,23.33 14,26.66 18,30 14,30 0,30" fill="#FFFFFF" />
        </>
      );

    /* ── Bahrain ───────────────────────────────────────────────────────── */
    case 'BH':
      return (
        <>
          <rect width="40" height="30" fill="#CE1126" />
          <polygon points="0,0 12,0 16,3 12,6 16,9 12,12 16,15 12,18 16,21 12,24 16,27 12,30 0,30" fill="#FFFFFF" />
        </>
      );

    /* ── Oman ──────────────────────────────────────────────────────────── */
    case 'OM':
      return (
        <>
          <rect width="40" height="10" fill="#FFFFFF" />
          <rect y="10" width="40" height="10" fill="#DB161B" />
          <rect y="20" width="40" height="10" fill="#008000" />
          <rect width="12" height="30" fill="#DB161B" />
          {/* National emblem placeholder */}
          <rect x="3" y="1.5" width="6" height="6" rx="1" fill="#FFFFFF" opacity="0.5" />
        </>
      );

    /* ── Yemen ─────────────────────────────────────────────────────────── */
    case 'YE':
      return (
        <>
          <rect width="40" height="10" fill="#CE1126" />
          <rect y="10" width="40" height="10" fill="#FFFFFF" />
          <rect y="20" width="40" height="10" fill="#000000" />
        </>
      );

    /* ── Iraq ──────────────────────────────────────────────────────────── */
    case 'IQ':
      return (
        <>
          <rect width="40" height="10" fill="#CE1126" />
          <rect y="10" width="40" height="10" fill="#FFFFFF" />
          <rect y="20" width="40" height="10" fill="#000000" />
          {/* Takbir text (simplified green block) */}
          <rect x="10" y="12" width="20" height="6" rx="1" fill="#007A3D" opacity="0.85" />
        </>
      );

    /* ── Jordan ────────────────────────────────────────────────────────── */
    case 'JO':
      return (
        <>
          <rect width="40" height="10" fill="#000000" />
          <rect y="10" width="40" height="10" fill="#FFFFFF" />
          <rect y="20" width="40" height="10" fill="#007A3D" />
          <polygon points="0,0 18,15 0,30" fill="#CE1126" />
          {/* Star */}
          <circle cx="7" cy="15" r="2" fill="#FFFFFF" />
        </>
      );

    /* ── Egypt ─────────────────────────────────────────────────────────── */
    case 'EG':
      return (
        <>
          <rect width="40" height="10" fill="#CE1126" />
          <rect y="10" width="40" height="10" fill="#FFFFFF" />
          <rect y="20" width="40" height="10" fill="#000000" />
          {/* Eagle of Saladin (simplified) */}
          <circle cx="20" cy="15" r="3.5" fill="#C09300" opacity="0.85" />
        </>
      );

    /* ── Fallback ──────────────────────────────────────────────────────── */
    default:
      return (
        <>
          <rect width="40" height="30" fill="#e5e7eb" />
          <text x="20" y="18" textAnchor="middle" fontSize="10" fill="#6b7280">{code}</text>
        </>
      );
  }
}
