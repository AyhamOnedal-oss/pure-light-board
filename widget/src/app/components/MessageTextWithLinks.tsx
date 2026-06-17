/**
 * MessageTextWithLinks — Utility component that renders text with clickable URL links.
 *
 * Automatically detects URLs in message text and converts them to clickable links
 * styled in blue that open in a new tab.
 */

interface MessageTextWithLinksProps {
  text: string;
  style?: React.CSSProperties;
}

/**
 * Regular expression to detect URLs in text.
 * Matches http://, https://, and www. patterns.
 */
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|avif|bmp|svg)(\?[^\s]*)?$/i;
const IMAGE_HOST_RE = /(media\.zid\.store|cdn\.salla\.sa|cdn\.youcan\.shop|images\.unsplash\.com|picsum\.photos|cloudinary\.com|imgur\.com)/i;
function isImageUrl(u: string): boolean {
  try {
    const url = u.startsWith('http') ? u : `https://${u}`;
    const p = new URL(url);
    return IMAGE_EXT_RE.test(p.pathname) || IMAGE_HOST_RE.test(p.hostname);
  } catch { return false; }
}

export function MessageTextWithLinks({ text, style }: MessageTextWithLinksProps) {
  // Split text by URLs
  const parts = text.split(URL_REGEX);

  return (
    <p style={{
      ...style,
      fontSize: '14px',
      lineHeight: '1.6',
      margin: 0,
      letterSpacing: '0.01em',
      wordBreak: 'break-word',
      overflowWrap: 'break-word',
      whiteSpace: 'pre-wrap',
    }}>
      {parts.map((part, index) => {
        // Check if this part is a URL
        if (part.match(URL_REGEX)) {
          // Ensure the URL has a protocol
          const href = part.startsWith('http') ? part : `https://${part}`;

          if (isImageUrl(part)) {
            return (
              <a
                key={index}
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
                    if (a) {
                      a.textContent = part;
                      a.style.color = '#3b82f6';
                      a.style.textDecoration = 'underline';
                      a.style.wordBreak = 'break-all';
                    }
                  }}
                  style={{ maxWidth: 220, width: '100%', height: 'auto', borderRadius: 12, display: 'block' }}
                />
              </a>
            );
          }

          return (
            <a
              key={index}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#3b82f6',
                textDecoration: 'underline',
                cursor: 'pointer',
                wordBreak: 'break-all',
                overflowWrap: 'break-word',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          );
        }

        // Regular text
        return <span key={index}>{part}</span>;
      })}
    </p>
  );
}
