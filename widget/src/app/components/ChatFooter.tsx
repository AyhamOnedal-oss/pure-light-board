/**
 * ChatFooter — Fuqah AI branding strip
 * Shown at the very bottom of the chat widget on all screens.
 * Logo on the left, text on the right.
 * Supports Dark Mode via isDarkMode prop.
 */

interface ChatFooterProps {
  isDarkMode?: boolean;
}

export function ChatFooter({ isDarkMode = false }: ChatFooterProps) {
  const bg = isDarkMode ? '#0f172a' : '#f9fafb';
  const border = isDarkMode ? '#334155' : '#e5e7eb';
  const textColor = isDarkMode ? '#64748b' : '#9ca3af';
  const brandColor = isDarkMode ? '#94a3b8' : '#6b7280';
  const hoverColor = isDarkMode ? '#cbd5e1' : '#6b7280';

  return (
    <div
      style={{
        background: bg,
        borderTop: `1px solid ${border}`,
        padding: '6px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        direction: 'ltr',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {/* Fuqah AI icon — inline SVG preserves the gradient correctly */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        viewBox="0 0 500 500"
        style={{ width: '16px', height: '16px', flexShrink: 0 }}
        aria-hidden="true"
      >
        <defs>
          <radialGradient
            id="fuqah-footer-grad"
            cx="250" cy="250" fx="250" fy="250" r="349.5"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0"   stopColor="#00fff4" />
            <stop offset=".1"  stopColor="#00f5f1" />
            <stop offset=".27" stopColor="#00ddec" />
            <stop offset=".49" stopColor="#01b5e3" />
            <stop offset=".74" stopColor="#027ed6" />
            <stop offset="1"   stopColor="#043cc8" />
          </radialGradient>
        </defs>
        <path
          fill="url(#fuqah-footer-grad)"
          d="M84.82,211.75h24.95v24.95h-24.95v-24.95ZM59.88,211.75h24.95v-24.95h-24.95v24.95ZM84.82,186.8h24.95v-24.95h-24.95v24.95ZM59.88,161.86h24.95v-24.95h-24.95v24.95ZM84.82,136.91h24.95v-24.95h-24.95v24.95ZM109.77,111.97h24.95v-24.95h-24.95v24.95ZM134.71,136.91h24.95v-24.95h-24.95v24.95ZM159.66,111.97h24.95v-24.95h-24.95v24.95ZM134.71,87.02h24.95v-24.95h-24.95v24.95ZM184.61,87.02h24.95v-24.95h-24.95v24.95ZM209.55,111.97h24.95v-24.95h-24.95v24.95ZM213.41,212.58h24.95v-24.95h-24.95v24.95ZM209.55,62.07h24.95v-24.95h-24.95v24.95ZM34.93,236.7h24.95v-24.95h-24.95v24.95ZM236.7,415.18v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM211.75,440.12v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM186.8,415.18v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM161.86,440.12v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM136.91,415.18v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM111.97,390.23v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM136.91,365.29v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM111.97,340.34v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM87.02,365.29v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM87.02,315.39v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM111.97,290.45v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM62.07,290.45v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM236.7,465.07v-24.95s-24.95,0-24.95,0v24.95s24.95,0,24.95,0ZM415.18,263.3h-24.95s0,24.95,0,24.95h24.95s0-24.95,0-24.95ZM440.12,288.25h-24.95s0,24.95,0,24.95h24.95s0-24.95,0-24.95ZM390.23,388.03h-24.95s0,24.95,0,24.95h24.95s0-24.95,0-24.95ZM340.34,388.03h-24.95s0,24.95,0,24.95h24.95s0-24.95,0-24.95ZM365.29,412.98h-24.95s0,24.95,0,24.95h24.95s0-24.95,0-24.95ZM315.39,412.98h-24.95s0,24.95,0,24.95h24.95s0-24.95,0-24.95ZM290.45,388.03h-24.95s0,24.95,0,24.95h24.95s0-24.95,0-24.95ZM290.45,437.93h-24.95s0,24.95,0,24.95h24.95s0-24.95,0-24.95ZM465.07,263.3h-24.95s0,24.95,0,24.95h24.95s0-24.95,0-24.95ZM263.3,84.82v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM288.25,59.88v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM313.2,84.82v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM338.14,59.88v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM363.09,84.82v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM388.03,109.77v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM363.09,134.71v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM388.03,159.66v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM412.98,134.71v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM412.98,184.61v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM388.03,209.55v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM437.93,209.55v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM263.3,34.93v24.95s24.95,0,24.95,0v-24.95s-24.95,0-24.95,0ZM263.3,187.63v24.95s72.48,0,72.48,0v-24.95s-72.48,0-72.48,0ZM164.22,237.53v24.95s171.57,0,171.57,0v-24.95s-171.57,0-171.57,0ZM164.22,287.42v24.95s83.65,0,83.65,0v-24.95s-83.65,0-83.65,0Z"
        />
      </svg>

      {/* Branding text */}
      <a
        href="https://www.fuqah.ai"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: '10.5px',
          color: textColor,
          letterSpacing: '0.01em',
          whiteSpace: 'nowrap',
          direction: 'rtl',
          textDecoration: 'none',
          cursor: 'pointer',
          transition: 'color 0.15s ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = hoverColor)}
        onMouseLeave={e => (e.currentTarget.style.color = textColor)}
      >
        مدعوم من{' '}
        <span style={{ color: brandColor, fontWeight: 600 }}>فقاعة AI</span>
      </a>
    </div>
  );
}
