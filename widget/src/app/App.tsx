/**
 * App — Demo showcase for the Chat Widget system.
 * Shows all 7 color themes, position controls, and responsive behavior.
 * In production, only ONE FloatingWidget would be rendered per page.
 */

import { useState } from 'react';
import { FloatingWidget } from './components/FloatingWidget';
import { ThemeControls } from './components/ThemeControls';
import { ThemeSettingsProvider, useThemeSettings } from './contexts/ThemeSettingsContext';
import { THEMES } from './types/theme';
import type { Theme } from './types/theme';
import { MessageCircle, ArrowLeftRight, Monitor, Tablet, Smartphone } from 'lucide-react';
import { useFetchChatSettings } from './hooks/useFetchChatSettings';
import { useFetchStoreBranding, type StoreBranding } from './hooks/useFetchStoreBranding';

function AppContent({ branding, isReady }: { branding: StoreBranding; isReady: boolean }) {
  const [activeTheme, setActiveTheme] = useState<Theme>(THEMES[0]);
  const { settings, updateSettings, fetchedPosition } = useThemeSettings();
  const [localPosition, setLocalPosition] = useState<'bottom-right' | 'bottom-left' | null>(null);

  // Use fetched position unless user overrides locally
  const effectivePosition = localPosition ?? fetchedPosition;

  /** Bubble colors per theme (for the palette selector) */
  function getBubbleBg(t: Theme) {
    if (t.id === 'white') return '#FFFFFF';
    return t.background;
  }

  const isDarkMode = settings.mode === 'dark';
  const pageBg = isDarkMode ? '#0f172a' : '#f9fafb';

  const handleSaveSettings = () => {
    // In production, this would save to backend/localStorage
    console.log('Settings saved:', settings);
  };

  return (
    <div className="min-h-screen" style={{ background: pageBg }} dir="rtl">
      {/* ── Header ── */}
      <header
        className="border-b sticky top-0 z-40"
        style={{
          background: isDarkMode ? '#1e293b' : '#FFFFFF',
          borderColor: isDarkMode ? '#334155' : '#e5e7eb',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 style={{
                fontSize: '18px',
                fontWeight: 700,
                color: isDarkMode ? '#f1f5f9' : '#1f2937',
              }}>
                فقاعة AI — ويدجت المحادثة
              </h1>
              <p style={{
                fontSize: '12px',
                color: isDarkMode ? '#94a3b8' : '#9ca3af',
              }}>
                نظام شات قابل للتضمين مع التحكم الكامل بالألوان
              </p>
            </div>
          </div>

          {/* Position toggle */}
          <button
            onClick={() => setLocalPosition(p => p === 'bottom-right' ? 'bottom-left' : 'bottom-right')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-colors"
            style={{
              background: isDarkMode ? '#334155' : '#f3f4f6',
              color: isDarkMode ? '#f1f5f9' : '#374151',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDarkMode ? '#475569' : '#e5e7eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isDarkMode ? '#334155' : '#f3f4f6';
            }}
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>{effectivePosition === 'bottom-right' ? 'يمين' : 'يسار'}</span>
          </button>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Theme Settings Dashboard */}
        <section className="mb-10">
          <ThemeControls
            settings={settings}
            onUpdate={updateSettings}
            onSave={handleSaveSettings}
          />
        </section>

        {/* Legacy Theme Selector (for reference) */}
        <section className="mb-10">
          <h2
            className="mb-4"
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: isDarkMode ? '#f1f5f9' : '#1f2937',
            }}
          >
            الثيمات الجاهزة (مرجع)
          </h2>
          <div className="flex flex-wrap gap-3">
            {THEMES.map(t => {
              const isActive = activeTheme.id === t.id;
              const bg = getBubbleBg(t);
              const isWhite = t.id === 'white';
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTheme(t)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${
                    isActive ? 'shadow-lg scale-[1.02]' : 'hover:shadow-md'
                  }`}
                  style={{
                    borderColor: isActive ? bg : (isDarkMode ? '#334155' : '#e5e7eb'),
                    background: isActive
                      ? `${isWhite ? '#1f2937' : bg}10`
                      : isDarkMode ? '#1e293b' : '#FFFFFF',
                  }}
                >
                  {/* Mini bubble preview */}
                  <div
                    className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center"
                    style={{
                      background: bg,
                      border: isWhite ? `2px solid ${isDarkMode ? '#334155' : '#e5e7eb'}` : 'none',
                      boxShadow: isWhite ? 'none' : `0 2px 8px ${bg}40`,
                    }}
                  >
                    <svg viewBox="0 0 1000 1000" className="w-5 h-5">
                      <path
                        fill={isWhite ? '#222' : '#fff'}
                        d="M500,217.35c-156.1,0-282.65,126.55-282.65,282.65s126.55,282.65,282.65,282.65v68.68s282.65-77.5,282.65-351.33c0-156.11-126.55-282.65-282.65-282.65Z"
                      />
                    </svg>
                  </div>
                  <div className="text-right">
                    <p
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: isDarkMode ? '#f1f5f9' : '#1f2937',
                      }}
                    >
                      {t.name}
                    </p>
                    <p
                      style={{
                        fontSize: '11px',
                        color: isDarkMode ? '#94a3b8' : '#9ca3af',
                      }}
                    >
                      {t.background}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Responsive Preview Section */}
        <section className="mb-10">
          <h2
            className="mb-4"
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: isDarkMode ? '#f1f5f9' : '#1f2937',
            }}
          >
            عرض مباشر حسب الجهاز
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Desktop */}
            <PreviewCard
              label="سطح المكتب"
              icon={<Monitor className="w-4 h-4" />}
              description={effectivePosition === 'bottom-right' ? 'الفقاعة أسفل اليمين' : 'الفقاعة أسفل اليسار'}
              isDarkMode={isDarkMode}
            >
              <MockBrowser theme={activeTheme} position={effectivePosition} type="desktop" />
            </PreviewCard>

            {/* Tablet */}
            <PreviewCard
              label="جهاز لوحي"
              icon={<Tablet className="w-4 h-4" />}
              description="نفس سلوك سطح المكتب"
              isDarkMode={isDarkMode}
            >
              <MockBrowser theme={activeTheme} position={effectivePosition} type="tablet" />
            </PreviewCard>

            {/* Mobile */}
            <PreviewCard
              label="هاتف محمول"
              icon={<Smartphone className="w-4 h-4" />}
              description="الشات يفتح بملء الشاشة"
              isDarkMode={isDarkMode}
            >
              <MockBrowser theme={activeTheme} position={effectivePosition} type="mobile" />
            </PreviewCard>
          </div>
        </section>

        {/* All 7 bubbles overview */}
        <section className="mb-10">
          <h2
            className="mb-4"
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: isDarkMode ? '#f1f5f9' : '#1f2937',
            }}
          >
            الفقاعات السبع — الحالة المغلقة
          </h2>
          <div className="flex flex-wrap gap-4 items-center">
            {THEMES.map(t => {
              const bg = getBubbleBg(t);
              const isWhite = t.id === 'white';
              return (
                <div key={t.id} className="flex flex-col items-center gap-2">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
                    style={{
                      background: bg,
                      border: isWhite ? '2px solid #e5e7eb' : 'none',
                      boxShadow: isWhite
                        ? '0 4px 16px rgba(0,0,0,0.1)'
                        : `0 4px 16px ${bg}50`,
                    }}
                    onClick={() => setActiveTheme(t)}
                  >
                    <svg viewBox="0 0 1000 1000" className="w-7 h-7">
                      <path
                        fill={isWhite ? '#222' : '#fff'}
                        d="M500,217.35c-156.1,0-282.65,126.55-282.65,282.65s126.55,282.65,282.65,282.65v68.68s282.65-77.5,282.65-351.33c0-156.11-126.55-282.65-282.65-282.65Z"
                      />
                    </svg>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      color: isDarkMode ? '#94a3b8' : '#6b7280',
                    }}
                  >
                    {t.name}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* ── Live floating widget — only render after backend data is loaded
            to avoid flash of default color / default store name / default logo. ── */}
      {isReady && (
        <FloatingWidget
          theme={activeTheme}
          position={effectivePosition}
          storeName={branding.storeName}
          storeLogo={branding.storeLogo}
          storeIcon={branding.storeIcon}
          themeSettings={settings}
        />
      )}
    </div>
  );
}

export default function App() {
  const { themeSettings: fetchedSettings, position: fetchedPosition, isLoaded } = useFetchChatSettings();
  const branding = useFetchStoreBranding();

  // Widget is "ready" only when BOTH endpoints have settled (success or fallback).
  // This eliminates the flash where the bubble briefly shows the default color
  // / the header shows the default store name / the empty-state shows the
  // placeholder Unsplash image before real data arrives from the dashboard.
  const isReady = isLoaded && branding.isLoaded;

  return (
    <ThemeSettingsProvider
      initialSettings={isLoaded ? fetchedSettings : undefined}
      initialPosition={fetchedPosition}
    >
      <AppContent branding={branding} isReady={isReady} />
    </ThemeSettingsProvider>
  );
}

/* ── Helper Components ── */

function PreviewCard({
  label,
  icon,
  description,
  children,
  isDarkMode,
}: {
  label: string;
  icon: React.ReactNode;
  description: string;
  children: React.ReactNode;
  isDarkMode?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        background: isDarkMode ? '#1e293b' : '#FFFFFF',
        borderColor: isDarkMode ? '#334155' : '#e5e7eb',
      }}
    >
      <div
        className="px-4 py-3 border-b flex items-center gap-2"
        style={{ borderColor: isDarkMode ? '#334155' : '#f3f4f6' }}
      >
        <span style={{ color: isDarkMode ? '#94a3b8' : '#6b7280' }}>{icon}</span>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: isDarkMode ? '#f1f5f9' : '#374151',
          }}
        >
          {label}
        </span>
        <span
          className="mr-auto"
          style={{
            fontSize: '11px',
            color: isDarkMode ? '#64748b' : '#9ca3af',
          }}
        >
          {description}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/** Mockup browser showing bubble + chat position */
function MockBrowser({
  theme,
  position,
  type,
}: {
  theme: Theme;
  position: 'bottom-right' | 'bottom-left';
  type: 'desktop' | 'tablet' | 'mobile';
}) {
  const isWhite = theme.id === 'white';
  const isBlack = theme.id === 'black';
  const bg = isWhite ? '#FFFFFF' : theme.background;
  const iconColor = isWhite ? '#222' : '#fff';
  const headerBg = isWhite ? '#000000' : isBlack ? '#FFFFFF' : theme.background;
  const headerText = isWhite ? '#FFFFFF' : isBlack ? '#1f2937' : theme.text;

  const heights: Record<string, number> = { desktop: 220, tablet: 200, mobile: 320 };
  const h = heights[type];

  const isMobile = type === 'mobile';

  // Chat window dimensions
  const chatW = isMobile ? '85%' : '55%';
  const chatH = isMobile ? '80%' : '60%';

  return (
    <div
      className="relative bg-gray-50 rounded-xl overflow-hidden border border-gray-200"
      style={{ height: `${h}px` }}
    >
      {/* Fake page content */}
      <div className="absolute top-3 left-4 right-4 flex flex-col gap-2">
        <div className="h-2 bg-gray-200 rounded w-3/4" />
        <div className="h-2 bg-gray-200 rounded w-1/2" />
        <div className="h-2 bg-gray-100 rounded w-2/3 mt-2" />
        <div className="h-2 bg-gray-100 rounded w-1/3" />
      </div>

      {/* Mini chat window */}
      <div
        className="absolute rounded-xl overflow-hidden shadow-lg border border-gray-200"
        style={{
          width: chatW,
          height: chatH,
          ...(isMobile
            ? { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
            : position === 'bottom-right'
              ? { right: '12px', bottom: '48px' }
              : { left: '12px', bottom: '48px' }),
        }}
      >
        {/* Mini header */}
        <div
          className="flex items-center gap-1.5 px-2 py-1.5"
          style={{ background: headerBg }}
        >
          <div className="w-4 h-4 rounded-full bg-white/30" />
          <div className="flex-1">
            <div className="h-1.5 rounded w-12" style={{ background: `${headerText}60` }} />
            <div className="h-1 rounded w-8 mt-0.5" style={{ background: `${headerText}30` }} />
          </div>
        </div>
        {/* Mini messages */}
        <div className="bg-white flex-1 p-1.5" style={{ height: 'calc(100% - 52px)' }}>
          <div className="flex justify-end mb-1">
            <div className="h-2 rounded-full w-10" style={{ background: headerBg, opacity: 0.7 }} />
          </div>
          <div className="flex justify-start mb-1">
            <div className="h-2 bg-gray-200 rounded-full w-14" />
          </div>
          <div className="flex justify-end">
            <div className="h-2 rounded-full w-8" style={{ background: headerBg, opacity: 0.5 }} />
          </div>
        </div>
        {/* Mini input */}
        <div className="bg-white border-t border-gray-100 px-1.5 py-1">
          <div className="h-3 bg-gray-100 rounded-full" />
        </div>
      </div>

      {/* Mini bubble */}
      <div
        className="absolute rounded-full flex items-center justify-center"
        style={{
          width: '28px',
          height: '28px',
          bottom: '10px',
          ...(isMobile
            ? (position === 'bottom-right' ? { right: '10px' } : { left: '10px' })
            : position === 'bottom-right'
              ? { right: '12px' }
              : { left: '12px' }),
          background: bg,
          border: isWhite ? '1.5px solid #e5e7eb' : 'none',
          boxShadow: `0 2px 8px rgba(0,0,0,0.15)`,
        }}
      >
        <svg viewBox="0 0 1000 1000" className="w-3.5 h-3.5">
          <path
            fill={iconColor}
            d="M500,217.35c-156.1,0-282.65,126.55-282.65,282.65s126.55,282.65,282.65,282.65v68.68s282.65-77.5,282.65-351.33c0-156.11-126.55-282.65-282.65-282.65Z"
          />
        </svg>
      </div>
    </div>
  );
}
