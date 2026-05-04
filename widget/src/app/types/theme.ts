/**
 * Theme configuration for Chat Widget
 * 
 * IMPORTANT: These 7 themes are controlled from the backend/dashboard ONLY.
 * Users cannot change the theme from inside the chat UI.
 * 
 * To change the active theme, set ACTIVE_THEME_ID in the backend config
 * and pass it via the widget initialization script.
 * 
 * API integration point:
 *   window.ChatWidgetConfig = { themeId: 'gold', ... }
 */

export interface Theme {
  id: string;
  name: string;
  /** Primary background used in header, send button, store message bubbles */
  background: string;
  /** Text color for elements on top of the primary background */
  text: string;
}

export const THEMES: Theme[] = [
  {
    id: 'white',
    name: 'أسود أنيق',
    background: '#FFFFFF',
    text: '#222222',
  },
  {
    id: 'black',
    name: 'أبيض كلاسيكي',
    background: '#000000',
    text: '#CCCCCC',
  },
  {
    id: 'gold',
    name: 'ذهبي فاخر',
    background: '#FFD700',
    text: '#FFFFFF',
  },
  {
    id: 'sky',
    name: 'أزرق سماوي',
    background: '#00BFFF',
    text: '#FFFFFF',
  },
  {
    id: 'navy',
    name: 'أزرق داكن',
    background: '#0A1F44',
    text: '#FFFFFF',
  },
  {
    id: 'red',
    name: 'أحمر قوي',
    background: '#FF0000',
    text: '#FFFFFF',
  },
  {
    id: 'whatsapp',
    name: 'واتساب',
    background: '#25D366',
    text: '#FFFFFF',
  },
];

/**
 * Helper – find a theme by id, fallback to first theme if not found.
 * Use this when setting the theme from backend config.
 */
export function getThemeById(id: string): Theme {
  return THEMES.find(t => t.id === id) ?? THEMES[0];
}

/**
 * The active theme index.
 * CONTROLLED FROM BACKEND ONLY — do not expose a UI selector to users.
 * Change this value via dashboard/API integration.
 */
export const ACTIVE_THEME_ID = 'white';