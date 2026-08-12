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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ai_agents: {
        Row: {
          active: boolean
          channels: string[]
          kind: string
          model: string
          organization_id: string
          provider: string
          system_prompt: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          channels?: string[]
          kind: string
          model?: string
          organization_id: string
          provider?: string
          system_prompt?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          channels?: string[]
          kind?: string
          model?: string
          organization_id?: string
          provider?: string
          system_prompt?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      amocrm_connection: {
        Row: {
          access_token: string
          connected_at: string
          connected_by: string | null
          last_sync_error: string | null
          last_synced_at: string | null
          organization_id: string
          refresh_token: string
          subdomain: string
          token_expires_at: string
        }
        Insert: {
          access_token: string
          connected_at?: string
          connected_by?: string | null
          last_sync_error?: string | null
          last_synced_at?: string | null
          organization_id: string
          refresh_token: string
          subdomain: string
          token_expires_at: string
        }
        Update: {
          access_token?: string
          connected_at?: string
          connected_by?: string | null
          last_sync_error?: string | null
          last_synced_at?: string | null
          organization_id?: string
          refresh_token?: string
          subdomain?: string
          token_expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amocrm_connection_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amocrm_connection_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      amocrm_calls: {
        Row: {
          ai_summary: string | null
          amocrm_note_id: number | null
          analyzed_at: string | null
          connected: boolean
          created_by: string | null
          direction: string
          duration_seconds: number
          id: string
          lead_id: string | null
          occurred_at: string
          organization_id: string
          phone: string | null
          recording_url: string | null
          source: string
          synced_at: string
          transcript: string | null
        }
        Insert: {
          ai_summary?: string | null
          amocrm_note_id?: number | null
          analyzed_at?: string | null
          connected?: boolean
          created_by?: string | null
          direction: string
          duration_seconds?: number
          id?: string
          lead_id?: string | null
          occurred_at: string
          organization_id?: string
          phone?: string | null
          recording_url?: string | null
          source?: string
          synced_at?: string
          transcript?: string | null
        }
        Update: {
          ai_summary?: string | null
          amocrm_note_id?: number | null
          analyzed_at?: string | null
          connected?: boolean
          created_by?: string | null
          direction?: string
          duration_seconds?: number
          id?: string
          lead_id?: string | null
          occurred_at?: string
          organization_id?: string
          phone?: string | null
          recording_url?: string | null
          source?: string
          synced_at?: string
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amocrm_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amocrm_calls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amocrm_calls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          meta: Json
          organization_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          meta?: Json
          organization_id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          meta?: Json
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_responders: {
        Row: {
          active: boolean
          channels: string[]
          created_at: string
          created_by: string | null
          id: string
          message: string
          name: string
          organization_id: string
          target_field: string | null
          trigger_text: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          channels?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          name: string
          organization_id?: string
          target_field?: string | null
          trigger_text: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          channels?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          name?: string
          organization_id?: string
          target_field?: string | null
          trigger_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_responders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_responders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          connected: boolean
          contact_id: string | null
          created_at: string
          duration_seconds: number
          id: string
          lead_id: string | null
          organization_id: string
          phone: string | null
          profile_id: string
        }
        Insert: {
          connected?: boolean
          contact_id?: string | null
          created_at?: string
          duration_seconds?: number
          id?: string
          lead_id?: string | null
          organization_id?: string
          phone?: string | null
          profile_id: string
        }
        Update: {
          connected?: boolean
          contact_id?: string | null
          created_at?: string
          duration_seconds?: number
          id?: string
          lead_id?: string | null
          organization_id?: string
          phone?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      work_sessions: {
        Row: {
          clock_in: string
          clock_out: string | null
          created_at: string
          id: string
          organization_id: string
          profile_id: string
        }
        Insert: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          profile_id: string
        }
        Update: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          context: Json
          created_at: string
          id: string
          message: string
          resolved: boolean
          route: string | null
          source: string
          stack: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json
          created_at?: string
          id?: string
          message: string
          resolved?: boolean
          route?: string | null
          source?: string
          stack?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          message?: string
          resolved?: boolean
          route?: string | null
          source?: string
          stack?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          amocrm_id: number | null
          annual_revenue: number | null
          city: string | null
          country: string | null
          created_at: string
          employees_range: string | null
          id: string
          industry: string | null
          name: string
          organization_id: string
          owner_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          amocrm_id?: number | null
          annual_revenue?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          employees_range?: string | null
          id?: string
          industry?: string | null
          name: string
          organization_id?: string
          owner_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          amocrm_id?: number | null
          annual_revenue?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          employees_range?: string | null
          id?: string
          industry?: string | null
          name?: string
          organization_id?: string
          owner_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          alt_phone: string | null
          amocrm_id: number | null
          birthday: string | null
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          organization_id: string
          owner_id: string | null
          phone: string | null
          position: string | null
          telegram: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          alt_phone?: string | null
          amocrm_id?: number | null
          birthday?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          organization_id?: string
          owner_id?: string | null
          phone?: string | null
          position?: string | null
          telegram?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          alt_phone?: string | null
          amocrm_id?: number | null
          birthday?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          organization_id?: string
          owner_id?: string | null
          phone?: string | null
          position?: string | null
          telegram?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          close_date: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          currency: string
          discount: number
          id: string
          lead_id: string | null
          name: string
          organization_id: string
          owner_id: string | null
          pipeline: string | null
          probability: number
          products_count: number
          stage_id: string | null
          status: Database["public"]["Enums"]["deal_status"]
          tax: number
          updated_at: string
          value: number
        }
        Insert: {
          close_date?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          discount?: number
          id?: string
          lead_id?: string | null
          name: string
          organization_id?: string
          owner_id?: string | null
          pipeline?: string | null
          probability?: number
          products_count?: number
          stage_id?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          tax?: number
          updated_at?: string
          value?: number
        }
        Update: {
          close_date?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          discount?: number
          id?: string
          lead_id?: string | null
          name?: string
          organization_id?: string
          owner_id?: string | null
          pipeline?: string | null
          probability?: number
          products_count?: number
          stage_id?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          tax?: number
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profile: {
        Row: {
          company_name: string
          competitors: string
          description: string
          organization_id: string
          terminology: string
          tone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_name?: string
          competitors?: string
          description?: string
          organization_id: string
          terminology?: string
          tone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_name?: string
          competitors?: string
          description?: string
          organization_id?: string
          terminology?: string
          tone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_profile_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_profile_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          config: Json
          enabled: boolean
          key: string
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          enabled?: boolean
          key: string
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          enabled?: boolean
          key?: string
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          organization_id: string
          type: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          organization_id?: string
          type: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          organization_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string | null
          amocrm_id: number | null
          budget: number
          campaign: string | null
          city: string | null
          company_id: string | null
          company_name: string
          contact_id: string | null
          country: string | null
          created_at: string
          expected_revenue: number
          funnel: string | null
          id: string
          last_contact_at: string | null
          manager_id: string | null
          name: string
          next_follow_up: string | null
          organization_id: string
          owner_id: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          region: string | null
          score: number
          source: string | null
          stage_id: string | null
          tags: string[]
          temperature: Database["public"]["Enums"]["lead_temperature"]
          updated_at: string
          utm: string | null
        }
        Insert: {
          address?: string | null
          amocrm_id?: number | null
          budget?: number
          campaign?: string | null
          city?: string | null
          company_id?: string | null
          company_name?: string
          contact_id?: string | null
          country?: string | null
          created_at?: string
          expected_revenue?: number
          funnel?: string | null
          id?: string
          last_contact_at?: string | null
          manager_id?: string | null
          name: string
          next_follow_up?: string | null
          organization_id?: string
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          region?: string | null
          score?: number
          source?: string | null
          stage_id?: string | null
          tags?: string[]
          temperature?: Database["public"]["Enums"]["lead_temperature"]
          updated_at?: string
          utm?: string | null
        }
        Update: {
          address?: string | null
          amocrm_id?: number | null
          budget?: number
          campaign?: string | null
          city?: string | null
          company_id?: string | null
          company_name?: string
          contact_id?: string | null
          country?: string | null
          created_at?: string
          expected_revenue?: number
          funnel?: string | null
          id?: string
          last_contact_at?: string | null
          manager_id?: string | null
          name?: string
          next_follow_up?: string | null
          organization_id?: string
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          region?: string | null
          score?: number
          source?: string | null
          stage_id?: string | null
          tags?: string[]
          temperature?: Database["public"]["Enums"]["lead_temperature"]
          updated_at?: string
          utm?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          profile_id: string
          task_assigned: boolean
          updated_at: string
        }
        Insert: {
          profile_id: string
          task_assigned?: boolean
          updated_at?: string
        }
        Update: {
          profile_id?: string
          task_assigned?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          organization_id: string
          read: boolean
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          organization_id?: string
          read?: boolean
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          organization_id?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          amocrm_pipeline_id: number | null
          amocrm_status_id: number | null
          color: string
          created_at: string
          id: string
          is_lost: boolean
          is_won: boolean
          key: string
          name: string
          organization_id: string
          position: number
          probability: number
        }
        Insert: {
          amocrm_pipeline_id?: number | null
          amocrm_status_id?: number | null
          color?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          key: string
          name: string
          organization_id?: string
          position: number
          probability?: number
        }
        Update: {
          amocrm_pipeline_id?: number | null
          amocrm_status_id?: number | null
          color?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          key?: string
          name?: string
          organization_id?: string
          position?: number
          probability?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          amocrm_user_id: number | null
          avatar_url: string | null
          branch: string | null
          created_at: string
          daily_target: number
          department: string
          email: string
          full_name: string
          id: string
          kpi_percent: number
          manager_id: string | null
          monthly_target: number
          organization_id: string | null
          phone: string | null
          position: string
          role: Database["public"]["Enums"]["app_role"]
          team: string | null
          telegram_chat_id: number | null
          telegram_link_code: string | null
          updated_at: string
        }
        Insert: {
          amocrm_user_id?: number | null
          avatar_url?: string | null
          branch?: string | null
          created_at?: string
          daily_target?: number
          department?: string
          email: string
          full_name?: string
          id: string
          kpi_percent?: number
          manager_id?: string | null
          monthly_target?: number
          organization_id?: string | null
          phone?: string | null
          position?: string
          role?: Database["public"]["Enums"]["app_role"]
          team?: string | null
          telegram_chat_id?: number | null
          telegram_link_code?: string | null
          updated_at?: string
        }
        Update: {
          amocrm_user_id?: number | null
          avatar_url?: string | null
          branch?: string | null
          created_at?: string
          daily_target?: number
          department?: string
          email?: string
          full_name?: string
          id?: string
          kpi_percent?: number
          manager_id?: string | null
          monthly_target?: number
          organization_id?: string | null
          phone?: string | null
          position?: string
          role?: Database["public"]["Enums"]["app_role"]
          team?: string | null
          telegram_chat_id?: number | null
          telegram_link_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          id: string
          organization_id: string
          task_id: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          id?: string
          organization_id?: string
          task_id: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          organization_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          organization_id: string
          priority: Database["public"]["Enums"]["priority_level"]
          progress: number
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          progress?: number
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          progress?: number
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
          phone: string | null
          plan: string
          trial_ends_at: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          phone?: string | null
          plan?: string
          trial_ends_at?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          phone?: string | null
          plan?: string
          trial_ends_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      is_admin_or_manager: { Args: never; Returns: boolean }
      current_user_org_id: { Args: never; Returns: string }
      is_platform_owner: { Args: never; Returns: boolean }
      entities_as_of: {
        Args: { p_organization_id: string; p_entity_type: string; p_as_of: string }
        Returns: Json[]
      }
    }
    Enums: {
      app_role: "super_admin" | "manager" | "rep" | "platform_owner"
      deal_status: "open" | "won" | "lost"
      lead_temperature: "Hot" | "Warm" | "Cold"
      priority_level: "Urgent" | "High" | "Normal" | "Low"
      task_status: "Todo" | "In progress" | "Review" | "Done"
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
      app_role: ["super_admin", "manager", "rep", "platform_owner"],
      deal_status: ["open", "won", "lost"],
      lead_temperature: ["Hot", "Warm", "Cold"],
      priority_level: ["Urgent", "High", "Normal", "Low"],
      task_status: ["Todo", "In progress", "Review", "Done"],
    },
  },
} as const
