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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      api_usage: {
        Row: {
          created_at: string
          function_name: string
          id: string
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          function_name: string
          id?: string
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          function_name?: string
          id?: string
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          applied_at: string | null
          created_at: string | null
          email_sent: boolean | null
          email_sent_at: string | null
          id: string
          job_id: string
          referral_contacts: string[] | null
          referral_email: string | null
          status: Database["public"]["Enums"]["application_status"] | null
          tailored_cover_letter: string | null
          tailored_resume: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          created_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          job_id: string
          referral_contacts?: string[] | null
          referral_email?: string | null
          status?: Database["public"]["Enums"]["application_status"] | null
          tailored_cover_letter?: string | null
          tailored_resume?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string | null
          created_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          job_id?: string
          referral_contacts?: string[] | null
          referral_email?: string | null
          status?: Database["public"]["Enums"]["application_status"] | null
          tailored_cover_letter?: string | null
          tailored_resume?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_settings: {
        Row: {
          api_delay_ms: number | null
          apply_within_minutes: number | null
          auto_apply_enabled: boolean | null
          background_apply_count: number | null
          background_apply_enabled: boolean | null
          created_at: string | null
          id: string
          min_match_score: number | null
          openai_tier: string | null
          platforms: string[] | null
          send_referral_emails: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          api_delay_ms?: number | null
          apply_within_minutes?: number | null
          auto_apply_enabled?: boolean | null
          background_apply_count?: number | null
          background_apply_enabled?: boolean | null
          created_at?: string | null
          id?: string
          min_match_score?: number | null
          openai_tier?: string | null
          platforms?: string[] | null
          send_referral_emails?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          api_delay_ms?: number | null
          apply_within_minutes?: number | null
          auto_apply_enabled?: boolean | null
          background_apply_count?: number | null
          background_apply_enabled?: boolean | null
          created_at?: string | null
          id?: string
          min_match_score?: number | null
          openai_tier?: string | null
          platforms?: string[] | null
          send_referral_emails?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      broken_link_reports: {
        Row: {
          created_at: string
          id: string
          job_id: string | null
          report_reason: string | null
          status: string
          updated_at: string
          url: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          job_id?: string | null
          report_reason?: string | null
          status?: string
          updated_at?: string
          url: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string | null
          report_reason?: string | null
          status?: string
          updated_at?: string
          url?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broken_link_reports_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      email_detections: {
        Row: {
          application_id: string | null
          created_at: string | null
          detected_at: string | null
          detection_type: Database["public"]["Enums"]["email_detection_type"]
          email_body: string | null
          email_from: string
          email_subject: string
          id: string
          is_read: boolean | null
          user_id: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string | null
          detected_at?: string | null
          detection_type: Database["public"]["Enums"]["email_detection_type"]
          email_body?: string | null
          email_from: string
          email_subject: string
          id?: string
          is_read?: boolean | null
          user_id: string
        }
        Update: {
          application_id?: string | null
          created_at?: string | null
          detected_at?: string | null
          detection_type?: Database["public"]["Enums"]["email_detection_type"]
          email_body?: string | null
          email_from?: string
          email_subject?: string
          id?: string
          is_read?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_detections_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      email_integrations: {
        Row: {
          access_token: string | null
          created_at: string | null
          email: string
          id: string
          is_connected: boolean | null
          refresh_token: string | null
          token_expiry: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          email: string
          id?: string
          is_connected?: boolean | null
          refresh_token?: string | null
          token_expiry?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          email?: string
          id?: string
          is_connected?: boolean | null
          refresh_token?: string | null
          token_expiry?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          applied_at: string | null
          company: string
          created_at: string | null
          description: string | null
          id: string
          location: string
          match_score: number | null
          platform: string | null
          posted_date: string | null
          report_count: number | null
          requirements: string[] | null
          salary: string | null
          status: Database["public"]["Enums"]["application_status"] | null
          title: string
          updated_at: string | null
          url: string | null
          url_last_checked: string | null
          url_status: string | null
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          company: string
          created_at?: string | null
          description?: string | null
          id?: string
          location: string
          match_score?: number | null
          platform?: string | null
          posted_date?: string | null
          report_count?: number | null
          requirements?: string[] | null
          salary?: string | null
          status?: Database["public"]["Enums"]["application_status"] | null
          title: string
          updated_at?: string | null
          url?: string | null
          url_last_checked?: string | null
          url_status?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string | null
          company?: string
          created_at?: string | null
          description?: string | null
          id?: string
          location?: string
          match_score?: number | null
          platform?: string | null
          posted_date?: string | null
          report_count?: number | null
          requirements?: string[] | null
          salary?: string | null
          status?: Database["public"]["Enums"]["application_status"] | null
          title?: string
          updated_at?: string | null
          url?: string | null
          url_last_checked?: string | null
          url_status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      keyword_monitors: {
        Row: {
          auto_apply: boolean | null
          created_at: string | null
          enabled: boolean | null
          id: string
          keywords: string[]
          locations: string[] | null
          min_match_score: number | null
          name: string
          roles: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_apply?: boolean | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          keywords: string[]
          locations?: string[] | null
          min_match_score?: number | null
          name: string
          roles?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_apply?: boolean | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          keywords?: string[]
          locations?: string[] | null
          min_match_score?: number | null
          name?: string
          roles?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          achievements: Json | null
          address: string | null
          ats_strategy: string | null
          authorized_countries: string[] | null
          certifications: string[] | null
          citizenship: string | null
          city: string | null
          country: string | null
          cover_letter: string | null
          created_at: string | null
          current_salary: string | null
          cv_file_name: string | null
          cv_file_path: string | null
          cv_uploaded_at: string | null
          disability: boolean | null
          driving_license: boolean | null
          education: Json | null
          email: string | null
          excluded_companies: string[] | null
          expected_salary: string | null
          first_name: string | null
          gender: string | null
          github: string | null
          highest_education: string | null
          hispanic_latino: boolean | null
          id: string
          languages: Json | null
          last_name: string | null
          learned_preferences: Json | null
          linkedin: string | null
          notice_period: string | null
          openai_api_key: string | null
          phone: string | null
          portfolio: string | null
          race_ethnicity: string | null
          security_clearance: boolean | null
          skills: Json | null
          state: string | null
          total_experience: string | null
          updated_at: string | null
          user_id: string
          veteran_status: boolean | null
          visa_required: boolean | null
          willing_to_relocate: boolean | null
          work_experience: Json | null
          zip_code: string | null
        }
        Insert: {
          achievements?: Json | null
          address?: string | null
          ats_strategy?: string | null
          authorized_countries?: string[] | null
          certifications?: string[] | null
          citizenship?: string | null
          city?: string | null
          country?: string | null
          cover_letter?: string | null
          created_at?: string | null
          current_salary?: string | null
          cv_file_name?: string | null
          cv_file_path?: string | null
          cv_uploaded_at?: string | null
          disability?: boolean | null
          driving_license?: boolean | null
          education?: Json | null
          email?: string | null
          excluded_companies?: string[] | null
          expected_salary?: string | null
          first_name?: string | null
          gender?: string | null
          github?: string | null
          highest_education?: string | null
          hispanic_latino?: boolean | null
          id?: string
          languages?: Json | null
          last_name?: string | null
          learned_preferences?: Json | null
          linkedin?: string | null
          notice_period?: string | null
          openai_api_key?: string | null
          phone?: string | null
          portfolio?: string | null
          race_ethnicity?: string | null
          security_clearance?: boolean | null
          skills?: Json | null
          state?: string | null
          total_experience?: string | null
          updated_at?: string | null
          user_id: string
          veteran_status?: boolean | null
          visa_required?: boolean | null
          willing_to_relocate?: boolean | null
          work_experience?: Json | null
          zip_code?: string | null
        }
        Update: {
          achievements?: Json | null
          address?: string | null
          ats_strategy?: string | null
          authorized_countries?: string[] | null
          certifications?: string[] | null
          citizenship?: string | null
          city?: string | null
          country?: string | null
          cover_letter?: string | null
          created_at?: string | null
          current_salary?: string | null
          cv_file_name?: string | null
          cv_file_path?: string | null
          cv_uploaded_at?: string | null
          disability?: boolean | null
          driving_license?: boolean | null
          education?: Json | null
          email?: string | null
          excluded_companies?: string[] | null
          expected_salary?: string | null
          first_name?: string | null
          gender?: string | null
          github?: string | null
          highest_education?: string | null
          hispanic_latino?: boolean | null
          id?: string
          languages?: Json | null
          last_name?: string | null
          learned_preferences?: Json | null
          linkedin?: string | null
          notice_period?: string | null
          openai_api_key?: string | null
          phone?: string | null
          portfolio?: string | null
          race_ethnicity?: string | null
          security_clearance?: boolean | null
          skills?: Json | null
          state?: string | null
          total_experience?: string | null
          updated_at?: string | null
          user_id?: string
          veteran_status?: boolean | null
          visa_required?: boolean | null
          willing_to_relocate?: boolean | null
          work_experience?: Json | null
          zip_code?: string | null
        }
        Relationships: []
      }
      sent_emails: {
        Row: {
          application_id: string | null
          body: string
          created_at: string | null
          delivered: boolean | null
          email_type: Database["public"]["Enums"]["email_type"]
          id: string
          recipient: string
          sent_at: string | null
          subject: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          body: string
          created_at?: string | null
          delivered?: boolean | null
          email_type: Database["public"]["Enums"]["email_type"]
          id?: string
          recipient: string
          sent_at?: string | null
          subject: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          body?: string
          created_at?: string | null
          delivered?: boolean | null
          email_type?: Database["public"]["Enums"]["email_type"]
          id?: string
          recipient?: string
          sent_at?: string | null
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_emails_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      user_memories: {
        Row: {
          answer: Json
          ats_score: number | null
          confidence: string
          context: Json | null
          created_at: string
          id: string
          last_used_at: string
          query_hash: string
          question_keywords: string[]
          question_normalized: string
          updated_at: string
          used_count: number
          user_id: string
        }
        Insert: {
          answer: Json
          ats_score?: number | null
          confidence?: string
          context?: Json | null
          created_at?: string
          id?: string
          last_used_at?: string
          query_hash: string
          question_keywords?: string[]
          question_normalized: string
          updated_at?: string
          used_count?: number
          user_id: string
        }
        Update: {
          answer?: Json
          ats_score?: number | null
          confidence?: string
          context?: Json | null
          created_at?: string
          id?: string
          last_used_at?: string
          query_hash?: string
          question_keywords?: string[]
          question_normalized?: string
          updated_at?: string
          used_count?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      application_status:
        | "pending"
        | "applied"
        | "interviewing"
        | "offered"
        | "rejected"
      email_detection_type: "interview" | "rejection" | "offer" | "follow_up"
      email_type: "application" | "referral" | "follow_up"
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
      application_status: [
        "pending",
        "applied",
        "interviewing",
        "offered",
        "rejected",
      ],
      email_detection_type: ["interview", "rejection", "offer", "follow_up"],
      email_type: ["application", "referral", "follow_up"],
    },
  },
} as const
