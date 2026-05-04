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
    }}>
      {parts.map((part, index) => {
        // Check if this part is a URL
        if (part.match(URL_REGEX)) {
          // Ensure the URL has a protocol
          const href = part.startsWith('http') ? part : `https://${part}`;

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
