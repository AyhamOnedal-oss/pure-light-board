بداية البرومبت
# Fuqah AI — Chat Widget Dashboard / Control Panel

## Overview
Build a comprehensive Arabic RTL dashboard to control and preview a chat widget (Fuqah AI).
The dashboard communicates with an embedded chat widget preview via `postMessage` API
and persists settings to the backend via REST API.

## Architecture

### Communication with Chat Widget
The chat widget listens for postMessage events. The dashboard embeds the widget in an iframe
for live preview and sends configuration updates:

```typescript
// Send config update to widget iframe
const iframe = document.getElementById('widget-preview') as HTMLIFrameElement;
iframe.contentWindow?.postMessage({
  type: 'FUQAH_CONFIG_UPDATE',
  payload: { /* Partial<DashboardConfig> */ }
}, '*');

// Granular updates:
// type: 'FUQAH_THEME_UPDATE'   → { mode, mainColor, outerColor, innerColor }
// type: 'FUQAH_STORE_UPDATE'   → { storeName, storeLogo }
// type: 'FUQAH_FEATURES_UPDATE' → { ticketsEnabled, ratingsEnabled, ... }
// type: 'FUQAH_RESET_PREVIEW'  → reset to saved config

// Listen for widget ready signal:
window.addEventListener('message', (e) => {
  if (e.data.type === 'FUQAH_WIDGET_READY') {
    // Send initial config to widget
  }
});
Backend API Routes
GET    /api/stores/:storeId/config          → Returns full DashboardConfig
PUT    /api/stores/:storeId/config          → Saves DashboardConfig
GET    /api/stores/:storeId/conversations   → List conversations with pagination
GET    /api/stores/:storeId/tickets         → List tickets with filters
GET    /api/stores/:storeId/ratings         → Ratings analytics
GET    /api/stores/:storeId/widget.js       → Widget embed script
Dashboard Pages & Sections
1. Appearance / المظهر (Main Settings Page)
Controls that map to the widget configuration:

A. Theme Mode Toggle (Light / Dark)
Two buttons: ☀️ فاتح / 🌙 داكن
Switching mode changes the widget's entire color scheme
Config key: appearance.mode → 'light' | 'dark'
B. Primary/Main Color (اللون الأساسي)
Color picker + hex input field
Controls: Header background, AI message bubbles, active send button, accent elements
Config key: appearance.mainColor
Show a visual guide of what this color affects
C. Preset Themes (الثيمات الجاهزة)
7 preset themes displayed as clickable cards with bubble previews:

ID	Arabic Name	mainColor	outerColor	innerColor
white	أسود أنيق	#000000	#000000	#FFFFFF
black	أبيض كلاسيكي	#000000	#1f2937	#000000
gold	ذهبي فاخر	#FFD700	#FFD700	#FFFFFF
sky	أزرق سماوي	#00BFFF	#00BFFF	#FFFFFF
navy	أزرق داكن	#0A1F44	#0A1F44	#FFFFFF
red	أحمر قوي	#FF0000	#FF0000	#FFFFFF
whatsapp	واتساب	#25D366	#25D366	#FFFFFF
Selecting a preset auto-fills mainColor, outerColor, innerColor. User can also create custom colors (not limited to presets).

D. Bubble Colors (ألوان الفقاعة العائمة)
Outer Color (لون الأيقونة الخارجي): Color picker + hex input Config: bubble.outerColor
Inner Color (لون الأيقونة الداخلي): Color picker + hex input Config: bubble.innerColor
E. Static Colors Reference Panel
Display a read-only info section showing static colors that DON'T change:

Light Mode static colors:

Messages area / Chat bg: #FFFFFF
User bubble bg: #f3f4f6
Primary text: #1f2937
Secondary text: #6b7280
Borders: #e5e7eb
Action buttons: #000000 (always black)
Header text: #FFFFFF (always white on mainColor)
Input placeholder: #9ca3af
Dark Mode static colors:

Chat bg / Messages area: #1e293b
User bubble bg: #334155
Primary text: #f1f5f9
Secondary text: #94a3b8
Borders: #334155
Action buttons: #FFFFFF (always white)
Header text: #FFFFFF
Input placeholder: #64748b
Page background: #0f172a
2. Widget Position & Style (موقع الفقاعة)
Position: bottom-right / bottom-left toggle Config: bubble.position
Offset X (horizontal margin): number input, default 20px Config: bubble.offsetX
Offset Y (vertical margin): number input, default 20px Config: bubble.offsetY
Bubble size: number input, default 60px Config: bubble.size
3. Store Settings (إعدادات المتجر)
Store Name (اسم المتجر): text input → store.storeName Shown in chat header
Store Logo (شعار المتجر): image upload or URL → store.storeLogo Shown in header (34px) and next to AI messages (34px circle on left)
API Endpoint: URL input → store.apiEndpoint
4. Chat Settings (إعدادات المحادثة)
Welcome Message (رسالة الترحيب): textarea → chat.welcomeMessage
Input Placeholder (نص الحقل): text input → chat.inputPlaceholder
Auto-open delay (فتح تلقائي): number in seconds, 0=disabled → chat.autoOpenDelay
Show branding footer (إظهار العلامة التجارية): toggle → chat.showBranding Footer: "مدعوم من فقاعة AI" with link to www.fuqah.ai
5. Features Toggle (الميزات)
Toggle switches for each feature:

✅ Tickets (التذاكر): features.ticketsEnabled
✅ Ratings (التقييمات): features.ratingsEnabled
✅ Export/Download (التصدير): features.exportEnabled
✅ Copy Messages (نسخ الرسائل): features.copyEnabled
✅ Message Feedback (تقييم الرسائل): features.messageFeedbackEnabled ThumbsUp/ThumbsDown icons under AI messages
✅ Media Attachments (المرفقات): features.mediaEnabled
Allowed Countries (الدول المسموحة): multi-select for phone validation
6. Live Preview (المعاينة المباشرة)
Embed the chat widget in an iframe
iframe src: widget URL with ?preview=true&storeId=xxx
Every change in the dashboard sends postMessage to iframe instantly
Show 3 device previews: Desktop / Tablet / Mobile
"Save" button persists to backend; "Reset" reverts to last saved
7. Conversations & Tickets Management
List all conversations with: Conversation ID, date, status, message count
List all tickets with: Ticket ID (#TKT-xxxxx), phone, status, date
View conversation details with full message history
Export conversation as text file
Filter by date, status
8. Embed Code Generator
Generate the embed script for the store owner:

<!-- Fuqah AI Chat Widget -->
<script>
  window.ChatWidgetConfig = {
    storeId: "store_xxx",
    storeName: "متجر الهدايا",
    storeLogo: "https://...",
    themeId: "sky",
    position: "bottom-right",
    apiEndpoint: "https://api.fuqah.ai"
  };
</script>
<script src="https://cdn.fuqah.ai/widget.js" async></script>
Complete TypeScript Interface
interface DashboardConfig {
  store: {
    storeId: string;
    storeName: string;
    storeLogo: string;
    apiEndpoint: string;
  };
  appearance: {
    mode: 'light' | 'dark';
    mainColor: string;        // hex
    presetThemeId?: string;   // optional preset
  };
  bubble: {
    position: 'bottom-right' | 'bottom-left';
    outerColor: string;       // hex
    innerColor: string;       // hex
    offsetX?: number;         // px, default 20
    offsetY?: number;         // px, default 20
    size?: number;            // px, default 60
  };
  chat: {
    welcomeMessage?: string;
    inputPlaceholder?: string;
    autoOpenDelay?: number;   // seconds, 0=disabled
    showBranding?: boolean;
  };
  features: {
    ticketsEnabled: boolean;
    ratingsEnabled: boolean;
    exportEnabled: boolean;
    copyEnabled: boolean;
    messageFeedbackEnabled: boolean;
    mediaEnabled: boolean;
    allowedCountries?: string[];
  };
}
Key Rules
Full Arabic RTL support (dir="rtl")
Dashboard itself supports Light/Dark mode toggle (separate from widget mode)
All color pickers must accept both visual picker AND hex code text input
Live preview updates must be instant via postMessage (no page reload)
"Save" button sends PUT /api/stores/:storeId/config
The widget's messages area is ALWAYS white in light mode (#FFFFFF) and #1e293b in dark mode — this is NOT configurable
All action buttons in the widget are ALWAYS #000000 (light) or #FFFFFF (dark) — NOT configurable
Header text is ALWAYS #FFFFFF regardless of mainColor — NOT configurable
Only 3 colors are truly dynamic/configurable: mainColor, bubble outerColor, bubble innerColor
The branded footer "مدعوم من فقاعة AI" links to www.fuqah.ai

---

تم إنشاء ملفين جديدين لتسهيل الربط مع لوحة التحكم:

- **`/src/app/types/dashboardConfig.ts`** — يحتوي على الواجهة الكاملة `DashboardConfig` مع توثيق شامل لكل الألوان الثابتة والمتغيرة في الوضعين Light/Dark، أنواع رسائل postMessage، الثيمات الـ 7، والقيم الافتراضية.
- **`/src/app/hooks/useDashboardBridge.ts`** — Hook جاهز للاستماع لرسائل postMessage من لوحة التحكم وتطبيق التحديثات فوراً على الويدجت.

**اقتراحات للخطوات التالية:**
- أرسل البرومبت أعلاه للـ AI الذي سيبني لوحة التحكم، وأرفق معه ملف `dashboardConfig.ts` كمرجع
- عند بناء الداشبورد، ضمّن الويدجت في iframe واستخدم `useDashboardBridge` للمعاينة الحية
- اربط زر "حفظ" في الداشبورد بـ `PUT /api/stores/:storeId/config` لحفظ الإعدادات بشكل دائم