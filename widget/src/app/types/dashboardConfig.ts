/**
 * DashboardConfig — Complete configuration interface for Dashboard ↔ Chat Widget integration
 *
 * This file defines EVERY configurable property that the dashboard can control.
 * The dashboard sends this config via:
 *   1. postMessage API (real-time preview)
 *   2. REST API / Backend (persistent settings)
 *   3. window.ChatWidgetConfig (embed script initialization)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * COLOR ARCHITECTURE — Static vs Dynamic Colors
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ DYNAMIC COLORS (Dashboard-controlled)                                      │
 * ├────────────────────┬──────────────────���─────────────────────────────────────┤
 * │ mainColor          │ Header bg, AI message bubbles, active send button,    │
 * │                    │ ticket button accent                                  │
 * │ widgetOuterColor   │ Floating bubble outer ring / background               │
 * │ widgetInnerColor   │ Floating bubble center icon / fill                    │
 * └────────────────────┴────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ STATIC COLORS — LIGHT MODE (never change)                                  │
 * ├────────────────────┬────────────────────────────────────────────────────────┤
 * │ #FFFFFF            │ Messages area bg, chat window bg, input bg            │
 * │ #f9fafb            │ Page/embed background                                │
 * │ #f3f4f6            │ User message bubble bg                               │
 * │ #1f2937            │ Primary text, user bubble text                        │
 * │ #6b7280            │ Secondary text                                        │
 * │ #9ca3af            │ Input placeholder                                     │
 * │ #e5e7eb            │ Borders, dividers                                     │
 * │ #000000            │ All dark action buttons (close, back, download, etc)  │
 * │ #FFFFFF            │ Header text (always white on mainColor bg)            │
 * └────────────────────┴────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ STATIC COLORS — DARK MODE (never change)                                   │
 * ├────────────────────┬──────────────────────────────────────��─────────────────┤
 * │ #0f172a            │ Page bg, input area bg (Slate 900)                    │
 * │ #1e293b            │ Chat window bg, messages area bg (Slate 800)          │
 * │ #334155            │ User bubble bg, borders, dividers (Slate 700)         │
 * │ #f1f5f9            │ Primary text, user bubble text (Slate 100)            │
 * │ #94a3b8            │ Secondary text (Slate 400)                            │
 * │ #64748b            │ Input placeholder (Slate 500)                         │
 * │ #FFFFFF            │ Header text (always white on mainColor bg)            │
 * └────────────────────┴────────────────────────────────────────────────────────┘
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Main Dashboard Config
// ═══════════════════════════════════════════════════════════════════════════════

export interface DashboardConfig {
  // ── Store Identity ──────────────────────────────────────────────────────────
  store: StoreIdentity;

  // ── Appearance ──────────────────────────────────────────────────────────────
  appearance: AppearanceConfig;

  // ── Bubble / Widget ─────────────────────────────────────────────────────────
  bubble: BubbleConfig;

  // ── Chat Behavior ───────────────────────────────────────────────────────────
  chat: ChatBehaviorConfig;

  // ── Features Toggle ─────────────────────────────────────────────────────────
  features: FeaturesConfig;
}

// ══════════════════════════════════════════════════════════════════���════════════
// Sub-Configs
// ═══════════════════════════════════════════════════════════════════════════════

/** Store identity — fetched from backend or set in dashboard */
export interface StoreIdentity {
  /** Unique store ID from backend */
  storeId: string;
  /** Display name shown in chat header */
  storeName: string;
  /**
   * Store Logo — wide banner shown in the chat welcome/pre-conversation area.
   * Upload rules:
   * - Recommended: 1024×256px (4:1 ratio)
   * - Max file size: 2MB
   * - Formats: jpeg, jpg, png
   */
  storeLogo: string;
  /**
   * Store Icon — small avatar shown in the chat header and next to agent messages.
   * Upload rules:
   * - Size: 32×32px
   * - Max file size: 2MB
   * - Formats: jpeg, jpg, png
   */
  storeIcon: string;
  /** Backend API endpoint for the widget */
  apiEndpoint: string;
}

