/**
 * CreateTicketForm — Full-screen phone + country form (shown as a chat screen).
 * Supports Dark Mode via isDarkMode prop.
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Phone, ArrowRight, Download } from 'lucide-react';
import type { Theme } from '../types/theme';
import { validatePhone } from './phoneValidation';
import { CountryFlag } from './CountryFlag';

interface Country {
  code: string;
  name: string;
  dialCode: string;
  placeholder: string;
}

const GULF_COUNTRIES: Country[] = [
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', placeholder: '05xxxxxxxx' },
  { code: 'AE', name: 'UAE',          dialCode: '+971', placeholder: '05xxxxxxxx' },
  { code: 'KW', name: 'Kuwait',       dialCode: '+965', placeholder: '5xxxxxxxx'  },
  { code: 'QA', name: 'Qatar',        dialCode: '+974', placeholder: '3xxxxxxxx'  },
  { code: 'BH', name: 'Bahrain',      dialCode: '+973', placeholder: '3xxxxxxxx'  },
  { code: 'OM', name: 'Oman',         dialCode: '+968', placeholder: '9xxxxxxxx'  },
  { code: 'YE', name: 'Yemen',        dialCode: '+967', placeholder: '7xxxxxxxx'  },
  { code: 'IQ', name: 'Iraq',         dialCode: '+964', placeholder: '7xxxxxxxx'  },
  { code: 'JO', name: 'Jordan',       dialCode: '+962', placeholder: '7xxxxxxxx'  },
  { code: 'EG', name: 'Egypt',        dialCode: '+20',  placeholder: '01xxxxxxxx' },
];

interface CreateTicketFormProps {
  theme: Theme;
  storeName: string;
  onSubmit: (phone: string, dialCode: string) => void;
  onBack: () => void;
  ticketAlreadyCreated?: boolean;
  onDownload?: () => void;
  isDarkMode?: boolean;
  mainColor?: string;
}

export function CreateTicketForm({ theme, storeName, onSubmit, onBack, ticketAlreadyCreated, onDownload, isDarkMode = false, mainColor }: CreateTicketFormProps) {
  const [selectedCountry, setSelectedCountry] = useState<Country>(GULF_COUNTRIES[0]);
  const [phone, setPhone]         = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError]         = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownListRef = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  const isWhiteTheme = theme.background === '#FFFFFF';
  const isBlackTheme = theme.id === 'black';
  const accentColor  = mainColor || ((isWhiteTheme || isBlackTheme) ? '#000000' : theme.background);
  const accentText   = (isWhiteTheme || isBlackTheme) ? '#FFFFFF' : theme.text;

  // Dark mode colors
  const pageBg = isDarkMode ? '#1e293b' : '#FFFFFF';
  const titleColor = isDarkMode ? '#f1f5f9' : '#1f2937';
  const descColor = isDarkMode ? '#94a3b8' : '#9ca3af';
  const borderColor = isDarkMode ? '#334155' : '#f3f4f6';
  const labelColor = isDarkMode ? '#cbd5e1' : '#374151';
  const phoneBg = isDarkMode ? '#0f172a' : '#f9fafb';
  const phoneBorder = isDarkMode ? '#475569' : '#d1d5db';
  const phoneText = isDarkMode ? '#f1f5f9' : '#1f2937';
  const countryText = isDarkMode ? '#cbd5e1' : '#374151';
  const countryBorder = isDarkMode ? '#334155' : '#e5e7eb';
  const chevronColor = isDarkMode ? '#64748b' : '#9ca3af';
  const dropdownBg = isDarkMode ? '#1e293b' : '#FFFFFF';
  const dropdownBorder = isDarkMode ? '#334155' : '#e5e7eb';
  const dropdownHover = isDarkMode ? '#334155' : '#f9fafb';
  const dropdownItemText = isDarkMode ? '#cbd5e1' : '#374151';
  const dropdownItemDial = isDarkMode ? '#64748b' : '#9ca3af';
  const iconBg = isDarkMode ? `${accentColor}20` : `${accentColor}12`;
  const backBtnHover = isDarkMode ? '#334155' : '#f3f4f6';
  const backIconColor = isDarkMode ? '#94a3b8' : '#6b7280';
  const successBg = isDarkMode ? '#052e16' : '#f0fdf4';
  const successBorder = isDarkMode ? '#166534' : '#bbf7d0';
  const dlBtnBorder = isDarkMode ? '#334155' : '#e5e7eb';
  const dlBtnColor = isDarkMode ? '#94a3b8' : '#6b7280';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const el = dropdownListRef.current;
    if (!el || !showDropdown) return;
    const handleTouch = (e: TouchEvent) => { e.stopPropagation(); };
    el.addEventListener('touchmove', handleTouch, { passive: false });
    el.addEventListener('touchstart', handleTouch, { passive: true });
    return () => {
      el.removeEventListener('touchmove', handleTouch);
      el.removeEventListener('touchstart', handleTouch);
    };
  }, [showDropdown]);

  const handleSubmit = () => {
    const cleaned = phone.replace(/\D/g, '');
    const result = validatePhone(selectedCountry.code, cleaned);
    if (!result.valid) {
      setError(result.error);
      inputRef.current?.focus();
      return;
    }
    setError('');
    onSubmit(cleaned, selectedCountry.dialCode);
  };

  const rowBorder = error
    ? '#ef4444'
    : inputFocused
    ? accentColor
    : phoneBorder;

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      dir="rtl"
      style={{ WebkitFontSmoothing: 'antialiased', overscrollBehavior: 'contain', touchAction: 'pan-y', background: pageBg }}
    >
      {/* Top accent line */}
      <div style={{ height: '4px', background: accentColor, flexShrink: 0 }} />

      {/* Header bar */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: `1px solid ${borderColor}` }}
      >
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-full transition-colors flex-shrink-0"
          style={{ background: 'transparent' }}
          onMouseEnter={e => (e.currentTarget.style.background = backBtnHover)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          aria-label="رجوع"
        >
          <ArrowRight className="w-5 h-5" style={{ color: backIconColor }} />
        </button>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: titleColor }}>
          رفع تذكرة دعم
        </h3>
      </div>

      <div data-chat-scrollable className="flex-1 flex flex-col px-5 py-5 overflow-y-auto">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: iconBg }}
          >
            <Phone style={{ width: '26px', height: '26px', color: accentColor }} strokeWidth={1.8} />
          </div>
        </div>

        {/* Description */}
        <div className="text-center mb-6">
          <p style={{ fontSize: '13px', color: descColor, lineHeight: '1.7' }}>
            أدخل رقم هاتفك وسيتواصل معك فريق {storeName}
          </p>
        </div>

        {ticketAlreadyCreated ? (
          <>
            <div
              className="w-full rounded-2xl p-5 text-center"
              style={{ background: successBg, border: `1.5px solid ${successBorder}` }}
            >
              <p style={{ fontSize: '14px', color: '#16a34a', fontWeight: 600, lineHeight: '1.7' }}>
                تم إنشاء تذكرة مسبقاً لهذه المحادثة.
              </p>
            </div>

            <div style={{ flex: 1, minHeight: '24px' }} />

            <button
              type="button"
              onClick={onBack}
              className="w-full rounded-xl transition-all hover:opacity-90 active:scale-[0.98]"
              style={{
                background: accentColor,
                color: accentText,
                fontSize: '14px',
                fontWeight: 700,
                padding: '14px',
                marginBottom: '10px',
              }}
            >
              حسناً، شكراً
            </button>

            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl transition-colors"
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: dlBtnColor,
                  border: `1.5px solid ${dlBtnBorder}`,
                  padding: '12px',
                  marginBottom: '10px',
                  background: 'transparent',
                }}
              >
                <Download className="w-4 h-4" />
                تحميل التذكرة
              </button>
            )}
          </>
        ) : (
          <>
            {/* Label */}
            <p style={{ fontSize: '13px', fontWeight: 600, color: labelColor, marginBottom: '8px' }}>
              رقم الهاتف
            </p>

            <div
              className="flex items-stretch rounded-xl overflow-visible"
              style={{
                direction: 'ltr',
                border: `1.5px solid ${rowBorder}`,
                background: phoneBg,
                transition: 'border-color 0.15s',
              }}
            >
              {/* Country selector */}
              <div className="relative flex-shrink-0" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowDropdown(v => !v)}
                  className="flex items-center gap-2 h-full transition-colors"
                  style={{
                    padding: '0 10px',
                    borderRight: `1.5px solid ${countryBorder}`,
                    background: 'transparent',
                    cursor: 'pointer',
                    minWidth: '88px',
                  }}
                >
                  <CountryFlag code={selectedCountry.code} size={22} />
                  <span style={{ fontSize: '13px', color: countryText, fontWeight: 600, flex: 1, textAlign: 'left' }}>
                    {selectedCountry.code}
                  </span>
                  <ChevronDown
                    style={{
                      width: '14px',
                      height: '14px',
                      color: chevronColor,
                      transition: 'transform 0.15s',
                      transform: showDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                      flexShrink: 0,
                    }}
                  />
                </button>

                {showDropdown && (
                  <div
                    ref={dropdownListRef}
                    data-chat-scrollable
                    className="absolute rounded-xl shadow-xl"
                    style={{
                      top: '100%',
                      left: 0,
                      marginTop: '4px',
                      width: '220px',
                      zIndex: 1000,
                      maxHeight: '220px',
                      overflowY: 'auto',
                      border: `1px solid ${dropdownBorder}`,
                      background: dropdownBg,
                      WebkitOverflowScrolling: 'touch',
                      overscrollBehavior: 'contain',
                      touchAction: 'pan-y',
                    }}
                  >
                    {GULF_COUNTRIES.map(country => (
                      <button
                        key={country.code}
                        type="button"
                        onClick={() => {
                          setSelectedCountry(country);
                          setShowDropdown(false);
                          setPhone('');
                          inputRef.current?.focus();
                        }}
                        className="w-full flex items-center gap-2.5 text-left transition-colors"
                        style={{
                          padding: '10px 14px',
                          background: selectedCountry.code === country.code
                            ? `${accentColor}0d`
                            : 'transparent',
                        }}
                        onMouseEnter={e => { if (selectedCountry.code !== country.code) e.currentTarget.style.background = dropdownHover; }}
                        onMouseLeave={e => { e.currentTarget.style.background = selectedCountry.code === country.code ? `${accentColor}0d` : 'transparent'; }}
                      >
                        <CountryFlag code={country.code} size={20} />
                        <span style={{ fontSize: '13px', color: dropdownItemText, fontWeight: 500 }}>
                          {country.code}
                        </span>
                        <span style={{ fontSize: '12px', color: dropdownItemDial, marginLeft: 'auto' }}>
                          {country.dialCode}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Phone input */}
              <input
                ref={inputRef}
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={e => {
                  setPhone(e.target.value.replace(/[^\d\s]/g, ''));
                  if (error) setError('');
                }}
                placeholder={selectedCountry.placeholder}
                dir="ltr"
                className="flex-1 bg-transparent outline-none"
                style={{
                  padding: '12px 12px',
                  fontSize: '16px',
                  color: phoneText,
                  caretColor: accentColor,
                  letterSpacing: '0.04em',
                  minWidth: 0,
                }}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
              />
            </div>

            {/* Error */}
            {error && (
              <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '6px' }}>{error}</p>
            )}

            <div style={{ flex: 1, minHeight: '24px' }} />

            {/* Submit */}
            <button
              type="button"
              onClick={handleSubmit}
              className="w-full rounded-xl transition-all hover:opacity-90 active:scale-[0.98]"
              style={{
                background: accentColor,
                color: accentText,
                fontSize: '14px',
                fontWeight: 700,
                padding: '14px',
                marginBottom: '10px',
              }}
            >
              إرسال التذكرة
            </button>
          </>
        )}
      </div>
    </div>
  );
}
