/**
 * Theme Settings — Dashboard-controlled appearance settings
 *
 * Supports Light/Dark mode and custom color controls for:
 * - Main color (header, AI bubbles, send button)
 * - Widget outer color (bubble outer edge)
 * - Widget inner color (bubble center/icon area)
 */

export type ThemeMode = 'light' | 'dark';

export interface ThemeSettings {
  /** Light or Dark mode */
  mode: ThemeMode;

  /** Main color — controls header, AI message bubbles, send button */
  mainColor: string;

  /** Widget outer color — outer edge/border of the floating bubble */
  widgetOuterColor: string;

  /** Widget inner color — center/icon area of the floating bubble */
  widgetInnerColor: string;

  /** Welcome teaser bubble above the floating icon (enable/disable) */
  welcomeBubbleEnabled?: boolean;
  /** Line 1 of welcome bubble (short greeting, e.g. "مرحباً 👋") */
  welcomeBubbleLine1?: string;
  /** Line 2 of welcome bubble (call-to-action, e.g. "كيف يمكنني مساعدتك؟") */
  welcomeBubbleLine2?: string;

  /** Master switch for the inactivity (idle) prompt */
  inactivityEnabled?: boolean;
  /** Seconds of idle time before showing Continue/End prompt (default 90) */
  inactivityPromptSeconds?: number;
  /** Seconds after prompt before auto-closing to rating (default 60) */
  inactivityCloseSeconds?: number;
  /** Seconds of idle time on rating screen before auto-skip + close (default 900 = 15 min) */
  ratingInactivitySeconds?: number;
}

/** Default Light Mode settings (fallback: elegant black) */
export const DEFAULT_LIGHT_SETTINGS: ThemeSettings = {
  mode: 'light',
  mainColor: '#000000',
  widgetOuterColor: '#000000',
  widgetInnerColor: '#FFFFFF',
  welcomeBubbleEnabled: true,
  welcomeBubbleLine1: 'مرحباً 👋',
  welcomeBubbleLine2: 'كيف يمكنني مساعدتك؟',
  inactivityEnabled: true,
  inactivityPromptSeconds: 90,
  inactivityCloseSeconds: 60,
  ratingInactivitySeconds: 900,
};

/** Default Dark Mode settings */
export const DEFAULT_DARK_SETTINGS: ThemeSettings = {
  mode: 'dark',
  mainColor: '#3b82f6', // Blue
  widgetOuterColor: '#1f2937',
  widgetInnerColor: '#3b82f6',
  welcomeBubbleEnabled: true,
  welcomeBubbleLine1: 'مرحباً 👋',
  welcomeBubbleLine2: 'كيف يمكنني مساعدتك؟',
  inactivityEnabled: true,
  inactivityPromptSeconds: 90,
  inactivityCloseSeconds: 60,
  ratingInactivitySeconds: 900,
};

/** Dark mode color palette */
export const DARK_MODE_COLORS = {
  // Page background
  pageBackground: '#0f172a', // Slate 900

  // Chat window
  chatBackground: '#1e293b', // Slate 800
  chatBorder: '#334155', // Slate 700

  // Messages area
  messagesBackground: '#1e293b', // Slate 800

  // User message bubble
  userBubbleBackground: '#334155', // Slate 700
  userBubbleText: '#f1f5f9', // Slate 100

  // Input area
  inputBackground: '#0f172a', // Slate 900
  inputBorder: '#334155', // Slate 700
  inputText: '#f1f5f9', // Slate 100
  inputPlaceholder: '#64748b', // Slate 500

  // Text colors
  primaryText: '#f1f5f9', // Slate 100
  secondaryText: '#94a3b8', // Slate 400

  // Header
  headerText: '#FFFFFF',

  // Dividers
  divider: '#334155', // Slate 700
};

/** Light mode color palette */
export const LIGHT_MODE_COLORS = {
  // Page background
  pageBackground: '#f9fafb', // Gray 50

  // Chat window
  chatBackground: '#FFFFFF',
  chatBorder: '#e5e7eb', // Gray 200

  // Messages area
  messagesBackground: '#FFFFFF',

  // User message bubble
  userBubbleBackground: '#f3f4f6', // Gray 100
  userBubbleText: '#1f2937', // Gray 800

  // Input area
  inputBackground: '#FFFFFF',
  inputBorder: '#e5e7eb', // Gray 200
  inputText: '#1f2937', // Gray 800
  inputPlaceholder: '#9ca3af', // Gray 400

  // Text colors
  primaryText: '#1f2937', // Gray 800
  secondaryText: '#6b7280', // Gray 500

  // Header
  headerText: '#FFFFFF',

  // Dividers
  divider: '#e5e7eb', // Gray 200
};

/** Preset themes — 7 ready-made themes for dashboard selection */
export interface PresetTheme {
  id: string;
  name: string;
  mainColor: string;
  widgetOuterColor: string;
  widgetInnerColor: string;
}

export const PRESET_THEMES: PresetTheme[] = [
  { id: 'white', name: 'أسود أنيق', mainColor: '#000000', widgetOuterColor: '#000000', widgetInnerColor: '#FFFFFF' },
  { id: 'black', name: 'أبيض كلاسيكي', mainColor: '#000000', widgetOuterColor: '#1f2937', widgetInnerColor: '#000000' },
  { id: 'gold', name: 'ذهبي فاخر', mainColor: '#FFD700', widgetOuterColor: '#FFD700', widgetInnerColor: '#FFFFFF' },
  { id: 'sky', name: 'أزرق سماوي', mainColor: '#00BFFF', widgetOuterColor: '#00BFFF', widgetInnerColor: '#FFFFFF' },
  { id: 'navy', name: 'أزرق داكن', mainColor: '#0A1F44', widgetOuterColor: '#0A1F44', widgetInnerColor: '#FFFFFF' },
  { id: 'red', name: 'أحمر قوي', mainColor: '#FF0000', widgetOuterColor: '#FF0000', widgetInnerColor: '#FFFFFF' },
  { id: 'whatsapp', name: 'واتساب', mainColor: '#25D366', widgetOuterColor: '#25D366', widgetInnerColor: '#FFFFFF' },
];