/** Appearance — all visual customization */
export interface AppearanceConfig {
  /** Light or Dark mode */
  mode: 'light' | 'dark';

  /**
   * Main/Primary color — controls:
   * - Chat header background
   * - AI/Store message bubble background
   * - Active send button background
   * - Ticket form accent elements
   * - Rating screen accent
   */
  mainColor: string;

  /**
   * Optional preset theme ID.
   * If set, mainColor/widgetColors are derived from the preset.
   * Presets: 'white' | 'black' | 'gold' | 'sky' | 'navy' | 'red' | 'whatsapp'
   */
  presetThemeId?: string;
}

/** Bubble — floating chat bubble configuration */
export interface BubbleConfig {
  /** Screen position */
  position: 'bottom-right' | 'bottom-left';

  /**
   * Outer color — the bubble's outer ring/background.
   * This is the main visible color of the floating circle.
   */
  outerColor: string;

  /**
   * Inner color — the icon/center area inside the bubble.
   * Usually white (#FFFFFF) or contrasting to outerColor.
   */
  innerColor: string;

  /** Horizontal offset from edge in pixels (default: 20) */
  offsetX?: number;

  /** Vertical offset from bottom in pixels (default: 20) */
  offsetY?: number;

  /** Bubble size in pixels (default: 60) */
  size?: number;
}

/** Chat behavior — functional settings */
export interface ChatBehaviorConfig {
  /** Welcome message shown when chat opens (first AI message) */
  welcomeMessage?: string;

  /** Placeholder text in the input field */
  inputPlaceholder?: string;

  /** Auto-open chat after X seconds (0 = disabled) */
  autoOpenDelay?: number;

  /** Show/hide the "Powered by Fuqah AI" footer */
  showBranding?: boolean;
}

/** Feature toggles — enable/disable specific features */
export interface FeaturesConfig {
  /** Allow users to create support tickets */
  ticketsEnabled: boolean;

  /** Allow users to rate conversations */
  ratingsEnabled: boolean;

  /** Allow downloading/exporting conversations */
  exportEnabled: boolean;

  /** Allow copying messages */
  copyEnabled: boolean;

  /** Show thumbs up/down feedback on AI messages */
  messageFeedbackEnabled: boolean;

  /** Allow media/file attachments */
  mediaEnabled: boolean;

