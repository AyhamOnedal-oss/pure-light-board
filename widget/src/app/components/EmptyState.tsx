interface EmptyStateProps {
  storeLogo?: string;
  isDarkMode?: boolean;
}

export function EmptyState({ storeLogo, isDarkMode }: EmptyStateProps) {
  const titleColor = isDarkMode ? '#f1f5f9' : '#1f2937';
  const subtitleColor = isDarkMode ? '#94a3b8' : '#9ca3af';

  return (
    <div
      className="flex flex-col items-center justify-center h-full py-12"
      style={{ WebkitFontSmoothing: 'antialiased' }}
    >
      {/* Store Logo — wide banner format (recommended 1024×256, max 2MB, jpeg/jpg/png) */}
      {storeLogo && (
        <div
          className="mb-6 flex items-center justify-center"
          style={{
            width: '100%',
            maxWidth: '280px',
            padding: '0 16px',
          }}
        >
          <img
            src={storeLogo}
            alt="Store Logo"
            style={{
              width: '100%',
              maxHeight: '80px',
              objectFit: 'contain',
              objectPosition: 'center',
              borderRadius: '8px',
              filter: isDarkMode ? 'brightness(0.95)' : 'none',
            }}
          />
        </div>
      )}
      <h3
        className="text-center mb-2"
        style={{ fontSize: '18px', fontWeight: 600, color: titleColor }}
      >
        مرحباً، كيف أستطيع أن أساعدك؟
      </h3>
      <p className="text-sm text-center" style={{ lineHeight: 1.6, color: subtitleColor }}>
        نحن هنا للإجابة على جميع استفساراتك
      </p>
    </div>
  );
}