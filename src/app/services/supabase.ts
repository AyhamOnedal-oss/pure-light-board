/**
 * Supabase Client Service
 * Simple, merchant-friendly API for dashboard data
 */

import { projectId, publicAnonKey } from '../../utils/supabase/info';
import type {
  Store,
  Conversation,
  Message,
  Ticket,
  Rating,
  Insight,
  Analytics,
  BubbleClick,
  ApiResponse,
  PaginatedResponse,
  ConversationWithMessages,
  TicketWithConversation
} from '../types/database';

const SUPABASE_URL = `https://${projectId}.supabase.co`;

class SupabaseService {
  private baseUrl: string;
  private headers: HeadersInit;

  constructor() {
    this.baseUrl = `${SUPABASE_URL}/rest/v1`;
    this.headers = {
      'apikey': publicAnonKey,
      'Authorization': `Bearer ${publicAnonKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  // ============================================
  // STORES
  // ============================================

  async getStore(storeId: string): Promise<ApiResponse<Store>> {
    try {
      const response = await fetch(`${this.baseUrl}/stores?id=eq.${storeId}`, {
        headers: this.headers
      });
      const data = await response.json();
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async updateStore(storeId: string, updates: Partial<Store>): Promise<ApiResponse<Store>> {
    try {
      const response = await fetch(`${this.baseUrl}/stores?id=eq.${storeId}`, {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify(updates)
      });
      const data = await response.json();
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // ============================================
  // ANALYTICS (Dashboard KPIs)
  // ============================================

  async getTodayAnalytics(storeId: string): Promise<ApiResponse<Analytics>> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(
        `${this.baseUrl}/analytics?store_id=eq.${storeId}&date=eq.${today}`,
        { headers: this.headers }
      );
      const data = await response.json();
      return { success: true, data: data[0] || this.getEmptyAnalytics(storeId, today) };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async getAnalyticsRange(
    storeId: string,
    startDate: string,
    endDate: string
  ): Promise<ApiResponse<Analytics[]>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/analytics?store_id=eq.${storeId}&date=gte.${startDate}&date=lte.${endDate}&order=date.desc`,
        { headers: this.headers }
      );
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private getEmptyAnalytics(storeId: string, date: string): Analytics {
    return {
      id: '',
      store_id: storeId,
      date,
      total_conversations: 0,
      completion_rate: 0,
      total_tickets: 0,
      open_tickets: 0,
      closed_tickets: 0,
      words_consumed: 0,
      bubble_clicks: 0,
      avg_response_time_seconds: 0,
      complaints_count: 0,
      inquiries_count: 0,
      requests_count: 0,
      suggestions_count: 0,
      unknown_count: 0,
      positive_feedback: 0,
      negative_feedback: 0,
      total_ratings: 0,
      avg_rating: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  // ============================================
  // CONVERSATIONS
  // ============================================

  async getConversations(
    storeId: string,
    page: number = 1,
    limit: number = 50,
    classification?: string,
    status?: string
  ): Promise<PaginatedResponse<Conversation>> {
    try {
      let url = `${this.baseUrl}/conversations?store_id=eq.${storeId}`;

      if (classification) {
        url += `&classification=eq.${classification}`;
      }
      if (status) {
        url += `&status=eq.${status}`;
      }

      const offset = (page - 1) * limit;
      url += `&order=created_at.desc&limit=${limit}&offset=${offset}`;

      const response = await fetch(url, { headers: this.headers });
      const data = await response.json();

      return {
        data,
        total: data.length,
        page,
        limit,
        hasMore: data.length === limit
      };
    } catch (error) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        hasMore: false
      };
    }
  }

  async getConversationWithMessages(conversationId: string): Promise<ApiResponse<ConversationWithMessages>> {
    try {
      // Get conversation
      const convResponse = await fetch(
        `${this.baseUrl}/conversations?id=eq.${conversationId}`,
        { headers: this.headers }
      );
      const conversation = (await convResponse.json())[0];

      // Get messages
      const msgResponse = await fetch(
        `${this.baseUrl}/messages?conversation_id=eq.${conversationId}&order=created_at.asc`,
        { headers: this.headers }
      );
      const messages = await msgResponse.json();

      return {
        success: true,
        data: { ...conversation, messages }
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // ============================================
  // MESSAGES
  // ============================================

  async addMessage(message: Omit<Message, 'id' | 'created_at'>): Promise<ApiResponse<Message>> {
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(message)
      });
      const data = await response.json();
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async updateMessageFeedback(
    messageId: string,
    feedback: 'positive' | 'negative',
    note?: string
  ): Promise<ApiResponse<Message>> {
    try {
      const response = await fetch(`${this.baseUrl}/messages?id=eq.${messageId}`, {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify({ feedback, feedback_note: note })
      });
      const data = await response.json();
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // ============================================
  // TICKETS
  // ============================================

  async getTickets(
    storeId: string,
    page: number = 1,
    limit: number = 50,
    status?: string,
    priority?: string
  ): Promise<PaginatedResponse<Ticket>> {
    try {
      let url = `${this.baseUrl}/tickets?store_id=eq.${storeId}`;

      if (status) {
        url += `&status=eq.${status}`;
      }
      if (priority) {
        url += `&priority=eq.${priority}`;
      }

      const offset = (page - 1) * limit;
      url += `&order=created_at.desc&limit=${limit}&offset=${offset}`;

      const response = await fetch(url, { headers: this.headers });
      const data = await response.json();

      return {
        data,
        total: data.length,
        page,
        limit,
        hasMore: data.length === limit
      };
    } catch (error) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        hasMore: false
      };
    }
  }

  async createTicket(ticket: Omit<Ticket, 'id' | 'ticket_number' | 'created_at' | 'updated_at'>): Promise<ApiResponse<Ticket>> {
    try {
      const response = await fetch(`${this.baseUrl}/tickets`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(ticket)
      });
      const data = await response.json();
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async updateTicket(ticketId: string, updates: Partial<Ticket>): Promise<ApiResponse<Ticket>> {
    try {
      const response = await fetch(`${this.baseUrl}/tickets?id=eq.${ticketId}`, {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify(updates)
      });
      const data = await response.json();
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // ============================================
  // RATINGS
  // ============================================

  async getRatings(
    storeId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedResponse<Rating>> {
    try {
      const offset = (page - 1) * limit;
      const url = `${this.baseUrl}/ratings?store_id=eq.${storeId}&order=created_at.desc&limit=${limit}&offset=${offset}`;

      const response = await fetch(url, { headers: this.headers });
      const data = await response.json();

      return {
        data,
        total: data.length,
        page,
        limit,
        hasMore: data.length === limit
      };
    } catch (error) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        hasMore: false
      };
    }
  }

  async addRating(rating: Omit<Rating, 'id' | 'created_at'>): Promise<ApiResponse<Rating>> {
    try {
      const response = await fetch(`${this.baseUrl}/ratings`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(rating)
      });
      const data = await response.json();
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // ============================================
  // INSIGHTS
  // ============================================

  async getInsights(
    storeId: string,
    category?: string,
    resolvedOnly?: boolean
  ): Promise<ApiResponse<Insight[]>> {
    try {
      let url = `${this.baseUrl}/insights?store_id=eq.${storeId}`;

      if (category) {
        url += `&category=eq.${category}`;
      }
      if (resolvedOnly !== undefined) {
        url += `&resolved=eq.${resolvedOnly}`;
      }

      url += '&order=count.desc';

      const response = await fetch(url, { headers: this.headers });
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async updateInsight(insightId: string, updates: Partial<Insight>): Promise<ApiResponse<Insight>> {
    try {
      const response = await fetch(`${this.baseUrl}/insights?id=eq.${insightId}`, {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify(updates)
      });
      const data = await response.json();
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async deleteInsight(insightId: string): Promise<ApiResponse<void>> {
    try {
      await fetch(`${this.baseUrl}/insights?id=eq.${insightId}`, {
        method: 'DELETE',
        headers: this.headers
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // ============================================
  // BUBBLE CLICKS
  // ============================================

  async trackBubbleClick(storeId: string, sessionId?: string): Promise<ApiResponse<BubbleClick>> {
    try {
      const response = await fetch(`${this.baseUrl}/bubble_clicks`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ store_id: storeId, session_id: sessionId })
      });
      const data = await response.json();
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}

// Export singleton instance
export const supabase = new SupabaseService();
