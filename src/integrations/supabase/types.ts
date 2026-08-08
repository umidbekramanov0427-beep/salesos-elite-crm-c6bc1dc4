// Hand-maintained to mirror supabase/migrations/20260808120000_init_schema.sql.
// Regenerate with `supabase gen types typescript` once the CLI is linked.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          role: Database["public"]["Enums"]["app_role"];
          department: string;
          position: string;
          team: string | null;
          branch: string | null;
          phone: string | null;
          manager_id: string | null;
          daily_target: number;
          monthly_target: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          avatar_url?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          department?: string;
          position?: string;
          team?: string | null;
          branch?: string | null;
          phone?: string | null;
          manager_id?: string | null;
          daily_target?: number;
          monthly_target?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          avatar_url?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          department?: string;
          position?: string;
          team?: string | null;
          branch?: string | null;
          phone?: string | null;
          manager_id?: string | null;
          daily_target?: number;
          monthly_target?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pipeline_stages: {
        Row: {
          id: string;
          key: string;
          name: string;
          position: number;
          color: string;
          probability: number;
          is_won: boolean;
          is_lost: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          name: string;
          position: number;
          color?: string;
          probability?: number;
          is_won?: boolean;
          is_lost?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          name?: string;
          position?: number;
          color?: string;
          probability?: number;
          is_won?: boolean;
          is_lost?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      companies: {
        Row: {
          id: string;
          name: string;
          industry: string | null;
          employees_range: string | null;
          annual_revenue: number | null;
          website: string | null;
          city: string | null;
          country: string | null;
          owner_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          industry?: string | null;
          employees_range?: string | null;
          annual_revenue?: number | null;
          website?: string | null;
          city?: string | null;
          country?: string | null;
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          industry?: string | null;
          employees_range?: string | null;
          annual_revenue?: number | null;
          website?: string | null;
          city?: string | null;
          country?: string | null;
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          company_id: string | null;
          full_name: string;
          position: string | null;
          phone: string | null;
          alt_phone: string | null;
          email: string | null;
          telegram: string | null;
          whatsapp: string | null;
          birthday: string | null;
          owner_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string | null;
          full_name: string;
          position?: string | null;
          phone?: string | null;
          alt_phone?: string | null;
          email?: string | null;
          telegram?: string | null;
          whatsapp?: string | null;
          birthday?: string | null;
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string | null;
          full_name?: string;
          position?: string | null;
          phone?: string | null;
          alt_phone?: string | null;
          email?: string | null;
          telegram?: string | null;
          whatsapp?: string | null;
          birthday?: string | null;
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          contact_id: string | null;
          company_id: string | null;
          name: string;
          company_name: string;
          source: string | null;
          campaign: string | null;
          utm: string | null;
          owner_id: string | null;
          manager_id: string | null;
          priority: Database["public"]["Enums"]["priority_level"];
          score: number;
          temperature: Database["public"]["Enums"]["lead_temperature"];
          budget: number;
          expected_revenue: number;
          country: string | null;
          region: string | null;
          city: string | null;
          address: string | null;
          stage_id: string | null;
          funnel: string | null;
          next_follow_up: string | null;
          last_contact_at: string | null;
          tags: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contact_id?: string | null;
          company_id?: string | null;
          name: string;
          company_name?: string;
          source?: string | null;
          campaign?: string | null;
          utm?: string | null;
          owner_id?: string | null;
          manager_id?: string | null;
          priority?: Database["public"]["Enums"]["priority_level"];
          score?: number;
          temperature?: Database["public"]["Enums"]["lead_temperature"];
          budget?: number;
          expected_revenue?: number;
          country?: string | null;
          region?: string | null;
          city?: string | null;
          address?: string | null;
          stage_id?: string | null;
          funnel?: string | null;
          next_follow_up?: string | null;
          last_contact_at?: string | null;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string | null;
          company_id?: string | null;
          name?: string;
          company_name?: string;
          source?: string | null;
          campaign?: string | null;
          utm?: string | null;
          owner_id?: string | null;
          manager_id?: string | null;
          priority?: Database["public"]["Enums"]["priority_level"];
          score?: number;
          temperature?: Database["public"]["Enums"]["lead_temperature"];
          budget?: number;
          expected_revenue?: number;
          country?: string | null;
          region?: string | null;
          city?: string | null;
          address?: string | null;
          stage_id?: string | null;
          funnel?: string | null;
          next_follow_up?: string | null;
          last_contact_at?: string | null;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      deals: {
        Row: {
          id: string;
          lead_id: string | null;
          company_id: string | null;
          contact_id: string | null;
          name: string;
          value: number;
          currency: string;
          probability: number;
          stage_id: string | null;
          pipeline: string | null;
          status: Database["public"]["Enums"]["deal_status"];
          close_date: string | null;
          owner_id: string | null;
          products_count: number;
          discount: number;
          tax: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id?: string | null;
          company_id?: string | null;
          contact_id?: string | null;
          name: string;
          value?: number;
          currency?: string;
          probability?: number;
          stage_id?: string | null;
          pipeline?: string | null;
          status?: Database["public"]["Enums"]["deal_status"];
          close_date?: string | null;
          owner_id?: string | null;
          products_count?: number;
          discount?: number;
          tax?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string | null;
          company_id?: string | null;
          contact_id?: string | null;
          name?: string;
          value?: number;
          currency?: string;
          probability?: number;
          stage_id?: string | null;
          pipeline?: string | null;
          status?: Database["public"]["Enums"]["deal_status"];
          close_date?: string | null;
          owner_id?: string | null;
          products_count?: number;
          discount?: number;
          tax?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lead_activities: {
        Row: {
          id: string;
          lead_id: string;
          type: string;
          content: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          type: string;
          content: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          type?: string;
          content?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          priority: Database["public"]["Enums"]["priority_level"];
          status: Database["public"]["Enums"]["task_status"];
          due_date: string | null;
          progress: number;
          assignee_id: string | null;
          created_by: string | null;
          lead_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          priority?: Database["public"]["Enums"]["priority_level"];
          status?: Database["public"]["Enums"]["task_status"];
          due_date?: string | null;
          progress?: number;
          assignee_id?: string | null;
          created_by?: string | null;
          lead_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          priority?: Database["public"]["Enums"]["priority_level"];
          status?: Database["public"]["Enums"]["task_status"];
          due_date?: string | null;
          progress?: number;
          assignee_id?: string | null;
          created_by?: string | null;
          lead_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      task_comments: {
        Row: {
          id: string;
          task_id: string;
          author_id: string | null;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          author_id?: string | null;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          author_id?: string | null;
          content?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string | null;
          type: string;
          title: string;
          body: string | null;
          link: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          type?: string;
          title: string;
          body?: string | null;
          link?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          type?: string;
          title?: string;
          body?: string | null;
          link?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          meta: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          meta?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          meta?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      integration_settings: {
        Row: {
          key: string;
          enabled: boolean;
          config: Json;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          enabled?: boolean;
          config?: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          enabled?: boolean;
          config?: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["app_role"];
      };
      is_admin_or_manager: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "super_admin" | "manager" | "rep";
      priority_level: "Urgent" | "High" | "Normal" | "Low";
      lead_temperature: "Hot" | "Warm" | "Cold";
      task_status: "Todo" | "In progress" | "Review" | "Done";
      deal_status: "open" | "won" | "lost";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "manager", "rep"],
      priority_level: ["Urgent", "High", "Normal", "Low"],
      lead_temperature: ["Hot", "Warm", "Cold"],
      task_status: ["Todo", "In progress", "Review", "Done"],
      deal_status: ["open", "won", "lost"],
    },
  },
} as const;
