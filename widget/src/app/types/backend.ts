/**
 * Backend Integration Types — Fuqah AI Chat Widget
 *
 * These interfaces define the data structures exchanged between the widget
 * and the backend. All IDs (conversationId, ticketId) are generated and
 * managed by the backend. The frontend uses temporary client-side IDs until
 * the backend confirms with real ones.
 *
 * Integration flow:
 *   1. Widget opens → POST /conversations → receives { conversationId }
 *   2. User sends message → POST /conversations/:id/messages
 *   3. Ticket created → POST /tickets → receives { ticketId }
 *   4. Rating submitted → POST /conversations/:id/rating
 *   5. Chat closed → PATCH /conversations/:id { status: 'closed' }
 */

// ─── Store Configuration (loaded from backend at widget init) ────────────────

export interface StoreConfig {
  /** Unique store identifier */
  storeId: string;
  /** Store display name */
  storeName: string;
  /** Store logo URL — wide banner (recommended 1024×256, max 2MB, jpeg/jpg/png) */
  storeLogo: string;
  /** Store icon URL — 32×32px avatar (max 2MB, jpeg/jpg/png) */
  storeIcon: string;
  /** Active theme ID: 'white' | 'black' | 'gold' | 'sky' | 'navy' | 'red' | 'whatsapp' */
  themeId: string;
  /** Widget position on page */
  position: 'bottom-right' | 'bottom-left';
  /** Backend API base URL */
  apiEndpoint: string;
}

// ─── Conversation ────────────────────────────────────────────────────────────

export interface ConversationPayload {
  /** Backend-generated unique conversation ID */
  conversationId: string;
  /** Store this conversation belongs to */
  storeId: string;
  /** Conversation status */
  status: 'active' | 'closed' | 'converted_to_ticket';
  /** ISO timestamp — when conversation started */
  createdAt: string;
  /** ISO timestamp — last activity */
  updatedAt: string;
}

// ─── Message ─────────────────────────────────────────────────────────────────

export interface MessagePayload {
  /** Backend-generated unique message ID */
  messageId: string;
  /** Parent conversation ID */
  conversationId: string;
  /** Message content */
  text: string;
  /** Who sent this message */
  sender: 'store' | 'customer';
  /** Optional attachment metadata */
  attachment?: {
    type: 'image' | 'file';
    url: string;
    name: string;
    size?: number;
  };
  /** ISO timestamp */
  timestamp: string;
}

// ─── Ticket ──────────────────────────────────────────────────────────────────

export interface TicketPayload {
  /** Backend-generated unique ticket ID (e.g., #TKT-10001) */
  ticketId: string;
  /** Linked conversation ID */
  conversationId: string;
  /** Store this ticket belongs to */
  storeId: string;
  /** Customer phone with country dial code */
  phone: string;
  dialCode: string;
  countryCode: string;
  /** Ticket status */
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  /** ISO timestamp */
  createdAt: string;
}

// ─── Rating ──────────────────────────────────────────────────────────────────

export interface RatingPayload {
  /** Linked conversation ID */
  conversationId: string;
  /** Rating value 1–5 */
  rating: number;
  /** Optional text feedback */
  feedback?: string;
  /** ISO timestamp */
  createdAt: string;
}

// ─── Widget Initialization Config ────────────────────────────────────────────
// Injected via: window.ChatWidgetConfig = { ... }

export interface ChatWidgetConfig {
  storeId: string;
  storeName: string;
  storeLogo: string;
  storeIcon: string;
  themeId: string;
  position?: 'bottom-right' | 'bottom-left';
  apiEndpoint: string;
}

// ─── API Response Wrapper ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Backend API Client Interface ────────────────────────────────────────────
// Implement this interface to connect the widget to your backend.

export interface ChatApiClient {
  /** Start a new conversation — returns backend-generated conversationId */
  createConversation(storeId: string): Promise<ApiResponse<ConversationPayload>>;

  /** Send a message within an existing conversation */
  sendMessage(
    conversationId: string,
    text: string,
    sender: 'store' | 'customer',
    attachment?: MessagePayload['attachment'],
  ): Promise<ApiResponse<MessagePayload>>;

  /** Create a support ticket linked to a conversation */
  createTicket(
    conversationId: string,
    storeId: string,
    phone: string,
    dialCode: string,
    countryCode: string,
  ): Promise<ApiResponse<TicketPayload>>;

  /** Submit a post-chat rating */
  submitRating(
    conversationId: string,
    rating: number,
    feedback?: string,
  ): Promise<ApiResponse<RatingPayload>>;

  /** Close/end a conversation */
  closeConversation(conversationId: string): Promise<ApiResponse<void>>;
}