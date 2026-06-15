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
          approval_status: "pending" | "approved" | "rejected";
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
          approval_status?: "pending" | "approved" | "rejected";
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
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          duration_minutes: number;
          price_cents: number;
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
        };
        Insert: {
          id?: string;
          barber_id: string;
          weekday: number;
          opens_at: string;
          closes_at: string;
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
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: "client" | "admin";
      approval_status: "pending" | "approved" | "rejected";
      request_status: "pending" | "proposed" | "confirmed" | "declined" | "cancelled";
      proposal_status: "sent" | "accepted" | "declined" | "expired";
      notification_channel: "email" | "sms";
      day_window: "Morning" | "Midday" | "Afternoon" | "Evening";
    };
    CompositeTypes: Record<string, never>;
  };
};
