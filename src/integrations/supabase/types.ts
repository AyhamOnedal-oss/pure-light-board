export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          assignee: string | null
          channel: Database["public"]["Enums"]["activity_channel"]
          conversation_id: string | null
          created_at: string
          id: string
          preview_ar: string
          preview_en: string
          primary_ar: string
          primary_en: string
          status: Database["public"]["Enums"]["activity_status"]
          tenant_id: string
          ticket_id: string | null
          type: Database["public"]["Enums"]["activity_type"]
          updated_at: string
        }
        Insert: {
          assignee?: string | null
          channel?: Database["public"]["Enums"]["activity_channel"]
          conversation_id?: string | null
          created_at?: string
          id?: string
          preview_ar?: string
          preview_en?: string
          primary_ar: string
          primary_en: string
          status?: Database["public"]["Enums"]["activity_status"]
          tenant_id: string
          ticket_id?: string | null
          type: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
        }
        Update: {
          assignee?: string | null
          channel?: Database["public"]["Enums"]["activity_channel"]
          conversation_id?: string | null
          created_at?: string
          id?: string
          preview_ar?: string
          preview_en?: string
          primary_ar?: string
          primary_en?: string
          status?: Database["public"]["Enums"]["activity_status"]
          tenant_id?: string
          ticket_id?: string | null
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          config: Json
          created_at: string
          display_name: string | null
          external_account_id: string | null
          id: string
          kind: Database["public"]["Enums"]["channel_kind"]
          status: Database["public"]["Enums"]["channel_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          display_name?: string | null
          external_account_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["channel_kind"]
          status?: Database["public"]["Enums"]["channel_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          display_name?: string | null
          external_account_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["channel_kind"]
          status?: Database["public"]["Enums"]["channel_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ai_handled: boolean
          ai_quality_score: number | null
          assignee_user_id: string | null
          category: Database["public"]["Enums"]["conversation_category"] | null
          channel_id: string | null
          channel_kind: Database["public"]["Enums"]["channel_kind"]
          close_reason: string | null
          created_at: string
          csat_comment: string | null
          csat_rating: number | null
          customer_id: string | null
          display_code: string | null
          first_response_at: string | null
          id: string
          language: string
          last_message_at: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["conversation_status"]
          subject: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ai_handled?: boolean
          ai_quality_score?: number | null
          assignee_user_id?: string | null
          category?: Database["public"]["Enums"]["conversation_category"] | null
          channel_id?: string | null
          channel_kind?: Database["public"]["Enums"]["channel_kind"]
          close_reason?: string | null
          created_at?: string
          csat_comment?: string | null
          csat_rating?: number | null
          customer_id?: string | null
          display_code?: string | null
          first_response_at?: string | null
          id?: string
          language?: string
          last_message_at?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          subject?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ai_handled?: boolean
          ai_quality_score?: number | null
          assignee_user_id?: string | null
          category?: Database["public"]["Enums"]["conversation_category"] | null
          channel_id?: string | null
          channel_kind?: Database["public"]["Enums"]["channel_kind"]
          close_reason?: string | null
          created_at?: string
          csat_comment?: string | null
          csat_rating?: number | null
          customer_id?: string | null
          display_code?: string | null
          first_response_at?: string | null
          id?: string
          language?: string
          last_message_at?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          subject?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          avatar_color: string | null
          created_at: string
          display_name: string | null
          display_name_ar: string | null
          email: string | null
          external_id: string | null
          id: string
          locale: string
          metadata: Json
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          avatar_color?: string | null
          created_at?: string
          display_name?: string | null
          display_name_ar?: string | null
          email?: string | null
          external_id?: string | null
          id?: string
          locale?: string
          metadata?: Json
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          avatar_color?: string | null
          created_at?: string
          display_name?: string | null
          display_name_ar?: string | null
          email?: string | null
          external_id?: string | null
          id?: string
          locale?: string
          metadata?: Json
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          ai_tokens_in: number
          ai_tokens_out: number
          attachments: Json
          body: string
          conversation_id: string
          created_at: string
          feedback: string | null
          id: string
          sender: Database["public"]["Enums"]["message_sender"]
          sender_user_id: string | null
          tenant_id: string
          word_count: number
        }
        Insert: {
          ai_tokens_in?: number
          ai_tokens_out?: number
          attachments?: Json
          body?: string
          conversation_id: string
          created_at?: string
          feedback?: string | null
          id?: string
          sender: Database["public"]["Enums"]["message_sender"]
          sender_user_id?: string | null
          tenant_id: string
          word_count?: number
        }
        Update: {
          ai_tokens_in?: number
          ai_tokens_out?: number
          attachments?: Json
          body?: string
          conversation_id?: string
          created_at?: string
          feedback?: string | null
          id?: string
          sender?: Database["public"]["Enums"]["message_sender"]
          sender_user_id?: string | null
          tenant_id?: string
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_quotas: {
        Row: {
          channel_quota: number
          created_at: string
          id: string
          monthly_word_quota: number
          monthly_words_used: number
          period_start: string
          seat_quota: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          channel_quota?: number
          created_at?: string
          id?: string
          monthly_word_quota?: number
          monthly_words_used?: number
          period_start?: string
          seat_quota?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          channel_quota?: number
          created_at?: string
          id?: string
          monthly_word_quota?: number
          monthly_words_used?: number
          period_start?: string
          seat_quota?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_quotas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          locale: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string | null
          name: string
          permissions: Json
          phone: string | null
          status: Database["public"]["Enums"]["team_member_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          name: string
          permissions?: Json
          phone?: string | null
          status?: Database["public"]["Enums"]["team_member_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          name?: string
          permissions?: Json
          phone?: string | null
          status?: Database["public"]["Enums"]["team_member_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          domain: string | null
          external_store_id: string | null
          id: string
          locale: string
          name: string
          plan: string
          platform: Database["public"]["Enums"]["tenant_platform"]
          status: Database["public"]["Enums"]["tenant_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain?: string | null
          external_store_id?: string | null
          id?: string
          locale?: string
          name: string
          plan?: string
          platform?: Database["public"]["Enums"]["tenant_platform"]
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string | null
          external_store_id?: string | null
          id?: string
          locale?: string
          name?: string
          plan?: string
          platform?: Database["public"]["Enums"]["tenant_platform"]
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          assignee_user_id: string | null
          category: Database["public"]["Enums"]["conversation_category"] | null
          conversation_id: string | null
          created_at: string
          description: string | null
          id: string
          number: number
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          sla_due_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assignee_user_id?: string | null
          category?: Database["public"]["Enums"]["conversation_category"] | null
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          number?: number
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assignee_user_id?: string | null
          category?: Database["public"]["Enums"]["conversation_category"] | null
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          number?: number
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_daily: {
        Row: {
          ai_quality_avg: number | null
          ai_tokens_used: number
          ai_words_used: number
          avg_response_seconds: number
          clicks: number
          conversations_opened: number
          conversations_resolved: number
          created_at: string
          csat_avg: number | null
          day: string
          id: string
          messages_in: number
          messages_out: number
          tenant_id: string
          unique_customers: number
          updated_at: string
        }
        Insert: {
          ai_quality_avg?: number | null
          ai_tokens_used?: number
          ai_words_used?: number
          avg_response_seconds?: number
          clicks?: number
          conversations_opened?: number
          conversations_resolved?: number
          created_at?: string
          csat_avg?: number | null
          day: string
          id?: string
          messages_in?: number
          messages_out?: number
          tenant_id: string
          unique_customers?: number
          updated_at?: string
        }
        Update: {
          ai_quality_avg?: number | null
          ai_tokens_used?: number
          ai_words_used?: number
          avg_response_seconds?: number
          clicks?: number
          conversations_opened?: number
          conversations_resolved?: number
          created_at?: string
          csat_avg?: number | null
          day?: string
          id?: string
          messages_in?: number
          messages_out?: number
          tenant_id?: string
          unique_customers?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_daily_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      tenant_role_at_least: {
        Args: {
          _min: Database["public"]["Enums"]["tenant_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      activity_channel:
        | "whatsapp"
        | "instagram"
        | "tiktok"
        | "snapchat"
        | "web"
        | "none"
      activity_status: "open" | "pending" | "resolved" | "trending" | "new"
      activity_type: "conversation" | "ticket" | "insight"
      app_role: "super_admin" | "support"
      channel_kind:
        | "whatsapp"
        | "instagram"
        | "tiktok"
        | "snapchat"
        | "web"
        | "salla"
        | "zid"
      channel_status: "connected" | "disconnected" | "error"
      conversation_category:
        | "shipping"
        | "refund"
        | "product"
        | "payment"
        | "complaint"
        | "inquiry"
        | "other"
        | "request"
        | "suggestion"
      conversation_status: "new" | "open" | "pending" | "resolved" | "closed"
      message_sender: "customer" | "agent" | "ai" | "system"
      team_member_status: "active" | "inactive"
      tenant_platform: "salla" | "zid" | "manual"
      tenant_role: "owner" | "admin" | "agent" | "viewer"
      tenant_status: "active" | "suspended" | "trial"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status: "open" | "in_progress" | "pending" | "resolved" | "closed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_channel: [
        "whatsapp",
        "instagram",
        "tiktok",
        "snapchat",
        "web",
        "none",
      ],
      activity_status: ["open", "pending", "resolved", "trending", "new"],
      activity_type: ["conversation", "ticket", "insight"],
      app_role: ["super_admin", "support"],
      channel_kind: [
        "whatsapp",
        "instagram",
        "tiktok",
        "snapchat",
        "web",
        "salla",
        "zid",
      ],
      channel_status: ["connected", "disconnected", "error"],
      conversation_category: [
        "shipping",
        "refund",
        "product",
        "payment",
        "complaint",
        "inquiry",
        "other",
        "request",
        "suggestion",
      ],
      conversation_status: ["new", "open", "pending", "resolved", "closed"],
      message_sender: ["customer", "agent", "ai", "system"],
      team_member_status: ["active", "inactive"],
      tenant_platform: ["salla", "zid", "manual"],
      tenant_role: ["owner", "admin", "agent", "viewer"],
      tenant_status: ["active", "suspended", "trial"],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: ["open", "in_progress", "pending", "resolved", "closed"],
    },
  },
} as const
