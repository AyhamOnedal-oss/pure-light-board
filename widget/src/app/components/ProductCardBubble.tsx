/**
 * ProductCardBubble — renders a horizontal-scroll row of product cards
 * returned by the AI (e.g. n8n Zid workflow). Up to 3 cards typically.
 */
import type { ProductCard } from '../utils/chatApi';

interface Props {
  products: ProductCard[];
  mainColor?: string;
  isDarkMode?: boolean;
}

export function ProductCardBubble({ products, mainColor, isDarkMode }: Props) {
  if (!products?.length) return null;
  const accent = mainColor || '#043CC8';
  const cardBg = isDarkMode ? '#1f2937' : '#ffffff';
  const cardBorder = isDarkMode ? '#374151' : '#e5e7eb';
  const text = isDarkMode ? '#f9fafb' : '#111827';
  const muted = isDarkMode ? '#9ca3af' : '#6b7280';

  return (
    <div
      dir="rtl"
      className="flex gap-2 overflow-x-auto pb-1 mt-1"
      style={{ scrollbarWidth: 'thin' }}
    >
      {products.slice(0, 6).map((p) => (
        <a
          key={String(p.id)}
          href={p.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 rounded-xl overflow-hidden transition-transform hover:scale-[1.02]"
          style={{
            width: 160,
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            textDecoration: 'none',
          }}
        >
          {p.image_url ? (
            <img
              src={p.image_url}
              alt={p.name}
              loading="lazy"
              style={{
                width: '100%',
                aspectRatio: '1 / 1',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            <div style={{ width: '100%', aspectRatio: '1 / 1', background: cardBorder }} />
          )}
          <div className="px-2 py-2 flex flex-col gap-1">
            <p
              className="truncate"
              style={{ fontSize: 12, fontWeight: 600, color: text, margin: 0 }}
              title={p.name}
            >
              {p.name}
            </p>
            <div className="flex items-baseline gap-1.5" style={{ fontSize: 12 }}>
              {p.sale_price ? (
                <>
                  <span style={{ color: accent, fontWeight: 700 }}>{p.sale_price}</span>
                  <span style={{ color: muted, textDecoration: 'line-through', fontSize: 10 }}>
                    {p.price}
                  </span>
                </>
              ) : (
                <span style={{ color: accent, fontWeight: 700 }}>{p.price}</span>
              )}
            </div>
            <span
              className="block text-center rounded-md mt-0.5"
              style={{
                background: accent,
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 0',
              }}
            >
              عرض المنتج
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}