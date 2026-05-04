/**
 * ChatInlineTicketForm — Compact ticket form embedded inside a chat message.
 * Supports Dark Mode via isDarkMode prop.
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Send } from 'lucide-react';
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

interface ChatInlineTicketFormProps {
  theme: Theme;
  onSubmit: (phone: string, dialCode: string) => void;
  isDarkMode?: boolean;
  mainColor?: string;
}

export function ChatInlineTicketForm({ theme, onSubmit, isDarkMode = false, mainColor }: ChatInlineTicketFormProps) {
  const [selectedCountry, setSelectedCountry] = useState<Country>(GULF_COUNTRIES[0]);
  const [phone, setPhone] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownListRef = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  const isWhiteTheme = theme.background === '#FFFFFF';
  const isBlackTheme = theme.id === 'black';
  const accentColor  = mainColor || ((isWhiteTheme || isBlackTheme) ? '#000000' : theme.background);
  const accentText   = (isWhiteTheme || isBlackTheme) ? '#FFFFFF' : theme.text;

  // Dark mode colors
  const containerBg = isDarkMode ? '#0f172a' : '#f8fafc';
  const containerBorder = isDarkMode ? '#334155' : '#e2e8f0';
  const inputRowBg = isDarkMode ? '#1e293b' : '#fff';
  const inputRowBorder = isDarkMode ? '#475569' : '#d1d5db';
  const inputText = isDarkMode ? '#f1f5f9' : '#1f2937';
  const countryText = isDarkMode ? '#cbd5e1' : '#374151';
  const countryBorder = isDarkMode ? '#334155' : '#e5e7eb';
  const chevronColor = isDarkMode ? '#64748b' : '#9ca3af';
  const dropdownBg = isDarkMode ? '#1e293b' : '#FFFFFF';
  const dropdownBorder = isDarkMode ? '#334155' : '#e5e7eb';
  const dropdownHover = isDarkMode ? '#334155' : '#f9fafb';
  const dropdownItemText = isDarkMode ? '#cbd5e1' : '#374151';
  const dropdownItemDial = isDarkMode ? '#64748b' : '#9ca3af';

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

  return (
    <div
      className="rounded-2xl overflow-visible"
      style={{
        background: containerBg,
        border: `1px solid ${containerBorder}`,
        padding: '12px',
        marginTop: '8px',
        width: '270px',
        direction: 'ltr',
      }}
    >
      <div
        className="flex items-stretch rounded-xl overflow-visible mb-2"
        style={{ border: `1.5px solid ${error ? '#ef4444' : inputRowBorder}`, background: inputRowBg }}
      >
        {/* Country selector */}
        <div className="relative flex-shrink-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowDropdown(v => !v)}
            className="flex items-center gap-1.5 h-full px-2.5 transition-colors"
            style={{
              borderRight: `1.5px solid ${countryBorder}`,
              background: 'transparent',
              cursor: 'pointer',
              minWidth: '76px',
            }}
          >
            <CountryFlag code={selectedCountry.code} size={18} />
            <span style={{ fontSize: '12px', color: countryText, fontWeight: 600, flex: 1, textAlign: 'left' }}>
              {selectedCountry.code}
            </span>
            <ChevronDown
              style={{
                width: '12px',
                height: '12px',
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
                width: '200px',
                zIndex: 1000,
                maxHeight: '200px',
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
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors"
                  style={{
                    background: selectedCountry.code === country.code
                      ? `${accentColor}0d`
                      : 'transparent',
                  }}
                  onMouseEnter={e => { if (selectedCountry.code !== country.code) e.currentTarget.style.background = dropdownHover; }}
                  onMouseLeave={e => { e.currentTarget.style.background = selectedCountry.code === country.code ? `${accentColor}0d` : 'transparent'; }}
                >
                  <CountryFlag code={country.code} size={17} />
                  <span style={{ fontSize: '13px', color: dropdownItemText, fontWeight: 500 }}>
                    {country.code}
                  </span>
                  <span style={{ fontSize: '11px', color: dropdownItemDial, marginLeft: 'auto' }}>
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
            padding: '10px 10px',
            fontSize: '16px',
            color: inputText,
            caretColor: accentColor,
            letterSpacing: '0.03em',
            minWidth: 0,
          }}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
        />
      </div>

      {/* Error */}
      {error && (
        <p style={{ fontSize: '11px', color: '#ef4444', marginBottom: '6px' }}>{error}</p>
      )}

      {/* Submit button */}
      <button
        type="button"
        onClick={handleSubmit}
        className="w-full flex items-center justify-center gap-1.5 rounded-xl transition-all hover:opacity-90 active:scale-[0.98]"
        style={{
          background: accentColor,
          color: accentText,
          fontSize: '13px',
          fontWeight: 700,
          padding: '9px 12px',
        }}
      >
        <Send style={{ width: '13px', height: '13px' }} />
        إرسال التذكرة
      </button>
    </div>
  );
}
