/**
 * Database Types - Fuqah AI Dashboard
 * Auto-generated from Supabase schema
 */

export interface Store {
  id: string;
  store_name: string;
  store_logo: string | null;
  api_endpoint: string | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  store_id: string;
  customer_phone: string | null;
  customer_name: string | null;
  classification: 'complaint' | 'inquiry' | 'request' | 'suggestion' | 'unknown';
  status: 'active' | 'completed' | 'archived';
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: 'customer' | 'ai' | 'agent';
  content: string;
  media_url: string | null;
  feedback: 'positive' | 'negative' | null;
  feedback_note: string | null;
  created_at: string;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  store_id: string;
  conversation_id: string | null;
  customer_phone: string;
  customer_name: string | null;
  title_en: string | null;
  title_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Rating {
  id: string;
  store_id: string;
  conversation_id: string;
  rating: number; // 1-5
  comment: string | null;
  created_at: string;
}

export interface Insight {
  id: string;
  store_id: string;
  category: 'complaints' | 'requests' | 'inquiries' | 'suggestions' | 'unknown';
  label_en: string;
  label_ar: string;
  count: number;
  resolved: boolean;
  created_at: string;
  updated_at: string;
}

export interface Analytics {
  id: string;
  store_id: string;
  date: string;

  // KPIs
  total_conversations: number;
  completion_rate: number; // Percentage
  total_tickets: number;
  open_tickets: number;
  closed_tickets: number;
  words_consumed: number;
  bubble_clicks: number;
  avg_response_time_seconds: number;

  // Classification counts
  complaints_count: number;
  inquiries_count: number;
  requests_count: number;
  suggestions_count: number;
  unknown_count: number;

  // Feedback counts
  positive_feedback: number;
  negative_feedback: number;

  // Rating metrics
  total_ratings: number;
  avg_rating: number;

  created_at: string;
  updated_at: string;
}

export interface BubbleClick {
  id: string;
  store_id: string;
  session_id: string | null;
  clicked_at: string;
}

// ============================================
// Dashboard-specific types
// ============================================

export interface DashboardKPI {
  label: string;
  value: string | number;
  change: string;
  up: boolean;
  color: string;
}

export interface ConversationClassificationData {
  name: string;
  value: number;
  color: string;
}

export interface TicketStatusData {
  name: string;
  value: number;
  fill: string;
}

export interface FeedbackData {
  name: string;
  value: number;
  color: string;
}

export interface InsightCategory {
  key: string;
  label: string;
  count: number;
  color: string;
}

// ============================================
// API Response types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

export interface TicketWithConversation extends Ticket {
  conversation?: Conversation;
}
