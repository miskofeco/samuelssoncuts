export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: "client" | "admin";
          approval_status: "pending" | "approved" | "rejected" | "blocked";
          full_name: string;
          email: string;
          phone: string | null;
          avatar_url: string | null;
          calendar_token: string;
          email_confirmed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: "client" | "admin";
          approval_status?: "pending" | "approved" | "rejected" | "blocked";
          full_name: string;
          email: string;
          phone?: string | null;
          avatar_url?: string | null;
          calendar_token?: string;
          email_confirmed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          duration_minutes: number;
          price_cents: number;
          image_url: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          duration_minutes: number;
          price_cents: number;
          image_url?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["services"]["Insert"]>;
        Relationships: [];
      };
      business_hours: {
        Row: {
          id: string;
          barber_id: string;
          weekday: number;
          opens_at: string;
          closes_at: string;
          closed: boolean;
        };
        Insert: {
          id?: string;
          barber_id: string;
          weekday: number;
          opens_at: string;
          closes_at: string;
          closed?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["business_hours"]["Insert"]>;
        Relationships: [];
      };
      blocked_times: {
        Row: {
          id: string;
          barber_id: string;
          starts_at: string;
          ends_at: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          barber_id: string;
          starts_at: string;
          ends_at: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["blocked_times"]["Insert"]>;
        Relationships: [];
      };
      cookie_consents: {
        Row: {
          id: string;
          user_id: string;
          necessary: boolean;
          functional: boolean;
          analytics: boolean;
          marketing: boolean;
          policy_version: number;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          necessary?: boolean;
          functional?: boolean;
          analytics?: boolean;
          marketing?: boolean;
          policy_version: number;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cookie_consents"]["Insert"]>;
        Relationships: [];
      };
      booking_requests: {
        Row: {
          id: string;
          client_id: string;
          service_id: string;
          note: string | null;
          status: "pending" | "proposed" | "confirmed" | "declined" | "cancelled";
          selected_proposal_id: string | null;
          requested_start: string | null;
          requested_end: string | null;
          price_cents: number | null;
          surcharge: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          service_id: string;
          note?: string | null;
          status?: "pending" | "proposed" | "confirmed" | "declined" | "cancelled";
          selected_proposal_id?: string | null;
          requested_start?: string | null;
          requested_end?: string | null;
          price_cents?: number | null;
          surcharge?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["booking_requests"]["Insert"]>;
        Relationships: [];
      };
      booking_preferences: {
        Row: {
          id: string;
          request_id: string;
          rank: number;
          preferred_date: string;
          day_window: "Morning" | "Midday" | "Afternoon" | "Evening";
        };
        Insert: {
          id?: string;
          request_id: string;
          rank: number;
          preferred_date: string;
          day_window: "Morning" | "Midday" | "Afternoon" | "Evening";
        };
        Update: Partial<Database["public"]["Tables"]["booking_preferences"]["Insert"]>;
        Relationships: [];
      };
      appointment_proposals: {
        Row: {
          id: string;
          request_id: string;
          barber_id: string;
          starts_at: string;
          ends_at: string;
          note: string | null;
          status: "sent" | "accepted" | "declined" | "expired";
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          barber_id: string;
          starts_at: string;
          ends_at: string;
          note?: string | null;
          status?: "sent" | "accepted" | "declined" | "expired";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["appointment_proposals"]["Insert"]>;
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          request_id: string | null;
          proposal_id: string | null;
          client_id: string | null;
          customer_name: string | null;
          barber_id: string;
          service_id: string;
          starts_at: string;
          ends_at: string;
          status: string;
          reminded_at: string | null;
          outcome: "completed" | "no_show" | "cancelled" | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id?: string | null;
          proposal_id?: string | null;
          client_id?: string | null;
          customer_name?: string | null;
          barber_id: string;
          service_id: string;
          starts_at: string;
          ends_at: string;
          status?: string;
          reminded_at?: string | null;
          outcome?: "completed" | "no_show" | "cancelled" | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["appointments"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string | null;
          channel: "email" | "sms";
          recipient: string;
          subject: string;
          body: string | null;
          provider_message_id: string | null;
          sent_at: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          channel: "email" | "sms";
          recipient: string;
          subject: string;
          body?: string | null;
          provider_message_id?: string | null;
          sent_at?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };
      rate_limits: {
        Row: {
          key: string;
          count: number;
          reset_at: string;
        };
        Insert: {
          key: string;
          count?: number;
          reset_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["rate_limits"]["Insert"]>;
        Relationships: [];
      };
      admin_audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          detail: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          target_type?: string | null;
          target_id?: string | null;
          detail?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["admin_audit_log"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      phone_taken: {
        Args: { p_phone: string };
        Returns: boolean;
      };
      check_rate_limit: {
        Args: {
          p_key: string;
          p_limit: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      record_admin_action: {
        Args: {
          p_action: string;
          p_target_type?: string | null;
          p_target_id?: string | null;
          p_detail?: Json;
        };
        Returns: string;
      };
      confirmed_appointment_slots: {
        Args: Record<string, never>;
        Returns: Array<{
          starts_at: string;
          ends_at: string;
          service_id: string;
        }>;
      };
      has_confirmed_appointment_overlap: {
        Args: {
          p_barber_id: string | null;
          p_start: string;
          p_end: string;
          p_exclude_appointment_id: string | null;
        };
        Returns: boolean;
      };
      confirm_booking_request: {
        Args: {
          p_request_id: string;
          p_barber_id: string;
        };
        Returns: string;
      };
      respond_to_appointment_proposal: {
        Args: {
          p_proposal_id: string;
          p_client_id: string;
          p_accepted: boolean;
        };
        Returns: string | null;
      };
      calendar_feed: {
        Args: { p_token: string };
        Returns: Array<{
          id: string;
          starts_at: string;
          ends_at: string;
          service_name: string;
          customer: string;
        }>;
      };
      client_cancel_confirmed_appointment: {
        Args: { p_appointment_id: string };
        Returns: string | null;
      };
      client_request_reschedule: {
        Args: {
          p_appointment_id: string;
          p_new_start: string;
        };
        Returns: string;
      };
    };
    Enums: {
      user_role: "client" | "admin";
      approval_status: "pending" | "approved" | "rejected" | "blocked";
      request_status: "pending" | "proposed" | "confirmed" | "declined" | "cancelled";
      proposal_status: "sent" | "accepted" | "declined" | "expired";
      notification_channel: "email" | "sms";
      day_window: "Morning" | "Midday" | "Afternoon" | "Evening";
      appointment_outcome: "completed" | "no_show" | "cancelled";
    };
    CompositeTypes: Record<string, never>;
  };
};
