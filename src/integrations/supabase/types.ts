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
      admin_ad_campaigns: {
        Row: {
          clicks: number
          content: string | null
          conversions: number
          created_at: string
          end_date: string
          id: string
          impressions: number
          last_sync: string | null
          link: string | null
          media_url: string | null
          name: string
          owner: string
          platform_row_id: string
          spend: number
          start_date: string
          status: Database["public"]["Enums"]["ad_campaign_status"]
          type: Database["public"]["Enums"]["ad_campaign_type"]
          updated_at: string
        }
        Insert: {
          clicks?: number
          content?: string | null
          conversions?: number
          created_at?: string
          end_date?: string
          id?: string
          impressions?: number
          last_sync?: string | null
          link?: string | null
          media_url?: string | null
          name: string
          owner?: string
          platform_row_id: string
          spend?: number
          start_date?: string
          status?: Database["public"]["Enums"]["ad_campaign_status"]
          type?: Database["public"]["Enums"]["ad_campaign_type"]
          updated_at?: string
        }
        Update: {
          clicks?: number
          content?: string | null
          conversions?: number
          created_at?: string
          end_date?: string
          id?: string
          impressions?: number
          last_sync?: string | null
          link?: string | null
          media_url?: string | null
          name?: string
          owner?: string
          platform_row_id?: string
          spend?: number
          start_date?: string
          status?: Database["public"]["Enums"]["ad_campaign_status"]
          type?: Database["public"]["Enums"]["ad_campaign_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_ad_campaigns_platform_row_id_fkey"
            columns: ["platform_row_id"]
            isOneToOne: false
            referencedRelation: "admin_ad_platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_ad_platforms: {
        Row: {
          account_id: string | null
          account_name: string | null
          added_at: string
          connected: boolean
          created_at: string
          id: string
          last_sync: string | null
          platform_id: Database["public"]["Enums"]["ad_platform_id"]
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          account_name?: string | null
          added_at?: string
          connected?: boolean
          created_at?: string
          id?: string
          last_sync?: string | null
          platform_id: Database["public"]["Enums"]["ad_platform_id"]
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          account_name?: string | null
          added_at?: string
          connected?: boolean
          created_at?: string
          id?: string
          last_sync?: string | null
          platform_id?: Database["public"]["Enums"]["ad_platform_id"]
          updated_at?: string
        }
        Relationships: []
      }
      admin_customers_seed: {
        Row: {
          created_at: string
          email: string
          id: string
          logo_initials: string
          phone: string | null
          plan: string
          plan_ar: string
          platform: string
          status: string
          store_name: string
          store_name_ar: string
          total_words: number
          updated_at: string
          usage_percent: number
          words: number
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          logo_initials: string
          phone?: string | null
          plan: string
          plan_ar: string
          platform: string
          status: string
          store_name: string
          store_name_ar: string
          total_words?: number
          updated_at?: string
          usage_percent?: number
          words?: number
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          logo_initials?: string
          phone?: string | null
          plan?: string
          plan_ar?: string
          platform?: string
          status?: string
          store_name?: string
          store_name_ar?: string
          total_words?: number
          updated_at?: string
          usage_percent?: number
          words?: number
        }
        Relationships: []
      }
      admin_dash_customer_source: {
        Row: {
          count: number
          created_at: string
          id: string
          platform: Database["public"]["Enums"]["platform_kind"]
          updated_at: string
        }
        Insert: {
          count?: number
          created_at?: string
          id?: string
          platform: Database["public"]["Enums"]["platform_kind"]
          updated_at?: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: string
          platform?: Database["public"]["Enums"]["platform_kind"]
          updated_at?: string
        }
        Relationships: []
      }
      admin_dash_first_sub_type: {
        Row: {
          count: number
          created_at: string
          id: string
          plan: Database["public"]["Enums"]["plan_tier"]
          updated_at: string
        }
        Insert: {
          count?: number
          created_at?: string
          id?: string
          plan: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      admin_dash_kpi_snapshots: {
        Row: {
          active_customers: number
          active_customers_change: number
          avg_response_seconds: number
          avg_response_seconds_change: number
          created_at: string
          id: string
          inactive_customers: number
          inactive_customers_change: number
          snapshot_date: string
          total_bubble_clicks: number
          total_bubble_clicks_change: number
          total_customers: number
          total_customers_change: number
          total_uninstalls: number
          total_uninstalls_change: number
          updated_at: string
        }
        Insert: {
          active_customers?: number
          active_customers_change?: number
          avg_response_seconds?: number
          avg_response_seconds_change?: number
          created_at?: string
          id?: string
          inactive_customers?: number
          inactive_customers_change?: number
          snapshot_date?: string
          total_bubble_clicks?: number
          total_bubble_clicks_change?: number
          total_customers?: number
          total_customers_change?: number
          total_uninstalls?: number
          total_uninstalls_change?: number
          updated_at?: string
        }
        Update: {
          active_customers?: number
          active_customers_change?: number
          avg_response_seconds?: number
          avg_response_seconds_change?: number
          created_at?: string
          id?: string
          inactive_customers?: number
          inactive_customers_change?: number
          snapshot_date?: string
          total_bubble_clicks?: number
          total_bubble_clicks_change?: number
          total_customers?: number
          total_customers_change?: number
          total_uninstalls?: number
          total_uninstalls_change?: number
          updated_at?: string
        }
        Relationships: []
      }
      admin_dash_new_subs_monthly: {
        Row: {
          count: number
          created_at: string
          id: string
          month: number
          platform: Database["public"]["Enums"]["platform_kind"]
          updated_at: string
          year: number
        }
        Insert: {
          count?: number
          created_at?: string
          id?: string
          month: number
          platform: Database["public"]["Enums"]["platform_kind"]
          updated_at?: string
          year: number
        }
        Update: {
          count?: number
          created_at?: string
          id?: string
          month?: number
          platform?: Database["public"]["Enums"]["platform_kind"]
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      admin_dash_new_subscribers: {
        Row: {
          created_at: string
          id: string
          logo_initials: string
          platform: Database["public"]["Enums"]["platform_kind"]
          store_name: string
          subscribed_on: string
          total_tokens: number
          updated_at: string
          used_tokens: number
        }
        Insert: {
          created_at?: string
          id?: string
          logo_initials: string
          platform: Database["public"]["Enums"]["platform_kind"]
          store_name: string
          subscribed_on: string
          total_tokens?: number
          updated_at?: string
          used_tokens?: number
        }
        Update: {
          created_at?: string
          id?: string
          logo_initials?: string
          platform?: Database["public"]["Enums"]["platform_kind"]
          store_name?: string
          subscribed_on?: string
          total_tokens?: number
          updated_at?: string
          used_tokens?: number
        }
        Relationships: []
      }
      admin_dash_plan_distribution: {
        Row: {
          created_at: string
          id: string
          plan: Database["public"]["Enums"]["plan_tier"]
          platform: Database["public"]["Enums"]["platform_kind"] | null
          subscribers: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan: Database["public"]["Enums"]["plan_tier"]
          platform?: Database["public"]["Enums"]["platform_kind"] | null
          subscribers?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          platform?: Database["public"]["Enums"]["platform_kind"] | null
          subscribers?: number
          updated_at?: string
        }
        Relationships: []
      }
      admin_dash_platform_subs: {
        Row: {
          count: number
          created_at: string
          id: string
          platform: Database["public"]["Enums"]["platform_kind"]
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          count?: number
          created_at?: string
          id?: string
          platform: Database["public"]["Enums"]["platform_kind"]
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: string
          platform?: Database["public"]["Enums"]["platform_kind"]
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: []
      }
      admin_dash_servers: {
        Row: {
          color: string
          created_at: string
          display_order: number
          id: string
          name: string
          status: Database["public"]["Enums"]["server_connection_status"]
          updated_at: string
          usage_percent: number
        }
        Insert: {
          color?: string
          created_at?: string
          display_order?: number
          id?: string
          name: string
          status?: Database["public"]["Enums"]["server_connection_status"]
          updated_at?: string
          usage_percent?: number
        }
        Update: {
          color?: string
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["server_connection_status"]
          updated_at?: string
          usage_percent?: number
        }
        Relationships: []
      }
      admin_dash_uninstalls: {
        Row: {
          count: number
          created_at: string
          id: string
          platform: Database["public"]["Enums"]["platform_kind"]
          updated_at: string
        }
        Insert: {
          count?: number
          created_at?: string
          id?: string
          platform: Database["public"]["Enums"]["platform_kind"]
          updated_at?: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: string
          platform?: Database["public"]["Enums"]["platform_kind"]
          updated_at?: string
        }
        Relationships: []
      }
      admin_dash_words_monthly: {
        Row: {
          created_at: string
          id: string
          month: number
          updated_at: string
          words: number
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          updated_at?: string
          words?: number
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          updated_at?: string
          words?: number
          year?: number
        }
        Relationships: []
      }
      admin_invoices_other: {
        Row: {
          amount: number
          amount_after_tax: number
          created_at: string
          details: string | null
          id: string
          invoice_date: string
          invoice_number: string
          name: string
          status: Database["public"]["Enums"]["admin_invoice_status"]
          tax: number
          updated_at: string
          vendor: string
        }
        Insert: {
          amount?: number
          amount_after_tax?: number
          created_at?: string
          details?: string | null
          id?: string
          invoice_date: string
          invoice_number: string
          name: string
          status?: Database["public"]["Enums"]["admin_invoice_status"]
          tax?: number
          updated_at?: string
          vendor: string
        }
        Update: {
          amount?: number
          amount_after_tax?: number
          created_at?: string
          details?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          name?: string
          status?: Database["public"]["Enums"]["admin_invoice_status"]
          tax?: number
          updated_at?: string
          vendor?: string
        }
        Relationships: []
      }
      admin_invoices_servers: {
        Row: {
          amount: number
          amount_after_tax: number
          created_at: string
          duration: string | null
          end_date: string | null
          id: string
          plan: string
          renewal: string
          server_name: string
          start_date: string | null
          status: Database["public"]["Enums"]["admin_invoice_status"]
          tax: number
          updated_at: string
          usage_percent: number
        }
        Insert: {
          amount?: number
          amount_after_tax?: number
          created_at?: string
          duration?: string | null
          end_date?: string | null
          id?: string
          plan: string
          renewal?: string
          server_name: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["admin_invoice_status"]
          tax?: number
          updated_at?: string
          usage_percent?: number
        }
        Update: {
          amount?: number
          amount_after_tax?: number
          created_at?: string
          duration?: string | null
          end_date?: string | null
          id?: string
          plan?: string
          renewal?: string
          server_name?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["admin_invoice_status"]
          tax?: number
          updated_at?: string
          usage_percent?: number
        }
        Relationships: []
      }
      admin_invoices_subscriptions: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_date: string
          payment_date: string | null
          plan: string
          plan_ar: string
          platform: string
          status: Database["public"]["Enums"]["admin_invoice_status"]
          store_name: string
          store_name_ar: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_date: string
          payment_date?: string | null
          plan: string
          plan_ar: string
          platform: string
          status?: Database["public"]["Enums"]["admin_invoice_status"]
          store_name: string
          store_name_ar: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_date?: string
          payment_date?: string | null
          plan?: string
          plan_ar?: string
          platform?: string
          status?: Database["public"]["Enums"]["admin_invoice_status"]
          store_name?: string
          store_name_ar?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_reports_plans: {
        Row: {
          created_at: string
          display_order: number
          id: string
          plan_key: string
          plan_name: string
          plan_name_ar: string
          platform: string
          price: number
          subscribers: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          plan_key: string
          plan_name: string
          plan_name_ar: string
          platform: string
          price?: number
          subscribers?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          plan_key?: string
          plan_name?: string
          plan_name_ar?: string
          platform?: string
          price?: number
          subscribers?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      admin_reports_revenue_monthly: {
        Row: {
          created_at: string
          id: string
          month: number
          salla: number
          updated_at: string
          year: number
          zid: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          salla?: number
          updated_at?: string
          year: number
          zid?: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          salla?: number
          updated_at?: string
          year?: number
          zid?: number
        }
        Relationships: []
      }
      admin_team_members: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          name_ar: string
          permissions: string[]
          phone: string | null
          status: Database["public"]["Enums"]["admin_team_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          name_ar: string
          permissions?: string[]
          phone?: string | null
          status?: Database["public"]["Enums"]["admin_team_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          name_ar?: string
          permissions?: string[]
          phone?: string | null
          status?: Database["public"]["Enums"]["admin_team_status"]
          updated_at?: string
        }
        Relationships: []
      }
      auth_tenant_members: {
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
            referencedRelation: "settings_workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_user_roles: {
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
      conversations_channels: {
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
            referencedRelation: "settings_workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations_customers: {
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
            referencedRelation: "settings_workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations_main: {
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
          rating_comment: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["conversation_status"]
          subject: string | null
          tenant_id: string
          ticket_status: string | null
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
          rating_comment?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          subject?: string | null
          tenant_id: string
          ticket_status?: string | null
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
          rating_comment?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          subject?: string | null
          tenant_id?: string
          ticket_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "conversations_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "conversations_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "settings_workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations_messages: {
        Row: {
          ai_tokens_in: number
          ai_tokens_out: number
          attachments: Json
          body: string
          conversation_id: string
          created_at: string
          feedback: string | null
          file_name: string | null
          id: string
          kind: string
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
          file_name?: string | null
          id?: string
          kind?: string
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
          file_name?: string | null
          id?: string
          kind?: string
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
            referencedRelation: "conversations_main"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "settings_workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_activities: {
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
            referencedRelation: "conversations_main"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "settings_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_main"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_usage_daily: {
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
            referencedRelation: "settings_workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_salla_connections: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          status: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      salla_connections: {
        Row: {
          access_token: string | null
          connected_at: string | null
          connection_status: string
          created_at: string
          id: string
          is_active: boolean
          merchant_id: number
          metadata: Json
          refresh_token: string | null
          store_email: string | null
          store_id: string | null
          store_name: string | null
          store_url: string | null
          tenant_id: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          connected_at?: string | null
          connection_status?: string
          created_at?: string
          id?: string
          is_active?: boolean
          merchant_id: number
          metadata?: Json
          refresh_token?: string | null
          store_email?: string | null
          store_id?: string | null
          store_name?: string | null
          store_url?: string | null
          tenant_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          connected_at?: string | null
          connection_status?: string
          created_at?: string
          id?: string
          is_active?: boolean
          merchant_id?: number
          metadata?: Json
          refresh_token?: string | null
          store_email?: string | null
          store_id?: string | null
          store_name?: string | null
          store_url?: string | null
          tenant_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salla_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "settings_workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      salla_events: {
        Row: {
          created_at: string
          event_data: Json
          event_type: string
          id: string
          merchant_id: number | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json
          event_type: string
          id?: string
          merchant_id?: number | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json
          event_type?: string
          id?: string
          merchant_id?: number | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      settings_account: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          locale: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      settings_chat_design: {
        Row: {
          allowed_countries: string[]
          auto_open_delay: number
          bubble_offset_x: number
          bubble_offset_y: number
          bubble_size: number
          copy_enabled: boolean
          created_at: string
          export_enabled: boolean
          id: string
          inactivity_close_seconds: number
          inactivity_enabled: boolean
          inactivity_prompt_seconds: number
          input_placeholder: string
          media_enabled: boolean
          message_feedback_enabled: boolean
          position: string
          preview_mode: string
          primary_color: string
          rating_inactivity_seconds: number
          ratings_enabled: boolean
          show_branding: boolean
          tenant_id: string
          theme_mode: string
          tickets_enabled: boolean
          updated_at: string
          welcome_bubble_enabled: boolean
          welcome_bubble_line1: string
          welcome_bubble_line2: string
          welcome_message: string
          widget_inner_color: string
          widget_outer_color: string
        }
        Insert: {
          allowed_countries?: string[]
          auto_open_delay?: number
          bubble_offset_x?: number
          bubble_offset_y?: number
          bubble_size?: number
          copy_enabled?: boolean
          created_at?: string
          export_enabled?: boolean
          id?: string
          inactivity_close_seconds?: number
          inactivity_enabled?: boolean
          inactivity_prompt_seconds?: number
          input_placeholder?: string
          media_enabled?: boolean
          message_feedback_enabled?: boolean
          position?: string
          preview_mode?: string
          primary_color?: string
          rating_inactivity_seconds?: number
          ratings_enabled?: boolean
          show_branding?: boolean
          tenant_id: string
          theme_mode?: string
          tickets_enabled?: boolean
          updated_at?: string
          welcome_bubble_enabled?: boolean
          welcome_bubble_line1?: string
          welcome_bubble_line2?: string
          welcome_message?: string
          widget_inner_color?: string
          widget_outer_color?: string
        }
        Update: {
          allowed_countries?: string[]
          auto_open_delay?: number
          bubble_offset_x?: number
          bubble_offset_y?: number
          bubble_size?: number
          copy_enabled?: boolean
          created_at?: string
          export_enabled?: boolean
          id?: string
          inactivity_close_seconds?: number
          inactivity_enabled?: boolean
          inactivity_prompt_seconds?: number
          input_placeholder?: string
          media_enabled?: boolean
          message_feedback_enabled?: boolean
          position?: string
          preview_mode?: string
          primary_color?: string
          rating_inactivity_seconds?: number
          ratings_enabled?: boolean
          show_branding?: boolean
          tenant_id?: string
          theme_mode?: string
          tickets_enabled?: boolean
          updated_at?: string
          welcome_bubble_enabled?: boolean
          welcome_bubble_line1?: string
          welcome_bubble_line2?: string
          welcome_message?: string
          widget_inner_color?: string
          widget_outer_color?: string
        }
        Relationships: []
      }
      settings_plans: {
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
            referencedRelation: "settings_workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      settings_train_ai: {
        Row: {
          bubble_visible: boolean
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
          mode: string
          prompt: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          bubble_visible?: boolean
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          mode?: string
          prompt?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          bubble_visible?: boolean
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          mode?: string
          prompt?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings_workspace: {
        Row: {
          created_at: string
          domain: string | null
          external_store_id: string | null
          icon_url: string | null
          id: string
          locale: string
          logo_url: string | null
          name: string
          plan: string
          platform: Database["public"]["Enums"]["tenant_platform"]
          salla_merchant_id: number | null
          status: Database["public"]["Enums"]["tenant_status"]
          updated_at: string
          zid_store_uuid: string | null
        }
        Insert: {
          created_at?: string
          domain?: string | null
          external_store_id?: string | null
          icon_url?: string | null
          id?: string
          locale?: string
          logo_url?: string | null
          name: string
          plan?: string
          platform?: Database["public"]["Enums"]["tenant_platform"]
          salla_merchant_id?: number | null
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
          zid_store_uuid?: string | null
        }
        Update: {
          created_at?: string
          domain?: string | null
          external_store_id?: string | null
          icon_url?: string | null
          id?: string
          locale?: string
          logo_url?: string | null
          name?: string
          plan?: string
          platform?: Database["public"]["Enums"]["tenant_platform"]
          salla_merchant_id?: number | null
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
          zid_store_uuid?: string | null
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
      tickets_activities: {
        Row: {
          attachment: Json | null
          author_name: string
          author_role: string
          author_user_id: string | null
          created_at: string
          edited_at: string | null
          id: string
          status: string | null
          tenant_id: string
          text: string | null
          ticket_id: string
          type: string
        }
        Insert: {
          attachment?: Json | null
          author_name: string
          author_role?: string
          author_user_id?: string | null
          created_at?: string
          edited_at?: string | null
          id?: string
          status?: string | null
          tenant_id: string
          text?: string | null
          ticket_id: string
          type: string
        }
        Update: {
          attachment?: Json | null
          author_name?: string
          author_role?: string
          author_user_id?: string | null
          created_at?: string
          edited_at?: string | null
          id?: string
          status?: string | null
          tenant_id?: string
          text?: string | null
          ticket_id?: string
          type?: string
        }
        Relationships: []
      }
      tickets_main: {
        Row: {
          assignee_user_id: string | null
          category: Database["public"]["Enums"]["conversation_category"] | null
          conversation_id: string | null
          created_at: string
          customer_avatar_color: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          description: string | null
          display_code: string | null
          id: string
          number: number
          priority: Database["public"]["Enums"]["ticket_priority"]
          rating: number | null
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
          customer_avatar_color?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          display_code?: string | null
          id?: string
          number?: number
          priority?: Database["public"]["Enums"]["ticket_priority"]
          rating?: number | null
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
          customer_avatar_color?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          display_code?: string | null
          id?: string
          number?: number
          priority?: Database["public"]["Enums"]["ticket_priority"]
          rating?: number | null
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
            referencedRelation: "conversations_main"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "settings_workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      widget_rate_limits: {
        Row: {
          count: number
          tenant_id: string
          window_start: string
        }
        Insert: {
          count?: number
          tenant_id: string
          window_start: string
        }
        Update: {
          count?: number
          tenant_id?: string
          window_start?: string
        }
        Relationships: []
      }
      zid_connections: {
        Row: {
          authorization_token: string | null
          connected_at: string | null
          connection_status: string
          created_at: string
          id: string
          is_active: boolean
          manager_token: string | null
          metadata: Json
          refresh_token: string | null
          store_email: string | null
          store_name: string | null
          store_url: string | null
          store_uuid: string
          tenant_id: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          authorization_token?: string | null
          connected_at?: string | null
          connection_status?: string
          created_at?: string
          id?: string
          is_active?: boolean
          manager_token?: string | null
          metadata?: Json
          refresh_token?: string | null
          store_email?: string | null
          store_name?: string | null
          store_url?: string | null
          store_uuid: string
          tenant_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          authorization_token?: string | null
          connected_at?: string | null
          connection_status?: string
          created_at?: string
          id?: string
          is_active?: boolean
          manager_token?: string | null
          metadata?: Json
          refresh_token?: string | null
          store_email?: string | null
          store_name?: string | null
          store_url?: string | null
          store_uuid?: string
          tenant_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zid_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "settings_workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      zid_events: {
        Row: {
          created_at: string
          event_data: Json
          event_type: string
          id: string
          store_uuid: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json
          event_type: string
          id?: string
          store_uuid?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json
          event_type?: string
          id?: string
          store_uuid?: string | null
          tenant_id?: string | null
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
      ad_campaign_status: "active" | "paused" | "done" | "draft"
      ad_campaign_type: "image" | "video"
      ad_platform_id:
        | "tiktok"
        | "snapchat"
        | "instagram"
        | "facebook"
        | "google"
      admin_invoice_status:
        | "active"
        | "inactive"
        | "expired"
        | "cancelled"
        | "paid"
        | "unpaid"
        | "pending"
      admin_team_status: "active" | "inactive"
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
        | "shipping_request"
      conversation_status: "new" | "open" | "pending" | "resolved" | "closed"
      message_sender: "customer" | "agent" | "ai" | "system"
      plan_tier: "trial" | "economy" | "basic" | "professional" | "business"
      platform_kind: "zid" | "salla"
      server_connection_status: "connected" | "disconnected"
      subscription_status: "active" | "inactive" | "cancelled"
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
      ad_campaign_status: ["active", "paused", "done", "draft"],
      ad_campaign_type: ["image", "video"],
      ad_platform_id: ["tiktok", "snapchat", "instagram", "facebook", "google"],
      admin_invoice_status: [
        "active",
        "inactive",
        "expired",
        "cancelled",
        "paid",
        "unpaid",
        "pending",
      ],
      admin_team_status: ["active", "inactive"],
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
        "shipping_request",
      ],
      conversation_status: ["new", "open", "pending", "resolved", "closed"],
      message_sender: ["customer", "agent", "ai", "system"],
      plan_tier: ["trial", "economy", "basic", "professional", "business"],
      platform_kind: ["zid", "salla"],
      server_connection_status: ["connected", "disconnected"],
      subscription_status: ["active", "inactive", "cancelled"],
      team_member_status: ["active", "inactive"],
      tenant_platform: ["salla", "zid", "manual"],
      tenant_role: ["owner", "admin", "agent", "viewer"],
      tenant_status: ["active", "suspended", "trial"],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: ["open", "in_progress", "pending", "resolved", "closed"],
    },
  },
} as const
