import React from 'react';

const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

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