  /** Phone validation for tickets — list of allowed country codes */
  allowedCountries?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Dashboard ↔ Widget Communication
// ═══════════════════════════════════════════════════════════════════════════════

/** Message types sent from Dashboard to Widget via postMessage */
export type DashboardToWidgetMessage =
  | { type: 'FUQAH_CONFIG_UPDATE'; payload: Partial<DashboardConfig> }
  | { type: 'FUQAH_THEME_UPDATE'; payload: Partial<AppearanceConfig> & Partial<BubbleConfig> }
  | { type: 'FUQAH_STORE_UPDATE'; payload: Partial<StoreIdentity> }
  | { type: 'FUQAH_FEATURES_UPDATE'; payload: Partial<FeaturesConfig> }
  | { type: 'FUQAH_RESET_PREVIEW' };

/** Message types sent from Widget to Dashboard via postMessage */
export type WidgetToDashboardMessage =
  | { type: 'FUQAH_WIDGET_READY' }
  | { type: 'FUQAH_CONFIG_RECEIVED'; payload: DashboardConfig }
  | { type: 'FUQAH_WIDGET_STATE'; payload: { isOpen: boolean; hasMessages: boolean } };

// ═══════════════════════════════════════════════════════════════════════════════
// Default Configs
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  store: {
    storeId: '',
    storeName: 'متجر الهدايا الحديث',
    storeLogo: '',
    storeIcon: '',
    apiEndpoint: '',
  },
  appearance: {
    mode: 'light',
    mainColor: '#0ea5e9',
    presetThemeId: undefined,
  },
  bubble: {
    position: 'bottom-right',
    outerColor: '#0ea5e9',
    innerColor: '#FFFFFF',
    offsetX: 20,
    offsetY: 20,
    size: 60,
  },
  chat: {
    welcomeMessage: 'أهلاً بك! كيف يمكنني مساعدتك اليوم؟',
    inputPlaceholder: 'اكتب رسالتك هنا...',
    autoOpenDelay: 0,
    showBranding: true,
  },
  features: {
    ticketsEnabled: true,
    ratingsEnabled: true,
    exportEnabled: true,
    copyEnabled: true,
    messageFeedbackEnabled: true,
    mediaEnabled: false,
    allowedCountries: undefined,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Static Color References (for dashboard to display as read-only info)
// ═══════════════════════════════════════════════════════════════════════════════

export const STATIC_COLORS = {
  light: {
    pageBackground: '#f9fafb',
    chatWindowBackground: '#FFFFFF',
    messagesAreaBackground: '#FFFFFF',
    userBubbleBackground: '#f3f4f6',
    userBubbleText: '#1f2937',
    primaryText: '#1f2937',
    secondaryText: '#6b7280',
    inputBackground: '#FFFFFF',
    inputPlaceholderText: '#9ca3af',
    borders: '#e5e7eb',
    darkButtons: '#000000',
    headerText: '#FFFFFF',
    successGreen: '#22c55e',
  },
  dark: {
    pageBackground: '#0f172a',
    chatWindowBackground: '#1e293b',
    messagesAreaBackground: '#1e293b',
    userBubbleBackground: '#334155',
    userBubbleText: '#f1f5f9',
    primaryText: '#f1f5f9',
    secondaryText: '#94a3b8',
    inputBackground: '#0f172a',
    inputPlaceholderText: '#64748b',
    borders: '#334155',
    darkButtons: '#FFFFFF',
    headerText: '#FFFFFF',
    successGreen: '#4ade80',
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Preset Themes (same 7 themes, structured for dashboard)
// ═════════════════════════════════════════════════════════════════════���═════════

export const DASHBOARD_PRESET_THEMES = [
  { id: 'white',    nameAr: 'أسود أنيق',     nameEn: 'Elegant Black',   mainColor: '#000000', outerColor: '#000000', innerColor: '#FFFFFF' },
  { id: 'black',    nameAr: 'أبيض كلاسيكي',  nameEn: 'Classic White',   mainColor: '#000000', outerColor: '#1f2937', innerColor: '#000000' },
  { id: 'gold',     nameAr: 'ذهبي فاخر',     nameEn: 'Luxury Gold',     mainColor: '#FFD700', outerColor: '#FFD700', innerColor: '#FFFFFF' },
  { id: 'sky',      nameAr: 'أزرق سماوي',    nameEn: 'Sky Blue',        mainColor: '#00BFFF', outerColor: '#00BFFF', innerColor: '#FFFFFF' },
  { id: 'navy',     nameAr: 'أزرق داكن',     nameEn: 'Dark Navy',       mainColor: '#0A1F44', outerColor: '#0A1F44', innerColor: '#FFFFFF' },
  { id: 'red',      nameAr: 'أحمر قوي',      nameEn: 'Bold Red',        mainColor: '#FF0000', outerColor: '#FF0000', innerColor: '#FFFFFF' },
  { id: 'whatsapp', nameAr: 'واتساب',        nameEn: 'WhatsApp Green',  mainColor: '#25D366', outerColor: '#25D366', innerColor: '#FFFFFF' },
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// API Routes Reference (for dashboard backend integration)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Backend API routes that the dashboard should implement:
 *
 * GET    /api/stores/:storeId/config          → Returns DashboardConfig
 * PUT    /api/stores/:storeId/config          → Updates DashboardConfig
 * GET    /api/stores/:storeId/conversations   → List conversations
 * GET    /api/stores/:storeId/tickets         → List tickets
 * GET    /api/stores/:storeId/ratings         → List ratings
 * POST   /api/stores/:storeId/conversations   → Create conversation
 * POST   /api/stores/:storeId/tickets         → Create ticket
 * POST   /api/conversations/:id/rating        → Submit rating
 * PATCH  /api/conversations/:id               → Close conversation
 *
 * Widget embed script route:
 * GET    /api/stores/:storeId/widget.js       → Returns widget embed script
 */