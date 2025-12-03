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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      auth_attempts: {
        Row: {
          attempt_type: string
          created_at: string | null
          email: string
          id: string
          session_id: string | null
          success: boolean | null
          user_info: Json | null
        }
        Insert: {
          attempt_type: string
          created_at?: string | null
          email: string
          id?: string
          session_id?: string | null
          success?: boolean | null
          user_info?: Json | null
        }
        Update: {
          attempt_type?: string
          created_at?: string | null
          email?: string
          id?: string
          session_id?: string | null
          success?: boolean | null
          user_info?: Json | null
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          encrypted_color: string | null
          encrypted_created_at: string
          encrypted_date: string
          encrypted_description: string | null
          encrypted_end_time: string | null
          encrypted_repeat_days: string | null
          encrypted_time: string
          encrypted_title: string
          id: string
          pseudonym_id: string
        }
        Insert: {
          encrypted_color?: string | null
          encrypted_created_at: string
          encrypted_date: string
          encrypted_description?: string | null
          encrypted_end_time?: string | null
          encrypted_repeat_days?: string | null
          encrypted_time: string
          encrypted_title: string
          id?: string
          pseudonym_id: string
        }
        Update: {
          encrypted_color?: string | null
          encrypted_created_at?: string
          encrypted_date?: string
          encrypted_description?: string | null
          encrypted_end_time?: string | null
          encrypted_repeat_days?: string | null
          encrypted_time?: string
          encrypted_title?: string
          id?: string
          pseudonym_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_pseudonym_id_fkey"
            columns: ["pseudonym_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["pseudonym_id"]
          },
        ]
      }
      checklist_reminders: {
        Row: {
          checklist_id: string
          encrypted_completed: string
          encrypted_created_at: string
          encrypted_text: string
          id: string
          source_date: string | null
          source_id: string | null
          source_type: string | null
        }
        Insert: {
          checklist_id: string
          encrypted_completed: string
          encrypted_created_at: string
          encrypted_text: string
          id?: string
          source_date?: string | null
          source_id?: string | null
          source_type?: string | null
        }
        Update: {
          checklist_id?: string
          encrypted_completed?: string
          encrypted_created_at?: string
          encrypted_text?: string
          id?: string
          source_date?: string | null
          source_id?: string | null
          source_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_reminders_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          encrypted_created_at: string
          encrypted_name: string
          id: string
          pseudonym_id: string
        }
        Insert: {
          encrypted_created_at: string
          encrypted_name: string
          id?: string
          pseudonym_id: string
        }
        Update: {
          encrypted_created_at?: string
          encrypted_name?: string
          id?: string
          pseudonym_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_pseudonym_id_fkey"
            columns: ["pseudonym_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["pseudonym_id"]
          },
        ]
      }
      chores: {
        Row: {
          encrypted_created_at: string
          encrypted_name: string
          encrypted_period: string
          encrypted_updated_at: string
          id: string
          pseudonym_id: string
        }
        Insert: {
          encrypted_created_at: string
          encrypted_name: string
          encrypted_period: string
          encrypted_updated_at: string
          id?: string
          pseudonym_id: string
        }
        Update: {
          encrypted_created_at?: string
          encrypted_name?: string
          encrypted_period?: string
          encrypted_updated_at?: string
          id?: string
          pseudonym_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chores_pseudonym_id_fkey"
            columns: ["pseudonym_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["pseudonym_id"]
          },
        ]
      }
      failed_auth_attempts: {
        Row: {
          attempt_time: string
          email: string
          id: string
          ip_address: string | null
          navigator_data: Json | null
          reason: string | null
          user_agent: string | null
        }
        Insert: {
          attempt_time?: string
          email: string
          id?: string
          ip_address?: string | null
          navigator_data?: Json | null
          reason?: string | null
          user_agent?: string | null
        }
        Update: {
          attempt_time?: string
          email?: string
          id?: string
          ip_address?: string | null
          navigator_data?: Json | null
          reason?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      focus_monitoring: {
        Row: {
          created_at: string
          encrypted_field_name: string
          encrypted_focus_duration: string
          encrypted_timestamp: string
          id: string
          pseudonym_id: string
        }
        Insert: {
          created_at?: string
          encrypted_field_name: string
          encrypted_focus_duration: string
          encrypted_timestamp: string
          id?: string
          pseudonym_id: string
        }
        Update: {
          created_at?: string
          encrypted_field_name?: string
          encrypted_focus_duration?: string
          encrypted_timestamp?: string
          id?: string
          pseudonym_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_monitoring_pseudonym_id_fkey"
            columns: ["pseudonym_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["pseudonym_id"]
          },
        ]
      }
      fraud_audit_log: {
        Row: {
          chain_position: number
          created_at: string | null
          entry_hash: string
          entry_type: string
          id: string
          ip_hash: string | null
          new_data: Json | null
          old_data: Json | null
          operation: string
          previous_hash: string | null
          record_id: string | null
          session_id: string | null
          table_name: string
        }
        Insert: {
          chain_position: number
          created_at?: string | null
          entry_hash: string
          entry_type: string
          id?: string
          ip_hash?: string | null
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          previous_hash?: string | null
          record_id?: string | null
          session_id?: string | null
          table_name: string
        }
        Update: {
          chain_position?: number
          created_at?: string | null
          entry_hash?: string
          entry_type?: string
          id?: string
          ip_hash?: string | null
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          previous_hash?: string | null
          record_id?: string | null
          session_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          encrypted_email: string | null
          id: string
          pseudonym_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          encrypted_email?: string | null
          id?: string
          pseudonym_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          encrypted_email?: string | null
          id?: string
          pseudonym_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      request_nonces: {
        Row: {
          actual_response_time: string | null
          created_at: string | null
          expected_response_time: string | null
          id: string
          ip_hash: string | null
          nonce: string
          session_id: string | null
          timing_valid: boolean | null
        }
        Insert: {
          actual_response_time?: string | null
          created_at?: string | null
          expected_response_time?: string | null
          id?: string
          ip_hash?: string | null
          nonce: string
          session_id?: string | null
          timing_valid?: boolean | null
        }
        Update: {
          actual_response_time?: string | null
          created_at?: string | null
          expected_response_time?: string | null
          id?: string
          ip_hash?: string | null
          nonce?: string
          session_id?: string | null
          timing_valid?: boolean | null
        }
        Relationships: []
      }
      response_timing_data: {
        Row: {
          anomaly_reason: string | null
          connection_type: string | null
          created_at: string | null
          downlink_estimate: number | null
          effective_type: string | null
          endpoint_category: string | null
          http_status: number | null
          id: string
          is_anomalous: boolean | null
          request_type: string | null
          response_duration_ms: number | null
          rtt_estimate: number | null
        }
        Insert: {
          anomaly_reason?: string | null
          connection_type?: string | null
          created_at?: string | null
          downlink_estimate?: number | null
          effective_type?: string | null
          endpoint_category?: string | null
          http_status?: number | null
          id?: string
          is_anomalous?: boolean | null
          request_type?: string | null
          response_duration_ms?: number | null
          rtt_estimate?: number | null
        }
        Update: {
          anomaly_reason?: string | null
          connection_type?: string | null
          created_at?: string | null
          downlink_estimate?: number | null
          effective_type?: string | null
          endpoint_category?: string | null
          http_status?: number | null
          id?: string
          is_anomalous?: boolean | null
          request_type?: string | null
          response_duration_ms?: number | null
          rtt_estimate?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          encrypted_created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          encrypted_created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          encrypted_created_at?: string | null
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
      add_audit_entry: {
        Args: {
          p_entry_type: string
          p_ip_hash?: string
          p_new_data?: Json
          p_old_data?: Json
          p_operation: string
          p_record_id: string
          p_session_id?: string
          p_table_name: string
        }
        Returns: string
      }
      check_bulk_operation_alert: {
        Args: never
        Returns: {
          alert_type: string
          ip_hash: string
          operation_count: number
          session_id: string
          time_window_seconds: number
        }[]
      }
      compute_audit_hash: {
        Args: {
          p_chain_position: number
          p_entry_type: string
          p_new_data: Json
          p_old_data: Json
          p_operation: string
          p_previous_hash: string
          p_record_id: string
          p_table_name: string
          p_timestamp: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      verify_audit_chain_integrity: {
        Args: never
        Returns: {
          actual_hash: string
          broken_at_position: number
          expected_hash: string
          is_valid: boolean
          total_entries: number
        }[]
      }
    }
    Enums: {
      app_role: "user" | "admin"
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
      app_role: ["user", "admin"],
    },
  },
} as const
