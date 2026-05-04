/**
 * ThemeControls — Dashboard panel for controlling theme settings
 *
 * Provides controls for:
 * - Theme mode (Light / Dark)
 * - Main color (header, AI bubbles, send button)
 * - Widget outer color (bubble outer edge)
 * - Widget inner color (bubble center/icon)
 */

import { useState } from 'react';
import { Sun, Moon, Save } from 'lucide-react';
import type { ThemeSettings, ThemeMode } from '../types/themeSettings';

interface ThemeControlsProps {
  settings: ThemeSettings;
  onUpdate: (settings: Partial<ThemeSettings>) => void;
  onSave: () => void;
}

export function ThemeControls({ settings, onUpdate, onSave }: ThemeControlsProps) {
  const [hasChanges, setHasChanges] = useState(false);
  const isDarkMode = settings.mode === 'dark';

  const handleModeChange = (mode: ThemeMode) => {
    onUpdate({ mode });
    setHasChanges(true);
  };

  const handleColorChange = (key: keyof ThemeSettings, value: string) => {
    onUpdate({ [key]: value });
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave();
    setHasChanges(false);
  };

  return (
    <div
      className="rounded-2xl border p-6"
      style={{
        maxWidth: '600px',
        background: isDarkMode ? '#1e293b' : '#FFFFFF',
        borderColor: isDarkMode ? '#334155' : '#e5e7eb',
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <h2
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: isDarkMode ? '#f1f5f9' : '#1f2937',
          }}
        >
          إعدادات المظهر
        </h2>
        {hasChanges && (
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>حفظ التغييرات</span>
          </button>
        )}
      </div>

      {/* Theme Mode Toggle */}
      <div className="mb-6">
        <label
          className="block mb-3"
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: isDarkMode ? '#f1f5f9' : '#374151',
          }}
        >
          نمط المظهر
        </label>
        <div className="flex gap-3">
          <button
            onClick={() => handleModeChange('light')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
              settings.mode === 'light'
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <Sun className="w-5 h-5" />
            <span style={{ fontSize: '14px', fontWeight: 600 }}>فاتح</span>
          </button>
          <button
            onClick={() => handleModeChange('dark')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
              settings.mode === 'dark'
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <Moon className="w-5 h-5" />
            <span style={{ fontSize: '14px', fontWeight: 600 }}>داكن</span>
          </button>
        </div>
      </div>

      {/* Main Color */}
      <ColorControl
        label="اللون الأساسي"
        description="يتحكم في لون الهيدر، رسائل الذكاء الاصطناعي، وزر الإرسال"
        value={settings.mainColor}
        onChange={(value) => handleColorChange('mainColor', value)}
        isDarkMode={isDarkMode}
      />

      {/* Widget Outer Color */}
      <ColorControl
        label="لون الأيقونة الخارجي"
        description="لون الحافة الخارجية للفقاعة العائمة"
        value={settings.widgetOuterColor}
        onChange={(value) => handleColorChange('widgetOuterColor', value)}
        isDarkMode={isDarkMode}
      />

      {/* Widget Inner Color */}
      <ColorControl
        label="لون الأيقونة الداخلي"
        description="لون المركز/الأيقونة داخل الفقاعة العائمة"
        value={settings.widgetInnerColor}
        onChange={(value) => handleColorChange('widgetInnerColor', value)}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}

interface ColorControlProps {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  isDarkMode?: boolean;
}

function ColorControl({ label, description, value, onChange, isDarkMode }: ColorControlProps) {
  return (
    <div className="mb-6 last:mb-0">
      <label
        className="block mb-2"
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: isDarkMode ? '#f1f5f9' : '#374151',
        }}
      >
        {label}
      </label>
      <p
        className="text-xs mb-3"
        style={{ color: isDarkMode ? '#94a3b8' : '#6b7280' }}
      >
        {description}
      </p>
      <div className="flex gap-3">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-16 h-12 rounded-xl border-2 cursor-pointer"
            style={{
              padding: '4px',
              borderColor: isDarkMode ? '#334155' : '#e5e7eb',
            }}
          />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 px-4 py-3 rounded-xl border text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
          style={{
            borderColor: isDarkMode ? '#334155' : '#e5e7eb',
            background: isDarkMode ? '#0f172a' : '#FFFFFF',
            color: isDarkMode ? '#f1f5f9' : '#374151',
          }}
          pattern="^#[0-9A-Fa-f]{6}$"
        />
      </div>
    </div>
  );
}
