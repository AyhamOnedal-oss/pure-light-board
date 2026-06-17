import React from 'react';

const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|avif|bmp|svg)(\?[^\s]*)?$/i;
const IMAGE_HOST_RE = /(media\.zid\.store|cdn\.salla\.sa|cdn\.youcan\.shop|images\.unsplash\.com|picsum\.photos|cloudinary\.com|imgur\.com)/i;
function isImageUrl(u: string): boolean {
  try {
    const url = u.startsWith('http') ? u : `https://${u}`;
    if (IMAGE_EXT_RE.test(new URL(url).pathname)) return true;
    return IMAGE_HOST_RE.test(new URL(url).hostname);
  } catch { return false; }
}

/**
 * Renders message text with newlines preserved, long words/URLs wrapped,
 * and any URLs converted into clickable blue links.
 */
export function LinkifiedText({
  text,
  onAi = false,
  className = '',
}: {
  text: string;
  onAi?: boolean;
  className?: string;
}) {
  const parts = text.split(URL_REGEX);
  const linkColor = onAi ? '#bfdbfe' : '#043CC8';
  return (
    <span
      className={className}
      style={{
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
      }}
    >
      {parts.map((part, i) => {
        if (part && URL_REGEX.test(part)) {
          URL_REGEX.lastIndex = 0;
          const href = part.startsWith('http') ? part : `https://${part}`;
          if (isImageUrl(part)) {
            return (
              <a
                key={i}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ display: 'block', margin: '4px 0' }}
              >
                <img
                  src={href}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    const img = e.currentTarget;
                    const a = img.parentElement as HTMLAnchorElement | null;
                    if (a) { a.textContent = part; a.style.color = linkColor; a.style.textDecoration = 'underline'; a.style.wordBreak = 'break-all'; }
                  }}
                  style={{ maxWidth: 240, width: '100%', height: 'auto', borderRadius: 12, display: 'block' }}
                />
              </a>
            );
          }
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                color: linkColor,
                textDecoration: 'underline',
                wordBreak: 'break-all',
                overflowWrap: 'anywhere',
              }}
            >
              {part}
            </a>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
}