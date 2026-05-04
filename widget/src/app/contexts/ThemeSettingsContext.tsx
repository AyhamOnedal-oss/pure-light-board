/**
 * ThemeSettingsContext — Provides theme settings throughout the app
 *
 * Manages Light/Dark mode and custom colors for:
 * - Main color (header, AI bubbles, send button)
 * - Widget colors (outer and inner)
 */

import { createContext, useContext, useState, ReactNode, useRef } from 'react';
import type { ThemeSettings, ThemeMode } from '../types/themeSettings';
import { DEFAULT_LIGHT_SETTINGS, DEFAULT_DARK_SETTINGS } from '../types/themeSettings';

interface ThemeSettingsContextValue {
  settings: ThemeSettings;
  updateSettings: (newSettings: Partial<ThemeSettings>) => void;
  setMode: (mode: ThemeMode) => void;
  resetToDefaults: () => void;
  fetchedPosition: 'bottom-right' | 'bottom-left';
}

const ThemeSettingsContext = createContext<ThemeSettingsContextValue | undefined>(undefined);

interface ThemeSettingsProviderProps {
  children: ReactNode;
  initialSettings?: ThemeSettings;
  initialPosition?: 'bottom-right' | 'bottom-left';
}

export function ThemeSettingsProvider({ children, initialSettings, initialPosition = 'bottom-right' }: ThemeSettingsProviderProps) {
  const [settings, setSettings] = useState<ThemeSettings>(initialSettings ?? DEFAULT_LIGHT_SETTINGS);

  // Sync when initialSettings changes (e.g. after fetch completes)
  const initialRef = useRef(initialSettings);
  if (initialSettings && initialSettings !== initialRef.current) {
    initialRef.current = initialSettings;
    setSettings(initialSettings);
  }

  const updateSettings = (newSettings: Partial<ThemeSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const setMode = (mode: ThemeMode) => {
    // When switching modes, apply default colors for that mode
    const defaults = mode === 'dark' ? DEFAULT_DARK_SETTINGS : DEFAULT_LIGHT_SETTINGS;
    setSettings(prev => ({
      ...prev,
      mode,
      // Optionally keep custom colors or reset to defaults
      // For now, we'll reset to mode defaults
      ...defaults,
    }));
  };

  const resetToDefaults = () => {
    const defaults = settings.mode === 'dark' ? DEFAULT_DARK_SETTINGS : DEFAULT_LIGHT_SETTINGS;
    setSettings(defaults);
  };

  return (
    <ThemeSettingsContext.Provider value={{ settings, updateSettings, setMode, resetToDefaults, fetchedPosition: initialPosition }}>
      {children}
    </ThemeSettingsContext.Provider>
  );
}

export function useThemeSettings() {
  const context = useContext(ThemeSettingsContext);
  if (!context) {
    throw new Error('useThemeSettings must be used within ThemeSettingsProvider');
  }
  return context;
}