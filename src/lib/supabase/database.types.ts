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
      abstract_authors: {
        Row: {
          abstract_id: string
          affiliation: string | null
          author_order: number | null
          created_at: string | null
          email: string | null
          id: string
          is_presenting: boolean | null
          name: string
        }
        Insert: {
          abstract_id: string
          affiliation?: string | null
          author_order?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_presenting?: boolean | null
          name: string
        }
        Update: {
          abstract_id?: string
          affiliation?: string | null
          author_order?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_presenting?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "abstract_authors_abstract_id_fkey"
            columns: ["abstract_id"]
            isOneToOne: false
            referencedRelation: "abstracts"
            referencedColumns: ["id"]
          },
        ]
      }
      abstract_categories: {
        Row: {
          allowed_file_types: string[] | null
          award_name: string | null
          created_at: string | null
          declarations: Json | null
          description: string | null
          eligibility_rules: Json | null
          event_id: string
          id: string
          is_active: boolean | null
          is_award_category: boolean | null
          keywords: string[] | null
          max_submissions: number | null
          name: string
          required_file: boolean | null
          scoring_criteria: Json | null
          sort_order: number | null
          specialty_track: string | null
          submission_instructions: string | null
          submission_type: string | null
          updated_at: string | null
        }
        Insert: {
          allowed_file_types?: string[] | null
          award_name?: string | null
          created_at?: string | null
          declarations?: Json | null
          description?: string | null
          eligibility_rules?: Json | null
          event_id: string
          id?: string
          is_active?: boolean | null
          is_award_category?: boolean | null
          keywords?: string[] | null
          max_submissions?: number | null
          name: string
          required_file?: boolean | null
          scoring_criteria?: Json | null
          sort_order?: number | null
          specialty_track?: string | null
          submission_instructions?: string | null
          submission_type?: string | null
          updated_at?: string | null
        }
        Update: {
          allowed_file_types?: string[] | null
          award_name?: string | null
          created_at?: string | null
          declarations?: Json | null
          description?: string | null
          eligibility_rules?: Json | null
          event_id?: string
          id?: string
          is_active?: boolean | null
          is_award_category?: boolean | null
          keywords?: string[] | null
          max_submissions?: number | null
          name?: string
          required_file?: boolean | null
          scoring_criteria?: Json | null
          sort_order?: number | null
          specialty_track?: string | null
          submission_instructions?: string | null
          submission_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abstract_categories_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      abstract_committee_decisions: {
        Row: {
          abstract_id: string
          decided_at: string
          decided_by: string | null
          decided_by_email: string | null
          decided_by_name: string
          decision: string
          feedback_to_author: string | null
          id: string
          is_override: boolean
          notes: string | null
          override_reason: string | null
          rejection_reason: string | null
          review_round: number
          second_review_instructions: string | null
          second_review_reason: string | null
        }
        Insert: {
          abstract_id: string
          decided_at?: string
          decided_by?: string | null
          decided_by_email?: string | null
          decided_by_name: string
          decision: string
          feedback_to_author?: string | null
          id?: string
          is_override?: boolean
          notes?: string | null
          override_reason?: string | null
          rejection_reason?: string | null
          review_round?: number
          second_review_instructions?: string | null
          second_review_reason?: string | null
        }
        Update: {
          abstract_id?: string
          decided_at?: string
          decided_by?: string | null
          decided_by_email?: string | null
          decided_by_name?: string
          decision?: string
          feedback_to_author?: string | null
          id?: string
          is_override?: boolean
          notes?: string | null
          override_reason?: string | null
          rejection_reason?: string | null
          review_round?: number
          second_review_instructions?: string | null
          second_review_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abstract_committee_decisions_abstract_id_fkey"
            columns: ["abstract_id"]
            isOneToOne: false
            referencedRelation: "abstracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abstract_committee_decisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      abstract_drafts: {
        Row: {
          created_at: string | null
          draft_data: Json
          event_id: string
          expires_at: string | null
          id: string
          last_saved_at: string | null
          user_email: string
        }
        Insert: {
          created_at?: string | null
          draft_data: Json
          event_id: string
          expires_at?: string | null
          id?: string
          last_saved_at?: string | null
          user_email: string
        }
        Update: {
          created_at?: string | null
          draft_data?: Json
          event_id?: string
          expires_at?: string | null
          id?: string
          last_saved_at?: string | null
          user_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "abstract_drafts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      abstract_notifications: {
        Row: {
          abstract_id: string
          body_preview: string | null
          created_at: string | null
          delivered_at: string | null
          delivery_status: string | null
          id: string
          metadata: Json | null
          notification_type: string
          opened_at: string | null
          recipient_email: string
          recipient_name: string | null
          sent_at: string | null
          sent_by: string | null
          subject: string | null
        }
        Insert: {
          abstract_id: string
          body_preview?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_status?: string | null
          id?: string
          metadata?: Json | null
          notification_type: string
          opened_at?: string | null
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string | null
          sent_by?: string | null
          subject?: string | null
        }
        Update: {
          abstract_id?: string
          body_preview?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_status?: string | null
          id?: string
          metadata?: Json | null
          notification_type?: string
          opened_at?: string | null
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string | null
          sent_by?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abstract_notifications_abstract_id_fkey"
            columns: ["abstract_id"]
            isOneToOne: false
            referencedRelation: "abstracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abstract_notifications_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      abstract_presentation_slots: {
        Row: {
          abstract_id: string
          confirmed_at: string | null
          created_at: string | null
          duration_minutes: number | null
          end_time: string
          event_id: string
          hall_name: string | null
          id: string
          is_confirmed: boolean | null
          poster_board_number: string | null
          poster_zone: string | null
          presentation_date: string
          presentation_type: string
          room_number: string | null
          session_id: string | null
          slot_order: number | null
          start_time: string
          updated_at: string | null
        }
        Insert: {
          abstract_id: string
          confirmed_at?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          end_time: string
          event_id: string
          hall_name?: string | null
          id?: string
          is_confirmed?: boolean | null
          poster_board_number?: string | null
          poster_zone?: string | null
          presentation_date: string
          presentation_type: string
          room_number?: string | null
          session_id?: string | null
          slot_order?: number | null
          start_time: string
          updated_at?: string | null
        }
        Update: {
          abstract_id?: string
          confirmed_at?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          end_time?: string
          event_id?: string
          hall_name?: string | null
          id?: string
          is_confirmed?: boolean | null
          poster_board_number?: string | null
          poster_zone?: string | null
          presentation_date?: string
          presentation_type?: string
          room_number?: string | null
          session_id?: string | null
          slot_order?: number | null
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abstract_presentation_slots_abstract_id_fkey"
            columns: ["abstract_id"]
            isOneToOne: true
            referencedRelation: "abstracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abstract_presentation_slots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abstract_presentation_slots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      abstract_presenter_checkins: {
        Row: {
          abstract_id: string
          check_in_location: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          event_id: string
          id: string
          notes: string | null
          presentation_ended_at: string | null
          presentation_started_at: string | null
          presenter_email: string
          presenter_name: string | null
          registration_id: string | null
        }
        Insert: {
          abstract_id: string
          check_in_location?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          event_id: string
          id?: string
          notes?: string | null
          presentation_ended_at?: string | null
          presentation_started_at?: string | null
          presenter_email: string
          presenter_name?: string | null
          registration_id?: string | null
        }
        Update: {
          abstract_id?: string
          check_in_location?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          presentation_ended_at?: string | null
          presentation_started_at?: string | null
          presenter_email?: string
          presenter_name?: string | null
          registration_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abstract_presenter_checkins_abstract_id_fkey"
            columns: ["abstract_id"]
            isOneToOne: false
            referencedRelation: "abstracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abstract_presenter_checkins_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abstract_presenter_checkins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abstract_presenter_checkins_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      abstract_reminders: {
        Row: {
          abstract_id: string | null
          channel: string | null
          created_at: string | null
          delivery_status: string | null
          event_id: string
          id: string
          recipient_email: string
          recipient_name: string | null
          recipient_type: string
          reminder_type: string
          sent_at: string | null
        }
        Insert: {
          abstract_id?: string | null
          channel?: string | null
          created_at?: string | null
          delivery_status?: string | null
          event_id: string
          id?: string
          recipient_email: string
          recipient_name?: string | null
          recipient_type: string
          reminder_type: string
          sent_at?: string | null
        }
        Update: {
          abstract_id?: string | null
          channel?: string | null
          created_at?: string | null
          delivery_status?: string | null
          event_id?: string
          id?: string
          recipient_email?: string
          recipient_name?: string | null
          recipient_type?: string
          reminder_type?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abstract_reminders_abstract_id_fkey"
            columns: ["abstract_id"]
            isOneToOne: false
            referencedRelation: "abstracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abstract_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      abstract_review_assignments: {
        Row: {
          abstract_id: string
          assigned_at: string | null
          assigned_by: string | null
          completed_at: string | null
          declined_notes: string | null
          declined_reason: string | null
          due_date: string | null
          email_opened_at: string | null
          id: string
          last_reminder_at: string | null
          last_viewed_at: string | null
          reminder_count: number | null
          review_round: number | null
          reviewer_id: string
          status: string | null
          view_count: number | null
        }
        Insert: {
          abstract_id: string
          assigned_at?: string | null
          assigned_by?: string | null
          completed_at?: string | null
          declined_notes?: string | null
          declined_reason?: string | null
          due_date?: string | null
          email_opened_at?: string | null
          id?: string
          last_reminder_at?: string | null
          last_viewed_at?: string | null
          reminder_count?: number | null
          review_round?: number | null
          reviewer_id: string
          status?: string | null
          view_count?: number | null
        }
        Update: {
          abstract_id?: string
          assigned_at?: string | null
          assigned_by?: string | null
          completed_at?: string | null
          declined_notes?: string | null
          declined_reason?: string | null
          due_date?: string | null
          email_opened_at?: string | null
          id?: string
          last_reminder_at?: string | null
          last_viewed_at?: string | null
          reminder_count?: number | null
          review_round?: number | null
          reviewer_id?: string
          status?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "abstract_review_assignments_abstract_id_fkey"
            columns: ["abstract_id"]
            isOneToOne: false
            referencedRelation: "abstracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abstract_review_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abstract_review_assignments_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "abstract_reviewer_pool"
            referencedColumns: ["id"]
          },
        ]
      }
      abstract_reviewer_pool: {
        Row: {
          access_token: string | null
          avg_review_time_hours: number | null
          avg_score_given: number | null
          completed_reviews: number | null
          created_at: string | null
          current_assignments: number | null
          decline_count: number | null
          designation: string | null
          email: string
          event_id: string
          expertise_areas: string[] | null
          id: string
          institution: string | null
          last_email_sent_at: string | null
          last_login_at: string | null
          max_assignments: number | null
          name: string
          phone: string | null
          specialty: string | null
          status: string | null
          total_emails_opened: number | null
          total_emails_sent: number | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          avg_review_time_hours?: number | null
          avg_score_given?: number | null
          completed_reviews?: number | null
          created_at?: string | null
          current_assignments?: number | null
          decline_count?: number | null
          designation?: string | null
          email: string
          event_id: string
          expertise_areas?: string[] | null
          id?: string
          institution?: string | null
          last_email_sent_at?: string | null
          last_login_at?: string | null
          max_assignments?: number | null
          name: string
          phone?: string | null
          specialty?: string | null
          status?: string | null
          total_emails_opened?: number | null
          total_emails_sent?: number | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          avg_review_time_hours?: number | null
          avg_score_given?: number | null
          completed_reviews?: number | null
          created_at?: string | null
          current_assignments?: number | null
          decline_count?: number | null
          designation?: string | null
          email?: string
          event_id?: string
          expertise_areas?: string[] | null
          id?: string
          institution?: string | null
          last_email_sent_at?: string | null
          last_login_at?: string | null
          max_assignments?: number | null
          name?: string
          phone?: string | null
          specialty?: string | null
          status?: string | null
          total_emails_opened?: number | null
          total_emails_sent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abstract_reviewer_pool_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      abstract_reviewers: {
        Row: {
          assigned_abstracts: string[] | null
          city: string | null
          coi_declared: boolean | null
          coi_declared_at: string | null
          created_at: string | null
          email: string
          event_id: string
          id: string
          institution: string | null
          keywords: string[] | null
          max_assignments: number | null
          name: string
          notes: string | null
          phone: string | null
          specialties: string[] | null
          specialty: string | null
          status: string | null
          updated_at: string | null
          years_of_experience: string | null
        }
        Insert: {
          assigned_abstracts?: string[] | null
          city?: string | null
          coi_declared?: boolean | null
          coi_declared_at?: string | null
          created_at?: string | null
          email: string
          event_id: string
          id?: string
          institution?: string | null
          keywords?: string[] | null
          max_assignments?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          specialties?: string[] | null
          specialty?: string | null
          status?: string | null
          updated_at?: string | null
          years_of_experience?: string | null
        }
        Update: {
          assigned_abstracts?: string[] | null
          city?: string | null
          coi_declared?: boolean | null
          coi_declared_at?: string | null
          created_at?: string | null
          email?: string
          event_id?: string
          id?: string
          institution?: string | null
          keywords?: string[] | null
          max_assignments?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          specialties?: string[] | null
          specialty?: string | null
          status?: string | null
          updated_at?: string | null
          years_of_experience?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abstract_reviewers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      abstract_reviews: {
        Row: {
          abstract_id: string
          comments_private: string | null
          comments_to_author: string | null
          created_at: string | null
          id: string
          max_possible_score: number | null
          overall_score: number | null
          recommendation: string | null
          review_type: string | null
          reviewed_at: string | null
          reviewer_email: string | null
          reviewer_id: string | null
          reviewer_name: string | null
          score_clarity: number | null
          score_methodology: number | null
          score_originality: number | null
          score_relevance: number | null
          scores: Json | null
          total_score: number | null
          updated_at: string | null
        }
        Insert: {
          abstract_id: string
          comments_private?: string | null
          comments_to_author?: string | null
          created_at?: string | null
          id?: string
          max_possible_score?: number | null
          overall_score?: number | null
          recommendation?: string | null
          review_type?: string | null
          reviewed_at?: string | null
          reviewer_email?: string | null
          reviewer_id?: string | null
          reviewer_name?: string | null
          score_clarity?: number | null
          score_methodology?: number | null
          score_originality?: number | null
          score_relevance?: number | null
          scores?: Json | null
          total_score?: number | null
          updated_at?: string | null
        }
        Update: {
          abstract_id?: string
          comments_private?: string | null
          comments_to_author?: string | null
          created_at?: string | null
          id?: string
          max_possible_score?: number | null
          overall_score?: number | null
          recommendation?: string | null
          review_type?: string | null
          reviewed_at?: string | null
          reviewer_email?: string | null
          reviewer_id?: string | null
          reviewer_name?: string | null
          score_clarity?: number | null
          score_methodology?: number | null
          score_originality?: number | null
          score_relevance?: number | null
          scores?: Json | null
          total_score?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abstract_reviews_abstract_id_fkey"
            columns: ["abstract_id"]
            isOneToOne: false
            referencedRelation: "abstracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abstract_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      abstract_revisions: {
        Row: {
          abstract_id: string
          abstract_text: string
          created_at: string | null
          event_id: string
          file_name: string | null
          file_url: string | null
          id: string
          keywords: string[] | null
          revised_at: string | null
          title: string
          version_number: number
        }
        Insert: {
          abstract_id: string
          abstract_text: string
          created_at?: string | null
          event_id: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          keywords?: string[] | null
          revised_at?: string | null
          title: string
          version_number?: number
        }
        Update: {
          abstract_id?: string
          abstract_text?: string
          created_at?: string | null
          event_id?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          keywords?: string[] | null
          revised_at?: string | null
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "abstract_revisions_abstract_id_fkey"
            columns: ["abstract_id"]
            isOneToOne: false
            referencedRelation: "abstracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abstract_revisions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      abstract_settings: {
        Row: {
          allowed_file_types: string[] | null
          author_guidelines: string | null
          auto_reminders_enabled: boolean | null
          blind_review: boolean | null
          created_at: string | null
          enable_blind_review: boolean | null
          enable_reviewer_matching: boolean | null
          event_id: string
          last_reminder_sent_at: string | null
          max_authors: number | null
          max_file_size_mb: number | null
          max_submissions_per_person: number | null
          notification_date: string | null
          notify_on_decision: boolean | null
          notify_on_submission: boolean | null
          presentation_types: string[] | null
          reminder_days_before: number[] | null
          require_addon_id: string | null
          require_coi_declaration: boolean | null
          require_registration: boolean | null
          restrict_reviewers: boolean | null
          review_deadline: string | null
          review_enabled: boolean | null
          reviewers_per_abstract: number | null
          revision_deadline: string | null
          submission_deadline: string | null
          submission_guidelines: string | null
          submission_opens_at: string | null
          updated_at: string | null
          word_limit: number | null
        }
        Insert: {
          allowed_file_types?: string[] | null
          author_guidelines?: string | null
          auto_reminders_enabled?: boolean | null
          blind_review?: boolean | null
          created_at?: string | null
          enable_blind_review?: boolean | null
          enable_reviewer_matching?: boolean | null
          event_id: string
          last_reminder_sent_at?: string | null
          max_authors?: number | null
          max_file_size_mb?: number | null
          max_submissions_per_person?: number | null
          notification_date?: string | null
          notify_on_decision?: boolean | null
          notify_on_submission?: boolean | null
          presentation_types?: string[] | null
          reminder_days_before?: number[] | null
          require_addon_id?: string | null
          require_coi_declaration?: boolean | null
          require_registration?: boolean | null
          restrict_reviewers?: boolean | null
          review_deadline?: string | null
          review_enabled?: boolean | null
          reviewers_per_abstract?: number | null
          revision_deadline?: string | null
          submission_deadline?: string | null
          submission_guidelines?: string | null
          submission_opens_at?: string | null
          updated_at?: string | null
          word_limit?: number | null
        }
        Update: {
          allowed_file_types?: string[] | null
          author_guidelines?: string | null
          auto_reminders_enabled?: boolean | null
          blind_review?: boolean | null
          created_at?: string | null
          enable_blind_review?: boolean | null
          enable_reviewer_matching?: boolean | null
          event_id?: string
          last_reminder_sent_at?: string | null
          max_authors?: number | null
          max_file_size_mb?: number | null
          max_submissions_per_person?: number | null
          notification_date?: string | null
          notify_on_decision?: boolean | null
          notify_on_submission?: boolean | null
          presentation_types?: string[] | null
          reminder_days_before?: number[] | null
          require_addon_id?: string | null
          require_coi_declaration?: boolean | null
          require_registration?: boolean | null
          restrict_reviewers?: boolean | null
          review_deadline?: string | null
          review_enabled?: boolean | null
          reviewers_per_abstract?: number | null
          revision_deadline?: string | null
          submission_deadline?: string | null
          submission_guidelines?: string | null
          submission_opens_at?: string | null
          updated_at?: string | null
          word_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "abstract_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abstract_settings_require_addon_id_fkey"
            columns: ["require_addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
        ]
      }
      abstracts: {
        Row: {
          abstract_number: string | null
          abstract_text: string
          accepted_as: string | null
          amasi_membership_number: string | null
          award_rank: number | null
          award_type: string | null
          category_id: string | null
          committee_decision: string | null
          committee_decision_at: string | null
          committee_decision_by: string | null
          created_at: string | null
          decision_date: string | null
          decision_notes: string | null
          decision_notified_at: string | null
          declarations_accepted: Json | null
          event_id: string
          file_name: string | null
          file_path: string | null
          file_size: number | null
          file_url: string | null
          id: string
          is_podium_selected: boolean | null
          keywords: string[] | null
          last_revision_at: string | null
          podium_checkin_by: string | null
          podium_checkin_hall: string | null
          podium_checkin_notes: string | null
          presentation_completed: boolean | null
          presentation_completed_at: string | null
          presentation_name: string | null
          presentation_type: string | null
          presentation_uploaded_at: string | null
          presentation_url: string | null
          presenter_checked_in: boolean | null
          presenter_checked_in_at: string | null
          presenting_author_affiliation: string | null
          presenting_author_email: string
          presenting_author_name: string
          presenting_author_phone: string | null
          redirected_from_category_id: string | null
          registration_id: string | null
          registration_verified: boolean
          registration_verified_at: string | null
          review_round: number
          revision_count: number | null
          revision_notes: string | null
          schedule_email_sent: boolean | null
          schedule_email_sent_at: string | null
          second_review_reason: string | null
          session_date: string | null
          session_id: string | null
          session_location: string | null
          session_time: string | null
          status: string | null
          subject: string | null
          submitted_at: string | null
          submitter_metadata: Json | null
          title: string
          updated_at: string | null
          withdrawn_at: string | null
          withdrawn_reason: string | null
          workflow_stage: string | null
        }
        Insert: {
          abstract_number?: string | null
          abstract_text: string
          accepted_as?: string | null
          amasi_membership_number?: string | null
          award_rank?: number | null
          award_type?: string | null
          category_id?: string | null
          committee_decision?: string | null
          committee_decision_at?: string | null
          committee_decision_by?: string | null
          created_at?: string | null
          decision_date?: string | null
          decision_notes?: string | null
          decision_notified_at?: string | null
          declarations_accepted?: Json | null
          event_id: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_podium_selected?: boolean | null
          keywords?: string[] | null
          last_revision_at?: string | null
          podium_checkin_by?: string | null
          podium_checkin_hall?: string | null
          podium_checkin_notes?: string | null
          presentation_completed?: boolean | null
          presentation_completed_at?: string | null
          presentation_name?: string | null
          presentation_type?: string | null
          presentation_uploaded_at?: string | null
          presentation_url?: string | null
          presenter_checked_in?: boolean | null
          presenter_checked_in_at?: string | null
          presenting_author_affiliation?: string | null
          presenting_author_email: string
          presenting_author_name: string
          presenting_author_phone?: string | null
          redirected_from_category_id?: string | null
          registration_id?: string | null
          registration_verified?: boolean
          registration_verified_at?: string | null
          review_round?: number
          revision_count?: number | null
          revision_notes?: string | null
          schedule_email_sent?: boolean | null
          schedule_email_sent_at?: string | null
          second_review_reason?: string | null
          session_date?: string | null
          session_id?: string | null
          session_location?: string | null
          session_time?: string | null
          status?: string | null
          subject?: string | null
          submitted_at?: string | null
          submitter_metadata?: Json | null
          title: string
          updated_at?: string | null
          withdrawn_at?: string | null
          withdrawn_reason?: string | null
          workflow_stage?: string | null
        }
        Update: {
          abstract_number?: string | null
          abstract_text?: string
          accepted_as?: string | null
          amasi_membership_number?: string | null
          award_rank?: number | null
          award_type?: string | null
          category_id?: string | null
          committee_decision?: string | null
          committee_decision_at?: string | null
          committee_decision_by?: string | null
          created_at?: string | null
          decision_date?: string | null
          decision_notes?: string | null
          decision_notified_at?: string | null
          declarations_accepted?: Json | null
          event_id?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_podium_selected?: boolean | null
          keywords?: string[] | null
          last_revision_at?: string | null
          podium_checkin_by?: string | null
          podium_checkin_hall?: string | null
          podium_checkin_notes?: string | null
          presentation_completed?: boolean | null
          presentation_completed_at?: string | null
          presentation_name?: string | null
          presentation_type?: string | null
          presentation_uploaded_at?: string | null
          presentation_url?: string | null
          presenter_checked_in?: boolean | null
          presenter_checked_in_at?: string | null
          presenting_author_affiliation?: string | null
          presenting_author_email?: string
          presenting_author_name?: string
          presenting_author_phone?: string | null
          redirected_from_category_id?: string | null
          registration_id?: string | null
          registration_verified?: boolean
          registration_verified_at?: string | null
          review_round?: number
          revision_count?: number | null
          revision_notes?: string | null
          schedule_email_sent?: boolean | null
          schedule_email_sent_at?: string | null
          second_review_reason?: string | null
          session_date?: string | null
          session_id?: string | null
          session_location?: string | null
          session_time?: string | null
          status?: string | null
          subject?: string | null
          submitted_at?: string | null
          submitter_metadata?: Json | null
          title?: string
          updated_at?: string | null
          withdrawn_at?: string | null
          withdrawn_reason?: string | null
          workflow_stage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abstracts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "abstract_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abstracts_committee_decision_by_fkey"
            columns: ["committee_decision_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abstracts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abstracts_redirected_from_category_id_fkey"
            columns: ["redirected_from_category_id"]
            isOneToOne: false
            referencedRelation: "abstract_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abstracts_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      accommodations: {
        Row: {
          actual_check_in: string | null
          actual_check_out: string | null
          booked_by: string | null
          booking_confirmation: string | null
          booking_status: string | null
          check_in_date: string | null
          check_out_date: string | null
          created_at: string | null
          event_faculty_id: string | null
          event_id: string | null
          faculty_id: string | null
          floor: string | null
          hotel_address: string | null
          hotel_name: string | null
          hotel_phone: string | null
          id: string
          internal_notes: string | null
          nights: number | null
          paid_by: string | null
          room_number: string | null
          room_rate: number | null
          room_type: string | null
          sharing_with: string | null
          special_requests: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          actual_check_in?: string | null
          actual_check_out?: string | null
          booked_by?: string | null
          booking_confirmation?: string | null
          booking_status?: string | null
          check_in_date?: string | null
          check_out_date?: string | null
          created_at?: string | null
          event_faculty_id?: string | null
          event_id?: string | null
          faculty_id?: string | null
          floor?: string | null
          hotel_address?: string | null
          hotel_name?: string | null
          hotel_phone?: string | null
          id?: string
          internal_notes?: string | null
          nights?: number | null
          paid_by?: string | null
          room_number?: string | null
          room_rate?: number | null
          room_type?: string | null
          sharing_with?: string | null
          special_requests?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          actual_check_in?: string | null
          actual_check_out?: string | null
          booked_by?: string | null
          booking_confirmation?: string | null
          booking_status?: string | null
          check_in_date?: string | null
          check_out_date?: string | null
          created_at?: string | null
          event_faculty_id?: string | null
          event_id?: string | null
          faculty_id?: string | null
          floor?: string | null
          hotel_address?: string | null
          hotel_name?: string | null
          hotel_phone?: string | null
          id?: string
          internal_notes?: string | null
          nights?: number | null
          paid_by?: string | null
          room_number?: string | null
          room_rate?: number | null
          room_type?: string | null
          sharing_with?: string | null
          special_requests?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accommodations_event_faculty_id_fkey"
            columns: ["event_faculty_id"]
            isOneToOne: false
            referencedRelation: "event_faculty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accommodations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accommodations_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accommodations_sharing_with_fkey"
            columns: ["sharing_with"]
            isOneToOne: false
            referencedRelation: "faculty"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          event_id: string | null
          event_name: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          event_id?: string | null
          event_name?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          event_id?: string | null
          event_name?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      addon_ticket_links: {
        Row: {
          addon_id: string
          created_at: string | null
          id: string
          is_required: boolean | null
          max_quantity_per_attendee: number | null
          ticket_type_id: string
        }
        Insert: {
          addon_id: string
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          max_quantity_per_attendee?: number | null
          ticket_type_id: string
        }
        Update: {
          addon_id?: string
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          max_quantity_per_attendee?: number | null
          ticket_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addon_ticket_links_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addon_ticket_links_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      addon_variants: {
        Row: {
          addon_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number | null
          sort_order: number | null
          stock: number | null
          updated_at: string | null
        }
        Insert: {
          addon_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price?: number | null
          sort_order?: number | null
          stock?: number | null
          updated_at?: string | null
        }
        Update: {
          addon_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number | null
          sort_order?: number | null
          stock?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addon_variants_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
        ]
      }
      addons: {
        Row: {
          certificate_template_id: string | null
          course_description: string | null
          course_duration: string | null
          course_instructor: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          event_id: string | null
          has_variants: boolean | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_course: boolean | null
          max_quantity: number | null
          name: string
          price: number | null
          quantity_sold: number | null
          quantity_total: number | null
          sort_order: number | null
          updated_at: string | null
          variant_type: string | null
        }
        Insert: {
          certificate_template_id?: string | null
          course_description?: string | null
          course_duration?: string | null
          course_instructor?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          event_id?: string | null
          has_variants?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_course?: boolean | null
          max_quantity?: number | null
          name: string
          price?: number | null
          quantity_sold?: number | null
          quantity_total?: number | null
          sort_order?: number | null
          updated_at?: string | null
          variant_type?: string | null
        }
        Update: {
          certificate_template_id?: string | null
          course_description?: string | null
          course_duration?: string | null
          course_instructor?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          event_id?: string | null
          has_variants?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_course?: boolean | null
          max_quantity?: number | null
          name?: string
          price?: number | null
          quantity_sold?: number | null
          quantity_total?: number | null
          sort_order?: number | null
          updated_at?: string | null
          variant_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addons_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by_email: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          title: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by_email?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          title: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by_email?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          title?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_email: string
          admin_name: string | null
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          ip_address: string | null
        }
        Insert: {
          action: string
          admin_email: string
          admin_name?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
        }
        Update: {
          action?: string
          admin_email?: string
          admin_name?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_active: boolean
          last_login: string | null
          name: string
          password_hash: string
          role: string
          totp_secret: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          name?: string
          password_hash: string
          role?: string
          totp_secret?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          name?: string
          password_hash?: string
          role?: string
          totp_secret?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_decisions: {
        Row: {
          application_id: string
          application_reference: string
          blocking_reason: string | null
          check_results: Json
          decision: string
          error: Json | null
          final_status: string | null
          final_status_at: string | null
          final_status_by: string | null
          id: string
          input_snapshot: Json
          membership_type: string
          nmc_api_response_time_ms: number | null
          nmc_api_status: string | null
          override_reason: string | null
          scored_at: string
          scoring_duration_ms: number | null
          threshold: number
          total_score: number
        }
        Insert: {
          application_id: string
          application_reference: string
          blocking_reason?: string | null
          check_results?: Json
          decision: string
          error?: Json | null
          final_status?: string | null
          final_status_at?: string | null
          final_status_by?: string | null
          id?: string
          input_snapshot?: Json
          membership_type: string
          nmc_api_response_time_ms?: number | null
          nmc_api_status?: string | null
          override_reason?: string | null
          scored_at?: string
          scoring_duration_ms?: number | null
          threshold?: number
          total_score: number
        }
        Update: {
          application_id?: string
          application_reference?: string
          blocking_reason?: string | null
          check_results?: Json
          decision?: string
          error?: Json | null
          final_status?: string | null
          final_status_at?: string | null
          final_status_by?: string | null
          id?: string
          input_snapshot?: Json
          membership_type?: string
          nmc_api_response_time_ms?: number | null
          nmc_api_status?: string | null
          override_reason?: string | null
          scored_at?: string
          scoring_duration_ms?: number | null
          threshold?: number
          total_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_decisions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "membership_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      airtable_members: {
        Row: {
          amasi_number: number | null
          email: string | null
          membership_type: string | null
          name: string | null
          phone: number | null
          sync_to_supabase: boolean | null
        }
        Insert: {
          amasi_number?: number | null
          email?: string | null
          membership_type?: string | null
          name?: string | null
          phone?: number | null
          sync_to_supabase?: boolean | null
        }
        Update: {
          amasi_number?: number | null
          email?: string | null
          membership_type?: string | null
          name?: string | null
          phone?: number | null
          sync_to_supabase?: boolean | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          id: string
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          id?: string
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          id?: string
          published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          status?: string
        }
        Relationships: []
      }
      application_step_events: {
        Row: {
          application_id: string | null
          created_at: string
          draft_id: string | null
          email: string
          event_type: string
          id: string
          metadata: Json | null
          status: string | null
          step: number | null
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          draft_id?: string | null
          email: string
          event_type: string
          id?: string
          metadata?: Json | null
          status?: string | null
          step?: number | null
        }
        Update: {
          application_id?: string | null
          created_at?: string
          draft_id?: string | null
          email?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          status?: string | null
          step?: number | null
        }
        Relationships: []
      }
      asi_reconcile_2026_06_24_snapshot: {
        Row: {
          active_license: string | null
          amasi_number: number | null
          application_date: string | null
          application_no: string | null
          application_status: number | null
          asi_member_certificate: string | null
          asi_member_id: string | null
          asi_membership_no: string | null
          asi_state: string | null
          city: string | null
          country: string | null
          created_at: string | null
          date_of_birth: string | null
          edu_superspecialty_college: string | null
          edu_superspecialty_degree: string | null
          edu_superspecialty_university: string | null
          edu_superspecialty_year: string | null
          edu_undergrad_degree: string | null
          email: string | null
          father_name: string | null
          first_name: string | null
          gender: string | null
          id: string | null
          imr_registration_no: string | null
          joining_date: string | null
          landline: string | null
          last_name: string | null
          letter_hod: string | null
          marketing_opt_out_at: string | null
          mbbs_degree_certificate: string | null
          mci_certificate: string | null
          mci_council_number: string | null
          mci_council_state: string | null
          membership_type: string | null
          middle_name: string | null
          mobile_code: string | null
          mysql_id: number | null
          name: string | null
          nationality: string | null
          other_intl_org: string | null
          other_intl_org_value: string | null
          pg_college: string | null
          pg_degree: string | null
          pg_degree_certificate: string | null
          pg_university: string | null
          pg_year: string | null
          phone: number | null
          postal_code: string | null
          profile_photo: string | null
          salutation: string | null
          snapshot_at: string | null
          state: string | null
          status: string | null
          std_code: string | null
          street_address_1: string | null
          street_address_2: string | null
          ug_college: string | null
          ug_university: string | null
          ug_year: string | null
          updated_at: string | null
          voting_eligible: boolean | null
          zone: string | null
        }
        Insert: {
          active_license?: string | null
          amasi_number?: number | null
          application_date?: string | null
          application_no?: string | null
          application_status?: number | null
          asi_member_certificate?: string | null
          asi_member_id?: string | null
          asi_membership_no?: string | null
          asi_state?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          edu_superspecialty_college?: string | null
          edu_superspecialty_degree?: string | null
          edu_superspecialty_university?: string | null
          edu_superspecialty_year?: string | null
          edu_undergrad_degree?: string | null
          email?: string | null
          father_name?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string | null
          imr_registration_no?: string | null
          joining_date?: string | null
          landline?: string | null
          last_name?: string | null
          letter_hod?: string | null
          marketing_opt_out_at?: string | null
          mbbs_degree_certificate?: string | null
          mci_certificate?: string | null
          mci_council_number?: string | null
          mci_council_state?: string | null
          membership_type?: string | null
          middle_name?: string | null
          mobile_code?: string | null
          mysql_id?: number | null
          name?: string | null
          nationality?: string | null
          other_intl_org?: string | null
          other_intl_org_value?: string | null
          pg_college?: string | null
          pg_degree?: string | null
          pg_degree_certificate?: string | null
          pg_university?: string | null
          pg_year?: string | null
          phone?: number | null
          postal_code?: string | null
          profile_photo?: string | null
          salutation?: string | null
          snapshot_at?: string | null
          state?: string | null
          status?: string | null
          std_code?: string | null
          street_address_1?: string | null
          street_address_2?: string | null
          ug_college?: string | null
          ug_university?: string | null
          ug_year?: string | null
          updated_at?: string | null
          voting_eligible?: boolean | null
          zone?: string | null
        }
        Update: {
          active_license?: string | null
          amasi_number?: number | null
          application_date?: string | null
          application_no?: string | null
          application_status?: number | null
          asi_member_certificate?: string | null
          asi_member_id?: string | null
          asi_membership_no?: string | null
          asi_state?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          edu_superspecialty_college?: string | null
          edu_superspecialty_degree?: string | null
          edu_superspecialty_university?: string | null
          edu_superspecialty_year?: string | null
          edu_undergrad_degree?: string | null
          email?: string | null
          father_name?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string | null
          imr_registration_no?: string | null
          joining_date?: string | null
          landline?: string | null
          last_name?: string | null
          letter_hod?: string | null
          marketing_opt_out_at?: string | null
          mbbs_degree_certificate?: string | null
          mci_certificate?: string | null
          mci_council_number?: string | null
          mci_council_state?: string | null
          membership_type?: string | null
          middle_name?: string | null
          mobile_code?: string | null
          mysql_id?: number | null
          name?: string | null
          nationality?: string | null
          other_intl_org?: string | null
          other_intl_org_value?: string | null
          pg_college?: string | null
          pg_degree?: string | null
          pg_degree_certificate?: string | null
          pg_university?: string | null
          pg_year?: string | null
          phone?: number | null
          postal_code?: string | null
          profile_photo?: string | null
          salutation?: string | null
          snapshot_at?: string | null
          state?: string | null
          status?: string | null
          std_code?: string | null
          street_address_1?: string | null
          street_address_2?: string | null
          ug_college?: string | null
          ug_university?: string | null
          ug_year?: string | null
          updated_at?: string | null
          voting_eligible?: boolean | null
          zone?: string | null
        }
        Relationships: []
      }
      assignment_emails: {
        Row: {
          assignment_id: string
          body_preview: string | null
          clicked_at: string | null
          created_at: string | null
          delivered_at: string | null
          email_type: string
          error_message: string | null
          event_id: string
          external_id: string | null
          id: string
          opened_at: string | null
          recipient_email: string
          recipient_name: string | null
          retry_count: number | null
          sent_at: string | null
          status: string | null
          subject: string
        }
        Insert: {
          assignment_id: string
          body_preview?: string | null
          clicked_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          email_type: string
          error_message?: string | null
          event_id: string
          external_id?: string | null
          id?: string
          opened_at?: string | null
          recipient_email: string
          recipient_name?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string | null
          subject: string
        }
        Update: {
          assignment_id?: string
          body_preview?: string | null
          clicked_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          email_type?: string
          error_message?: string | null
          event_id?: string
          external_id?: string | null
          id?: string
          opened_at?: string | null
          recipient_email?: string
          recipient_name?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_emails_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "faculty_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_emails_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_device_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          device_id: string
          event_id: string
          id: string
          notes: string | null
          registration_id: string
          returned_at: string | null
          returned_by: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          device_id: string
          event_id: string
          id?: string
          notes?: string | null
          registration_id: string
          returned_at?: string | null
          returned_by?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          device_id?: string
          event_id?: string
          id?: string
          notes?: string | null
          registration_id?: string
          returned_at?: string | null
          returned_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audio_device_assignments_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "audio_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_device_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_device_assignments_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_devices: {
        Row: {
          created_at: string
          device_code: string
          event_id: string
          id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_code: string
          event_id: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_code?: string
          event_id?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_devices_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changes_summary: string | null
          created_at: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          event_id: string | null
          event_name: string | null
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          request_id: string | null
          request_method: string | null
          request_path: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          changes_summary?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          event_id?: string | null
          event_name?: string | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          request_method?: string | null
          request_path?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          changes_summary?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          event_id?: string | null
          event_name?: string | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          request_method?: string | null
          request_path?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      av_requirements: {
        Row: {
          additional_monitors: number | null
          created_at: string | null
          event_id: string | null
          id: string
          issue_resolved: boolean | null
          issues: string | null
          livestream_required: boolean | null
          mic_handheld: number | null
          mic_lapel: number | null
          mic_podium: number | null
          projector_count: number | null
          recording_required: boolean | null
          screen_type: string | null
          session_id: string | null
          setup_status: string | null
          special_requirements: string | null
          surgical_camera: boolean | null
          tested_at: string | null
          tested_by: string | null
          video_playback: boolean | null
        }
        Insert: {
          additional_monitors?: number | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          issue_resolved?: boolean | null
          issues?: string | null
          livestream_required?: boolean | null
          mic_handheld?: number | null
          mic_lapel?: number | null
          mic_podium?: number | null
          projector_count?: number | null
          recording_required?: boolean | null
          screen_type?: string | null
          session_id?: string | null
          setup_status?: string | null
          special_requirements?: string | null
          surgical_camera?: boolean | null
          tested_at?: string | null
          tested_by?: string | null
          video_playback?: boolean | null
        }
        Update: {
          additional_monitors?: number | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          issue_resolved?: boolean | null
          issues?: string | null
          livestream_required?: boolean | null
          mic_handheld?: number | null
          mic_lapel?: number | null
          mic_podium?: number | null
          projector_count?: number | null
          recording_required?: boolean | null
          screen_type?: string | null
          session_id?: string | null
          setup_status?: string | null
          special_requirements?: string | null
          surgical_camera?: boolean | null
          tested_at?: string | null
          tested_by?: string | null
          video_playback?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "av_requirements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "av_requirements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      backfill_app_member_id_2026_05_20_snapshot: {
        Row: {
          assigned_amasi_number: number | null
          id: string | null
          snapshot_member_id: string | null
          snapshot_updated_at: string | null
          status: string | null
        }
        Insert: {
          assigned_amasi_number?: number | null
          id?: string | null
          snapshot_member_id?: string | null
          snapshot_updated_at?: string | null
          status?: string | null
        }
        Update: {
          assigned_amasi_number?: number | null
          id?: string | null
          snapshot_member_id?: string | null
          snapshot_updated_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      backfill_audit_pii_mask_2026_05_20_snapshot: {
        Row: {
          id: string | null
          snapshot_new_data: Json | null
          snapshot_old_data: Json | null
        }
        Insert: {
          id?: string | null
          snapshot_new_data?: Json | null
          snapshot_old_data?: Json | null
        }
        Update: {
          id?: string | null
          snapshot_new_data?: Json | null
          snapshot_old_data?: Json | null
        }
        Relationships: []
      }
      backfill_clear_review_flags_2026_05_20_snapshot: {
        Row: {
          id: string | null
          manual_review_reason: string | null
          needs_manual_review: boolean | null
          snapshot_updated_at: string | null
          status: string | null
        }
        Insert: {
          id?: string | null
          manual_review_reason?: string | null
          needs_manual_review?: boolean | null
          snapshot_updated_at?: string | null
          status?: string | null
        }
        Update: {
          id?: string | null
          manual_review_reason?: string | null
          needs_manual_review?: boolean | null
          snapshot_updated_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      backfill_completed_draft_failure_2026_05_20_snapshot: {
        Row: {
          failure_reason: string | null
          failure_step: number | null
          id: string | null
          snapshot_updated_at: string | null
          stale_since: string | null
          status: string | null
        }
        Insert: {
          failure_reason?: string | null
          failure_step?: number | null
          id?: string | null
          snapshot_updated_at?: string | null
          stale_since?: string | null
          status?: string | null
        }
        Update: {
          failure_reason?: string | null
          failure_step?: number | null
          id?: string | null
          snapshot_updated_at?: string | null
          stale_since?: string | null
          status?: string | null
        }
        Relationships: []
      }
      backfill_members_id_2026_05_20_snapshot: {
        Row: {
          amasi_number: number | null
          email: string | null
          name: string | null
          snapshot_created_at: string | null
          snapshot_id: string | null
        }
        Insert: {
          amasi_number?: number | null
          email?: string | null
          name?: string | null
          snapshot_created_at?: string | null
          snapshot_id?: string | null
        }
        Update: {
          amasi_number?: number | null
          email?: string | null
          name?: string | null
          snapshot_created_at?: string | null
          snapshot_id?: string | null
        }
        Relationships: []
      }
      backfill_members_timestamps_2026_05_20_snapshot: {
        Row: {
          amasi_number: number | null
          id: string | null
          joining_date: string | null
          snapshot_created_at: string | null
          snapshot_updated_at: string | null
        }
        Insert: {
          amasi_number?: number | null
          id?: string | null
          joining_date?: string | null
          snapshot_created_at?: string | null
          snapshot_updated_at?: string | null
        }
        Update: {
          amasi_number?: number | null
          id?: string | null
          joining_date?: string | null
          snapshot_created_at?: string | null
          snapshot_updated_at?: string | null
        }
        Relationships: []
      }
      backfill_payment_amount_2026_05_20_snapshot: {
        Row: {
          id: string | null
          payment_id: string | null
          payment_status: string | null
          snapshot_payment_amount: number | null
          snapshot_updated_at: string | null
        }
        Insert: {
          id?: string | null
          payment_id?: string | null
          payment_status?: string | null
          snapshot_payment_amount?: number | null
          snapshot_updated_at?: string | null
        }
        Update: {
          id?: string | null
          payment_id?: string | null
          payment_status?: string | null
          snapshot_payment_amount?: number | null
          snapshot_updated_at?: string | null
        }
        Relationships: []
      }
      backfill_payments_membership_strays_2026_06_14_snapshot: {
        Row: {
          amount: number | null
          completed_at: string | null
          created_at: string | null
          currency: string | null
          discount_amount: number | null
          event_id: string | null
          id: string | null
          metadata: Json | null
          net_amount: number | null
          notes: string | null
          payer_email: string | null
          payer_name: string | null
          payer_phone: string | null
          payment_method: string | null
          payment_number: string | null
          payment_type: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          refunded_at: string | null
          status: string | null
          tax_amount: number | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          discount_amount?: number | null
          event_id?: string | null
          id?: string | null
          metadata?: Json | null
          net_amount?: number | null
          notes?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          payment_method?: string | null
          payment_number?: string | null
          payment_type?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          refunded_at?: string | null
          status?: string | null
          tax_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          discount_amount?: number | null
          event_id?: string | null
          id?: string | null
          metadata?: Json | null
          net_amount?: number | null
          notes?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          payment_method?: string | null
          payment_number?: string | null
          payment_type?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          refunded_at?: string | null
          status?: string | null
          tax_amount?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      badge_templates: {
        Row: {
          badges_generated_count: number | null
          created_at: string | null
          description: string | null
          event_id: string
          id: string
          is_default: boolean | null
          is_locked: boolean | null
          locked_at: string | null
          locked_by: string | null
          name: string
          size: string | null
          template_data: Json
          template_image_url: string | null
          ticket_type_ids: string[] | null
          updated_at: string | null
        }
        Insert: {
          badges_generated_count?: number | null
          created_at?: string | null
          description?: string | null
          event_id: string
          id?: string
          is_default?: boolean | null
          is_locked?: boolean | null
          locked_at?: string | null
          locked_by?: string | null
          name: string
          size?: string | null
          template_data?: Json
          template_image_url?: string | null
          ticket_type_ids?: string[] | null
          updated_at?: string | null
        }
        Update: {
          badges_generated_count?: number | null
          created_at?: string | null
          description?: string | null
          event_id?: string
          id?: string
          is_default?: boolean | null
          is_locked?: boolean | null
          locked_at?: string | null
          locked_by?: string | null
          name?: string
          size?: string | null
          template_data?: Json
          template_image_url?: string | null
          ticket_type_ids?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "badge_templates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_categories: {
        Row: {
          allocated_amount: number | null
          color: string | null
          created_at: string | null
          description: string | null
          event_id: string | null
          id: string
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          allocated_amount?: number | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          event_id?: string | null
          id?: string
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          allocated_amount?: number | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          event_id?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          amount: number
          budget_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          invoice_number: string | null
          item_name: string
          notes: string | null
          paid_date: string | null
          payment_method: string | null
          quantity: number | null
          receipt_url: string | null
          status: string | null
          updated_at: string | null
          vendor: string | null
        }
        Insert: {
          amount?: number
          budget_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          invoice_number?: string | null
          item_name: string
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          quantity?: number | null
          receipt_url?: string | null
          status?: string | null
          updated_at?: string | null
          vendor?: string | null
        }
        Update: {
          amount?: number
          budget_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          invoice_number?: string | null
          item_name?: string
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          quantity?: number | null
          receipt_url?: string | null
          status?: string | null
          updated_at?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          actual_amount: number | null
          category: string
          created_at: string | null
          estimated_amount: number | null
          event_id: string
          id: string
          name: string
          notes: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          actual_amount?: number | null
          category: string
          created_at?: string | null
          estimated_amount?: number | null
          event_id: string
          id?: string
          name: string
          notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_amount?: number | null
          category?: string
          created_at?: string | null
          estimated_amount?: number | null
          event_id?: string
          id?: string
          name?: string
          notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budgets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      buyers: {
        Row: {
          created_at: string | null
          email: string
          event_id: string | null
          form_data: Json | null
          id: string
          name: string
          payment_status: string | null
          phone: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          event_id?: string | null
          form_data?: Json | null
          id?: string
          name: string
          payment_status?: string | null
          phone?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          event_id?: string | null
          form_data?: Json | null
          id?: string
          name?: string
          payment_status?: string | null
          phone?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          campaign_type: string
          channel: Database["public"]["Enums"]["comm_channel"]
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          email_template_id: string | null
          event_id: string | null
          id: string
          is_scheduled: boolean | null
          name: string
          recipient_count: number | null
          recipient_filter: Json | null
          recipient_ids: string[] | null
          recipient_type: string
          scheduled_at: string | null
          started_at: string | null
          status: string | null
          total_clicked: number | null
          total_delivered: number | null
          total_failed: number | null
          total_opened: number | null
          total_sent: number | null
          updated_at: string | null
          whatsapp_template_id: string | null
        }
        Insert: {
          campaign_type: string
          channel: Database["public"]["Enums"]["comm_channel"]
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          email_template_id?: string | null
          event_id?: string | null
          id?: string
          is_scheduled?: boolean | null
          name: string
          recipient_count?: number | null
          recipient_filter?: Json | null
          recipient_ids?: string[] | null
          recipient_type: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string | null
          total_clicked?: number | null
          total_delivered?: number | null
          total_failed?: number | null
          total_opened?: number | null
          total_sent?: number | null
          updated_at?: string | null
          whatsapp_template_id?: string | null
        }
        Update: {
          campaign_type?: string
          channel?: Database["public"]["Enums"]["comm_channel"]
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          email_template_id?: string | null
          event_id?: string | null
          id?: string
          is_scheduled?: boolean | null
          name?: string
          recipient_count?: number | null
          recipient_filter?: Json | null
          recipient_ids?: string[] | null
          recipient_type?: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string | null
          total_clicked?: number | null
          total_delivered?: number | null
          total_failed?: number | null
          total_opened?: number | null
          total_sent?: number | null
          updated_at?: string | null
          whatsapp_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_whatsapp_template_id_fkey"
            columns: ["whatsapp_template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      catering: {
        Row: {
          actual_count: number | null
          created_at: string | null
          event_id: string | null
          expected_count: number | null
          id: string
          jain_count: number | null
          meal_date: string | null
          meal_time: string | null
          meal_type: string | null
          menu_items: string[] | null
          non_vegetarian_count: number | null
          special_arrangements: string | null
          status: string | null
          vegan_count: number | null
          vegetarian_count: number | null
          venue: string | null
        }
        Insert: {
          actual_count?: number | null
          created_at?: string | null
          event_id?: string | null
          expected_count?: number | null
          id?: string
          jain_count?: number | null
          meal_date?: string | null
          meal_time?: string | null
          meal_type?: string | null
          menu_items?: string[] | null
          non_vegetarian_count?: number | null
          special_arrangements?: string | null
          status?: string | null
          vegan_count?: number | null
          vegetarian_count?: number | null
          venue?: string | null
        }
        Update: {
          actual_count?: number | null
          created_at?: string | null
          event_id?: string | null
          expected_count?: number | null
          id?: string
          jain_count?: number | null
          meal_date?: string | null
          meal_time?: string | null
          meal_type?: string | null
          menu_items?: string[] | null
          non_vegetarian_count?: number | null
          special_arrangements?: string | null
          status?: string | null
          vegan_count?: number | null
          vegetarian_count?: number | null
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catering_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_signatories: {
        Row: {
          active: boolean | null
          created_at: string | null
          from_date: string
          id: string
          logo_url: string | null
          president_name: string
          president_sign_url: string | null
          secretary_name: string | null
          secretary_sign_url: string | null
          template_url: string | null
          to_date: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          from_date: string
          id?: string
          logo_url?: string | null
          president_name: string
          president_sign_url?: string | null
          secretary_name?: string | null
          secretary_sign_url?: string | null
          template_url?: string | null
          to_date: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          from_date?: string
          id?: string
          logo_url?: string | null
          president_name?: string
          president_sign_url?: string | null
          secretary_name?: string | null
          secretary_sign_url?: string | null
          template_url?: string | null
          to_date?: string
        }
        Relationships: []
      }
      certificate_templates: {
        Row: {
          background_color: string | null
          background_url: string | null
          created_at: string | null
          description: string | null
          event_id: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          size: string | null
          template_data: Json | null
          template_image_url: string | null
          template_type: string | null
          ticket_type_ids: string[] | null
          updated_at: string | null
        }
        Insert: {
          background_color?: string | null
          background_url?: string | null
          created_at?: string | null
          description?: string | null
          event_id: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          size?: string | null
          template_data?: Json | null
          template_image_url?: string | null
          template_type?: string | null
          ticket_type_ids?: string[] | null
          updated_at?: string | null
        }
        Update: {
          background_color?: string | null
          background_url?: string | null
          created_at?: string | null
          description?: string | null
          event_id?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          size?: string | null
          template_data?: Json | null
          template_image_url?: string | null
          template_type?: string | null
          ticket_type_ids?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificate_templates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_verifications: {
        Row: {
          certificate_id: string | null
          certificate_number: string
          id: string
          is_valid: boolean | null
          user_agent: string | null
          verified_at: string | null
          verified_from_ip: string | null
        }
        Insert: {
          certificate_id?: string | null
          certificate_number: string
          id?: string
          is_valid?: boolean | null
          user_agent?: string | null
          verified_at?: string | null
          verified_from_ip?: string | null
        }
        Update: {
          certificate_id?: string | null
          certificate_number?: string
          id?: string
          is_valid?: boolean | null
          user_agent?: string | null
          verified_at?: string | null
          verified_from_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificate_verifications_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates_issued"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          award_name: string | null
          certificate_number: string
          certificate_type: string
          created_at: string | null
          description: string | null
          download_count: number | null
          download_ips: string[] | null
          email_opened: boolean | null
          email_sent: boolean | null
          email_sent_at: string | null
          event_faculty_id: string | null
          event_id: string
          faculty_id: string | null
          generated_by: string | null
          id: string
          is_valid: boolean | null
          last_downloaded_at: string | null
          member_id: string | null
          pdf_generated_at: string | null
          pdf_url: string | null
          qr_code_data: string | null
          recipient_city: string | null
          recipient_email: string | null
          recipient_institution: string | null
          recipient_name: string
          recipient_title: string | null
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          roles: string[] | null
          sessions: string[] | null
          status: string | null
          template_id: string | null
          template_name: string | null
          updated_at: string | null
          user_id: string | null
          verification_token: string | null
          verification_url: string | null
        }
        Insert: {
          award_name?: string | null
          certificate_number: string
          certificate_type: string
          created_at?: string | null
          description?: string | null
          download_count?: number | null
          download_ips?: string[] | null
          email_opened?: boolean | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          event_faculty_id?: string | null
          event_id: string
          faculty_id?: string | null
          generated_by?: string | null
          id?: string
          is_valid?: boolean | null
          last_downloaded_at?: string | null
          member_id?: string | null
          pdf_generated_at?: string | null
          pdf_url?: string | null
          qr_code_data?: string | null
          recipient_city?: string | null
          recipient_email?: string | null
          recipient_institution?: string | null
          recipient_name: string
          recipient_title?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          roles?: string[] | null
          sessions?: string[] | null
          status?: string | null
          template_id?: string | null
          template_name?: string | null
          updated_at?: string | null
          user_id?: string | null
          verification_token?: string | null
          verification_url?: string | null
        }
        Update: {
          award_name?: string | null
          certificate_number?: string
          certificate_type?: string
          created_at?: string | null
          description?: string | null
          download_count?: number | null
          download_ips?: string[] | null
          email_opened?: boolean | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          event_faculty_id?: string | null
          event_id?: string
          faculty_id?: string | null
          generated_by?: string | null
          id?: string
          is_valid?: boolean | null
          last_downloaded_at?: string | null
          member_id?: string | null
          pdf_generated_at?: string | null
          pdf_url?: string | null
          qr_code_data?: string | null
          recipient_city?: string | null
          recipient_email?: string | null
          recipient_institution?: string | null
          recipient_name?: string
          recipient_title?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          roles?: string[] | null
          sessions?: string[] | null
          status?: string | null
          template_id?: string | null
          template_name?: string | null
          updated_at?: string | null
          user_id?: string | null
          verification_token?: string | null
          verification_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_event_faculty_id_fkey"
            columns: ["event_faculty_id"]
            isOneToOne: false
            referencedRelation: "event_faculty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "active_amasi_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates_issued: {
        Row: {
          certificate_number: string
          certificate_type: string
          course_name: string | null
          created_at: string | null
          download_count: number | null
          downloaded_at: string | null
          event_year: string | null
          id: string
          issued_at: string | null
          pdf_url: string | null
          recipient_email: string
          recipient_name: string
          roles: string[] | null
          sessions: Json | null
          verified_count: number | null
        }
        Insert: {
          certificate_number: string
          certificate_type: string
          course_name?: string | null
          created_at?: string | null
          download_count?: number | null
          downloaded_at?: string | null
          event_year?: string | null
          id?: string
          issued_at?: string | null
          pdf_url?: string | null
          recipient_email: string
          recipient_name: string
          roles?: string[] | null
          sessions?: Json | null
          verified_count?: number | null
        }
        Update: {
          certificate_number?: string
          certificate_type?: string
          course_name?: string | null
          created_at?: string | null
          download_count?: number | null
          downloaded_at?: string | null
          event_year?: string | null
          id?: string
          issued_at?: string | null
          pdf_url?: string | null
          recipient_email?: string
          recipient_name?: string
          roles?: string[] | null
          sessions?: Json | null
          verified_count?: number | null
        }
        Relationships: []
      }
      checkin_audit_log: {
        Row: {
          action: string
          checkin_list_id: string | null
          created_at: string | null
          device_info: Json | null
          error_message: string | null
          event_id: string | null
          id: string
          performed_by: string | null
          performed_via: string | null
          registration_id: string | null
          success: boolean | null
          token_used: string | null
        }
        Insert: {
          action: string
          checkin_list_id?: string | null
          created_at?: string | null
          device_info?: Json | null
          error_message?: string | null
          event_id?: string | null
          id?: string
          performed_by?: string | null
          performed_via?: string | null
          registration_id?: string | null
          success?: boolean | null
          token_used?: string | null
        }
        Update: {
          action?: string
          checkin_list_id?: string | null
          created_at?: string | null
          device_info?: Json | null
          error_message?: string | null
          event_id?: string | null
          id?: string
          performed_by?: string | null
          performed_via?: string | null
          registration_id?: string | null
          success?: boolean | null
          token_used?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkin_audit_log_checkin_list_id_fkey"
            columns: ["checkin_list_id"]
            isOneToOne: false
            referencedRelation: "checkin_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_audit_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_audit_log_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_lists: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          addon_ids: string[] | null
          allow_multiple_checkins: boolean | null
          created_at: string | null
          description: string | null
          ends_at: string | null
          event_id: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          starts_at: string | null
          ticket_type_ids: string[] | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          addon_ids?: string[] | null
          allow_multiple_checkins?: boolean | null
          created_at?: string | null
          description?: string | null
          ends_at?: string | null
          event_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          starts_at?: string | null
          ticket_type_ids?: string[] | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          addon_ids?: string[] | null
          allow_multiple_checkins?: boolean | null
          created_at?: string | null
          description?: string | null
          ends_at?: string | null
          event_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          starts_at?: string | null
          ticket_type_ids?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkin_lists_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_records: {
        Row: {
          checked_in_at: string | null
          checked_in_by: string | null
          checked_out_at: string | null
          checkin_list_id: string | null
          id: string
          notes: string | null
          registration_id: string | null
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          checked_out_at?: string | null
          checkin_list_id?: string | null
          id?: string
          notes?: string | null
          registration_id?: string | null
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          checked_out_at?: string | null
          checkin_list_id?: string | null
          id?: string
          notes?: string | null
          registration_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkin_records_checkin_list_id_fkey"
            columns: ["checkin_list_id"]
            isOneToOne: false
            referencedRelation: "checkin_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_records_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      commitments: {
        Row: {
          admin_remarks: string | null
          av_requirements: string[] | null
          created_at: string | null
          day_number: number | null
          duration_minutes: number | null
          event_faculty_id: string
          event_id: string
          faculty_id: string
          faculty_remarks: string | null
          hall: string | null
          hall_capacity: number | null
          id: string
          modification_request: string | null
          presentation_deadline: string | null
          presentation_file_name: string | null
          presentation_type: string | null
          presentation_uploaded: boolean | null
          presentation_uploaded_at: string | null
          presentation_url: string | null
          rejection_reason: string | null
          response_at: string | null
          role: Database["public"]["Enums"]["faculty_session_role"]
          sequence_order: number | null
          session_date: string
          session_name: string
          session_theme: string | null
          session_time_display: string | null
          session_time_end: string | null
          session_time_start: string | null
          session_type: string | null
          special_requirements: string | null
          status: Database["public"]["Enums"]["commitment_status"] | null
          topic_abstract: string | null
          topic_title: string | null
          updated_at: string | null
        }
        Insert: {
          admin_remarks?: string | null
          av_requirements?: string[] | null
          created_at?: string | null
          day_number?: number | null
          duration_minutes?: number | null
          event_faculty_id: string
          event_id: string
          faculty_id: string
          faculty_remarks?: string | null
          hall?: string | null
          hall_capacity?: number | null
          id?: string
          modification_request?: string | null
          presentation_deadline?: string | null
          presentation_file_name?: string | null
          presentation_type?: string | null
          presentation_uploaded?: boolean | null
          presentation_uploaded_at?: string | null
          presentation_url?: string | null
          rejection_reason?: string | null
          response_at?: string | null
          role: Database["public"]["Enums"]["faculty_session_role"]
          sequence_order?: number | null
          session_date: string
          session_name: string
          session_theme?: string | null
          session_time_display?: string | null
          session_time_end?: string | null
          session_time_start?: string | null
          session_type?: string | null
          special_requirements?: string | null
          status?: Database["public"]["Enums"]["commitment_status"] | null
          topic_abstract?: string | null
          topic_title?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_remarks?: string | null
          av_requirements?: string[] | null
          created_at?: string | null
          day_number?: number | null
          duration_minutes?: number | null
          event_faculty_id?: string
          event_id?: string
          faculty_id?: string
          faculty_remarks?: string | null
          hall?: string | null
          hall_capacity?: number | null
          id?: string
          modification_request?: string | null
          presentation_deadline?: string | null
          presentation_file_name?: string | null
          presentation_type?: string | null
          presentation_uploaded?: boolean | null
          presentation_uploaded_at?: string | null
          presentation_url?: string | null
          rejection_reason?: string | null
          response_at?: string | null
          role?: Database["public"]["Enums"]["faculty_session_role"]
          sequence_order?: number | null
          session_date?: string
          session_name?: string
          session_theme?: string | null
          session_time_display?: string | null
          session_time_end?: string | null
          session_time_start?: string | null
          session_type?: string | null
          special_requirements?: string | null
          status?: Database["public"]["Enums"]["commitment_status"] | null
          topic_abstract?: string | null
          topic_title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commitments_event_faculty_id_fkey"
            columns: ["event_faculty_id"]
            isOneToOne: false
            referencedRelation: "event_faculty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculty"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_logs: {
        Row: {
          batch_id: string | null
          campaign_id: string | null
          campaign_name: string | null
          channel: Database["public"]["Enums"]["comm_channel"]
          cost: number | null
          created_at: string | null
          email_bounce_type: string | null
          email_click_count: number | null
          email_clicked_at: string | null
          email_delivered_at: string | null
          email_links_clicked: Json | null
          email_message_id: string | null
          email_open_count: number | null
          email_opened_at: string | null
          email_provider: string | null
          email_sent_at: string | null
          email_status:
            | Database["public"]["Enums"]["email_delivery_status"]
            | null
          error_code: string | null
          error_message: string | null
          event_faculty_id: string | null
          event_id: string | null
          faculty_id: string | null
          id: string
          member_id: string | null
          message_preview: string | null
          recipient_email: string | null
          recipient_name: string | null
          recipient_phone: string | null
          retry_count: number | null
          sent_by: string | null
          subject: string | null
          template_id: string | null
          template_name: string | null
          whatsapp_delivered_at: string | null
          whatsapp_message_id: string | null
          whatsapp_provider: string | null
          whatsapp_read_at: string | null
          whatsapp_response_at: string | null
          whatsapp_response_text: string | null
          whatsapp_sent_at: string | null
          whatsapp_status:
            | Database["public"]["Enums"]["whatsapp_delivery_status"]
            | null
        }
        Insert: {
          batch_id?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          channel: Database["public"]["Enums"]["comm_channel"]
          cost?: number | null
          created_at?: string | null
          email_bounce_type?: string | null
          email_click_count?: number | null
          email_clicked_at?: string | null
          email_delivered_at?: string | null
          email_links_clicked?: Json | null
          email_message_id?: string | null
          email_open_count?: number | null
          email_opened_at?: string | null
          email_provider?: string | null
          email_sent_at?: string | null
          email_status?:
            | Database["public"]["Enums"]["email_delivery_status"]
            | null
          error_code?: string | null
          error_message?: string | null
          event_faculty_id?: string | null
          event_id?: string | null
          faculty_id?: string | null
          id?: string
          member_id?: string | null
          message_preview?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          retry_count?: number | null
          sent_by?: string | null
          subject?: string | null
          template_id?: string | null
          template_name?: string | null
          whatsapp_delivered_at?: string | null
          whatsapp_message_id?: string | null
          whatsapp_provider?: string | null
          whatsapp_read_at?: string | null
          whatsapp_response_at?: string | null
          whatsapp_response_text?: string | null
          whatsapp_sent_at?: string | null
          whatsapp_status?:
            | Database["public"]["Enums"]["whatsapp_delivery_status"]
            | null
        }
        Update: {
          batch_id?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          channel?: Database["public"]["Enums"]["comm_channel"]
          cost?: number | null
          created_at?: string | null
          email_bounce_type?: string | null
          email_click_count?: number | null
          email_clicked_at?: string | null
          email_delivered_at?: string | null
          email_links_clicked?: Json | null
          email_message_id?: string | null
          email_open_count?: number | null
          email_opened_at?: string | null
          email_provider?: string | null
          email_sent_at?: string | null
          email_status?:
            | Database["public"]["Enums"]["email_delivery_status"]
            | null
          error_code?: string | null
          error_message?: string | null
          event_faculty_id?: string | null
          event_id?: string | null
          faculty_id?: string | null
          id?: string
          member_id?: string | null
          message_preview?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          retry_count?: number | null
          sent_by?: string | null
          subject?: string | null
          template_id?: string | null
          template_name?: string | null
          whatsapp_delivered_at?: string | null
          whatsapp_message_id?: string | null
          whatsapp_provider?: string | null
          whatsapp_read_at?: string | null
          whatsapp_response_at?: string | null
          whatsapp_response_text?: string | null
          whatsapp_sent_at?: string | null
          whatsapp_status?:
            | Database["public"]["Enums"]["whatsapp_delivery_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_logs_event_faculty_id_fkey"
            columns: ["event_faculty_id"]
            isOneToOne: false
            referencedRelation: "event_faculty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "active_amasi_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_settings: {
        Row: {
          channels_enabled: Json | null
          created_at: string | null
          email_api_key: string | null
          email_from_address: string | null
          email_from_name: string | null
          email_provider: string | null
          event_id: string | null
          id: string
          sms_api_key: string | null
          sms_auth_token: string | null
          sms_provider: string | null
          sms_sender_id: string | null
          twilio_account_sid: string | null
          twilio_auth_token: string | null
          twilio_phone_number: string | null
          updated_at: string | null
          webhook_enabled: boolean | null
          webhook_headers: Json | null
          webhook_secret: string | null
          webhook_url: string | null
          whatsapp_access_token: string | null
          whatsapp_api_key: string | null
          whatsapp_business_account_id: string | null
          whatsapp_phone_number_id: string | null
          whatsapp_provider: string | null
        }
        Insert: {
          channels_enabled?: Json | null
          created_at?: string | null
          email_api_key?: string | null
          email_from_address?: string | null
          email_from_name?: string | null
          email_provider?: string | null
          event_id?: string | null
          id?: string
          sms_api_key?: string | null
          sms_auth_token?: string | null
          sms_provider?: string | null
          sms_sender_id?: string | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_phone_number?: string | null
          updated_at?: string | null
          webhook_enabled?: boolean | null
          webhook_headers?: Json | null
          webhook_secret?: string | null
          webhook_url?: string | null
          whatsapp_access_token?: string | null
          whatsapp_api_key?: string | null
          whatsapp_business_account_id?: string | null
          whatsapp_phone_number_id?: string | null
          whatsapp_provider?: string | null
        }
        Update: {
          channels_enabled?: Json | null
          created_at?: string | null
          email_api_key?: string | null
          email_from_address?: string | null
          email_from_name?: string | null
          email_provider?: string | null
          event_id?: string | null
          id?: string
          sms_api_key?: string | null
          sms_auth_token?: string | null
          sms_provider?: string | null
          sms_sender_id?: string | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_phone_number?: string | null
          updated_at?: string | null
          webhook_enabled?: boolean | null
          webhook_headers?: Json | null
          webhook_secret?: string | null
          webhook_url?: string | null
          whatsapp_access_token?: string | null
          whatsapp_api_key?: string | null
          whatsapp_business_account_id?: string | null
          whatsapp_phone_number_id?: string | null
          whatsapp_provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      credential_templates: {
        Row: {
          convocation_date: string | null
          convocation_place: string | null
          credential_type: string
          name_font_size_px: number | null
          name_top_pct: number | null
          president_name: string | null
          template_path: string
          year: number
        }
        Insert: {
          convocation_date?: string | null
          convocation_place?: string | null
          credential_type: string
          name_font_size_px?: number | null
          name_top_pct?: number | null
          president_name?: string | null
          template_path: string
          year: number
        }
        Update: {
          convocation_date?: string | null
          convocation_place?: string | null
          credential_type?: string
          name_font_size_px?: number | null
          name_top_pct?: number | null
          president_name?: string | null
          template_path?: string
          year?: number
        }
        Relationships: []
      }
      cron_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: number
          job: string
          metadata: Json | null
          started_at: string
          status: string
          synced_count: number | null
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: never
          job: string
          metadata?: Json | null
          started_at?: string
          status?: string
          synced_count?: number | null
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: never
          job?: string
          metadata?: Json | null
          started_at?: string
          status?: string
          synced_count?: number | null
        }
        Relationships: []
      }
      delegate_portal_downloads: {
        Row: {
          download_type: string
          downloaded_at: string | null
          event_id: string
          id: string
          ip_address: string | null
          registration_id: string
          user_agent: string | null
        }
        Insert: {
          download_type: string
          downloaded_at?: string | null
          event_id: string
          id?: string
          ip_address?: string | null
          registration_id: string
          user_agent?: string | null
        }
        Update: {
          download_type?: string
          downloaded_at?: string | null
          event_id?: string
          id?: string
          ip_address?: string | null
          registration_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delegate_portal_downloads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delegate_portal_downloads_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          created_at: string
          device_name: string | null
          expo_push_token: string
          id: string
          last_seen_at: string
          platform: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string | null
          expo_push_token: string
          id?: string
          last_seen_at?: string
          platform: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string | null
          expo_push_token?: string
          id?: string
          last_seen_at?: string
          platform?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      directory_access_log: {
        Row: {
          created_at: string | null
          id: number
          ip: string | null
          query_params: Json | null
          result_count: number | null
          viewer_member_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          ip?: string | null
          query_params?: Json | null
          result_count?: number | null
          viewer_member_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          ip?: string | null
          query_params?: Json | null
          result_count?: number | null
          viewer_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directory_access_log_viewer_member_id_fkey"
            columns: ["viewer_member_id"]
            isOneToOne: false
            referencedRelation: "active_amasi_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directory_access_log_viewer_member_id_fkey"
            columns: ["viewer_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          applies_to_ticket_ids: string[] | null
          code: string
          created_at: string
          current_uses: number
          description: string | null
          discount_type: string
          discount_value: number
          event_id: string
          id: string
          is_active: boolean
          max_discount_amount: number | null
          max_uses: number | null
          min_order_amount: number | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applies_to_ticket_ids?: string[] | null
          code: string
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_type: string
          discount_value: number
          event_id: string
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          max_uses?: number | null
          min_order_amount?: number | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applies_to_ticket_ids?: string[] | null
          code?: string
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_type?: string
          discount_value?: number
          event_id?: string
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          max_uses?: number | null
          min_order_amount?: number | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_codes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_applications: {
        Row: {
          created_at: string | null
          current_step: number | null
          deleted_at: string | null
          email: string
          expires_at: string | null
          failure_reason: string | null
          failure_step: number | null
          has_verified_payment: boolean | null
          id: string
          membership_type: string | null
          payment_id: string | null
          payment_order_id: string | null
          phone: string | null
          reminder_count: number
          reminder_sent_at: string | null
          stale_since: string | null
          status: string | null
          step_data: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_step?: number | null
          deleted_at?: string | null
          email: string
          expires_at?: string | null
          failure_reason?: string | null
          failure_step?: number | null
          has_verified_payment?: boolean | null
          id?: string
          membership_type?: string | null
          payment_id?: string | null
          payment_order_id?: string | null
          phone?: string | null
          reminder_count?: number
          reminder_sent_at?: string | null
          stale_since?: string | null
          status?: string | null
          step_data?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_step?: number | null
          deleted_at?: string | null
          email?: string
          expires_at?: string | null
          failure_reason?: string | null
          failure_step?: number | null
          has_verified_payment?: boolean | null
          id?: string
          membership_type?: string | null
          payment_id?: string | null
          payment_order_id?: string | null
          phone?: string | null
          reminder_count?: number
          reminder_sent_at?: string | null
          stale_since?: string | null
          status?: string | null
          step_data?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      electoral_objections: {
        Row: {
          created_at: string
          id: string
          ip: string | null
          objection_text: string
          objection_type: string
          objector_email: string
          objector_name: string
          objector_phone: string | null
          objector_relation: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_amasi_number: number | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip?: string | null
          objection_text: string
          objection_type: string
          objector_email: string
          objector_name: string
          objector_phone?: string | null
          objector_relation?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_amasi_number?: number | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string | null
          objection_text?: string
          objection_type?: string
          objector_email?: string
          objector_name?: string
          objector_phone?: string | null
          objector_relation?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_amasi_number?: number | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      email_campaign_recipients: {
        Row: {
          amasi_number: number | null
          campaign_id: string
          created_at: string | null
          email: string
          id: string
          member_id: string
          name: string | null
          send_error: string | null
          sent_at: string | null
          update_detected_at: string | null
        }
        Insert: {
          amasi_number?: number | null
          campaign_id: string
          created_at?: string | null
          email: string
          id?: string
          member_id: string
          name?: string | null
          send_error?: string | null
          sent_at?: string | null
          update_detected_at?: string | null
        }
        Update: {
          amasi_number?: number | null
          campaign_id?: string
          created_at?: string | null
          email?: string
          id?: string
          member_id?: string
          name?: string | null
          send_error?: string | null
          sent_at?: string | null
          update_detected_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          category: string
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          status: string
          target_fields: string[]
          template_key: string
        }
        Insert: {
          category: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          status?: string
          target_fields: string[]
          template_key: string
        }
        Update: {
          category?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          status?: string
          target_fields?: string[]
          template_key?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          created_at: string | null
          error: string | null
          event_id: string | null
          id: string
          provider: string | null
          provider_message_id: string | null
          recipient_email: string
          registration_id: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
          template_type: string | null
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          event_id?: string | null
          id?: string
          provider?: string | null
          provider_message_id?: string | null
          recipient_email: string
          registration_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_type?: string | null
        }
        Update: {
          created_at?: string | null
          error?: string | null
          event_id?: string | null
          id?: string
          provider?: string | null
          provider_message_id?: string | null
          recipient_email?: string
          registration_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          attachment_urls: string[] | null
          body_html: string
          body_text: string | null
          category: string
          created_at: string | null
          created_by: string | null
          description: string | null
          event_id: string | null
          id: string
          include_invitation_pdf: boolean | null
          include_program_pdf: boolean | null
          is_active: boolean | null
          is_default: boolean | null
          name: string
          preview_data: Json | null
          slug: string
          subject: string
          updated_at: string | null
          variables_available: string[] | null
          variables_required: string[] | null
        }
        Insert: {
          attachment_urls?: string[] | null
          body_html: string
          body_text?: string | null
          category: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_id?: string | null
          id?: string
          include_invitation_pdf?: boolean | null
          include_program_pdf?: boolean | null
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          preview_data?: Json | null
          slug: string
          subject: string
          updated_at?: string | null
          variables_available?: string[] | null
          variables_required?: string[] | null
        }
        Update: {
          attachment_urls?: string[] | null
          body_html?: string
          body_text?: string | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_id?: string | null
          id?: string
          include_invitation_pdf?: boolean | null
          include_program_pdf?: boolean | null
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          preview_data?: Json | null
          slug?: string
          subject?: string
          updated_at?: string | null
          variables_available?: string[] | null
          variables_required?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_admins: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          event_id: string
          id: string
          is_active: boolean | null
          permissions: string[] | null
          role: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          event_id: string
          id?: string
          is_active?: boolean | null
          permissions?: string[] | null
          role?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          event_id?: string
          id?: string
          is_active?: boolean | null
          permissions?: string[] | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_admins_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_admins_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_admins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_analytics_daily: {
        Row: {
          checkout_page_views: number | null
          conversion_rate: number | null
          created_at: string | null
          date: string
          desktop_views: number | null
          event_id: string
          id: string
          mobile_views: number | null
          page_views: number | null
          registration_page_views: number | null
          registrations: number | null
          top_referrer: string | null
          top_utm_source: string | null
          unique_visitors: number | null
          updated_at: string | null
        }
        Insert: {
          checkout_page_views?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          date: string
          desktop_views?: number | null
          event_id: string
          id?: string
          mobile_views?: number | null
          page_views?: number | null
          registration_page_views?: number | null
          registrations?: number | null
          top_referrer?: string | null
          top_utm_source?: string | null
          unique_visitors?: number | null
          updated_at?: string | null
        }
        Update: {
          checkout_page_views?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          date?: string
          desktop_views?: number | null
          event_id?: string
          id?: string
          mobile_views?: number | null
          page_views?: number | null
          registration_page_views?: number | null
          registrations?: number | null
          top_referrer?: string | null
          top_utm_source?: string | null
          unique_visitors?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_analytics_daily_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_faculty: {
        Row: {
          accepted_sessions: number | null
          accommodation_check_in: string | null
          accommodation_check_out: string | null
          accommodation_confirmation: string | null
          accommodation_hotel: string | null
          accommodation_nights: number | null
          accommodation_notes: string | null
          accommodation_required: boolean | null
          accommodation_room_type: string | null
          arrival_date: string | null
          arrival_details: string | null
          arrival_time: string | null
          badge_printed: boolean | null
          certificate_downloaded: boolean | null
          certificate_generated: boolean | null
          certificate_generated_at: string | null
          certificate_url: string | null
          created_at: string | null
          departure_date: string | null
          departure_details: string | null
          departure_time: string | null
          display_order: number | null
          event_id: string
          faculty_id: string
          honorarium: number | null
          honorarium_amount: number | null
          honorarium_applicable: boolean | null
          honorarium_currency: string | null
          honorarium_paid_date: string | null
          honorarium_reference: string | null
          honorarium_status: string | null
          id: string
          internal_notes: string | null
          invitation_method: string | null
          invitation_sent_at: string | null
          invitation_status:
            | Database["public"]["Enums"]["invitation_status"]
            | null
          is_confirmed: boolean | null
          is_featured: boolean | null
          kit_collected: boolean | null
          kit_collected_at: string | null
          last_reminder_at: string | null
          next_reminder_at: string | null
          payment_method: string | null
          pending_sessions: number | null
          priority: string | null
          registration_amount: number | null
          registration_id: string | null
          registration_status: string | null
          registration_type: string | null
          rejected_sessions: number | null
          reminder_count: number | null
          requires_accommodation: boolean | null
          requires_travel: boolean | null
          response_at: string | null
          response_date: string | null
          response_notes: string | null
          response_status: Database["public"]["Enums"]["response_status"] | null
          role: string | null
          roles: Database["public"]["Enums"]["faculty_session_role"][] | null
          session_topics: string[] | null
          tds_deducted: number | null
          total_sessions: number | null
          travel_from_city: string | null
          travel_mode: string | null
          travel_notes: string | null
          travel_pnr: string | null
          travel_required: boolean | null
          updated_at: string | null
          vip: boolean | null
        }
        Insert: {
          accepted_sessions?: number | null
          accommodation_check_in?: string | null
          accommodation_check_out?: string | null
          accommodation_confirmation?: string | null
          accommodation_hotel?: string | null
          accommodation_nights?: number | null
          accommodation_notes?: string | null
          accommodation_required?: boolean | null
          accommodation_room_type?: string | null
          arrival_date?: string | null
          arrival_details?: string | null
          arrival_time?: string | null
          badge_printed?: boolean | null
          certificate_downloaded?: boolean | null
          certificate_generated?: boolean | null
          certificate_generated_at?: string | null
          certificate_url?: string | null
          created_at?: string | null
          departure_date?: string | null
          departure_details?: string | null
          departure_time?: string | null
          display_order?: number | null
          event_id: string
          faculty_id: string
          honorarium?: number | null
          honorarium_amount?: number | null
          honorarium_applicable?: boolean | null
          honorarium_currency?: string | null
          honorarium_paid_date?: string | null
          honorarium_reference?: string | null
          honorarium_status?: string | null
          id?: string
          internal_notes?: string | null
          invitation_method?: string | null
          invitation_sent_at?: string | null
          invitation_status?:
            | Database["public"]["Enums"]["invitation_status"]
            | null
          is_confirmed?: boolean | null
          is_featured?: boolean | null
          kit_collected?: boolean | null
          kit_collected_at?: string | null
          last_reminder_at?: string | null
          next_reminder_at?: string | null
          payment_method?: string | null
          pending_sessions?: number | null
          priority?: string | null
          registration_amount?: number | null
          registration_id?: string | null
          registration_status?: string | null
          registration_type?: string | null
          rejected_sessions?: number | null
          reminder_count?: number | null
          requires_accommodation?: boolean | null
          requires_travel?: boolean | null
          response_at?: string | null
          response_date?: string | null
          response_notes?: string | null
          response_status?:
            | Database["public"]["Enums"]["response_status"]
            | null
          role?: string | null
          roles?: Database["public"]["Enums"]["faculty_session_role"][] | null
          session_topics?: string[] | null
          tds_deducted?: number | null
          total_sessions?: number | null
          travel_from_city?: string | null
          travel_mode?: string | null
          travel_notes?: string | null
          travel_pnr?: string | null
          travel_required?: boolean | null
          updated_at?: string | null
          vip?: boolean | null
        }
        Update: {
          accepted_sessions?: number | null
          accommodation_check_in?: string | null
          accommodation_check_out?: string | null
          accommodation_confirmation?: string | null
          accommodation_hotel?: string | null
          accommodation_nights?: number | null
          accommodation_notes?: string | null
          accommodation_required?: boolean | null
          accommodation_room_type?: string | null
          arrival_date?: string | null
          arrival_details?: string | null
          arrival_time?: string | null
          badge_printed?: boolean | null
          certificate_downloaded?: boolean | null
          certificate_generated?: boolean | null
          certificate_generated_at?: string | null
          certificate_url?: string | null
          created_at?: string | null
          departure_date?: string | null
          departure_details?: string | null
          departure_time?: string | null
          display_order?: number | null
          event_id?: string
          faculty_id?: string
          honorarium?: number | null
          honorarium_amount?: number | null
          honorarium_applicable?: boolean | null
          honorarium_currency?: string | null
          honorarium_paid_date?: string | null
          honorarium_reference?: string | null
          honorarium_status?: string | null
          id?: string
          internal_notes?: string | null
          invitation_method?: string | null
          invitation_sent_at?: string | null
          invitation_status?:
            | Database["public"]["Enums"]["invitation_status"]
            | null
          is_confirmed?: boolean | null
          is_featured?: boolean | null
          kit_collected?: boolean | null
          kit_collected_at?: string | null
          last_reminder_at?: string | null
          next_reminder_at?: string | null
          payment_method?: string | null
          pending_sessions?: number | null
          priority?: string | null
          registration_amount?: number | null
          registration_id?: string | null
          registration_status?: string | null
          registration_type?: string | null
          rejected_sessions?: number | null
          reminder_count?: number | null
          requires_accommodation?: boolean | null
          requires_travel?: boolean | null
          response_at?: string | null
          response_date?: string | null
          response_notes?: string | null
          response_status?:
            | Database["public"]["Enums"]["response_status"]
            | null
          role?: string | null
          roles?: Database["public"]["Enums"]["faculty_session_role"][] | null
          session_topics?: string[] | null
          tds_deducted?: number | null
          total_sessions?: number | null
          travel_from_city?: string | null
          travel_mode?: string | null
          travel_notes?: string | null
          travel_pnr?: string | null
          travel_required?: boolean | null
          updated_at?: string | null
          vip?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "event_faculty_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_faculty_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculty"
            referencedColumns: ["id"]
          },
        ]
      }
      event_lead_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          type: string | null
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          type?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "event_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      event_leads: {
        Row: {
          converted_at: string | null
          created_at: string | null
          email: string
          event_id: string
          id: string
          name: string | null
          notes: string | null
          phone: string | null
          registration_id: string | null
          source: string | null
          status: string | null
          updated_at: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          visitor_id: string | null
        }
        Insert: {
          converted_at?: string | null
          created_at?: string | null
          email: string
          event_id: string
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          registration_id?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id?: string | null
        }
        Update: {
          converted_at?: string | null
          created_at?: string | null
          email?: string
          event_id?: string
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          registration_id?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_leads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_leads_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          event_id: string
          id: string
          invited_at: string
          invited_by: string | null
          role: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          role?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_members_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_page_views: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string | null
          device_type: string | null
          event_id: string
          id: string
          ip_hash: string | null
          page_type: string
          referrer: string | null
          session_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          visitor_id: string
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          event_id: string
          id?: string
          ip_hash?: string | null
          page_type?: string
          referrer?: string | null
          session_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id: string
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          event_id?: string
          id?: string
          ip_hash?: string | null
          page_type?: string
          referrer?: string | null
          session_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_page_views_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_settings: {
        Row: {
          allow_attendee_login: boolean | null
          allow_buyers: boolean | null
          allow_cancellation: boolean | null
          allow_duplicate_email: boolean | null
          allow_multiple_addons: boolean | null
          allow_multiple_ticket_types: boolean | null
          auto_email_badge: boolean | null
          auto_email_certificate: boolean | null
          auto_generate_badge: boolean | null
          auto_generate_certificate: boolean | null
          auto_send_receipt: boolean | null
          auto_send_reminder: boolean | null
          auto_send_survey: boolean | null
          auto_waitlist: boolean
          buyer_form_id: string | null
          cancellation_deadline_hours: number | null
          confirmation_email_body: string | null
          confirmation_email_subject: string | null
          created_at: string | null
          current_registration_number: number | null
          customize_registration_id: boolean | null
          enable_abstracts: boolean | null
          enable_accommodation: boolean | null
          enable_addons: boolean | null
          enable_badges: boolean | null
          enable_budget: boolean | null
          enable_certificates: boolean | null
          enable_checkin: boolean | null
          enable_convocation: boolean | null
          enable_delegate_portal: boolean | null
          enable_examination: boolean | null
          enable_forms: boolean | null
          enable_leads: boolean | null
          enable_meals: boolean | null
          enable_print_station: boolean | null
          enable_program: boolean | null
          enable_speakers: boolean | null
          enable_sponsors: boolean | null
          enable_surveys: boolean | null
          enable_travel: boolean | null
          enable_visa: boolean | null
          enable_waitlist: boolean | null
          event_id: string | null
          id: string
          integrations: Json
          registration_prefix: string | null
          registration_start_number: number | null
          registration_suffix: string | null
          reminder_lead_days: number | null
          require_approval: boolean | null
          send_confirmation_email: boolean | null
          send_reminder_email: boolean | null
          show_duplicate_warning: boolean | null
          speaker_content_deadline: string | null
          survey_form_id: string | null
          survey_send_delay_hours: number | null
          updated_at: string | null
        }
        Insert: {
          allow_attendee_login?: boolean | null
          allow_buyers?: boolean | null
          allow_cancellation?: boolean | null
          allow_duplicate_email?: boolean | null
          allow_multiple_addons?: boolean | null
          allow_multiple_ticket_types?: boolean | null
          auto_email_badge?: boolean | null
          auto_email_certificate?: boolean | null
          auto_generate_badge?: boolean | null
          auto_generate_certificate?: boolean | null
          auto_send_receipt?: boolean | null
          auto_send_reminder?: boolean | null
          auto_send_survey?: boolean | null
          auto_waitlist?: boolean
          buyer_form_id?: string | null
          cancellation_deadline_hours?: number | null
          confirmation_email_body?: string | null
          confirmation_email_subject?: string | null
          created_at?: string | null
          current_registration_number?: number | null
          customize_registration_id?: boolean | null
          enable_abstracts?: boolean | null
          enable_accommodation?: boolean | null
          enable_addons?: boolean | null
          enable_badges?: boolean | null
          enable_budget?: boolean | null
          enable_certificates?: boolean | null
          enable_checkin?: boolean | null
          enable_convocation?: boolean | null
          enable_delegate_portal?: boolean | null
          enable_examination?: boolean | null
          enable_forms?: boolean | null
          enable_leads?: boolean | null
          enable_meals?: boolean | null
          enable_print_station?: boolean | null
          enable_program?: boolean | null
          enable_speakers?: boolean | null
          enable_sponsors?: boolean | null
          enable_surveys?: boolean | null
          enable_travel?: boolean | null
          enable_visa?: boolean | null
          enable_waitlist?: boolean | null
          event_id?: string | null
          id?: string
          integrations?: Json
          registration_prefix?: string | null
          registration_start_number?: number | null
          registration_suffix?: string | null
          reminder_lead_days?: number | null
          require_approval?: boolean | null
          send_confirmation_email?: boolean | null
          send_reminder_email?: boolean | null
          show_duplicate_warning?: boolean | null
          speaker_content_deadline?: string | null
          survey_form_id?: string | null
          survey_send_delay_hours?: number | null
          updated_at?: string | null
        }
        Update: {
          allow_attendee_login?: boolean | null
          allow_buyers?: boolean | null
          allow_cancellation?: boolean | null
          allow_duplicate_email?: boolean | null
          allow_multiple_addons?: boolean | null
          allow_multiple_ticket_types?: boolean | null
          auto_email_badge?: boolean | null
          auto_email_certificate?: boolean | null
          auto_generate_badge?: boolean | null
          auto_generate_certificate?: boolean | null
          auto_send_receipt?: boolean | null
          auto_send_reminder?: boolean | null
          auto_send_survey?: boolean | null
          auto_waitlist?: boolean
          buyer_form_id?: string | null
          cancellation_deadline_hours?: number | null
          confirmation_email_body?: string | null
          confirmation_email_subject?: string | null
          created_at?: string | null
          current_registration_number?: number | null
          customize_registration_id?: boolean | null
          enable_abstracts?: boolean | null
          enable_accommodation?: boolean | null
          enable_addons?: boolean | null
          enable_badges?: boolean | null
          enable_budget?: boolean | null
          enable_certificates?: boolean | null
          enable_checkin?: boolean | null
          enable_convocation?: boolean | null
          enable_delegate_portal?: boolean | null
          enable_examination?: boolean | null
          enable_forms?: boolean | null
          enable_leads?: boolean | null
          enable_meals?: boolean | null
          enable_print_station?: boolean | null
          enable_program?: boolean | null
          enable_speakers?: boolean | null
          enable_sponsors?: boolean | null
          enable_surveys?: boolean | null
          enable_travel?: boolean | null
          enable_visa?: boolean | null
          enable_waitlist?: boolean | null
          event_id?: string | null
          id?: string
          integrations?: Json
          registration_prefix?: string | null
          registration_start_number?: number | null
          registration_suffix?: string | null
          reminder_lead_days?: number | null
          require_approval?: boolean | null
          send_confirmation_email?: boolean | null
          send_reminder_email?: boolean | null
          show_duplicate_warning?: boolean | null
          speaker_content_deadline?: string | null
          survey_form_id?: string | null
          survey_send_delay_hours?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_settings_buyer_form_id_fkey"
            columns: ["buyer_form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_settings_survey_form_id_fkey"
            columns: ["survey_form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      event_settings_log: {
        Row: {
          changed_at: string
          changed_by: string
          event_id: string
          id: string
          section: string
          snapshot: Json | null
          summary: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          event_id: string
          id?: string
          section: string
          snapshot?: Json | null
          summary: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          event_id?: string
          id?: string
          section?: string
          snapshot?: Json | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_settings_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_team: {
        Row: {
          assigned_days: number[] | null
          assigned_halls: string[] | null
          can_edit: boolean | null
          can_export: boolean | null
          created_at: string | null
          dashboard_access: string[] | null
          department: string | null
          email: string | null
          event_id: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          role: string
          shift_timing: string | null
          user_id: string | null
        }
        Insert: {
          assigned_days?: number[] | null
          assigned_halls?: string[] | null
          can_edit?: boolean | null
          can_export?: boolean | null
          created_at?: string | null
          dashboard_access?: string[] | null
          department?: string | null
          email?: string | null
          event_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          role: string
          shift_timing?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_days?: number[] | null
          assigned_halls?: string[] | null
          can_edit?: boolean | null
          can_export?: boolean | null
          created_at?: string | null
          dashboard_access?: string[] | null
          department?: string | null
          email?: string | null
          event_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          role?: string
          shift_timing?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_team_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_team_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_team_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          abstract_deadline: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_branch: string | null
          bank_ifsc_code: string | null
          bank_name: string | null
          bank_upi_id: string | null
          banner_url: string | null
          brochure_url: string | null
          city: string | null
          confirmed_faculty: number | null
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          discount_enabled: boolean | null
          early_bird_end: string | null
          edition: number | null
          end_date: string
          event_type: string
          favicon_url: string | null
          id: string
          is_hybrid: boolean | null
          is_public: boolean | null
          is_virtual: boolean | null
          logo_url: string | null
          max_attendees: number | null
          name: string
          organized_by: string | null
          organizing_chairman: string | null
          organizing_secretary: string | null
          payment_methods_enabled: Json | null
          pending_faculty: number | null
          primary_color: string | null
          razorpay_key_id: string | null
          razorpay_key_secret: string | null
          razorpay_webhook_secret: string | null
          registration_deadline: string | null
          registration_end: string | null
          registration_open: boolean | null
          registration_settings: Json | null
          registration_start: string | null
          scientific_chairman: string | null
          seo_description: string | null
          seo_title: string | null
          settings: Json | null
          short_name: string | null
          signatory_title: string | null
          signature_image_url: string | null
          slug: string
          social_instagram: string | null
          social_linkedin: string | null
          social_twitter: string | null
          start_date: string
          state: string | null
          status: Database["public"]["Enums"]["event_status"] | null
          tagline: string | null
          tenant: string
          timezone: string | null
          total_delegates: number | null
          total_faculty: number | null
          total_sessions: number | null
          treasurer: string | null
          updated_at: string | null
          venue_address: string | null
          venue_map_url: string | null
          venue_name: string | null
          virtual_link: string | null
          virtual_platform: string | null
          visibility: string | null
          website_url: string | null
          welcome_message: string | null
          year: string | null
        }
        Insert: {
          abstract_deadline?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_ifsc_code?: string | null
          bank_name?: string | null
          bank_upi_id?: string | null
          banner_url?: string | null
          brochure_url?: string | null
          city?: string | null
          confirmed_faculty?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_enabled?: boolean | null
          early_bird_end?: string | null
          edition?: number | null
          end_date: string
          event_type?: string
          favicon_url?: string | null
          id?: string
          is_hybrid?: boolean | null
          is_public?: boolean | null
          is_virtual?: boolean | null
          logo_url?: string | null
          max_attendees?: number | null
          name: string
          organized_by?: string | null
          organizing_chairman?: string | null
          organizing_secretary?: string | null
          payment_methods_enabled?: Json | null
          pending_faculty?: number | null
          primary_color?: string | null
          razorpay_key_id?: string | null
          razorpay_key_secret?: string | null
          razorpay_webhook_secret?: string | null
          registration_deadline?: string | null
          registration_end?: string | null
          registration_open?: boolean | null
          registration_settings?: Json | null
          registration_start?: string | null
          scientific_chairman?: string | null
          seo_description?: string | null
          seo_title?: string | null
          settings?: Json | null
          short_name?: string | null
          signatory_title?: string | null
          signature_image_url?: string | null
          slug: string
          social_instagram?: string | null
          social_linkedin?: string | null
          social_twitter?: string | null
          start_date: string
          state?: string | null
          status?: Database["public"]["Enums"]["event_status"] | null
          tagline?: string | null
          tenant?: string
          timezone?: string | null
          total_delegates?: number | null
          total_faculty?: number | null
          total_sessions?: number | null
          treasurer?: string | null
          updated_at?: string | null
          venue_address?: string | null
          venue_map_url?: string | null
          venue_name?: string | null
          virtual_link?: string | null
          virtual_platform?: string | null
          visibility?: string | null
          website_url?: string | null
          welcome_message?: string | null
          year?: string | null
        }
        Update: {
          abstract_deadline?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_ifsc_code?: string | null
          bank_name?: string | null
          bank_upi_id?: string | null
          banner_url?: string | null
          brochure_url?: string | null
          city?: string | null
          confirmed_faculty?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_enabled?: boolean | null
          early_bird_end?: string | null
          edition?: number | null
          end_date?: string
          event_type?: string
          favicon_url?: string | null
          id?: string
          is_hybrid?: boolean | null
          is_public?: boolean | null
          is_virtual?: boolean | null
          logo_url?: string | null
          max_attendees?: number | null
          name?: string
          organized_by?: string | null
          organizing_chairman?: string | null
          organizing_secretary?: string | null
          payment_methods_enabled?: Json | null
          pending_faculty?: number | null
          primary_color?: string | null
          razorpay_key_id?: string | null
          razorpay_key_secret?: string | null
          razorpay_webhook_secret?: string | null
          registration_deadline?: string | null
          registration_end?: string | null
          registration_open?: boolean | null
          registration_settings?: Json | null
          registration_start?: string | null
          scientific_chairman?: string | null
          seo_description?: string | null
          seo_title?: string | null
          settings?: Json | null
          short_name?: string | null
          signatory_title?: string | null
          signature_image_url?: string | null
          slug?: string
          social_instagram?: string | null
          social_linkedin?: string | null
          social_twitter?: string | null
          start_date?: string
          state?: string | null
          status?: Database["public"]["Enums"]["event_status"] | null
          tagline?: string | null
          tenant?: string
          timezone?: string | null
          total_delegates?: number | null
          total_faculty?: number | null
          total_sessions?: number | null
          treasurer?: string | null
          updated_at?: string | null
          venue_address?: string | null
          venue_map_url?: string | null
          venue_name?: string | null
          virtual_link?: string | null
          virtual_platform?: string | null
          visibility?: string | null
          website_url?: string | null
          welcome_message?: string | null
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string | null
          created_by: string | null
          description: string
          event_id: string | null
          expense_date: string
          id: string
          invoice_number: string | null
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: string | null
          receipt_url: string | null
          updated_at: string | null
          vendor_name: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          event_id?: string | null
          expense_date?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          receipt_url?: string | null
          updated_at?: string | null
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          event_id?: string | null
          expense_date?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          receipt_url?: string | null
          updated_at?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      faculty: {
        Row: {
          acceptance_rate: number | null
          address: string | null
          areas_of_interest: string[] | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_name: string | null
          bio: string | null
          bio_markdown: string | null
          blacklist_reason: string | null
          city: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          department: string | null
          designation: string | null
          dietary_preference: string | null
          email: string | null
          email_secondary: string | null
          experience_years: number | null
          expertise_tags: string[]
          gst_number: string | null
          headshot_urls: Json
          id: string
          institution: string | null
          institution_city: string | null
          institution_type: string | null
          internal_notes: string | null
          is_reviewer: boolean | null
          last_event_date: string | null
          last_event_name: string | null
          linkedin: string | null
          member_id: string | null
          name: string
          orcid_id: string | null
          pan_number: string | null
          phone: string | null
          phone_secondary: string | null
          photo_url: string | null
          pincode: string | null
          preferred_contact: string | null
          pubmed_id: string | null
          qualification: string | null
          researchgate: string | null
          reviewer_specialties: string | null
          source: string | null
          specialty: string | null
          state: string | null
          status: string | null
          sub_specialty: string | null
          title: string | null
          total_events: number | null
          total_sessions: number | null
          tshirt_size: string | null
          twitter: string | null
          updated_at: string | null
          user_id: string | null
          website: string | null
          whatsapp: string | null
          youtube_reel_url: string | null
        }
        Insert: {
          acceptance_rate?: number | null
          address?: string | null
          areas_of_interest?: string[] | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          bio?: string | null
          bio_markdown?: string | null
          blacklist_reason?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          designation?: string | null
          dietary_preference?: string | null
          email?: string | null
          email_secondary?: string | null
          experience_years?: number | null
          expertise_tags?: string[]
          gst_number?: string | null
          headshot_urls?: Json
          id?: string
          institution?: string | null
          institution_city?: string | null
          institution_type?: string | null
          internal_notes?: string | null
          is_reviewer?: boolean | null
          last_event_date?: string | null
          last_event_name?: string | null
          linkedin?: string | null
          member_id?: string | null
          name: string
          orcid_id?: string | null
          pan_number?: string | null
          phone?: string | null
          phone_secondary?: string | null
          photo_url?: string | null
          pincode?: string | null
          preferred_contact?: string | null
          pubmed_id?: string | null
          qualification?: string | null
          researchgate?: string | null
          reviewer_specialties?: string | null
          source?: string | null
          specialty?: string | null
          state?: string | null
          status?: string | null
          sub_specialty?: string | null
          title?: string | null
          total_events?: number | null
          total_sessions?: number | null
          tshirt_size?: string | null
          twitter?: string | null
          updated_at?: string | null
          user_id?: string | null
          website?: string | null
          whatsapp?: string | null
          youtube_reel_url?: string | null
        }
        Update: {
          acceptance_rate?: number | null
          address?: string | null
          areas_of_interest?: string[] | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          bio?: string | null
          bio_markdown?: string | null
          blacklist_reason?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          designation?: string | null
          dietary_preference?: string | null
          email?: string | null
          email_secondary?: string | null
          experience_years?: number | null
          expertise_tags?: string[]
          gst_number?: string | null
          headshot_urls?: Json
          id?: string
          institution?: string | null
          institution_city?: string | null
          institution_type?: string | null
          internal_notes?: string | null
          is_reviewer?: boolean | null
          last_event_date?: string | null
          last_event_name?: string | null
          linkedin?: string | null
          member_id?: string | null
          name?: string
          orcid_id?: string | null
          pan_number?: string | null
          phone?: string | null
          phone_secondary?: string | null
          photo_url?: string | null
          pincode?: string | null
          preferred_contact?: string | null
          pubmed_id?: string | null
          qualification?: string | null
          researchgate?: string | null
          reviewer_specialties?: string | null
          source?: string | null
          specialty?: string | null
          state?: string | null
          status?: string | null
          sub_specialty?: string | null
          title?: string | null
          total_events?: number | null
          total_sessions?: number | null
          tshirt_size?: string | null
          twitter?: string | null
          updated_at?: string | null
          user_id?: string | null
          website?: string | null
          whatsapp?: string | null
          youtube_reel_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faculty_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faculty_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faculty_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "active_amasi_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faculty_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faculty_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faculty_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      faculty_assignments: {
        Row: {
          created_at: string | null
          display_order: number
          end_time: string | null
          event_id: string
          faculty_email: string | null
          faculty_id: string | null
          faculty_name: string
          faculty_phone: string | null
          hall: string | null
          id: string
          invitation_sent_at: string | null
          invitation_token: string | null
          participation_mode: string | null
          registration_id: string | null
          replaced_by: string | null
          responded_at: string | null
          response_notes: string | null
          role: string
          session_date: string | null
          session_id: string | null
          session_name: string | null
          start_time: string | null
          status: string | null
          topic_description: string | null
          topic_title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          end_time?: string | null
          event_id: string
          faculty_email?: string | null
          faculty_id?: string | null
          faculty_name: string
          faculty_phone?: string | null
          hall?: string | null
          id?: string
          invitation_sent_at?: string | null
          invitation_token?: string | null
          participation_mode?: string | null
          registration_id?: string | null
          replaced_by?: string | null
          responded_at?: string | null
          response_notes?: string | null
          role: string
          session_date?: string | null
          session_id?: string | null
          session_name?: string | null
          start_time?: string | null
          status?: string | null
          topic_description?: string | null
          topic_title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          end_time?: string | null
          event_id?: string
          faculty_email?: string | null
          faculty_id?: string | null
          faculty_name?: string
          faculty_phone?: string | null
          hall?: string | null
          id?: string
          invitation_sent_at?: string | null
          invitation_token?: string | null
          participation_mode?: string | null
          registration_id?: string | null
          replaced_by?: string | null
          responded_at?: string | null
          response_notes?: string | null
          role?: string
          session_date?: string | null
          session_id?: string | null
          session_name?: string | null
          start_time?: string | null
          status?: string | null
          topic_description?: string | null
          topic_title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faculty_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faculty_assignments_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faculty_assignments_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faculty_assignments_replaced_by_fkey"
            columns: ["replaced_by"]
            isOneToOne: false
            referencedRelation: "faculty_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faculty_assignments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      faculty_assignments_127_pre_final_snapshot_2026_06_29: {
        Row: {
          created_at: string | null
          display_order: number | null
          end_time: string | null
          event_id: string | null
          faculty_email: string | null
          faculty_id: string | null
          faculty_name: string | null
          faculty_phone: string | null
          hall: string | null
          id: string | null
          invitation_sent_at: string | null
          invitation_token: string | null
          participation_mode: string | null
          registration_id: string | null
          replaced_by: string | null
          responded_at: string | null
          response_notes: string | null
          role: string | null
          session_date: string | null
          session_id: string | null
          session_name: string | null
          start_time: string | null
          status: string | null
          topic_description: string | null
          topic_title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          end_time?: string | null
          event_id?: string | null
          faculty_email?: string | null
          faculty_id?: string | null
          faculty_name?: string | null
          faculty_phone?: string | null
          hall?: string | null
          id?: string | null
          invitation_sent_at?: string | null
          invitation_token?: string | null
          participation_mode?: string | null
          registration_id?: string | null
          replaced_by?: string | null
          responded_at?: string | null
          response_notes?: string | null
          role?: string | null
          session_date?: string | null
          session_id?: string | null
          session_name?: string | null
          start_time?: string | null
          status?: string | null
          topic_description?: string | null
          topic_title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          end_time?: string | null
          event_id?: string | null
          faculty_email?: string | null
          faculty_id?: string | null
          faculty_name?: string | null
          faculty_phone?: string | null
          hall?: string | null
          id?: string | null
          invitation_sent_at?: string | null
          invitation_token?: string | null
          participation_mode?: string | null
          registration_id?: string | null
          replaced_by?: string | null
          responded_at?: string | null
          response_notes?: string | null
          role?: string | null
          session_date?: string | null
          session_id?: string | null
          session_name?: string | null
          start_time?: string | null
          status?: string | null
          topic_description?: string | null
          topic_title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fcm_tokens: {
        Row: {
          app_version: string | null
          created_at: string
          id: string
          last_seen_at: string
          member_id: string | null
          platform: string
          token: string
          updated_at: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          id?: string
          last_seen_at?: string
          member_id?: string | null
          platform?: string
          token: string
          updated_at?: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          id?: string
          last_seen_at?: string
          member_id?: string | null
          platform?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fcm_tokens_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "active_amasi_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fcm_tokens_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      form_fields: {
        Row: {
          conditional_logic: Json | null
          created_at: string | null
          field_type: string
          form_id: string
          help_text: string | null
          id: string
          is_required: boolean | null
          label: string
          max_length: number | null
          max_value: number | null
          min_length: number | null
          min_value: number | null
          options: Json | null
          pattern: string | null
          placeholder: string | null
          section_id: string | null
          settings: Json | null
          sort_order: number
          updated_at: string | null
          width: string | null
        }
        Insert: {
          conditional_logic?: Json | null
          created_at?: string | null
          field_type: string
          form_id: string
          help_text?: string | null
          id?: string
          is_required?: boolean | null
          label: string
          max_length?: number | null
          max_value?: number | null
          min_length?: number | null
          min_value?: number | null
          options?: Json | null
          pattern?: string | null
          placeholder?: string | null
          section_id?: string | null
          settings?: Json | null
          sort_order?: number
          updated_at?: string | null
          width?: string | null
        }
        Update: {
          conditional_logic?: Json | null
          created_at?: string | null
          field_type?: string
          form_id?: string
          help_text?: string | null
          id?: string
          is_required?: boolean | null
          label?: string
          max_length?: number | null
          max_value?: number | null
          min_length?: number | null
          min_value?: number | null
          options?: Json | null
          pattern?: string | null
          placeholder?: string | null
          section_id?: string | null
          settings?: Json | null
          sort_order?: number
          updated_at?: string | null
          width?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_fields_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "form_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      form_sections: {
        Row: {
          created_at: string | null
          description: string | null
          form_id: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          form_id: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          form_id?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_sections_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          form_id: string
          id: string
          responses: Json
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          submitter_email: string | null
          submitter_ip: string | null
          submitter_name: string | null
          user_agent: string | null
        }
        Insert: {
          form_id: string
          id?: string
          responses: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          submitter_email?: string | null
          submitter_ip?: string | null
          submitter_name?: string | null
          user_agent?: string | null
        }
        Update: {
          form_id?: string
          id?: string
          responses?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          submitter_email?: string | null
          submitter_ip?: string | null
          submitter_name?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_templates: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          form_config: Json
          id: string
          is_system: boolean | null
          name: string
          thumbnail_url: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          form_config: Json
          id?: string
          is_system?: boolean | null
          name: string
          thumbnail_url?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          form_config?: Json
          id?: string
          is_system?: boolean | null
          name?: string
          thumbnail_url?: string | null
        }
        Relationships: []
      }
      forms: {
        Row: {
          allow_multiple_submissions: boolean | null
          auto_email_certificate: boolean | null
          background_color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          event_id: string | null
          form_type: string
          header_image_url: string | null
          id: string
          is_member_form: boolean | null
          is_public: boolean | null
          logo_url: string | null
          max_submissions: number | null
          membership_required_strict: boolean | null
          name: string
          notification_emails: string[] | null
          notify_on_submission: boolean | null
          primary_color: string | null
          redirect_url: string | null
          release_certificate_on_submission: boolean | null
          require_check_in_for_submission: boolean | null
          requires_auth: boolean | null
          slug: string | null
          status: string
          submission_deadline: string | null
          submit_button_text: string | null
          success_message: string | null
          updated_at: string | null
        }
        Insert: {
          allow_multiple_submissions?: boolean | null
          auto_email_certificate?: boolean | null
          background_color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_id?: string | null
          form_type?: string
          header_image_url?: string | null
          id?: string
          is_member_form?: boolean | null
          is_public?: boolean | null
          logo_url?: string | null
          max_submissions?: number | null
          membership_required_strict?: boolean | null
          name: string
          notification_emails?: string[] | null
          notify_on_submission?: boolean | null
          primary_color?: string | null
          redirect_url?: string | null
          release_certificate_on_submission?: boolean | null
          require_check_in_for_submission?: boolean | null
          requires_auth?: boolean | null
          slug?: string | null
          status?: string
          submission_deadline?: string | null
          submit_button_text?: string | null
          success_message?: string | null
          updated_at?: string | null
        }
        Update: {
          allow_multiple_submissions?: boolean | null
          auto_email_certificate?: boolean | null
          background_color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_id?: string | null
          form_type?: string
          header_image_url?: string | null
          id?: string
          is_member_form?: boolean | null
          is_public?: boolean | null
          logo_url?: string | null
          max_submissions?: number | null
          membership_required_strict?: boolean | null
          name?: string
          notification_emails?: string[] | null
          notify_on_submission?: boolean | null
          primary_color?: string | null
          redirect_url?: string | null
          release_certificate_on_submission?: boolean | null
          require_check_in_for_submission?: boolean | null
          requires_auth?: boolean | null
          slug?: string | null
          status?: string
          submission_deadline?: string | null
          submit_button_text?: string | null
          success_message?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forms_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_badges: {
        Row: {
          badge_data: Json | null
          badge_url: string | null
          created_at: string | null
          event_id: string
          generated_at: string | null
          id: string
          registration_id: string
          template_id: string
        }
        Insert: {
          badge_data?: Json | null
          badge_url?: string | null
          created_at?: string | null
          event_id: string
          generated_at?: string | null
          id?: string
          registration_id: string
          template_id: string
        }
        Update: {
          badge_data?: Json | null
          badge_url?: string | null
          created_at?: string | null
          event_id?: string
          generated_at?: string | null
          id?: string
          registration_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_badges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_badges_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_badges_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "badge_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      hall_coordinators: {
        Row: {
          coordinator_email: string
          coordinator_name: string
          coordinator_phone: string | null
          created_at: string | null
          event_id: string
          hall_name: string
          id: string
          portal_token: string
          updated_at: string | null
        }
        Insert: {
          coordinator_email: string
          coordinator_name: string
          coordinator_phone?: string | null
          created_at?: string | null
          event_id: string
          hall_name: string
          id?: string
          portal_token?: string
          updated_at?: string | null
        }
        Update: {
          coordinator_email?: string
          coordinator_name?: string
          coordinator_phone?: string | null
          created_at?: string | null
          event_id?: string
          hall_name?: string
          id?: string
          portal_token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hall_coordinators_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      help_request_replies: {
        Row: {
          created_at: string
          help_request_id: string
          id: string
          message: string
          sender_email: string | null
          sender_name: string | null
          sender_type: string
        }
        Insert: {
          created_at?: string
          help_request_id: string
          id?: string
          message: string
          sender_email?: string | null
          sender_name?: string | null
          sender_type: string
        }
        Update: {
          created_at?: string
          help_request_id?: string
          id?: string
          message?: string
          sender_email?: string | null
          sender_name?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_request_replies_help_request_id_fkey"
            columns: ["help_request_id"]
            isOneToOne: false
            referencedRelation: "help_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      help_requests: {
        Row: {
          admin_notes: string | null
          assigned_to: string | null
          category: string | null
          created_at: string
          email: string
          event_id: string
          id: string
          message: string
          name: string | null
          priority: string
          registration_number: string | null
          resolved_at: string | null
          status: string | null
        }
        Insert: {
          admin_notes?: string | null
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          email: string
          event_id: string
          id?: string
          message: string
          name?: string | null
          priority?: string
          registration_number?: string | null
          resolved_at?: string | null
          status?: string | null
        }
        Update: {
          admin_notes?: string | null
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          email?: string
          event_id?: string
          id?: string
          message?: string
          name?: string | null
          priority?: string
          registration_number?: string | null
          resolved_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "help_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          address: string | null
          booking_contact: string | null
          booking_reference: string | null
          check_in_time: string | null
          check_out_time: string | null
          contact_person: string | null
          created_at: string | null
          deluxe_rate: number | null
          deluxe_rooms: number | null
          email: string | null
          event_id: string
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          standard_rate: number | null
          standard_rooms: number | null
          suite_rate: number | null
          suite_rooms: number | null
          total_rooms: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          booking_contact?: string | null
          booking_reference?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          contact_person?: string | null
          created_at?: string | null
          deluxe_rate?: number | null
          deluxe_rooms?: number | null
          email?: string | null
          event_id: string
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          standard_rate?: number | null
          standard_rooms?: number | null
          suite_rate?: number | null
          suite_rooms?: number | null
          total_rooms?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          booking_contact?: string | null
          booking_reference?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          contact_person?: string | null
          created_at?: string | null
          deluxe_rate?: number | null
          deluxe_rooms?: number | null
          email?: string | null
          event_id?: string
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          standard_rate?: number | null
          standard_rooms?: number | null
          suite_rate?: number | null
          suite_rooms?: number | null
          total_rooms?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotels_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      lm_asi_deepdive_2026_06_24_snapshot: {
        Row: {
          active_license: string | null
          amasi_number: number | null
          application_date: string | null
          application_no: string | null
          application_status: number | null
          asi_member_certificate: string | null
          asi_member_id: string | null
          asi_membership_no: string | null
          asi_state: string | null
          city: string | null
          country: string | null
          created_at: string | null
          date_of_birth: string | null
          edu_superspecialty_college: string | null
          edu_superspecialty_degree: string | null
          edu_superspecialty_university: string | null
          edu_superspecialty_year: string | null
          edu_undergrad_degree: string | null
          email: string | null
          father_name: string | null
          first_name: string | null
          gender: string | null
          id: string | null
          imr_registration_no: string | null
          joining_date: string | null
          landline: string | null
          last_name: string | null
          letter_hod: string | null
          marketing_opt_out_at: string | null
          mbbs_degree_certificate: string | null
          mci_certificate: string | null
          mci_council_number: string | null
          mci_council_state: string | null
          membership_type: string | null
          middle_name: string | null
          mobile_code: string | null
          mysql_id: number | null
          name: string | null
          nationality: string | null
          other_intl_org: string | null
          other_intl_org_value: string | null
          pg_college: string | null
          pg_degree: string | null
          pg_degree_certificate: string | null
          pg_university: string | null
          pg_year: string | null
          phone: number | null
          postal_code: string | null
          profile_photo: string | null
          salutation: string | null
          snapshot_at: string | null
          state: string | null
          status: string | null
          std_code: string | null
          street_address_1: string | null
          street_address_2: string | null
          ug_college: string | null
          ug_university: string | null
          ug_year: string | null
          updated_at: string | null
          voting_eligible: boolean | null
          zone: string | null
        }
        Insert: {
          active_license?: string | null
          amasi_number?: number | null
          application_date?: string | null
          application_no?: string | null
          application_status?: number | null
          asi_member_certificate?: string | null
          asi_member_id?: string | null
          asi_membership_no?: string | null
          asi_state?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          edu_superspecialty_college?: string | null
          edu_superspecialty_degree?: string | null
          edu_superspecialty_university?: string | null
          edu_superspecialty_year?: string | null
          edu_undergrad_degree?: string | null
          email?: string | null
          father_name?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string | null
          imr_registration_no?: string | null
          joining_date?: string | null
          landline?: string | null
          last_name?: string | null
          letter_hod?: string | null
          marketing_opt_out_at?: string | null
          mbbs_degree_certificate?: string | null
          mci_certificate?: string | null
          mci_council_number?: string | null
          mci_council_state?: string | null
          membership_type?: string | null
          middle_name?: string | null
          mobile_code?: string | null
          mysql_id?: number | null
          name?: string | null
          nationality?: string | null
          other_intl_org?: string | null
          other_intl_org_value?: string | null
          pg_college?: string | null
          pg_degree?: string | null
          pg_degree_certificate?: string | null
          pg_university?: string | null
          pg_year?: string | null
          phone?: number | null
          postal_code?: string | null
          profile_photo?: string | null
          salutation?: string | null
          snapshot_at?: string | null
          state?: string | null
          status?: string | null
          std_code?: string | null
          street_address_1?: string | null
          street_address_2?: string | null
          ug_college?: string | null
          ug_university?: string | null
          ug_year?: string | null
          updated_at?: string | null
          voting_eligible?: boolean | null
          zone?: string | null
        }
        Update: {
          active_license?: string | null
          amasi_number?: number | null
          application_date?: string | null
          application_no?: string | null
          application_status?: number | null
          asi_member_certificate?: string | null
          asi_member_id?: string | null
          asi_membership_no?: string | null
          asi_state?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          edu_superspecialty_college?: string | null
          edu_superspecialty_degree?: string | null
          edu_superspecialty_university?: string | null
          edu_superspecialty_year?: string | null
          edu_undergrad_degree?: string | null
          email?: string | null
          father_name?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string | null
          imr_registration_no?: string | null
          joining_date?: string | null
          landline?: string | null
          last_name?: string | null
          letter_hod?: string | null
          marketing_opt_out_at?: string | null
          mbbs_degree_certificate?: string | null
          mci_certificate?: string | null
          mci_council_number?: string | null
          mci_council_state?: string | null
          membership_type?: string | null
          middle_name?: string | null
          mobile_code?: string | null
          mysql_id?: number | null
          name?: string | null
          nationality?: string | null
          other_intl_org?: string | null
          other_intl_org_value?: string | null
          pg_college?: string | null
          pg_degree?: string | null
          pg_degree_certificate?: string | null
          pg_university?: string | null
          pg_year?: string | null
          phone?: number | null
          postal_code?: string | null
          profile_photo?: string | null
          salutation?: string | null
          snapshot_at?: string | null
          state?: string | null
          status?: string | null
          std_code?: string | null
          street_address_1?: string | null
          street_address_2?: string | null
          ug_college?: string | null
          ug_university?: string | null
          ug_year?: string | null
          updated_at?: string | null
          voting_eligible?: boolean | null
          zone?: string | null
        }
        Relationships: []
      }
      lm_asi_recover_2026_06_24_snapshot: {
        Row: {
          active_license: string | null
          amasi_number: number | null
          application_date: string | null
          application_no: string | null
          application_status: number | null
          asi_member_certificate: string | null
          asi_member_id: string | null
          asi_membership_no: string | null
          asi_state: string | null
          city: string | null
          country: string | null
          created_at: string | null
          date_of_birth: string | null
          edu_superspecialty_college: string | null
          edu_superspecialty_degree: string | null
          edu_superspecialty_university: string | null
          edu_superspecialty_year: string | null
          edu_undergrad_degree: string | null
          email: string | null
          father_name: string | null
          first_name: string | null
          gender: string | null
          id: string | null
          imr_registration_no: string | null
          joining_date: string | null
          landline: string | null
          last_name: string | null
          letter_hod: string | null
          marketing_opt_out_at: string | null
          mbbs_degree_certificate: string | null
          mci_certificate: string | null
          mci_council_number: string | null
          mci_council_state: string | null
          membership_type: string | null
          middle_name: string | null
          mobile_code: string | null
          mysql_id: number | null
          name: string | null
          nationality: string | null
          other_intl_org: string | null
          other_intl_org_value: string | null
          pg_college: string | null
          pg_degree: string | null
          pg_degree_certificate: string | null
          pg_university: string | null
          pg_year: string | null
          phone: number | null
          postal_code: string | null
          profile_photo: string | null
          salutation: string | null
          snapshot_at: string | null
          state: string | null
          status: string | null
          std_code: string | null
          street_address_1: string | null
          street_address_2: string | null
          ug_college: string | null
          ug_university: string | null
          ug_year: string | null
          updated_at: string | null
          voting_eligible: boolean | null
          zone: string | null
        }
        Insert: {
          active_license?: string | null
          amasi_number?: number | null
          application_date?: string | null
          application_no?: string | null
          application_status?: number | null
          asi_member_certificate?: string | null
          asi_member_id?: string | null
          asi_membership_no?: string | null
          asi_state?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          edu_superspecialty_college?: string | null
          edu_superspecialty_degree?: string | null
          edu_superspecialty_university?: string | null
          edu_superspecialty_year?: string | null
          edu_undergrad_degree?: string | null
          email?: string | null
          father_name?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string | null
          imr_registration_no?: string | null
          joining_date?: string | null
          landline?: string | null
          last_name?: string | null
          letter_hod?: string | null
          marketing_opt_out_at?: string | null
          mbbs_degree_certificate?: string | null
          mci_certificate?: string | null
          mci_council_number?: string | null
          mci_council_state?: string | null
          membership_type?: string | null
          middle_name?: string | null
          mobile_code?: string | null
          mysql_id?: number | null
          name?: string | null
          nationality?: string | null
          other_intl_org?: string | null
          other_intl_org_value?: string | null
          pg_college?: string | null
          pg_degree?: string | null
          pg_degree_certificate?: string | null
          pg_university?: string | null
          pg_year?: string | null
          phone?: number | null
          postal_code?: string | null
          profile_photo?: string | null
          salutation?: string | null
          snapshot_at?: string | null
          state?: string | null
          status?: string | null
          std_code?: string | null
          street_address_1?: string | null
          street_address_2?: string | null
          ug_college?: string | null
          ug_university?: string | null
          ug_year?: string | null
          updated_at?: string | null
          voting_eligible?: boolean | null
          zone?: string | null
        }
        Update: {
          active_license?: string | null
          amasi_number?: number | null
          application_date?: string | null
          application_no?: string | null
          application_status?: number | null
          asi_member_certificate?: string | null
          asi_member_id?: string | null
          asi_membership_no?: string | null
          asi_state?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          edu_superspecialty_college?: string | null
          edu_superspecialty_degree?: string | null
          edu_superspecialty_university?: string | null
          edu_superspecialty_year?: string | null
          edu_undergrad_degree?: string | null
          email?: string | null
          father_name?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string | null
          imr_registration_no?: string | null
          joining_date?: string | null
          landline?: string | null
          last_name?: string | null
          letter_hod?: string | null
          marketing_opt_out_at?: string | null
          mbbs_degree_certificate?: string | null
          mci_certificate?: string | null
          mci_council_number?: string | null
          mci_council_state?: string | null
          membership_type?: string | null
          middle_name?: string | null
          mobile_code?: string | null
          mysql_id?: number | null
          name?: string | null
          nationality?: string | null
          other_intl_org?: string | null
          other_intl_org_value?: string | null
          pg_college?: string | null
          pg_degree?: string | null
          pg_degree_certificate?: string | null
          pg_university?: string | null
          pg_year?: string | null
          phone?: number | null
          postal_code?: string | null
          profile_photo?: string | null
          salutation?: string | null
          snapshot_at?: string | null
          state?: string | null
          status?: string | null
          std_code?: string | null
          street_address_1?: string | null
          street_address_2?: string | null
          ug_college?: string | null
          ug_university?: string | null
          ug_year?: string | null
          updated_at?: string | null
          voting_eligible?: boolean | null
          zone?: string | null
        }
        Relationships: []
      }
      lm_downgrade_2026_06_24_snapshot: {
        Row: {
          active_license: string | null
          amasi_number: number | null
          application_date: string | null
          application_no: string | null
          application_status: number | null
          asi_member_certificate: string | null
          asi_member_id: string | null
          asi_membership_no: string | null
          asi_state: string | null
          city: string | null
          country: string | null
          created_at: string | null
          date_of_birth: string | null
          edu_superspecialty_college: string | null
          edu_superspecialty_degree: string | null
          edu_superspecialty_university: string | null
          edu_superspecialty_year: string | null
          edu_undergrad_degree: string | null
          email: string | null
          father_name: string | null
          first_name: string | null
          gender: string | null
          id: string | null
          imr_registration_no: string | null
          joining_date: string | null
          landline: string | null
          last_name: string | null
          letter_hod: string | null
          marketing_opt_out_at: string | null
          mbbs_degree_certificate: string | null
          mci_certificate: string | null
          mci_council_number: string | null
          mci_council_state: string | null
          membership_type: string | null
          middle_name: string | null
          mobile_code: string | null
          mysql_id: number | null
          name: string | null
          nationality: string | null
          other_intl_org: string | null
          other_intl_org_value: string | null
          pg_college: string | null
          pg_degree: string | null
          pg_degree_certificate: string | null
          pg_university: string | null
          pg_year: string | null
          phone: number | null
          postal_code: string | null
          profile_photo: string | null
          salutation: string | null
          snapshot_at: string | null
          state: string | null
          status: string | null
          std_code: string | null
          street_address_1: string | null
          street_address_2: string | null
          ug_college: string | null
          ug_university: string | null
          ug_year: string | null
          updated_at: string | null
          voting_eligible: boolean | null
          zone: string | null
        }
        Insert: {
          active_license?: string | null
          amasi_number?: number | null
          application_date?: string | null
          application_no?: string | null
          application_status?: number | null
          asi_member_certificate?: string | null
          asi_member_id?: string | null
          asi_membership_no?: string | null
          asi_state?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          edu_superspecialty_college?: string | null
          edu_superspecialty_degree?: string | null
          edu_superspecialty_university?: string | null
          edu_superspecialty_year?: string | null
          edu_undergrad_degree?: string | null
          email?: string | null
          father_name?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string | null
          imr_registration_no?: string | null
          joining_date?: string | null
          landline?: string | null
          last_name?: string | null
          letter_hod?: string | null
          marketing_opt_out_at?: string | null
          mbbs_degree_certificate?: string | null
          mci_certificate?: string | null
          mci_council_number?: string | null
          mci_council_state?: string | null
          membership_type?: string | null
          middle_name?: string | null
          mobile_code?: string | null
          mysql_id?: number | null
          name?: string | null
          nationality?: string | null
          other_intl_org?: string | null
          other_intl_org_value?: string | null
          pg_college?: string | null
          pg_degree?: string | null
          pg_degree_certificate?: string | null
          pg_university?: string | null
          pg_year?: string | null
          phone?: number | null
          postal_code?: string | null
          profile_photo?: string | null
          salutation?: string | null
          snapshot_at?: string | null
          state?: string | null
          status?: string | null
          std_code?: string | null
          street_address_1?: string | null
          street_address_2?: string | null
          ug_college?: string | null
          ug_university?: string | null
          ug_year?: string | null
          updated_at?: string | null
          voting_eligible?: boolean | null
          zone?: string | null
        }
        Update: {
          active_license?: string | null
          amasi_number?: number | null
          application_date?: string | null
          application_no?: string | null
          application_status?: number | null
          asi_member_certificate?: string | null
          asi_member_id?: string | null
          asi_membership_no?: string | null
          asi_state?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          edu_superspecialty_college?: string | null
          edu_superspecialty_degree?: string | null
          edu_superspecialty_university?: string | null
          edu_superspecialty_year?: string | null
          edu_undergrad_degree?: string | null
          email?: string | null
          father_name?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string | null
          imr_registration_no?: string | null
          joining_date?: string | null
          landline?: string | null
          last_name?: string | null
          letter_hod?: string | null
          marketing_opt_out_at?: string | null
          mbbs_degree_certificate?: string | null
          mci_certificate?: string | null
          mci_council_number?: string | null
          mci_council_state?: string | null
          membership_type?: string | null
          middle_name?: string | null
          mobile_code?: string | null
          mysql_id?: number | null
          name?: string | null
          nationality?: string | null
          other_intl_org?: string | null
          other_intl_org_value?: string | null
          pg_college?: string | null
          pg_degree?: string | null
          pg_degree_certificate?: string | null
          pg_university?: string | null
          pg_year?: string | null
          phone?: number | null
          postal_code?: string | null
          profile_photo?: string | null
          salutation?: string | null
          snapshot_at?: string | null
          state?: string | null
          status?: string | null
          std_code?: string | null
          street_address_1?: string | null
          street_address_2?: string | null
          ug_college?: string | null
          ug_university?: string | null
          ug_year?: string | null
          updated_at?: string | null
          voting_eligible?: boolean | null
          zone?: string | null
        }
        Relationships: []
      }
      lm_downgrade2_2026_06_24_snapshot: {
        Row: {
          active_license: string | null
          amasi_number: number | null
          application_date: string | null
          application_no: string | null
          application_status: number | null
          asi_member_certificate: string | null
          asi_member_id: string | null
          asi_membership_no: string | null
          asi_state: string | null
          city: string | null
          country: string | null
          created_at: string | null
          date_of_birth: string | null
          edu_superspecialty_college: string | null
          edu_superspecialty_degree: string | null
          edu_superspecialty_university: string | null
          edu_superspecialty_year: string | null
          edu_undergrad_degree: string | null
          email: string | null
          father_name: string | null
          first_name: string | null
          gender: string | null
          id: string | null
          imr_registration_no: string | null
          joining_date: string | null
          landline: string | null
          last_name: string | null
          letter_hod: string | null
          marketing_opt_out_at: string | null
          mbbs_degree_certificate: string | null
          mci_certificate: string | null
          mci_council_number: string | null
          mci_council_state: string | null
          membership_type: string | null
          middle_name: string | null
          mobile_code: string | null
          mysql_id: number | null
          name: string | null
          nationality: string | null
          other_intl_org: string | null
          other_intl_org_value: string | null
          pg_college: string | null
          pg_degree: string | null
          pg_degree_certificate: string | null
          pg_university: string | null
          pg_year: string | null
          phone: number | null
          postal_code: string | null
          profile_photo: string | null
          salutation: string | null
          snapshot_at: string | null
          state: string | null
          status: string | null
          std_code: string | null
          street_address_1: string | null
          street_address_2: string | null
          ug_college: string | null
          ug_university: string | null
          ug_year: string | null
          updated_at: string | null
          voting_eligible: boolean | null
          zone: string | null
        }
        Insert: {
          active_license?: string | null
          amasi_number?: number | null
          application_date?: string | null
          application_no?: string | null
          application_status?: number | null
          asi_member_certificate?: string | null
          asi_member_id?: string | null
          asi_membership_no?: string | null
          asi_state?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          edu_superspecialty_college?: string | null
          edu_superspecialty_degree?: string | null
          edu_superspecialty_university?: string | null
          edu_superspecialty_year?: string | null
          edu_undergrad_degree?: string | null
          email?: string | null
          father_name?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string | null
          imr_registration_no?: string | null
          joining_date?: string | null
          landline?: string | null
          last_name?: string | null
          letter_hod?: string | null
          marketing_opt_out_at?: string | null
          mbbs_degree_certificate?: string | null
          mci_certificate?: string | null
          mci_council_number?: string | null
          mci_council_state?: string | null
          membership_type?: string | null
          middle_name?: string | null
          mobile_code?: string | null
          mysql_id?: number | null
          name?: string | null
          nationality?: string | null
          other_intl_org?: string | null
          other_intl_org_value?: string | null
          pg_college?: string | null
          pg_degree?: string | null
          pg_degree_certificate?: string | null
          pg_university?: string | null
          pg_year?: string | null
          phone?: number | null
          postal_code?: string | null
          profile_photo?: string | null
          salutation?: string | null
          snapshot_at?: string | null
          state?: string | null
          status?: string | null
          std_code?: string | null
          street_address_1?: string | null
          street_address_2?: string | null
          ug_college?: string | null
          ug_university?: string | null
          ug_year?: string | null
          updated_at?: string | null
          voting_eligible?: boolean | null
          zone?: string | null
        }
        Update: {
          active_license?: string | null
          amasi_number?: number | null
          application_date?: string | null
          application_no?: string | null
          application_status?: number | null
          asi_member_certificate?: string | null
          asi_member_id?: string | null
          asi_membership_no?: string | null
          asi_state?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          edu_superspecialty_college?: string | null
          edu_superspecialty_degree?: string | null
          edu_superspecialty_university?: string | null
          edu_superspecialty_year?: string | null
          edu_undergrad_degree?: string | null
          email?: string | null
          father_name?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string | null
          imr_registration_no?: string | null
          joining_date?: string | null
          landline?: string | null
          last_name?: string | null
          letter_hod?: string | null
          marketing_opt_out_at?: string | null
          mbbs_degree_certificate?: string | null
          mci_certificate?: string | null
          mci_council_number?: string | null
          mci_council_state?: string | null
          membership_type?: string | null
          middle_name?: string | null
          mobile_code?: string | null
          mysql_id?: number | null
          name?: string | null
          nationality?: string | null
          other_intl_org?: string | null
          other_intl_org_value?: string | null
          pg_college?: string | null
          pg_degree?: string | null
          pg_degree_certificate?: string | null
          pg_university?: string | null
          pg_year?: string | null
          phone?: number | null
          postal_code?: string | null
          profile_photo?: string | null
          salutation?: string | null
          snapshot_at?: string | null
          state?: string | null
          status?: string | null
          std_code?: string | null
          street_address_1?: string | null
          street_address_2?: string | null
          ug_college?: string | null
          ug_university?: string | null
          ug_year?: string | null
          updated_at?: string | null
          voting_eligible?: boolean | null
          zone?: string | null
        }
        Relationships: []
      }
      login_history: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string | null
          device_type: string | null
          email: string
          failure_reason: string | null
          id: string
          ip_address: string | null
          login_method: string | null
          os: string | null
          session_id: string | null
          status: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          email: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          login_method?: string | null
          os?: string | null
          session_id?: string | null
          status: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          email?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          login_method?: string | null
          os?: string | null
          session_id?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "login_history_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "user_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "login_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "login_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      magic_tokens: {
        Row: {
          certificate_id: string | null
          commitment_id: string | null
          created_at: string | null
          created_by: string | null
          event_faculty_id: string | null
          event_id: string | null
          expires_at: string
          faculty_id: string | null
          first_used_at: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          max_uses: number | null
          member_id: string | null
          metadata: Json | null
          purpose: string
          redirect_url: string | null
          revoked_at: string | null
          revoked_by: string | null
          token: string
          use_count: number | null
          used_from_ips: string[] | null
          used_user_agents: string[] | null
          user_id: string | null
        }
        Insert: {
          certificate_id?: string | null
          commitment_id?: string | null
          created_at?: string | null
          created_by?: string | null
          event_faculty_id?: string | null
          event_id?: string | null
          expires_at: string
          faculty_id?: string | null
          first_used_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          max_uses?: number | null
          member_id?: string | null
          metadata?: Json | null
          purpose: string
          redirect_url?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          token: string
          use_count?: number | null
          used_from_ips?: string[] | null
          used_user_agents?: string[] | null
          user_id?: string | null
        }
        Update: {
          certificate_id?: string | null
          commitment_id?: string | null
          created_at?: string | null
          created_by?: string | null
          event_faculty_id?: string | null
          event_id?: string | null
          expires_at?: string
          faculty_id?: string | null
          first_used_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          max_uses?: number | null
          member_id?: string | null
          metadata?: Json | null
          purpose?: string
          redirect_url?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          token?: string
          use_count?: number | null
          used_from_ips?: string[] | null
          used_user_agents?: string[] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "magic_tokens_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_tokens_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "commitments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_tokens_event_faculty_id_fkey"
            columns: ["event_faculty_id"]
            isOneToOne: false
            referencedRelation: "event_faculty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_tokens_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_tokens_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_tokens_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "active_amasi_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_tokens_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_tokens_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_tokens_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          capacity: number | null
          created_at: string | null
          date: string
          end_time: string | null
          event_id: string
          id: string
          is_included: boolean | null
          meal_type: string
          menu_description: string | null
          name: string
          notes: string | null
          price: number | null
          start_time: string | null
          status: string | null
          updated_at: string | null
          venue: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          date: string
          end_time?: string | null
          event_id: string
          id?: string
          is_included?: boolean | null
          meal_type: string
          menu_description?: string | null
          name: string
          notes?: string | null
          price?: number | null
          start_time?: string | null
          status?: string | null
          updated_at?: string | null
          venue?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          date?: string
          end_time?: string | null
          event_id?: string
          id?: string
          is_included?: boolean | null
          meal_type?: string
          menu_description?: string | null
          name?: string
          notes?: string | null
          price?: number | null
          start_time?: string | null
          status?: string | null
          updated_at?: string | null
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_registrations: {
        Row: {
          allergies: string | null
          checked_in_at: string | null
          created_at: string | null
          dietary_preference: string | null
          id: string
          meal_plan_id: string
          registration_id: string
          special_requests: string | null
          status: string | null
        }
        Insert: {
          allergies?: string | null
          checked_in_at?: string | null
          created_at?: string | null
          dietary_preference?: string | null
          id?: string
          meal_plan_id: string
          registration_id: string
          special_requests?: string | null
          status?: string | null
        }
        Update: {
          allergies?: string | null
          checked_in_at?: string | null
          created_at?: string | null
          dietary_preference?: string | null
          id?: string
          meal_plan_id?: string
          registration_id?: string
          special_requests?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_registrations_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_registrations_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_clinics: {
        Row: {
          address: string | null
          city: string | null
          clinic_name: string
          country: string | null
          created_at: string | null
          id: string
          is_primary: boolean | null
          member_id: string
          phone: string | null
          pin_code: string | null
          state: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          clinic_name?: string
          country?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          member_id: string
          phone?: string | null
          pin_code?: string | null
          state?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          clinic_name?: string
          country?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          member_id?: string
          phone?: string | null
          pin_code?: string | null
          state?: string | null
        }
        Relationships: []
      }
      member_credentials: {
        Row: {
          amasi_number: number
          awarded_at: string | null
          created_at: string
          credential_type: string
          dispatch_status: string | null
          dispatched_at: string | null
          dispatched_by: string | null
          notes: string | null
          skill_course_id: number | null
          tracking_number: string | null
          year: number
        }
        Insert: {
          amasi_number: number
          awarded_at?: string | null
          created_at?: string
          credential_type: string
          dispatch_status?: string | null
          dispatched_at?: string | null
          dispatched_by?: string | null
          notes?: string | null
          skill_course_id?: number | null
          tracking_number?: string | null
          year: number
        }
        Update: {
          amasi_number?: number
          awarded_at?: string | null
          created_at?: string
          credential_type?: string
          dispatch_status?: string | null
          dispatched_at?: string | null
          dispatched_by?: string | null
          notes?: string | null
          skill_course_id?: number | null
          tracking_number?: string | null
          year?: number
        }
        Relationships: []
      }
      member_experiences: {
        Row: {
          created_at: string | null
          experience_from: string | null
          experience_to: string | null
          id: string
          institution: string
          is_current: boolean | null
          member_id: string
          position: string
          total_years: string | null
        }
        Insert: {
          created_at?: string | null
          experience_from?: string | null
          experience_to?: string | null
          id?: string
          institution?: string
          is_current?: boolean | null
          member_id: string
          position?: string
          total_years?: string | null
        }
        Update: {
          created_at?: string | null
          experience_from?: string | null
          experience_to?: string | null
          id?: string
          institution?: string
          is_current?: boolean | null
          member_id?: string
          position?: string
          total_years?: string | null
        }
        Relationships: []
      }
      member_notifications: {
        Row: {
          action_url: string | null
          body: string
          broadcast_id: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          id: string
          image_url: string | null
          member_id: string
          read_at: string | null
          title: string
        }
        Insert: {
          action_url?: string | null
          body: string
          broadcast_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          id?: string
          image_url?: string | null
          member_id: string
          read_at?: string | null
          title: string
        }
        Update: {
          action_url?: string | null
          body?: string
          broadcast_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          id?: string
          image_url?: string | null
          member_id?: string
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_notifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "active_amasi_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_notifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          active_license: string | null
          amasi_number: number | null
          application_date: string | null
          application_no: string | null
          application_status: number | null
          asi_member_certificate: string | null
          asi_member_id: string | null
          asi_membership_no: string | null
          asi_state: string | null
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          edu_superspecialty_college: string | null
          edu_superspecialty_degree: string | null
          edu_superspecialty_university: string | null
          edu_superspecialty_year: string | null
          edu_undergrad_degree: string | null
          email: string
          father_name: string | null
          first_name: string | null
          gender: string | null
          id: string
          imr_registration_no: string | null
          joining_date: string | null
          landline: string | null
          last_name: string | null
          letter_hod: string | null
          marketing_opt_out_at: string | null
          mbbs_degree_certificate: string | null
          mci_certificate: string | null
          mci_council_number: string | null
          mci_council_state: string | null
          membership_type: string | null
          middle_name: string | null
          mobile_code: string | null
          mysql_id: number | null
          name: string | null
          nationality: string | null
          other_intl_org: string | null
          other_intl_org_value: string | null
          pg_college: string | null
          pg_degree: string | null
          pg_degree_certificate: string | null
          pg_university: string | null
          pg_year: string | null
          phone: number | null
          postal_code: string | null
          profile_photo: string | null
          salutation: string | null
          state: string | null
          status: string | null
          std_code: string | null
          street_address_1: string | null
          street_address_2: string | null
          ug_college: string | null
          ug_university: string | null
          ug_year: string | null
          updated_at: string
          voting_eligible: boolean | null
          zone: string | null
        }
        Insert: {
          active_license?: string | null
          amasi_number?: number | null
          application_date?: string | null
          application_no?: string | null
          application_status?: number | null
          asi_member_certificate?: string | null
          asi_member_id?: string | null
          asi_membership_no?: string | null
          asi_state?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          edu_superspecialty_college?: string | null
          edu_superspecialty_degree?: string | null
          edu_superspecialty_university?: string | null
          edu_superspecialty_year?: string | null
          edu_undergrad_degree?: string | null
          email: string
          father_name?: string | null
          first_name?: string | null
          gender?: string | null
          id: string
          imr_registration_no?: string | null
          joining_date?: string | null
          landline?: string | null
          last_name?: string | null
          letter_hod?: string | null
          marketing_opt_out_at?: string | null
          mbbs_degree_certificate?: string | null
          mci_certificate?: string | null
          mci_council_number?: string | null
          mci_council_state?: string | null
          membership_type?: string | null
          middle_name?: string | null
          mobile_code?: string | null
          mysql_id?: number | null
          name?: string | null
          nationality?: string | null
          other_intl_org?: string | null
          other_intl_org_value?: string | null
          pg_college?: string | null
          pg_degree?: string | null
          pg_degree_certificate?: string | null
          pg_university?: string | null
          pg_year?: string | null
          phone?: number | null
          postal_code?: string | null
          profile_photo?: string | null
          salutation?: string | null
          state?: string | null
          status?: string | null
          std_code?: string | null
          street_address_1?: string | null
          street_address_2?: string | null
          ug_college?: string | null
          ug_university?: string | null
          ug_year?: string | null
          updated_at?: string
          voting_eligible?: boolean | null
          zone?: string | null
        }
        Update: {
          active_license?: string | null
          amasi_number?: number | null
          application_date?: string | null
          application_no?: string | null
          application_status?: number | null
          asi_member_certificate?: string | null
          asi_member_id?: string | null
          asi_membership_no?: string | null
          asi_state?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          edu_superspecialty_college?: string | null
          edu_superspecialty_degree?: string | null
          edu_superspecialty_university?: string | null
          edu_superspecialty_year?: string | null
          edu_undergrad_degree?: string | null
          email?: string
          father_name?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          imr_registration_no?: string | null
          joining_date?: string | null
          landline?: string | null
          last_name?: string | null
          letter_hod?: string | null
          marketing_opt_out_at?: string | null
          mbbs_degree_certificate?: string | null
          mci_certificate?: string | null
          mci_council_number?: string | null
          mci_council_state?: string | null
          membership_type?: string | null
          middle_name?: string | null
          mobile_code?: string | null
          mysql_id?: number | null
          name?: string | null
          nationality?: string | null
          other_intl_org?: string | null
          other_intl_org_value?: string | null
          pg_college?: string | null
          pg_degree?: string | null
          pg_degree_certificate?: string | null
          pg_university?: string | null
          pg_year?: string | null
          phone?: number | null
          postal_code?: string | null
          profile_photo?: string | null
          salutation?: string | null
          state?: string | null
          status?: string | null
          std_code?: string | null
          street_address_1?: string | null
          street_address_2?: string | null
          ug_college?: string | null
          ug_university?: string | null
          ug_year?: string | null
          updated_at?: string
          voting_eligible?: boolean | null
          zone?: string | null
        }
        Relationships: []
      }
      members_asi_backfill_2026_06_26: {
        Row: {
          amasi_number: number | null
          applied_at: string
          column_name: string
          id: string
          member_id: string
          new_value: string
          old_value: string | null
          source: string
        }
        Insert: {
          amasi_number?: number | null
          applied_at?: string
          column_name: string
          id?: string
          member_id: string
          new_value: string
          old_value?: string | null
          source: string
        }
        Update: {
          amasi_number?: number | null
          applied_at?: string
          column_name?: string
          id?: string
          member_id?: string
          new_value?: string
          old_value?: string | null
          source?: string
        }
        Relationships: []
      }
      members_middle_name_dup_2026_06_30_snapshot: {
        Row: {
          amasi_number: number | null
          email: string | null
          first_name: string | null
          last_name: string | null
          middle_name: string | null
          name: string | null
          snapshot_taken_at: string | null
        }
        Insert: {
          amasi_number?: number | null
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          middle_name?: string | null
          name?: string | null
          snapshot_taken_at?: string | null
        }
        Update: {
          amasi_number?: number | null
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          middle_name?: string | null
          name?: string | null
          snapshot_taken_at?: string | null
        }
        Relationships: []
      }
      members_nicobar_fix_2026_05_21_snapshot: {
        Row: {
          amasi_number: number | null
          city_before: string | null
          id: string
          postal_code: string | null
          snapshotted_at: string
          state_before: string | null
        }
        Insert: {
          amasi_number?: number | null
          city_before?: string | null
          id: string
          postal_code?: string | null
          snapshotted_at?: string
          state_before?: string | null
        }
        Update: {
          amasi_number?: number | null
          city_before?: string | null
          id?: string
          postal_code?: string | null
          snapshotted_at?: string
          state_before?: string | null
        }
        Relationships: []
      }
      membership_applications: {
        Row: {
          admin_notes: Json
          ai_confidence: string | null
          ai_flags: Json | null
          ai_verified: boolean | null
          application_number: string | null
          asi_membership_no: string | null
          asi_state: string | null
          assigned_amasi_number: number | null
          city: string | null
          clinic_address: string | null
          clinic_city: string | null
          clinic_name: string | null
          clinic_pin: string | null
          clinic_state: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          documents: Json | null
          eligibility_reason: string | null
          eligibility_status: string | null
          email: string
          email_verified: boolean | null
          father_name: string | null
          fee_type: string | null
          first_name: string | null
          gender: string | null
          id: string
          imr_registration_no: string | null
          intl_org_elsa: boolean | null
          intl_org_other: string | null
          intl_org_sages: boolean | null
          landline: string | null
          last_name: string | null
          manual_review_reason: string | null
          mci_council_number: string | null
          mci_council_state: string | null
          member_id: string | null
          membership_type: string | null
          middle_name: string | null
          mobile_code: string | null
          mobile_verified: boolean | null
          name: string
          nationality: string | null
          needs_manual_review: boolean | null
          nmc_verification: Json | null
          ocr_data: Json | null
          ocr_score: number | null
          other_intl_org: string | null
          other_intl_org_value: string | null
          payment_amount: number | null
          payment_id: string | null
          payment_status: string | null
          pg_college: string | null
          pg_degree: string | null
          pg_university: string | null
          pg_year: string | null
          phone: string | null
          postal_code: string | null
          previous_membership_no: number | null
          profile_photo_url: string | null
          reference_number: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          salutation: string | null
          ss_college: string | null
          ss_degree: string | null
          ss_university: string | null
          ss_year: string | null
          state: string | null
          status: string
          std_code: string | null
          street_address_1: string | null
          street_address_2: string | null
          ug_college: string | null
          ug_degree: string | null
          ug_university: string | null
          ug_year: string | null
          updated_at: string
          upgrade_from: string | null
          use_clinic_as_mailing: boolean | null
          zone: string | null
        }
        Insert: {
          admin_notes?: Json
          ai_confidence?: string | null
          ai_flags?: Json | null
          ai_verified?: boolean | null
          application_number?: string | null
          asi_membership_no?: string | null
          asi_state?: string | null
          assigned_amasi_number?: number | null
          city?: string | null
          clinic_address?: string | null
          clinic_city?: string | null
          clinic_name?: string | null
          clinic_pin?: string | null
          clinic_state?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          documents?: Json | null
          eligibility_reason?: string | null
          eligibility_status?: string | null
          email: string
          email_verified?: boolean | null
          father_name?: string | null
          fee_type?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          imr_registration_no?: string | null
          intl_org_elsa?: boolean | null
          intl_org_other?: string | null
          intl_org_sages?: boolean | null
          landline?: string | null
          last_name?: string | null
          manual_review_reason?: string | null
          mci_council_number?: string | null
          mci_council_state?: string | null
          member_id?: string | null
          membership_type?: string | null
          middle_name?: string | null
          mobile_code?: string | null
          mobile_verified?: boolean | null
          name: string
          nationality?: string | null
          needs_manual_review?: boolean | null
          nmc_verification?: Json | null
          ocr_data?: Json | null
          ocr_score?: number | null
          other_intl_org?: string | null
          other_intl_org_value?: string | null
          payment_amount?: number | null
          payment_id?: string | null
          payment_status?: string | null
          pg_college?: string | null
          pg_degree?: string | null
          pg_university?: string | null
          pg_year?: string | null
          phone?: string | null
          postal_code?: string | null
          previous_membership_no?: number | null
          profile_photo_url?: string | null
          reference_number?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          salutation?: string | null
          ss_college?: string | null
          ss_degree?: string | null
          ss_university?: string | null
          ss_year?: string | null
          state?: string | null
          status?: string
          std_code?: string | null
          street_address_1?: string | null
          street_address_2?: string | null
          ug_college?: string | null
          ug_degree?: string | null
          ug_university?: string | null
          ug_year?: string | null
          updated_at?: string
          upgrade_from?: string | null
          use_clinic_as_mailing?: boolean | null
          zone?: string | null
        }
        Update: {
          admin_notes?: Json
          ai_confidence?: string | null
          ai_flags?: Json | null
          ai_verified?: boolean | null
          application_number?: string | null
          asi_membership_no?: string | null
          asi_state?: string | null
          assigned_amasi_number?: number | null
          city?: string | null
          clinic_address?: string | null
          clinic_city?: string | null
          clinic_name?: string | null
          clinic_pin?: string | null
          clinic_state?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          documents?: Json | null
          eligibility_reason?: string | null
          eligibility_status?: string | null
          email?: string
          email_verified?: boolean | null
          father_name?: string | null
          fee_type?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          imr_registration_no?: string | null
          intl_org_elsa?: boolean | null
          intl_org_other?: string | null
          intl_org_sages?: boolean | null
          landline?: string | null
          last_name?: string | null
          manual_review_reason?: string | null
          mci_council_number?: string | null
          mci_council_state?: string | null
          member_id?: string | null
          membership_type?: string | null
          middle_name?: string | null
          mobile_code?: string | null
          mobile_verified?: boolean | null
          name?: string
          nationality?: string | null
          needs_manual_review?: boolean | null
          nmc_verification?: Json | null
          ocr_data?: Json | null
          ocr_score?: number | null
          other_intl_org?: string | null
          other_intl_org_value?: string | null
          payment_amount?: number | null
          payment_id?: string | null
          payment_status?: string | null
          pg_college?: string | null
          pg_degree?: string | null
          pg_university?: string | null
          pg_year?: string | null
          phone?: string | null
          postal_code?: string | null
          previous_membership_no?: number | null
          profile_photo_url?: string | null
          reference_number?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          salutation?: string | null
          ss_college?: string | null
          ss_degree?: string | null
          ss_university?: string | null
          ss_year?: string | null
          state?: string | null
          status?: string
          std_code?: string | null
          street_address_1?: string | null
          street_address_2?: string | null
          ug_college?: string | null
          ug_degree?: string | null
          ug_university?: string | null
          ug_year?: string | null
          updated_at?: string
          upgrade_from?: string | null
          use_clinic_as_mailing?: boolean | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_applications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "active_amasi_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_applications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_audit_log: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          performed_by: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          performed_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          performed_by?: string | null
        }
        Relationships: []
      }
      membership_documents: {
        Row: {
          application_id: string | null
          created_at: string | null
          doc_type: string
          eligibility_check: Json | null
          file_name: string | null
          file_size: number | null
          file_url: string
          id: string
          member_email: string
          ocr_engine: string | null
          ocr_extracted: Json | null
          updated_at: string | null
          verification_message: string | null
          verification_status: string | null
        }
        Insert: {
          application_id?: string | null
          created_at?: string | null
          doc_type: string
          eligibility_check?: Json | null
          file_name?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          member_email: string
          ocr_engine?: string | null
          ocr_extracted?: Json | null
          updated_at?: string | null
          verification_message?: string | null
          verification_status?: string | null
        }
        Update: {
          application_id?: string | null
          created_at?: string | null
          doc_type?: string
          eligibility_check?: Json | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          member_email?: string
          ocr_engine?: string | null
          ocr_extracted?: Json | null
          updated_at?: string | null
          verification_message?: string | null
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "membership_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_experience: {
        Row: {
          application_id: string | null
          created_at: string | null
          from_date: string | null
          id: string
          institution: string | null
          position: string
          to_date: string | null
          years: number | null
        }
        Insert: {
          application_id?: string | null
          created_at?: string | null
          from_date?: string | null
          id?: string
          institution?: string | null
          position: string
          to_date?: string | null
          years?: number | null
        }
        Update: {
          application_id?: string | null
          created_at?: string | null
          from_date?: string | null
          id?: string
          institution?: string | null
          position?: string
          to_date?: string | null
          years?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_experience_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "membership_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_payments: {
        Row: {
          amount: number
          application_id: string | null
          created_at: string | null
          currency: string | null
          error_message: string | null
          fee_breakdown: Json | null
          gateway_order_id: string | null
          gateway_payment_id: string | null
          gateway_signature: string | null
          id: string
          member_email: string
          payment_gateway: string | null
          receipt_url: string | null
          refund_id: string | null
          refund_reason: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          application_id?: string | null
          created_at?: string | null
          currency?: string | null
          error_message?: string | null
          fee_breakdown?: Json | null
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          gateway_signature?: string | null
          id?: string
          member_email: string
          payment_gateway?: string | null
          receipt_url?: string | null
          refund_id?: string | null
          refund_reason?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          application_id?: string | null
          created_at?: string | null
          currency?: string | null
          error_message?: string | null
          fee_breakdown?: Json | null
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          gateway_signature?: string | null
          id?: string
          member_email?: string
          payment_gateway?: string | null
          receipt_url?: string | null
          refund_id?: string | null
          refund_reason?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_payments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "membership_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_payments_nonmembership_cleanup_2026_06_29: {
        Row: {
          amount: number | null
          application_id: string | null
          created_at: string | null
          currency: string | null
          error_message: string | null
          fee_breakdown: Json | null
          gateway_order_id: string | null
          gateway_payment_id: string | null
          gateway_signature: string | null
          id: string | null
          member_email: string | null
          payment_gateway: string | null
          receipt_url: string | null
          refund_id: string | null
          refund_reason: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          application_id?: string | null
          created_at?: string | null
          currency?: string | null
          error_message?: string | null
          fee_breakdown?: Json | null
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          gateway_signature?: string | null
          id?: string | null
          member_email?: string | null
          payment_gateway?: string | null
          receipt_url?: string | null
          refund_id?: string | null
          refund_reason?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          application_id?: string | null
          created_at?: string | null
          currency?: string | null
          error_message?: string | null
          fee_breakdown?: Json | null
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          gateway_signature?: string | null
          id?: string | null
          member_email?: string | null
          payment_gateway?: string | null
          receipt_url?: string | null
          refund_id?: string | null
          refund_reason?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      membership_upgrades: {
        Row: {
          ai_confidence: string | null
          ai_verified: boolean | null
          amasi_number: number | null
          asi_certificate_url: string | null
          asi_email_proof_url: string | null
          asi_membership_no: string | null
          asi_state: string | null
          created_at: string | null
          current_membership_no: number | null
          documents: Json | null
          from_type: string
          id: string
          member_email: string
          member_id: string | null
          member_name: string | null
          new_application_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          to_type: string
          updated_at: string | null
          upgrade_number: string | null
        }
        Insert: {
          ai_confidence?: string | null
          ai_verified?: boolean | null
          amasi_number?: number | null
          asi_certificate_url?: string | null
          asi_email_proof_url?: string | null
          asi_membership_no?: string | null
          asi_state?: string | null
          created_at?: string | null
          current_membership_no?: number | null
          documents?: Json | null
          from_type: string
          id?: string
          member_email: string
          member_id?: string | null
          member_name?: string | null
          new_application_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          to_type: string
          updated_at?: string | null
          upgrade_number?: string | null
        }
        Update: {
          ai_confidence?: string | null
          ai_verified?: boolean | null
          amasi_number?: number | null
          asi_certificate_url?: string | null
          asi_email_proof_url?: string | null
          asi_membership_no?: string | null
          asi_state?: string | null
          created_at?: string | null
          current_membership_no?: number | null
          documents?: Json | null
          from_type?: string
          id?: string
          member_email?: string
          member_id?: string | null
          member_name?: string | null
          new_application_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          to_type?: string
          updated_at?: string | null
          upgrade_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_upgrades_new_application_id_fkey"
            columns: ["new_application_id"]
            isOneToOne: false
            referencedRelation: "membership_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      message_logs: {
        Row: {
          channel: string
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          event_id: string | null
          failed_at: string | null
          id: string
          message_body: string | null
          metadata: Json | null
          provider: string | null
          provider_message_id: string | null
          read_at: string | null
          recipient: string
          recipient_name: string | null
          registration_id: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
          template_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          event_id?: string | null
          failed_at?: string | null
          id?: string
          message_body?: string | null
          metadata?: Json | null
          provider?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          recipient: string
          recipient_name?: string | null
          registration_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          event_id?: string | null
          failed_at?: string | null
          id?: string
          message_body?: string | null
          metadata?: Json | null
          provider?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          recipient?: string
          recipient_name?: string | null
          registration_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          auto_send: boolean | null
          channel: string
          created_at: string | null
          description: string | null
          email_body: string | null
          email_subject: string | null
          event_id: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          message_body: string | null
          name: string
          trigger_type: string | null
          trigger_value: number | null
          updated_at: string | null
          variables: Json | null
          whatsapp_template_language: string | null
          whatsapp_template_name: string | null
          whatsapp_template_namespace: string | null
        }
        Insert: {
          auto_send?: boolean | null
          channel: string
          created_at?: string | null
          description?: string | null
          email_body?: string | null
          email_subject?: string | null
          event_id?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          message_body?: string | null
          name: string
          trigger_type?: string | null
          trigger_value?: number | null
          updated_at?: string | null
          variables?: Json | null
          whatsapp_template_language?: string | null
          whatsapp_template_name?: string | null
          whatsapp_template_namespace?: string | null
        }
        Update: {
          auto_send?: boolean | null
          channel?: string
          created_at?: string | null
          description?: string | null
          email_body?: string | null
          email_subject?: string | null
          event_id?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          message_body?: string | null
          name?: string
          trigger_type?: string | null
          trigger_value?: number | null
          updated_at?: string | null
          variables?: Json | null
          whatsapp_template_language?: string | null
          whatsapp_template_name?: string | null
          whatsapp_template_namespace?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      nmc_verification_cache: {
        Row: {
          doctor_name: string
          expires_at: string
          qualification: string | null
          raw_response: Json | null
          registration_number: string
          source: string
          state_council: string
          status: string
          verified_at: string
          year_of_registration: number | null
        }
        Insert: {
          doctor_name: string
          expires_at: string
          qualification?: string | null
          raw_response?: Json | null
          registration_number: string
          source: string
          state_council: string
          status: string
          verified_at?: string
          year_of_registration?: number | null
        }
        Update: {
          doctor_name?: string
          expires_at?: string
          qualification?: string | null
          raw_response?: Json | null
          registration_number?: string
          source?: string
          state_council?: string
          status?: string
          verified_at?: string
          year_of_registration?: number | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          buyer_id: string | null
          coupon_code: string | null
          created_at: string | null
          currency: string | null
          discount: number | null
          discount_code_id: string | null
          event_id: string | null
          id: string
          order_number: string | null
          payment_id: string | null
          payment_method: string | null
          payment_status: string | null
          subtotal: number | null
          tax: number | null
          total: number | null
          updated_at: string | null
        }
        Insert: {
          buyer_id?: string | null
          coupon_code?: string | null
          created_at?: string | null
          currency?: string | null
          discount?: number | null
          discount_code_id?: string | null
          event_id?: string | null
          id?: string
          order_number?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
          updated_at?: string | null
        }
        Update: {
          buyer_id?: string | null
          coupon_code?: string | null
          created_at?: string | null
          currency?: string | null
          discount?: number | null
          discount_code_id?: string | null
          event_id?: string | null
          id?: string
          order_number?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          attempts: number | null
          code: string
          created_at: string | null
          email: string
          expires_at: string
          id: string
          verified: boolean | null
        }
        Insert: {
          attempts?: number | null
          code: string
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          verified?: boolean | null
        }
        Update: {
          attempts?: number | null
          code?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      participants: {
        Row: {
          accessibility_needs: string | null
          amount_paid: number | null
          badge_printed: boolean | null
          certificate_generated: boolean | null
          certificate_number: string | null
          certificate_url: string | null
          check_in_time: string | null
          checked_in: boolean | null
          city: string | null
          country: string | null
          created_at: string | null
          designation: string | null
          dietary_requirements: string | null
          email: string | null
          event_id: string | null
          full_name: string
          id: string
          import_batch_id: string | null
          institution: string | null
          kit_collected: boolean | null
          payment_reference: string | null
          payment_status: string | null
          phone: string | null
          registration_category: string | null
          registration_date: string | null
          registration_id: string | null
          registration_source: string | null
          registration_type: string | null
          state: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          accessibility_needs?: string | null
          amount_paid?: number | null
          badge_printed?: boolean | null
          certificate_generated?: boolean | null
          certificate_number?: string | null
          certificate_url?: string | null
          check_in_time?: string | null
          checked_in?: boolean | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          designation?: string | null
          dietary_requirements?: string | null
          email?: string | null
          event_id?: string | null
          full_name: string
          id?: string
          import_batch_id?: string | null
          institution?: string | null
          kit_collected?: boolean | null
          payment_reference?: string | null
          payment_status?: string | null
          phone?: string | null
          registration_category?: string | null
          registration_date?: string | null
          registration_id?: string | null
          registration_source?: string | null
          registration_type?: string | null
          state?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          accessibility_needs?: string | null
          amount_paid?: number | null
          badge_printed?: boolean | null
          certificate_generated?: boolean | null
          certificate_number?: string | null
          certificate_url?: string | null
          check_in_time?: string | null
          checked_in?: boolean | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          designation?: string | null
          dietary_requirements?: string | null
          email?: string | null
          event_id?: string | null
          full_name?: string
          id?: string
          import_batch_id?: string | null
          institution?: string | null
          kit_collected?: boolean | null
          payment_reference?: string | null
          payment_status?: string | null
          phone?: string | null
          registration_category?: string | null
          registration_date?: string | null
          registration_id?: string | null
          registration_source?: string | null
          registration_type?: string | null
          state?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          event_id: string | null
          id: string
          message: string
          metadata: Json
          payment_id: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string
          event_id?: string | null
          id?: string
          message: string
          metadata?: Json
          payment_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          event_id?: string | null
          id?: string
          message?: string
          metadata?: Json
          payment_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_alerts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_alerts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string | null
          currency: string
          discount_amount: number | null
          event_id: string | null
          id: string
          metadata: Json | null
          net_amount: number
          notes: string | null
          payer_email: string
          payer_name: string
          payer_phone: string | null
          payment_method: string
          payment_number: string
          payment_type: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          refunded_at: string | null
          status: string
          tax_amount: number | null
          updated_at: string | null
        }
        Insert: {
          amount?: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string
          discount_amount?: number | null
          event_id?: string | null
          id?: string
          metadata?: Json | null
          net_amount?: number
          notes?: string | null
          payer_email: string
          payer_name: string
          payer_phone?: string | null
          payment_method?: string
          payment_number: string
          payment_type?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          refunded_at?: string | null
          status?: string
          tax_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string
          discount_amount?: number | null
          event_id?: string | null
          id?: string
          metadata?: Json | null
          net_amount?: number
          notes?: string | null
          payer_email?: string
          payer_name?: string
          payer_phone?: string | null
          payment_method?: string
          payment_number?: string
          payment_type?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          refunded_at?: string | null
          status?: string
          tax_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          is_editable: boolean | null
          is_public: boolean | null
          is_sensitive: boolean | null
          key: string
          updated_at: string | null
          updated_by: string | null
          validation_schema: Json | null
          value: Json
          value_type: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_editable?: boolean | null
          is_public?: boolean | null
          is_sensitive?: boolean | null
          key: string
          updated_at?: string | null
          updated_by?: string | null
          validation_schema?: Json | null
          value: Json
          value_type?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_editable?: boolean | null
          is_public?: boolean | null
          is_sensitive?: boolean | null
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          validation_schema?: Json | null
          value?: Json
          value_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      position_audit_log: {
        Row: {
          action: string | null
          event_type: string
          id: string
          member_id: string | null
          metadata: Json | null
          notes: string | null
          occurred_at: string
          position_holder_id: string | null
          position_id: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action?: string | null
          event_type: string
          id?: string
          member_id?: string | null
          metadata?: Json | null
          notes?: string | null
          occurred_at?: string
          position_holder_id?: string | null
          position_id?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string | null
          event_type?: string
          id?: string
          member_id?: string | null
          metadata?: Json | null
          notes?: string | null
          occurred_at?: string
          position_holder_id?: string | null
          position_id?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "position_audit_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "active_amasi_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_audit_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_audit_log_position_holder_id_fkey"
            columns: ["position_holder_id"]
            isOneToOne: false
            referencedRelation: "position_holders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_audit_log_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      position_holders: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          member_id: string
          position_id: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          member_id: string
          position_id: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          member_id?: string
          position_id?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "position_holders_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "position_holders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_holders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "active_amasi_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_holders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_holders_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_holders_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "position_holders"
            referencedColumns: ["id"]
          },
        ]
      }
      position_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          permission: string
          position_id: string
          scope: string | null
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission: string
          position_id: string
          scope?: string | null
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission?: string
          position_id?: string
          scope?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "position_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "position_holders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_permissions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          category: string
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          display_name: string
          id: string
          is_active: boolean
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "positions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "position_holders"
            referencedColumns: ["id"]
          },
        ]
      }
      print_jobs: {
        Row: {
          agent_id: string | null
          badge_html: string | null
          created_at: string | null
          device_info: Json | null
          error_message: string | null
          id: string
          picked_up_at: string | null
          print_number: number
          print_station_id: string
          printed_at: string | null
          printed_by: string | null
          printer_name: string | null
          registration_data: Json | null
          registration_id: string
          status: string | null
          zpl_data: string | null
        }
        Insert: {
          agent_id?: string | null
          badge_html?: string | null
          created_at?: string | null
          device_info?: Json | null
          error_message?: string | null
          id?: string
          picked_up_at?: string | null
          print_number?: number
          print_station_id: string
          printed_at?: string | null
          printed_by?: string | null
          printer_name?: string | null
          registration_data?: Json | null
          registration_id: string
          status?: string | null
          zpl_data?: string | null
        }
        Update: {
          agent_id?: string | null
          badge_html?: string | null
          created_at?: string | null
          device_info?: Json | null
          error_message?: string | null
          id?: string
          picked_up_at?: string | null
          print_number?: number
          print_station_id?: string
          printed_at?: string | null
          printed_by?: string | null
          printer_name?: string | null
          registration_data?: Json | null
          registration_id?: string
          status?: string | null
          zpl_data?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_jobs_print_station_id_fkey"
            columns: ["print_station_id"]
            isOneToOne: false
            referencedRelation: "print_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      print_stations: {
        Row: {
          access_token: string | null
          allow_reprint: boolean | null
          auto_print: boolean | null
          badge_template_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          event_id: string
          id: string
          is_active: boolean | null
          max_reprints: number | null
          name: string
          print_mode: string
          print_settings: Json | null
          require_checkin: boolean | null
          ticket_type_ids: string[] | null
          token_expires_at: string | null
          total_prints: number | null
          unique_prints: number | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          allow_reprint?: boolean | null
          auto_print?: boolean | null
          badge_template_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_id: string
          id?: string
          is_active?: boolean | null
          max_reprints?: number | null
          name: string
          print_mode?: string
          print_settings?: Json | null
          require_checkin?: boolean | null
          ticket_type_ids?: string[] | null
          token_expires_at?: string | null
          total_prints?: number | null
          unique_prints?: number | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          allow_reprint?: boolean | null
          auto_print?: boolean | null
          badge_template_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_id?: string
          id?: string
          is_active?: boolean | null
          max_reprints?: number | null
          name?: string
          print_mode?: string
          print_settings?: Json | null
          require_checkin?: boolean | null
          ticket_type_ids?: string[] | null
          token_expires_at?: string | null
          total_prints?: number | null
          unique_prints?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_stations_badge_template_id_fkey"
            columns: ["badge_template_id"]
            isOneToOne: false
            referencedRelation: "badge_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_stations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_edit_log: {
        Row: {
          applied_at: string
          fields_changed: Json
          id: number
          idempotency_key: string
          member_id: string
        }
        Insert: {
          applied_at?: string
          fields_changed: Json
          id?: number
          idempotency_key: string
          member_id: string
        }
        Update: {
          applied_at?: string
          fields_changed?: Json
          id?: number
          idempotency_key?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_edit_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "active_amasi_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_edit_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      program_change_log: {
        Row: {
          assignment_id: string | null
          change_type: string
          changed_by_email: string | null
          changed_by_name: string | null
          created_at: string | null
          event_id: string
          id: string
          new_values: Json | null
          notification_sent: boolean | null
          notification_type: string | null
          old_values: Json | null
          reason: string | null
          session_id: string | null
          session_name: string | null
          summary: string | null
        }
        Insert: {
          assignment_id?: string | null
          change_type?: string
          changed_by_email?: string | null
          changed_by_name?: string | null
          created_at?: string | null
          event_id: string
          id?: string
          new_values?: Json | null
          notification_sent?: boolean | null
          notification_type?: string | null
          old_values?: Json | null
          reason?: string | null
          session_id?: string | null
          session_name?: string | null
          summary?: string | null
        }
        Update: {
          assignment_id?: string | null
          change_type?: string
          changed_by_email?: string | null
          changed_by_name?: string | null
          created_at?: string | null
          event_id?: string
          id?: string
          new_values?: Json | null
          notification_sent?: boolean | null
          notification_type?: string | null
          old_values?: Json | null
          reason?: string | null
          session_id?: string | null
          session_name?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_change_log_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "faculty_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_change_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_change_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          app_version: string | null
          created_at: string
          expo_push_token: string
          id: string
          last_seen_at: string
          member_id: string
          platform: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          expo_push_token: string
          id?: string
          last_seen_at?: string
          member_id: string
          platform: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          expo_push_token?: string
          id?: string
          last_seen_at?: string
          member_id?: string
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "active_amasi_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_tokens_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_addons: {
        Row: {
          addon_id: string | null
          addon_variant_id: string | null
          certificate_issued: boolean | null
          certificate_issued_at: string | null
          certificate_url: string | null
          created_at: string | null
          id: string
          price: number | null
          quantity: number | null
          registration_id: string | null
          total_price: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          addon_id?: string | null
          addon_variant_id?: string | null
          certificate_issued?: boolean | null
          certificate_issued_at?: string | null
          certificate_url?: string | null
          created_at?: string | null
          id?: string
          price?: number | null
          quantity?: number | null
          registration_id?: string | null
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          addon_id?: string | null
          addon_variant_id?: string | null
          certificate_issued?: boolean | null
          certificate_issued_at?: string | null
          certificate_url?: string | null
          created_at?: string | null
          id?: string
          price?: number | null
          quantity?: number | null
          registration_id?: string | null
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registration_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_addons_addon_variant_id_fkey"
            columns: ["addon_variant_id"]
            isOneToOne: false
            referencedRelation: "addon_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_addons_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          attendee_city: string | null
          attendee_country: string | null
          attendee_designation: string | null
          attendee_email: string
          attendee_institution: string | null
          attendee_name: string
          attendee_phone: string | null
          attendee_state: string | null
          badge_downloaded_by_delegate_at: string | null
          badge_generated_at: string | null
          badge_template_id: string | null
          badge_url: string | null
          buyer_id: string | null
          certificate_downloaded_at: string | null
          certificate_generated_at: string | null
          certificate_template_id: string | null
          certificate_url: string | null
          checked_in: boolean
          checked_in_at: string | null
          checkin_token: string | null
          confirmed_at: string | null
          convocation_address: Json | null
          convocation_number: string | null
          created_at: string
          currency: string
          custom_fields: Json | null
          discount_amount: number
          discount_code: string | null
          discount_code_id: string | null
          event_id: string
          exam_marks: Json | null
          exam_result: string | null
          exam_total_marks: number | null
          form_responses: Json | null
          id: string
          notes: string | null
          order_id: string | null
          participation_mode: string | null
          payment_id: string | null
          payment_status: string
          quantity: number | null
          registration_number: string
          status: string
          tax_amount: number
          ticket_type_id: string
          total_amount: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          attendee_city?: string | null
          attendee_country?: string | null
          attendee_designation?: string | null
          attendee_email: string
          attendee_institution?: string | null
          attendee_name: string
          attendee_phone?: string | null
          attendee_state?: string | null
          badge_downloaded_by_delegate_at?: string | null
          badge_generated_at?: string | null
          badge_template_id?: string | null
          badge_url?: string | null
          buyer_id?: string | null
          certificate_downloaded_at?: string | null
          certificate_generated_at?: string | null
          certificate_template_id?: string | null
          certificate_url?: string | null
          checked_in?: boolean
          checked_in_at?: string | null
          checkin_token?: string | null
          confirmed_at?: string | null
          convocation_address?: Json | null
          convocation_number?: string | null
          created_at?: string
          currency?: string
          custom_fields?: Json | null
          discount_amount?: number
          discount_code?: string | null
          discount_code_id?: string | null
          event_id: string
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          form_responses?: Json | null
          id?: string
          notes?: string | null
          order_id?: string | null
          participation_mode?: string | null
          payment_id?: string | null
          payment_status?: string
          quantity?: number | null
          registration_number: string
          status?: string
          tax_amount?: number
          ticket_type_id: string
          total_amount: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          attendee_city?: string | null
          attendee_country?: string | null
          attendee_designation?: string | null
          attendee_email?: string
          attendee_institution?: string | null
          attendee_name?: string
          attendee_phone?: string | null
          attendee_state?: string | null
          badge_downloaded_by_delegate_at?: string | null
          badge_generated_at?: string | null
          badge_template_id?: string | null
          badge_url?: string | null
          buyer_id?: string | null
          certificate_downloaded_at?: string | null
          certificate_generated_at?: string | null
          certificate_template_id?: string | null
          certificate_url?: string | null
          checked_in?: boolean
          checked_in_at?: string | null
          checkin_token?: string | null
          confirmed_at?: string | null
          convocation_address?: Json | null
          convocation_number?: string | null
          created_at?: string
          currency?: string
          custom_fields?: Json | null
          discount_amount?: number
          discount_code?: string | null
          discount_code_id?: string | null
          event_id?: string
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          form_responses?: Json | null
          id?: string
          notes?: string | null
          order_id?: string | null
          participation_mode?: string | null
          payment_id?: string | null
          payment_status?: string
          quantity?: number | null
          registration_number?: string
          status?: string
          tax_amount?: number
          ticket_type_id?: string
          total_amount?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_badge_template_id_fkey"
            columns: ["badge_template_id"]
            isOneToOne: false
            referencedRelation: "badge_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_certificate_template_id_fkey"
            columns: ["certificate_template_id"]
            isOneToOne: false
            referencedRelation: "certificate_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations_126_marksheet_pre_2026_07_02_snapshot: {
        Row: {
          convocation_number: string | null
          exam_marks: Json | null
          exam_result: string | null
          exam_total_marks: number | null
          id: string | null
          registration_number: string | null
        }
        Insert: {
          convocation_number?: string | null
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          id?: string | null
          registration_number?: string | null
        }
        Update: {
          convocation_number?: string | null
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          id?: string | null
          registration_number?: string | null
        }
        Relationships: []
      }
      registrations_127_accom_2026_06_30_snapshot: {
        Row: {
          attendee_city: string | null
          attendee_country: string | null
          attendee_designation: string | null
          attendee_email: string | null
          attendee_institution: string | null
          attendee_name: string | null
          attendee_phone: string | null
          attendee_state: string | null
          badge_downloaded_by_delegate_at: string | null
          badge_generated_at: string | null
          badge_template_id: string | null
          badge_url: string | null
          buyer_id: string | null
          certificate_downloaded_at: string | null
          certificate_generated_at: string | null
          certificate_template_id: string | null
          certificate_url: string | null
          checked_in: boolean | null
          checked_in_at: string | null
          checkin_token: string | null
          confirmed_at: string | null
          convocation_address: Json | null
          convocation_number: string | null
          created_at: string | null
          currency: string | null
          custom_fields: Json | null
          discount_amount: number | null
          discount_code: string | null
          discount_code_id: string | null
          event_id: string | null
          exam_marks: Json | null
          exam_result: string | null
          exam_total_marks: number | null
          form_responses: Json | null
          id: string | null
          notes: string | null
          order_id: string | null
          participation_mode: string | null
          payment_id: string | null
          payment_status: string | null
          quantity: number | null
          registration_number: string | null
          status: string | null
          tax_amount: number | null
          ticket_type_id: string | null
          total_amount: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          attendee_city?: string | null
          attendee_country?: string | null
          attendee_designation?: string | null
          attendee_email?: string | null
          attendee_institution?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          attendee_state?: string | null
          badge_downloaded_by_delegate_at?: string | null
          badge_generated_at?: string | null
          badge_template_id?: string | null
          badge_url?: string | null
          buyer_id?: string | null
          certificate_downloaded_at?: string | null
          certificate_generated_at?: string | null
          certificate_template_id?: string | null
          certificate_url?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checkin_token?: string | null
          confirmed_at?: string | null
          convocation_address?: Json | null
          convocation_number?: string | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_code_id?: string | null
          event_id?: string | null
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          form_responses?: Json | null
          id?: string | null
          notes?: string | null
          order_id?: string | null
          participation_mode?: string | null
          payment_id?: string | null
          payment_status?: string | null
          quantity?: number | null
          registration_number?: string | null
          status?: string | null
          tax_amount?: number | null
          ticket_type_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          attendee_city?: string | null
          attendee_country?: string | null
          attendee_designation?: string | null
          attendee_email?: string | null
          attendee_institution?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          attendee_state?: string | null
          badge_downloaded_by_delegate_at?: string | null
          badge_generated_at?: string | null
          badge_template_id?: string | null
          badge_url?: string | null
          buyer_id?: string | null
          certificate_downloaded_at?: string | null
          certificate_generated_at?: string | null
          certificate_template_id?: string | null
          certificate_url?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checkin_token?: string | null
          confirmed_at?: string | null
          convocation_address?: Json | null
          convocation_number?: string | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_code_id?: string | null
          event_id?: string | null
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          form_responses?: Json | null
          id?: string | null
          notes?: string | null
          order_id?: string | null
          participation_mode?: string | null
          payment_id?: string | null
          payment_status?: string | null
          quantity?: number | null
          registration_number?: string | null
          status?: string | null
          tax_amount?: number | null
          ticket_type_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      registrations_127_accom_indiv_2026_06_30_snapshot: {
        Row: {
          attendee_city: string | null
          attendee_country: string | null
          attendee_designation: string | null
          attendee_email: string | null
          attendee_institution: string | null
          attendee_name: string | null
          attendee_phone: string | null
          attendee_state: string | null
          badge_downloaded_by_delegate_at: string | null
          badge_generated_at: string | null
          badge_template_id: string | null
          badge_url: string | null
          buyer_id: string | null
          certificate_downloaded_at: string | null
          certificate_generated_at: string | null
          certificate_template_id: string | null
          certificate_url: string | null
          checked_in: boolean | null
          checked_in_at: string | null
          checkin_token: string | null
          confirmed_at: string | null
          convocation_address: Json | null
          convocation_number: string | null
          created_at: string | null
          currency: string | null
          custom_fields: Json | null
          discount_amount: number | null
          discount_code: string | null
          discount_code_id: string | null
          event_id: string | null
          exam_marks: Json | null
          exam_result: string | null
          exam_total_marks: number | null
          form_responses: Json | null
          id: string | null
          notes: string | null
          order_id: string | null
          participation_mode: string | null
          payment_id: string | null
          payment_status: string | null
          quantity: number | null
          registration_number: string | null
          status: string | null
          tax_amount: number | null
          ticket_type_id: string | null
          total_amount: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          attendee_city?: string | null
          attendee_country?: string | null
          attendee_designation?: string | null
          attendee_email?: string | null
          attendee_institution?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          attendee_state?: string | null
          badge_downloaded_by_delegate_at?: string | null
          badge_generated_at?: string | null
          badge_template_id?: string | null
          badge_url?: string | null
          buyer_id?: string | null
          certificate_downloaded_at?: string | null
          certificate_generated_at?: string | null
          certificate_template_id?: string | null
          certificate_url?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checkin_token?: string | null
          confirmed_at?: string | null
          convocation_address?: Json | null
          convocation_number?: string | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_code_id?: string | null
          event_id?: string | null
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          form_responses?: Json | null
          id?: string | null
          notes?: string | null
          order_id?: string | null
          participation_mode?: string | null
          payment_id?: string | null
          payment_status?: string | null
          quantity?: number | null
          registration_number?: string | null
          status?: string | null
          tax_amount?: number | null
          ticket_type_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          attendee_city?: string | null
          attendee_country?: string | null
          attendee_designation?: string | null
          attendee_email?: string | null
          attendee_institution?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          attendee_state?: string | null
          badge_downloaded_by_delegate_at?: string | null
          badge_generated_at?: string | null
          badge_template_id?: string | null
          badge_url?: string | null
          buyer_id?: string | null
          certificate_downloaded_at?: string | null
          certificate_generated_at?: string | null
          certificate_template_id?: string | null
          certificate_url?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checkin_token?: string | null
          confirmed_at?: string | null
          convocation_address?: Json | null
          convocation_number?: string | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_code_id?: string | null
          event_id?: string | null
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          form_responses?: Json | null
          id?: string | null
          notes?: string | null
          order_id?: string | null
          participation_mode?: string | null
          payment_id?: string | null
          payment_status?: string | null
          quantity?: number | null
          registration_number?: string | null
          status?: string | null
          tax_amount?: number | null
          ticket_type_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      registrations_127_prabhu_2026_06_30_snapshot: {
        Row: {
          attendee_city: string | null
          attendee_country: string | null
          attendee_designation: string | null
          attendee_email: string | null
          attendee_institution: string | null
          attendee_name: string | null
          attendee_phone: string | null
          attendee_state: string | null
          badge_downloaded_by_delegate_at: string | null
          badge_generated_at: string | null
          badge_template_id: string | null
          badge_url: string | null
          buyer_id: string | null
          certificate_downloaded_at: string | null
          certificate_generated_at: string | null
          certificate_template_id: string | null
          certificate_url: string | null
          checked_in: boolean | null
          checked_in_at: string | null
          checkin_token: string | null
          confirmed_at: string | null
          convocation_address: Json | null
          convocation_number: string | null
          created_at: string | null
          currency: string | null
          custom_fields: Json | null
          discount_amount: number | null
          discount_code: string | null
          discount_code_id: string | null
          event_id: string | null
          exam_marks: Json | null
          exam_result: string | null
          exam_total_marks: number | null
          form_responses: Json | null
          id: string | null
          notes: string | null
          order_id: string | null
          participation_mode: string | null
          payment_id: string | null
          payment_status: string | null
          quantity: number | null
          registration_number: string | null
          status: string | null
          tax_amount: number | null
          ticket_type_id: string | null
          total_amount: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          attendee_city?: string | null
          attendee_country?: string | null
          attendee_designation?: string | null
          attendee_email?: string | null
          attendee_institution?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          attendee_state?: string | null
          badge_downloaded_by_delegate_at?: string | null
          badge_generated_at?: string | null
          badge_template_id?: string | null
          badge_url?: string | null
          buyer_id?: string | null
          certificate_downloaded_at?: string | null
          certificate_generated_at?: string | null
          certificate_template_id?: string | null
          certificate_url?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checkin_token?: string | null
          confirmed_at?: string | null
          convocation_address?: Json | null
          convocation_number?: string | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_code_id?: string | null
          event_id?: string | null
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          form_responses?: Json | null
          id?: string | null
          notes?: string | null
          order_id?: string | null
          participation_mode?: string | null
          payment_id?: string | null
          payment_status?: string | null
          quantity?: number | null
          registration_number?: string | null
          status?: string | null
          tax_amount?: number | null
          ticket_type_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          attendee_city?: string | null
          attendee_country?: string | null
          attendee_designation?: string | null
          attendee_email?: string | null
          attendee_institution?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          attendee_state?: string | null
          badge_downloaded_by_delegate_at?: string | null
          badge_generated_at?: string | null
          badge_template_id?: string | null
          badge_url?: string | null
          buyer_id?: string | null
          certificate_downloaded_at?: string | null
          certificate_generated_at?: string | null
          certificate_template_id?: string | null
          certificate_url?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checkin_token?: string | null
          confirmed_at?: string | null
          convocation_address?: Json | null
          convocation_number?: string | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_code_id?: string | null
          event_id?: string | null
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          form_responses?: Json | null
          id?: string | null
          notes?: string | null
          order_id?: string | null
          participation_mode?: string | null
          payment_id?: string | null
          payment_status?: string | null
          quantity?: number | null
          registration_number?: string | null
          status?: string | null
          tax_amount?: number | null
          ticket_type_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      registrations_127_ritika_2026_06_30_snapshot: {
        Row: {
          attendee_city: string | null
          attendee_country: string | null
          attendee_designation: string | null
          attendee_email: string | null
          attendee_institution: string | null
          attendee_name: string | null
          attendee_phone: string | null
          attendee_state: string | null
          badge_downloaded_by_delegate_at: string | null
          badge_generated_at: string | null
          badge_template_id: string | null
          badge_url: string | null
          buyer_id: string | null
          certificate_downloaded_at: string | null
          certificate_generated_at: string | null
          certificate_template_id: string | null
          certificate_url: string | null
          checked_in: boolean | null
          checked_in_at: string | null
          checkin_token: string | null
          confirmed_at: string | null
          convocation_address: Json | null
          convocation_number: string | null
          created_at: string | null
          currency: string | null
          custom_fields: Json | null
          discount_amount: number | null
          discount_code: string | null
          discount_code_id: string | null
          event_id: string | null
          exam_marks: Json | null
          exam_result: string | null
          exam_total_marks: number | null
          form_responses: Json | null
          id: string | null
          notes: string | null
          order_id: string | null
          participation_mode: string | null
          payment_id: string | null
          payment_status: string | null
          quantity: number | null
          registration_number: string | null
          status: string | null
          tax_amount: number | null
          ticket_type_id: string | null
          total_amount: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          attendee_city?: string | null
          attendee_country?: string | null
          attendee_designation?: string | null
          attendee_email?: string | null
          attendee_institution?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          attendee_state?: string | null
          badge_downloaded_by_delegate_at?: string | null
          badge_generated_at?: string | null
          badge_template_id?: string | null
          badge_url?: string | null
          buyer_id?: string | null
          certificate_downloaded_at?: string | null
          certificate_generated_at?: string | null
          certificate_template_id?: string | null
          certificate_url?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checkin_token?: string | null
          confirmed_at?: string | null
          convocation_address?: Json | null
          convocation_number?: string | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_code_id?: string | null
          event_id?: string | null
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          form_responses?: Json | null
          id?: string | null
          notes?: string | null
          order_id?: string | null
          participation_mode?: string | null
          payment_id?: string | null
          payment_status?: string | null
          quantity?: number | null
          registration_number?: string | null
          status?: string | null
          tax_amount?: number | null
          ticket_type_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          attendee_city?: string | null
          attendee_country?: string | null
          attendee_designation?: string | null
          attendee_email?: string | null
          attendee_institution?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          attendee_state?: string | null
          badge_downloaded_by_delegate_at?: string | null
          badge_generated_at?: string | null
          badge_template_id?: string | null
          badge_url?: string | null
          buyer_id?: string | null
          certificate_downloaded_at?: string | null
          certificate_generated_at?: string | null
          certificate_template_id?: string | null
          certificate_url?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checkin_token?: string | null
          confirmed_at?: string | null
          convocation_address?: Json | null
          convocation_number?: string | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_code_id?: string | null
          event_id?: string | null
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          form_responses?: Json | null
          id?: string | null
          notes?: string | null
          order_id?: string | null
          participation_mode?: string | null
          payment_id?: string | null
          payment_status?: string | null
          quantity?: number | null
          registration_number?: string | null
          status?: string | null
          tax_amount?: number | null
          ticket_type_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      registrations_127_sameer_pre_final_snapshot_2026_06_29: {
        Row: {
          attendee_city: string | null
          attendee_country: string | null
          attendee_designation: string | null
          attendee_email: string | null
          attendee_institution: string | null
          attendee_name: string | null
          attendee_phone: string | null
          attendee_state: string | null
          badge_downloaded_by_delegate_at: string | null
          badge_generated_at: string | null
          badge_template_id: string | null
          badge_url: string | null
          buyer_id: string | null
          certificate_downloaded_at: string | null
          certificate_generated_at: string | null
          certificate_template_id: string | null
          certificate_url: string | null
          checked_in: boolean | null
          checked_in_at: string | null
          checkin_token: string | null
          confirmed_at: string | null
          convocation_address: Json | null
          convocation_number: string | null
          created_at: string | null
          currency: string | null
          custom_fields: Json | null
          discount_amount: number | null
          discount_code: string | null
          discount_code_id: string | null
          event_id: string | null
          exam_marks: Json | null
          exam_result: string | null
          exam_total_marks: number | null
          form_responses: Json | null
          id: string | null
          notes: string | null
          order_id: string | null
          participation_mode: string | null
          payment_id: string | null
          payment_status: string | null
          quantity: number | null
          registration_number: string | null
          status: string | null
          tax_amount: number | null
          ticket_type_id: string | null
          total_amount: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          attendee_city?: string | null
          attendee_country?: string | null
          attendee_designation?: string | null
          attendee_email?: string | null
          attendee_institution?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          attendee_state?: string | null
          badge_downloaded_by_delegate_at?: string | null
          badge_generated_at?: string | null
          badge_template_id?: string | null
          badge_url?: string | null
          buyer_id?: string | null
          certificate_downloaded_at?: string | null
          certificate_generated_at?: string | null
          certificate_template_id?: string | null
          certificate_url?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checkin_token?: string | null
          confirmed_at?: string | null
          convocation_address?: Json | null
          convocation_number?: string | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_code_id?: string | null
          event_id?: string | null
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          form_responses?: Json | null
          id?: string | null
          notes?: string | null
          order_id?: string | null
          participation_mode?: string | null
          payment_id?: string | null
          payment_status?: string | null
          quantity?: number | null
          registration_number?: string | null
          status?: string | null
          tax_amount?: number | null
          ticket_type_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          attendee_city?: string | null
          attendee_country?: string | null
          attendee_designation?: string | null
          attendee_email?: string | null
          attendee_institution?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          attendee_state?: string | null
          badge_downloaded_by_delegate_at?: string | null
          badge_generated_at?: string | null
          badge_template_id?: string | null
          badge_url?: string | null
          buyer_id?: string | null
          certificate_downloaded_at?: string | null
          certificate_generated_at?: string | null
          certificate_template_id?: string | null
          certificate_url?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checkin_token?: string | null
          confirmed_at?: string | null
          convocation_address?: Json | null
          convocation_number?: string | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_code_id?: string | null
          event_id?: string | null
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          form_responses?: Json | null
          id?: string | null
          notes?: string | null
          order_id?: string | null
          participation_mode?: string | null
          payment_id?: string | null
          payment_status?: string | null
          quantity?: number | null
          registration_number?: string | null
          status?: string | null
          tax_amount?: number | null
          ticket_type_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      registrations_127_traincheckout_2026_06_30_snapshot: {
        Row: {
          attendee_city: string | null
          attendee_country: string | null
          attendee_designation: string | null
          attendee_email: string | null
          attendee_institution: string | null
          attendee_name: string | null
          attendee_phone: string | null
          attendee_state: string | null
          badge_downloaded_by_delegate_at: string | null
          badge_generated_at: string | null
          badge_template_id: string | null
          badge_url: string | null
          buyer_id: string | null
          certificate_downloaded_at: string | null
          certificate_generated_at: string | null
          certificate_template_id: string | null
          certificate_url: string | null
          checked_in: boolean | null
          checked_in_at: string | null
          checkin_token: string | null
          confirmed_at: string | null
          convocation_address: Json | null
          convocation_number: string | null
          created_at: string | null
          currency: string | null
          custom_fields: Json | null
          discount_amount: number | null
          discount_code: string | null
          discount_code_id: string | null
          event_id: string | null
          exam_marks: Json | null
          exam_result: string | null
          exam_total_marks: number | null
          form_responses: Json | null
          id: string | null
          notes: string | null
          order_id: string | null
          participation_mode: string | null
          payment_id: string | null
          payment_status: string | null
          quantity: number | null
          registration_number: string | null
          status: string | null
          tax_amount: number | null
          ticket_type_id: string | null
          total_amount: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          attendee_city?: string | null
          attendee_country?: string | null
          attendee_designation?: string | null
          attendee_email?: string | null
          attendee_institution?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          attendee_state?: string | null
          badge_downloaded_by_delegate_at?: string | null
          badge_generated_at?: string | null
          badge_template_id?: string | null
          badge_url?: string | null
          buyer_id?: string | null
          certificate_downloaded_at?: string | null
          certificate_generated_at?: string | null
          certificate_template_id?: string | null
          certificate_url?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checkin_token?: string | null
          confirmed_at?: string | null
          convocation_address?: Json | null
          convocation_number?: string | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_code_id?: string | null
          event_id?: string | null
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          form_responses?: Json | null
          id?: string | null
          notes?: string | null
          order_id?: string | null
          participation_mode?: string | null
          payment_id?: string | null
          payment_status?: string | null
          quantity?: number | null
          registration_number?: string | null
          status?: string | null
          tax_amount?: number | null
          ticket_type_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          attendee_city?: string | null
          attendee_country?: string | null
          attendee_designation?: string | null
          attendee_email?: string | null
          attendee_institution?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          attendee_state?: string | null
          badge_downloaded_by_delegate_at?: string | null
          badge_generated_at?: string | null
          badge_template_id?: string | null
          badge_url?: string | null
          buyer_id?: string | null
          certificate_downloaded_at?: string | null
          certificate_generated_at?: string | null
          certificate_template_id?: string | null
          certificate_url?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checkin_token?: string | null
          confirmed_at?: string | null
          convocation_address?: Json | null
          convocation_number?: string | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_code_id?: string | null
          event_id?: string | null
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          form_responses?: Json | null
          id?: string | null
          notes?: string | null
          order_id?: string | null
          participation_mode?: string | null
          payment_id?: string | null
          payment_status?: string | null
          quantity?: number | null
          registration_number?: string | null
          status?: string | null
          tax_amount?: number | null
          ticket_type_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      registrations_127_travel_complete_2026_06_30_snapshot: {
        Row: {
          attendee_city: string | null
          attendee_country: string | null
          attendee_designation: string | null
          attendee_email: string | null
          attendee_institution: string | null
          attendee_name: string | null
          attendee_phone: string | null
          attendee_state: string | null
          badge_downloaded_by_delegate_at: string | null
          badge_generated_at: string | null
          badge_template_id: string | null
          badge_url: string | null
          buyer_id: string | null
          certificate_downloaded_at: string | null
          certificate_generated_at: string | null
          certificate_template_id: string | null
          certificate_url: string | null
          checked_in: boolean | null
          checked_in_at: string | null
          checkin_token: string | null
          confirmed_at: string | null
          convocation_address: Json | null
          convocation_number: string | null
          created_at: string | null
          currency: string | null
          custom_fields: Json | null
          discount_amount: number | null
          discount_code: string | null
          discount_code_id: string | null
          event_id: string | null
          exam_marks: Json | null
          exam_result: string | null
          exam_total_marks: number | null
          form_responses: Json | null
          id: string | null
          notes: string | null
          order_id: string | null
          participation_mode: string | null
          payment_id: string | null
          payment_status: string | null
          quantity: number | null
          registration_number: string | null
          status: string | null
          tax_amount: number | null
          ticket_type_id: string | null
          total_amount: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          attendee_city?: string | null
          attendee_country?: string | null
          attendee_designation?: string | null
          attendee_email?: string | null
          attendee_institution?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          attendee_state?: string | null
          badge_downloaded_by_delegate_at?: string | null
          badge_generated_at?: string | null
          badge_template_id?: string | null
          badge_url?: string | null
          buyer_id?: string | null
          certificate_downloaded_at?: string | null
          certificate_generated_at?: string | null
          certificate_template_id?: string | null
          certificate_url?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checkin_token?: string | null
          confirmed_at?: string | null
          convocation_address?: Json | null
          convocation_number?: string | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_code_id?: string | null
          event_id?: string | null
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          form_responses?: Json | null
          id?: string | null
          notes?: string | null
          order_id?: string | null
          participation_mode?: string | null
          payment_id?: string | null
          payment_status?: string | null
          quantity?: number | null
          registration_number?: string | null
          status?: string | null
          tax_amount?: number | null
          ticket_type_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          attendee_city?: string | null
          attendee_country?: string | null
          attendee_designation?: string | null
          attendee_email?: string | null
          attendee_institution?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          attendee_state?: string | null
          badge_downloaded_by_delegate_at?: string | null
          badge_generated_at?: string | null
          badge_template_id?: string | null
          badge_url?: string | null
          buyer_id?: string | null
          certificate_downloaded_at?: string | null
          certificate_generated_at?: string | null
          certificate_template_id?: string | null
          certificate_url?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checkin_token?: string | null
          confirmed_at?: string | null
          convocation_address?: Json | null
          convocation_number?: string | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_code_id?: string | null
          event_id?: string | null
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          form_responses?: Json | null
          id?: string | null
          notes?: string | null
          order_id?: string | null
          participation_mode?: string | null
          payment_id?: string | null
          payment_status?: string | null
          quantity?: number | null
          registration_number?: string | null
          status?: string | null
          tax_amount?: number | null
          ticket_type_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      registrations_127_travel_details_2026_06_30_snapshot: {
        Row: {
          attendee_city: string | null
          attendee_country: string | null
          attendee_designation: string | null
          attendee_email: string | null
          attendee_institution: string | null
          attendee_name: string | null
          attendee_phone: string | null
          attendee_state: string | null
          badge_downloaded_by_delegate_at: string | null
          badge_generated_at: string | null
          badge_template_id: string | null
          badge_url: string | null
          buyer_id: string | null
          certificate_downloaded_at: string | null
          certificate_generated_at: string | null
          certificate_template_id: string | null
          certificate_url: string | null
          checked_in: boolean | null
          checked_in_at: string | null
          checkin_token: string | null
          confirmed_at: string | null
          convocation_address: Json | null
          convocation_number: string | null
          created_at: string | null
          currency: string | null
          custom_fields: Json | null
          discount_amount: number | null
          discount_code: string | null
          discount_code_id: string | null
          event_id: string | null
          exam_marks: Json | null
          exam_result: string | null
          exam_total_marks: number | null
          form_responses: Json | null
          id: string | null
          notes: string | null
          order_id: string | null
          participation_mode: string | null
          payment_id: string | null
          payment_status: string | null
          quantity: number | null
          registration_number: string | null
          status: string | null
          tax_amount: number | null
          ticket_type_id: string | null
          total_amount: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          attendee_city?: string | null
          attendee_country?: string | null
          attendee_designation?: string | null
          attendee_email?: string | null
          attendee_institution?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          attendee_state?: string | null
          badge_downloaded_by_delegate_at?: string | null
          badge_generated_at?: string | null
          badge_template_id?: string | null
          badge_url?: string | null
          buyer_id?: string | null
          certificate_downloaded_at?: string | null
          certificate_generated_at?: string | null
          certificate_template_id?: string | null
          certificate_url?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checkin_token?: string | null
          confirmed_at?: string | null
          convocation_address?: Json | null
          convocation_number?: string | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_code_id?: string | null
          event_id?: string | null
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          form_responses?: Json | null
          id?: string | null
          notes?: string | null
          order_id?: string | null
          participation_mode?: string | null
          payment_id?: string | null
          payment_status?: string | null
          quantity?: number | null
          registration_number?: string | null
          status?: string | null
          tax_amount?: number | null
          ticket_type_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          attendee_city?: string | null
          attendee_country?: string | null
          attendee_designation?: string | null
          attendee_email?: string | null
          attendee_institution?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          attendee_state?: string | null
          badge_downloaded_by_delegate_at?: string | null
          badge_generated_at?: string | null
          badge_template_id?: string | null
          badge_url?: string | null
          buyer_id?: string | null
          certificate_downloaded_at?: string | null
          certificate_generated_at?: string | null
          certificate_template_id?: string | null
          certificate_url?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checkin_token?: string | null
          confirmed_at?: string | null
          convocation_address?: Json | null
          convocation_number?: string | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_code_id?: string | null
          event_id?: string | null
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          form_responses?: Json | null
          id?: string | null
          notes?: string | null
          order_id?: string | null
          participation_mode?: string | null
          payment_id?: string | null
          payment_status?: string | null
          quantity?: number | null
          registration_number?: string | null
          status?: string | null
          tax_amount?: number | null
          ticket_type_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      registrations_127_travel_details2_2026_06_30_snapshot: {
        Row: {
          attendee_city: string | null
          attendee_country: string | null
          attendee_designation: string | null
          attendee_email: string | null
          attendee_institution: string | null
          attendee_name: string | null
          attendee_phone: string | null
          attendee_state: string | null
          badge_downloaded_by_delegate_at: string | null
          badge_generated_at: string | null
          badge_template_id: string | null
          badge_url: string | null
          buyer_id: string | null
          certificate_downloaded_at: string | null
          certificate_generated_at: string | null
          certificate_template_id: string | null
          certificate_url: string | null
          checked_in: boolean | null
          checked_in_at: string | null
          checkin_token: string | null
          confirmed_at: string | null
          convocation_address: Json | null
          convocation_number: string | null
          created_at: string | null
          currency: string | null
          custom_fields: Json | null
          discount_amount: number | null
          discount_code: string | null
          discount_code_id: string | null
          event_id: string | null
          exam_marks: Json | null
          exam_result: string | null
          exam_total_marks: number | null
          form_responses: Json | null
          id: string | null
          notes: string | null
          order_id: string | null
          participation_mode: string | null
          payment_id: string | null
          payment_status: string | null
          quantity: number | null
          registration_number: string | null
          status: string | null
          tax_amount: number | null
          ticket_type_id: string | null
          total_amount: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          attendee_city?: string | null
          attendee_country?: string | null
          attendee_designation?: string | null
          attendee_email?: string | null
          attendee_institution?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          attendee_state?: string | null
          badge_downloaded_by_delegate_at?: string | null
          badge_generated_at?: string | null
          badge_template_id?: string | null
          badge_url?: string | null
          buyer_id?: string | null
          certificate_downloaded_at?: string | null
          certificate_generated_at?: string | null
          certificate_template_id?: string | null
          certificate_url?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checkin_token?: string | null
          confirmed_at?: string | null
          convocation_address?: Json | null
          convocation_number?: string | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_code_id?: string | null
          event_id?: string | null
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          form_responses?: Json | null
          id?: string | null
          notes?: string | null
          order_id?: string | null
          participation_mode?: string | null
          payment_id?: string | null
          payment_status?: string | null
          quantity?: number | null
          registration_number?: string | null
          status?: string | null
          tax_amount?: number | null
          ticket_type_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          attendee_city?: string | null
          attendee_country?: string | null
          attendee_designation?: string | null
          attendee_email?: string | null
          attendee_institution?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          attendee_state?: string | null
          badge_downloaded_by_delegate_at?: string | null
          badge_generated_at?: string | null
          badge_template_id?: string | null
          badge_url?: string | null
          buyer_id?: string | null
          certificate_downloaded_at?: string | null
          certificate_generated_at?: string | null
          certificate_template_id?: string | null
          certificate_url?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checkin_token?: string | null
          confirmed_at?: string | null
          convocation_address?: Json | null
          convocation_number?: string | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_code_id?: string | null
          event_id?: string | null
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          form_responses?: Json | null
          id?: string | null
          notes?: string | null
          order_id?: string | null
          participation_mode?: string | null
          payment_id?: string | null
          payment_status?: string | null
          quantity?: number | null
          registration_number?: string | null
          status?: string | null
          tax_amount?: number | null
          ticket_type_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      registrations_127_travel_origin_2026_06_30_snapshot: {
        Row: {
          attendee_city: string | null
          attendee_country: string | null
          attendee_designation: string | null
          attendee_email: string | null
          attendee_institution: string | null
          attendee_name: string | null
          attendee_phone: string | null
          attendee_state: string | null
          badge_downloaded_by_delegate_at: string | null
          badge_generated_at: string | null
          badge_template_id: string | null
          badge_url: string | null
          buyer_id: string | null
          certificate_downloaded_at: string | null
          certificate_generated_at: string | null
          certificate_template_id: string | null
          certificate_url: string | null
          checked_in: boolean | null
          checked_in_at: string | null
          checkin_token: string | null
          confirmed_at: string | null
          convocation_address: Json | null
          convocation_number: string | null
          created_at: string | null
          currency: string | null
          custom_fields: Json | null
          discount_amount: number | null
          discount_code: string | null
          discount_code_id: string | null
          event_id: string | null
          exam_marks: Json | null
          exam_result: string | null
          exam_total_marks: number | null
          form_responses: Json | null
          id: string | null
          notes: string | null
          order_id: string | null
          participation_mode: string | null
          payment_id: string | null
          payment_status: string | null
          quantity: number | null
          registration_number: string | null
          status: string | null
          tax_amount: number | null
          ticket_type_id: string | null
          total_amount: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          attendee_city?: string | null
          attendee_country?: string | null
          attendee_designation?: string | null
          attendee_email?: string | null
          attendee_institution?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          attendee_state?: string | null
          badge_downloaded_by_delegate_at?: string | null
          badge_generated_at?: string | null
          badge_template_id?: string | null
          badge_url?: string | null
          buyer_id?: string | null
          certificate_downloaded_at?: string | null
          certificate_generated_at?: string | null
          certificate_template_id?: string | null
          certificate_url?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checkin_token?: string | null
          confirmed_at?: string | null
          convocation_address?: Json | null
          convocation_number?: string | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_code_id?: string | null
          event_id?: string | null
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          form_responses?: Json | null
          id?: string | null
          notes?: string | null
          order_id?: string | null
          participation_mode?: string | null
          payment_id?: string | null
          payment_status?: string | null
          quantity?: number | null
          registration_number?: string | null
          status?: string | null
          tax_amount?: number | null
          ticket_type_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          attendee_city?: string | null
          attendee_country?: string | null
          attendee_designation?: string | null
          attendee_email?: string | null
          attendee_institution?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          attendee_state?: string | null
          badge_downloaded_by_delegate_at?: string | null
          badge_generated_at?: string | null
          badge_template_id?: string | null
          badge_url?: string | null
          buyer_id?: string | null
          certificate_downloaded_at?: string | null
          certificate_generated_at?: string | null
          certificate_template_id?: string | null
          certificate_url?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checkin_token?: string | null
          confirmed_at?: string | null
          convocation_address?: Json | null
          convocation_number?: string | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_code_id?: string | null
          event_id?: string | null
          exam_marks?: Json | null
          exam_result?: string | null
          exam_total_marks?: number | null
          form_responses?: Json | null
          id?: string | null
          notes?: string | null
          order_id?: string | null
          participation_mode?: string | null
          payment_id?: string | null
          payment_status?: string | null
          quantity?: number | null
          registration_number?: string | null
          status?: string | null
          tax_amount?: number | null
          ticket_type_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      reply_templates: {
        Row: {
          active: boolean | null
          body: string
          created_at: string | null
          created_by: string | null
          id: string
          sort_order: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          body: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          sort_order?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          body?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          sort_order?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      reviewer_conflicts: {
        Row: {
          conflict_reason: string | null
          conflict_type: string
          conflict_value: string
          created_at: string | null
          declared_at: string | null
          event_id: string
          id: string
          reviewer_id: string
        }
        Insert: {
          conflict_reason?: string | null
          conflict_type: string
          conflict_value: string
          created_at?: string | null
          declared_at?: string | null
          event_id: string
          id?: string
          reviewer_id: string
        }
        Update: {
          conflict_reason?: string | null
          conflict_type?: string
          conflict_value?: string
          created_at?: string | null
          declared_at?: string | null
          event_id?: string
          id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviewer_conflicts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviewer_conflicts_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "abstract_reviewers"
            referencedColumns: ["id"]
          },
        ]
      }
      reviewers_pool: {
        Row: {
          available_for_review: boolean | null
          avg_review_time_days: number | null
          bio: string | null
          city: string | null
          created_at: string | null
          designation: string | null
          email: string
          form_completed_at: string | null
          form_token: string | null
          id: string
          institution: string | null
          languages: string[] | null
          last_review_at: string | null
          linkedin_url: string | null
          max_reviews_per_month: number | null
          name: string
          notes: string | null
          orcid_id: string | null
          phone: string | null
          photo_url: string | null
          publications_count: number | null
          rating: number | null
          research_interests: string | null
          specialty: string | null
          status: string | null
          total_reviews_completed: number | null
          updated_at: string | null
          years_of_experience: string | null
        }
        Insert: {
          available_for_review?: boolean | null
          avg_review_time_days?: number | null
          bio?: string | null
          city?: string | null
          created_at?: string | null
          designation?: string | null
          email: string
          form_completed_at?: string | null
          form_token?: string | null
          id?: string
          institution?: string | null
          languages?: string[] | null
          last_review_at?: string | null
          linkedin_url?: string | null
          max_reviews_per_month?: number | null
          name: string
          notes?: string | null
          orcid_id?: string | null
          phone?: string | null
          photo_url?: string | null
          publications_count?: number | null
          rating?: number | null
          research_interests?: string | null
          specialty?: string | null
          status?: string | null
          total_reviews_completed?: number | null
          updated_at?: string | null
          years_of_experience?: string | null
        }
        Update: {
          available_for_review?: boolean | null
          avg_review_time_days?: number | null
          bio?: string | null
          city?: string | null
          created_at?: string | null
          designation?: string | null
          email?: string
          form_completed_at?: string | null
          form_token?: string | null
          id?: string
          institution?: string | null
          languages?: string[] | null
          last_review_at?: string | null
          linkedin_url?: string | null
          max_reviews_per_month?: number | null
          name?: string
          notes?: string | null
          orcid_id?: string | null
          phone?: string | null
          photo_url?: string | null
          publications_count?: number | null
          rating?: number | null
          research_interests?: string | null
          specialty?: string | null
          status?: string | null
          total_reviews_completed?: number | null
          updated_at?: string | null
          years_of_experience?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean | null
          permissions: Json
          role_name: string
          role_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          permissions: Json
          role_name: string
          role_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          permissions?: Json
          role_name?: string
          role_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      session_attendance_speaker: {
        Row: {
          arrived_late: boolean
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string
          device_id: string | null
          event_id: string
          id: string
          no_show: boolean
          notes: string | null
          session_speaker_id: string
          updated_at: string
        }
        Insert: {
          arrived_late?: boolean
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          device_id?: string | null
          event_id: string
          id?: string
          no_show?: boolean
          notes?: string | null
          session_speaker_id: string
          updated_at?: string
        }
        Update: {
          arrived_late?: boolean
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          device_id?: string | null
          event_id?: string
          id?: string
          no_show?: boolean
          notes?: string | null
          session_speaker_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_attendance_speaker_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_attendance_speaker_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_attendance_speaker_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_attendance_speaker_session_speaker_id_fkey"
            columns: ["session_speaker_id"]
            isOneToOne: true
            referencedRelation: "faculty_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      session_cme: {
        Row: {
          accrediting_body: string | null
          activity_code: string | null
          cme_category: string | null
          cme_credits: number
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          notes: string | null
          quiz_form_id: string | null
          requires_completion_quiz: boolean
          session_id: string
          updated_at: string
        }
        Insert: {
          accrediting_body?: string | null
          activity_code?: string | null
          cme_category?: string | null
          cme_credits?: number
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          notes?: string | null
          quiz_form_id?: string | null
          requires_completion_quiz?: boolean
          session_id: string
          updated_at?: string
        }
        Update: {
          accrediting_body?: string | null
          activity_code?: string | null
          cme_category?: string | null
          cme_credits?: number
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          quiz_form_id?: string | null
          requires_completion_quiz?: boolean
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_cme_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_cme_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_cme_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_cme_quiz_form_id_fkey"
            columns: ["quiz_form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_cme_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_feedback: {
        Row: {
          comments: string | null
          created_at: string
          event_id: string
          id: string
          ip_address: unknown
          is_anonymous: boolean
          rating_content: number | null
          rating_delivery: number | null
          rating_overall: number
          respondent_email: string | null
          respondent_registration_id: string | null
          respondent_token: string | null
          session_id: string
          session_speaker_id: string | null
        }
        Insert: {
          comments?: string | null
          created_at?: string
          event_id: string
          id?: string
          ip_address?: unknown
          is_anonymous?: boolean
          rating_content?: number | null
          rating_delivery?: number | null
          rating_overall: number
          respondent_email?: string | null
          respondent_registration_id?: string | null
          respondent_token?: string | null
          session_id: string
          session_speaker_id?: string | null
        }
        Update: {
          comments?: string | null
          created_at?: string
          event_id?: string
          id?: string
          ip_address?: unknown
          is_anonymous?: boolean
          rating_content?: number | null
          rating_delivery?: number | null
          rating_overall?: number
          respondent_email?: string | null
          respondent_registration_id?: string | null
          respondent_token?: string | null
          session_id?: string
          session_speaker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_feedback_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_feedback_respondent_registration_id_fkey"
            columns: ["respondent_registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_feedback_session_speaker_id_fkey"
            columns: ["session_speaker_id"]
            isOneToOne: false
            referencedRelation: "faculty_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      session_qa: {
        Row: {
          answer: string | null
          answered_at: string | null
          answered_by_faculty_id: string | null
          asked_at: string
          asked_by_email: string | null
          asked_by_name: string | null
          asked_by_registration_id: string | null
          event_id: string
          id: string
          ip_address: unknown
          is_anonymous: boolean
          is_published: boolean
          question: string
          session_id: string
          session_speaker_id: string | null
          upvotes: number
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          answered_by_faculty_id?: string | null
          asked_at?: string
          asked_by_email?: string | null
          asked_by_name?: string | null
          asked_by_registration_id?: string | null
          event_id: string
          id?: string
          ip_address?: unknown
          is_anonymous?: boolean
          is_published?: boolean
          question: string
          session_id: string
          session_speaker_id?: string | null
          upvotes?: number
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          answered_by_faculty_id?: string | null
          asked_at?: string
          asked_by_email?: string | null
          asked_by_name?: string | null
          asked_by_registration_id?: string | null
          event_id?: string
          id?: string
          ip_address?: unknown
          is_anonymous?: boolean
          is_published?: boolean
          question?: string
          session_id?: string
          session_speaker_id?: string | null
          upvotes?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_qa_answered_by_faculty_id_fkey"
            columns: ["answered_by_faculty_id"]
            isOneToOne: false
            referencedRelation: "faculty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_qa_asked_by_registration_id_fkey"
            columns: ["asked_by_registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_qa_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_qa_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_qa_session_speaker_id_fkey"
            columns: ["session_speaker_id"]
            isOneToOne: false
            referencedRelation: "faculty_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          audience_count: number | null
          av_requirements: Json | null
          chairpersons: string | null
          chairpersons_text: string | null
          coordinator_checklist: Json | null
          coordinator_notes: string | null
          coordinator_status: string | null
          created_at: string | null
          day_number: number | null
          description: string | null
          duration_minutes: number | null
          end_time: string | null
          event_id: string | null
          faculty_email: string | null
          faculty_id: string | null
          faculty_name: string | null
          faculty_phone: string | null
          floor: string | null
          hall: string | null
          id: string
          import_batch_id: string | null
          livestream_required: boolean | null
          max_attendees: number | null
          max_presentations: number | null
          moderators: string | null
          moderators_text: string | null
          pre_registration_required: boolean | null
          recording_required: boolean | null
          registered_count: number | null
          session_code: string | null
          session_date: string | null
          session_name: string
          session_type: string | null
          speakers: string | null
          speakers_text: string | null
          specialty_track: string | null
          start_time: string | null
          status: string | null
          topics: string[] | null
          updated_at: string | null
        }
        Insert: {
          audience_count?: number | null
          av_requirements?: Json | null
          chairpersons?: string | null
          chairpersons_text?: string | null
          coordinator_checklist?: Json | null
          coordinator_notes?: string | null
          coordinator_status?: string | null
          created_at?: string | null
          day_number?: number | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          event_id?: string | null
          faculty_email?: string | null
          faculty_id?: string | null
          faculty_name?: string | null
          faculty_phone?: string | null
          floor?: string | null
          hall?: string | null
          id?: string
          import_batch_id?: string | null
          livestream_required?: boolean | null
          max_attendees?: number | null
          max_presentations?: number | null
          moderators?: string | null
          moderators_text?: string | null
          pre_registration_required?: boolean | null
          recording_required?: boolean | null
          registered_count?: number | null
          session_code?: string | null
          session_date?: string | null
          session_name: string
          session_type?: string | null
          speakers?: string | null
          speakers_text?: string | null
          specialty_track?: string | null
          start_time?: string | null
          status?: string | null
          topics?: string[] | null
          updated_at?: string | null
        }
        Update: {
          audience_count?: number | null
          av_requirements?: Json | null
          chairpersons?: string | null
          chairpersons_text?: string | null
          coordinator_checklist?: Json | null
          coordinator_notes?: string | null
          coordinator_status?: string | null
          created_at?: string | null
          day_number?: number | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          event_id?: string | null
          faculty_email?: string | null
          faculty_id?: string | null
          faculty_name?: string | null
          faculty_phone?: string | null
          floor?: string | null
          hall?: string | null
          id?: string
          import_batch_id?: string | null
          livestream_required?: boolean | null
          max_attendees?: number | null
          max_presentations?: number | null
          moderators?: string | null
          moderators_text?: string | null
          pre_registration_required?: boolean | null
          recording_required?: boolean | null
          registered_count?: number | null
          session_code?: string | null
          session_date?: string | null
          session_name?: string
          session_type?: string | null
          speakers?: string | null
          speakers_text?: string | null
          specialty_track?: string | null
          start_time?: string | null
          status?: string | null
          topics?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions_127_pre_final_snapshot_2026_06_29: {
        Row: {
          audience_count: number | null
          av_requirements: Json | null
          chairpersons: string | null
          chairpersons_text: string | null
          coordinator_checklist: Json | null
          coordinator_notes: string | null
          coordinator_status: string | null
          created_at: string | null
          day_number: number | null
          description: string | null
          duration_minutes: number | null
          end_time: string | null
          event_id: string | null
          faculty_email: string | null
          faculty_id: string | null
          faculty_name: string | null
          faculty_phone: string | null
          floor: string | null
          hall: string | null
          id: string | null
          import_batch_id: string | null
          livestream_required: boolean | null
          max_attendees: number | null
          max_presentations: number | null
          moderators: string | null
          moderators_text: string | null
          pre_registration_required: boolean | null
          recording_required: boolean | null
          registered_count: number | null
          session_code: string | null
          session_date: string | null
          session_name: string | null
          session_type: string | null
          speakers: string | null
          speakers_text: string | null
          specialty_track: string | null
          start_time: string | null
          status: string | null
          topics: string[] | null
          updated_at: string | null
        }
        Insert: {
          audience_count?: number | null
          av_requirements?: Json | null
          chairpersons?: string | null
          chairpersons_text?: string | null
          coordinator_checklist?: Json | null
          coordinator_notes?: string | null
          coordinator_status?: string | null
          created_at?: string | null
          day_number?: number | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          event_id?: string | null
          faculty_email?: string | null
          faculty_id?: string | null
          faculty_name?: string | null
          faculty_phone?: string | null
          floor?: string | null
          hall?: string | null
          id?: string | null
          import_batch_id?: string | null
          livestream_required?: boolean | null
          max_attendees?: number | null
          max_presentations?: number | null
          moderators?: string | null
          moderators_text?: string | null
          pre_registration_required?: boolean | null
          recording_required?: boolean | null
          registered_count?: number | null
          session_code?: string | null
          session_date?: string | null
          session_name?: string | null
          session_type?: string | null
          speakers?: string | null
          speakers_text?: string | null
          specialty_track?: string | null
          start_time?: string | null
          status?: string | null
          topics?: string[] | null
          updated_at?: string | null
        }
        Update: {
          audience_count?: number | null
          av_requirements?: Json | null
          chairpersons?: string | null
          chairpersons_text?: string | null
          coordinator_checklist?: Json | null
          coordinator_notes?: string | null
          coordinator_status?: string | null
          created_at?: string | null
          day_number?: number | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          event_id?: string | null
          faculty_email?: string | null
          faculty_id?: string | null
          faculty_name?: string | null
          faculty_phone?: string | null
          floor?: string | null
          hall?: string | null
          id?: string | null
          import_batch_id?: string | null
          livestream_required?: boolean | null
          max_attendees?: number | null
          max_presentations?: number | null
          moderators?: string | null
          moderators_text?: string | null
          pre_registration_required?: boolean | null
          recording_required?: boolean | null
          registered_count?: number | null
          session_code?: string | null
          session_date?: string | null
          session_name?: string | null
          session_type?: string | null
          speakers?: string | null
          speakers_text?: string | null
          specialty_track?: string | null
          start_time?: string | null
          status?: string | null
          topics?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      skill_courses: {
        Row: {
          convenor: string | null
          credential_type: string
          id: number
          name: string
          place: string | null
          venue: string | null
          year: number | null
        }
        Insert: {
          convenor?: string | null
          credential_type: string
          id: number
          name: string
          place?: string | null
          venue?: string | null
          year?: number | null
        }
        Update: {
          convenor?: string | null
          credential_type?: string
          id?: number
          name?: string
          place?: string | null
          venue?: string | null
          year?: number | null
        }
        Relationships: []
      }
      speaker_commitments: {
        Row: {
          created_at: string | null
          event_year: string | null
          faculty_email: string
          faculty_name: string
          id: string
          remarks: string | null
          response_date: string | null
          session_date: string | null
          session_hall: string | null
          session_id: string
          session_name: string | null
          session_role: string | null
          session_time: string | null
          session_topic: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_year?: string | null
          faculty_email: string
          faculty_name: string
          id?: string
          remarks?: string | null
          response_date?: string | null
          session_date?: string | null
          session_hall?: string | null
          session_id: string
          session_name?: string | null
          session_role?: string | null
          session_time?: string | null
          session_topic?: string | null
          status: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_year?: string | null
          faculty_email?: string
          faculty_name?: string
          id?: string
          remarks?: string | null
          response_date?: string | null
          session_date?: string | null
          session_hall?: string | null
          session_id?: string
          session_name?: string | null
          session_role?: string | null
          session_time?: string | null
          session_topic?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      speaker_content: {
        Row: {
          content_type: string
          created_at: string
          event_id: string
          faculty_assignment_id: string
          faculty_id: string | null
          file_size_bytes: number
          id: string
          is_current: boolean
          mime_type: string
          notes: string | null
          original_filename: string
          public_url: string | null
          review_status: string
          storage_bucket: string
          storage_path: string
          superseded_at: string | null
          updated_at: string
          uploaded_at: string
          uploaded_by_email: string | null
          uploaded_by_token: string | null
          version: number
        }
        Insert: {
          content_type: string
          created_at?: string
          event_id: string
          faculty_assignment_id: string
          faculty_id?: string | null
          file_size_bytes: number
          id?: string
          is_current?: boolean
          mime_type: string
          notes?: string | null
          original_filename: string
          public_url?: string | null
          review_status?: string
          storage_bucket?: string
          storage_path: string
          superseded_at?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by_email?: string | null
          uploaded_by_token?: string | null
          version?: number
        }
        Update: {
          content_type?: string
          created_at?: string
          event_id?: string
          faculty_assignment_id?: string
          faculty_id?: string | null
          file_size_bytes?: number
          id?: string
          is_current?: boolean
          mime_type?: string
          notes?: string | null
          original_filename?: string
          public_url?: string | null
          review_status?: string
          storage_bucket?: string
          storage_path?: string
          superseded_at?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by_email?: string | null
          uploaded_by_token?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "speaker_content_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaker_content_faculty_assignment_id_fkey"
            columns: ["faculty_assignment_id"]
            isOneToOne: false
            referencedRelation: "faculty_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaker_content_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculty"
            referencedColumns: ["id"]
          },
        ]
      }
      speaker_disclosures: {
        Row: {
          created_at: string
          disclosure_text: string | null
          entities: Json
          event_id: string
          faculty_id: string
          has_conflict: boolean
          id: string
          is_current: boolean
          pdf_storage_path: string | null
          signature_image_url: string | null
          signed_at: string
          signed_by_token: string | null
          signed_ip: unknown
          superseded_at: string | null
          superseded_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          disclosure_text?: string | null
          entities?: Json
          event_id: string
          faculty_id: string
          has_conflict: boolean
          id?: string
          is_current?: boolean
          pdf_storage_path?: string | null
          signature_image_url?: string | null
          signed_at?: string
          signed_by_token?: string | null
          signed_ip?: unknown
          superseded_at?: string | null
          superseded_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          disclosure_text?: string | null
          entities?: Json
          event_id?: string
          faculty_id?: string
          has_conflict?: boolean
          id?: string
          is_current?: boolean
          pdf_storage_path?: string | null
          signature_image_url?: string | null
          signed_at?: string
          signed_by_token?: string | null
          signed_ip?: unknown
          superseded_at?: string | null
          superseded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "speaker_disclosures_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaker_disclosures_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaker_disclosures_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "speaker_disclosures"
            referencedColumns: ["id"]
          },
        ]
      }
      speaker_portal_actions: {
        Row: {
          action_type: string
          created_at: string
          event_id: string | null
          faculty_assignment_id: string | null
          id: string
          ip_address: unknown
          payload: Json
          user_agent: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          event_id?: string | null
          faculty_assignment_id?: string | null
          id?: string
          ip_address?: unknown
          payload?: Json
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          event_id?: string | null
          faculty_assignment_id?: string | null
          id?: string
          ip_address?: unknown
          payload?: Json
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "speaker_portal_actions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaker_portal_actions_faculty_assignment_id_fkey"
            columns: ["faculty_assignment_id"]
            isOneToOne: false
            referencedRelation: "faculty_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      speaker_queries: {
        Row: {
          admin_response: string | null
          created_at: string | null
          id: string
          message: string
          priority: string | null
          query_type: string
          responded_at: string | null
          responded_by: string | null
          speaker_email: string
          speaker_mobile: string | null
          speaker_name: string
          status: string | null
          subject: string
          updated_at: string | null
        }
        Insert: {
          admin_response?: string | null
          created_at?: string | null
          id?: string
          message: string
          priority?: string | null
          query_type: string
          responded_at?: string | null
          responded_by?: string | null
          speaker_email: string
          speaker_mobile?: string | null
          speaker_name: string
          status?: string | null
          subject: string
          updated_at?: string | null
        }
        Update: {
          admin_response?: string | null
          created_at?: string | null
          id?: string
          message?: string
          priority?: string | null
          query_type?: string
          responded_at?: string | null
          responded_by?: string | null
          speaker_email?: string
          speaker_mobile?: string | null
          speaker_name?: string
          status?: string | null
          subject?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sponsor_contacts: {
        Row: {
          created_at: string | null
          designation: string | null
          email: string | null
          id: string
          is_primary: boolean | null
          name: string
          needs_badge: boolean | null
          phone: string | null
          sponsor_id: string | null
        }
        Insert: {
          created_at?: string | null
          designation?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name: string
          needs_badge?: boolean | null
          phone?: string | null
          sponsor_id?: string | null
        }
        Update: {
          created_at?: string | null
          designation?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name?: string
          needs_badge?: boolean | null
          phone?: string | null
          sponsor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_contacts_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_tiers: {
        Row: {
          benefits: Json | null
          color: string | null
          complimentary_passes: number | null
          created_at: string | null
          display_order: number | null
          event_id: string | null
          id: string
          logo_size: string | null
          name: string
          price: number | null
          stall_size: string | null
        }
        Insert: {
          benefits?: Json | null
          color?: string | null
          complimentary_passes?: number | null
          created_at?: string | null
          display_order?: number | null
          event_id?: string | null
          id?: string
          logo_size?: string | null
          name: string
          price?: number | null
          stall_size?: string | null
        }
        Update: {
          benefits?: Json | null
          color?: string | null
          complimentary_passes?: number | null
          created_at?: string | null
          display_order?: number | null
          event_id?: string | null
          id?: string
          logo_size?: string | null
          name?: string
          price?: number | null
          stall_size?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_tiers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors: {
        Row: {
          amount_agreed: number | null
          amount_paid: number | null
          booth_allocated: boolean | null
          booth_location: string | null
          booth_number: string | null
          booth_size: string | null
          category: string | null
          company_address: string | null
          company_email: string | null
          company_name: string
          company_phone: string | null
          confirmed_at: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string | null
          description: string | null
          event_id: string | null
          id: string
          insert_in_kit: boolean | null
          insert_received: boolean | null
          invoice_number: string | null
          logo_in_backdrop: boolean | null
          logo_in_badges: boolean | null
          logo_in_souvenir: boolean | null
          logo_received: boolean | null
          logo_url: string | null
          notes: string | null
          payment_status: string | null
          reps_allowed: number | null
          reps_registered: number | null
          speaking_slot: boolean | null
          sponsorship_amount: number | null
          standee_count: number | null
          status: string | null
          tier_id: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          amount_agreed?: number | null
          amount_paid?: number | null
          booth_allocated?: boolean | null
          booth_location?: string | null
          booth_number?: string | null
          booth_size?: string | null
          category?: string | null
          company_address?: string | null
          company_email?: string | null
          company_name: string
          company_phone?: string | null
          confirmed_at?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          description?: string | null
          event_id?: string | null
          id?: string
          insert_in_kit?: boolean | null
          insert_received?: boolean | null
          invoice_number?: string | null
          logo_in_backdrop?: boolean | null
          logo_in_badges?: boolean | null
          logo_in_souvenir?: boolean | null
          logo_received?: boolean | null
          logo_url?: string | null
          notes?: string | null
          payment_status?: string | null
          reps_allowed?: number | null
          reps_registered?: number | null
          speaking_slot?: boolean | null
          sponsorship_amount?: number | null
          standee_count?: number | null
          status?: string | null
          tier_id?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          amount_agreed?: number | null
          amount_paid?: number | null
          booth_allocated?: boolean | null
          booth_location?: string | null
          booth_number?: string | null
          booth_size?: string | null
          category?: string | null
          company_address?: string | null
          company_email?: string | null
          company_name?: string
          company_phone?: string | null
          confirmed_at?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          description?: string | null
          event_id?: string | null
          id?: string
          insert_in_kit?: boolean | null
          insert_received?: boolean | null
          invoice_number?: string | null
          logo_in_backdrop?: boolean | null
          logo_in_badges?: boolean | null
          logo_in_souvenir?: boolean | null
          logo_received?: boolean | null
          logo_url?: string | null
          notes?: string | null
          payment_status?: string | null
          reps_allowed?: number | null
          reps_registered?: number | null
          speaking_slot?: boolean | null
          sponsorship_amount?: number | null
          standee_count?: number | null
          status?: string | null
          tier_id?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsors_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "sponsor_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      stalls: {
        Row: {
          amenities: Json | null
          created_at: string | null
          event_id: string | null
          height: number | null
          id: string
          location: string | null
          notes: string | null
          position_x: number | null
          position_y: number | null
          price: number | null
          size: string | null
          sponsor_id: string | null
          stall_name: string | null
          stall_number: string
          status: string | null
          width: number | null
        }
        Insert: {
          amenities?: Json | null
          created_at?: string | null
          event_id?: string | null
          height?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          position_x?: number | null
          position_y?: number | null
          price?: number | null
          size?: string | null
          sponsor_id?: string | null
          stall_name?: string | null
          stall_number: string
          status?: string | null
          width?: number | null
        }
        Update: {
          amenities?: Json | null
          created_at?: string | null
          event_id?: string | null
          height?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          position_x?: number | null
          position_y?: number | null
          price?: number | null
          size?: string | null
          sponsor_id?: string | null
          stall_name?: string | null
          stall_number?: string
          status?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stalls_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stalls_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_idempotency: {
        Row: {
          created_at: string | null
          endpoint: string
          expires_at: string | null
          key: string
          request_hash: string | null
          response_body: Json | null
          response_status: number | null
          status: string
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          expires_at?: string | null
          key: string
          request_hash?: string | null
          response_body?: Json | null
          response_status?: number | null
          status?: string
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          expires_at?: string | null
          key?: string
          request_hash?: string | null
          response_body?: Json | null
          response_status?: number | null
          status?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          amasi_number: string | null
          assigned_to: string | null
          attachments: Json | null
          category: string
          closed_at: string | null
          created_at: string | null
          csat_comment: string | null
          csat_rating: number | null
          csat_sent_at: string | null
          csat_token: string | null
          description: string
          email: string | null
          first_response_at: string | null
          id: string
          merged_at: string | null
          merged_into: string | null
          name: string
          phone: string | null
          priority: string
          search_vector: unknown
          sla_breached: boolean | null
          sla_due_at: string | null
          status: string
          subject: string
          ticket_number: string
          updated_at: string | null
        }
        Insert: {
          amasi_number?: string | null
          assigned_to?: string | null
          attachments?: Json | null
          category?: string
          closed_at?: string | null
          created_at?: string | null
          csat_comment?: string | null
          csat_rating?: number | null
          csat_sent_at?: string | null
          csat_token?: string | null
          description: string
          email?: string | null
          first_response_at?: string | null
          id?: string
          merged_at?: string | null
          merged_into?: string | null
          name: string
          phone?: string | null
          priority?: string
          search_vector?: unknown
          sla_breached?: boolean | null
          sla_due_at?: string | null
          status?: string
          subject: string
          ticket_number: string
          updated_at?: string | null
        }
        Update: {
          amasi_number?: string | null
          assigned_to?: string | null
          attachments?: Json | null
          category?: string
          closed_at?: string | null
          created_at?: string | null
          csat_comment?: string | null
          csat_rating?: number | null
          csat_sent_at?: string | null
          csat_token?: string | null
          description?: string
          email?: string | null
          first_response_at?: string | null
          id?: string
          merged_at?: string | null
          merged_into?: string | null
          name?: string
          phone?: string | null
          priority?: string
          search_vector?: unknown
          sla_breached?: boolean | null
          sla_due_at?: string | null
          status?: string
          subject?: string
          ticket_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      team_access_logs: {
        Row: {
          created_at: string | null
          event_id: string | null
          id: string
          ip_address: string | null
          method: string | null
          module: string
          path: string | null
          user_agent: string | null
          user_email: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          ip_address?: string | null
          method?: string | null
          module: string
          path?: string | null
          user_agent?: string | null
          user_email: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          ip_address?: string | null
          method?: string | null
          module?: string
          path?: string | null
          user_agent?: string | null
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      team_activity_logs: {
        Row: {
          action: string
          actor_email: string
          actor_id: string
          created_at: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          target_email: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_email: string
          actor_id: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_email?: string | null
          target_id?: string | null
          target_type?: string
        }
        Update: {
          action?: string
          actor_email?: string
          actor_id?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_email?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          event_ids: string[] | null
          expires_at: string
          id: string
          invited_by: string | null
          name: string | null
          permissions: Json | null
          phone: string | null
          role: string
          status: string
          token: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          event_ids?: string[] | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          name?: string | null
          permissions?: Json | null
          phone?: string | null
          role?: string
          status?: string
          token?: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          event_ids?: string[] | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          name?: string | null
          permissions?: Json | null
          phone?: string | null
          role?: string
          status?: string
          token?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          accepted_at: string | null
          backup_member_id: string | null
          created_at: string | null
          email: string
          event_ids: string[] | null
          id: string
          invited_by: string | null
          is_active: boolean | null
          last_reviewed_at: string | null
          name: string
          needs_review: boolean | null
          notes: string | null
          permissions: Json | null
          phone: string | null
          role: string
          tags: string[] | null
          timezone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          backup_member_id?: string | null
          created_at?: string | null
          email: string
          event_ids?: string[] | null
          id?: string
          invited_by?: string | null
          is_active?: boolean | null
          last_reviewed_at?: string | null
          name: string
          needs_review?: boolean | null
          notes?: string | null
          permissions?: Json | null
          phone?: string | null
          role?: string
          tags?: string[] | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          backup_member_id?: string | null
          created_at?: string | null
          email?: string
          event_ids?: string[] | null
          id?: string
          invited_by?: string | null
          is_active?: boolean | null
          last_reviewed_at?: string | null
          name?: string
          needs_review?: boolean | null
          notes?: string | null
          permissions?: Json | null
          phone?: string | null
          role?: string
          tags?: string[] | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_backup_member_id_fkey"
            columns: ["backup_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_replies: {
        Row: {
          attachments: Json | null
          author_name: string | null
          created_at: string | null
          id: string
          is_admin: boolean
          is_internal: boolean | null
          message: string
          ticket_id: string
        }
        Insert: {
          attachments?: Json | null
          author_name?: string | null
          created_at?: string | null
          id?: string
          is_admin?: boolean
          is_internal?: boolean | null
          message: string
          ticket_id: string
        }
        Update: {
          attachments?: Json | null
          author_name?: string | null
          created_at?: string | null
          id?: string
          is_admin?: boolean
          is_internal?: boolean | null
          message?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_routing_rules: {
        Row: {
          active: boolean | null
          assigned_to: string
          category: string
          created_at: string | null
          id: string
          priority_override: string | null
        }
        Insert: {
          active?: boolean | null
          assigned_to: string
          category: string
          created_at?: string | null
          id?: string
          priority_override?: string | null
        }
        Update: {
          active?: boolean | null
          assigned_to?: string
          category?: string
          created_at?: string | null
          id?: string
          priority_override?: string | null
        }
        Relationships: []
      }
      ticket_types: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          event_id: string
          exclusivity_group: string | null
          form_id: string | null
          id: string
          is_hidden: boolean
          max_per_order: number
          min_per_order: number
          name: string
          price: number
          quantity_sold: number
          quantity_total: number | null
          requires_approval: boolean
          sale_end_date: string | null
          sale_start_date: string | null
          sort_order: number
          status: string
          tax_percentage: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          event_id: string
          exclusivity_group?: string | null
          form_id?: string | null
          id?: string
          is_hidden?: boolean
          max_per_order?: number
          min_per_order?: number
          name: string
          price?: number
          quantity_sold?: number
          quantity_total?: number | null
          requires_approval?: boolean
          sale_end_date?: string | null
          sale_start_date?: string | null
          sort_order?: number
          status?: string
          tax_percentage?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          event_id?: string
          exclusivity_group?: string | null
          form_id?: string | null
          id?: string
          is_hidden?: boolean
          max_per_order?: number
          min_per_order?: number
          name?: string
          price?: number
          quantity_sold?: number
          quantity_total?: number | null
          requires_approval?: boolean
          sale_end_date?: string | null
          sale_start_date?: string | null
          sort_order?: number
          status?: string
          tax_percentage?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_types_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          chairpersons: string | null
          color: string | null
          created_at: string | null
          description: string | null
          event_id: string
          id: string
          name: string
          sessions_count: number | null
          updated_at: string | null
        }
        Insert: {
          chairpersons?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          event_id: string
          id?: string
          name: string
          sessions_count?: number | null
          updated_at?: string | null
        }
        Update: {
          chairpersons?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          event_id?: string
          id?: string
          name?: string
          sessions_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_bookings: {
        Row: {
          amount: number | null
          booked_by: string | null
          booking_date: string | null
          booking_reference: string | null
          booking_status: string | null
          booking_type: string | null
          carrier: string | null
          created_at: string | null
          destination_city: string | null
          event_faculty_id: string | null
          event_id: string | null
          faculty_id: string | null
          flight_train_number: string | null
          id: string
          internal_notes: string | null
          origin_city: string | null
          pickup_driver_name: string | null
          pickup_driver_phone: string | null
          pickup_location: string | null
          pickup_required: boolean | null
          pickup_status: string | null
          pickup_time: string | null
          pickup_vehicle: string | null
          pnr: string | null
          special_requirements: string | null
          travel_date: string | null
          travel_mode: string | null
          travel_time: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          booked_by?: string | null
          booking_date?: string | null
          booking_reference?: string | null
          booking_status?: string | null
          booking_type?: string | null
          carrier?: string | null
          created_at?: string | null
          destination_city?: string | null
          event_faculty_id?: string | null
          event_id?: string | null
          faculty_id?: string | null
          flight_train_number?: string | null
          id?: string
          internal_notes?: string | null
          origin_city?: string | null
          pickup_driver_name?: string | null
          pickup_driver_phone?: string | null
          pickup_location?: string | null
          pickup_required?: boolean | null
          pickup_status?: string | null
          pickup_time?: string | null
          pickup_vehicle?: string | null
          pnr?: string | null
          special_requirements?: string | null
          travel_date?: string | null
          travel_mode?: string | null
          travel_time?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          booked_by?: string | null
          booking_date?: string | null
          booking_reference?: string | null
          booking_status?: string | null
          booking_type?: string | null
          carrier?: string | null
          created_at?: string | null
          destination_city?: string | null
          event_faculty_id?: string | null
          event_id?: string | null
          faculty_id?: string | null
          flight_train_number?: string | null
          id?: string
          internal_notes?: string | null
          origin_city?: string | null
          pickup_driver_name?: string | null
          pickup_driver_phone?: string | null
          pickup_location?: string | null
          pickup_required?: boolean | null
          pickup_status?: string | null
          pickup_time?: string | null
          pickup_vehicle?: string | null
          pnr?: string | null
          special_requirements?: string | null
          travel_date?: string | null
          travel_mode?: string | null
          travel_time?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "travel_bookings_event_faculty_id_fkey"
            columns: ["event_faculty_id"]
            isOneToOne: false
            referencedRelation: "event_faculty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_bookings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_bookings_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculty"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string | null
          device_name: string | null
          device_type: string | null
          expires_at: string
          id: string
          ip_address: string | null
          is_active: boolean | null
          last_activity_at: string | null
          logged_out_at: string | null
          logout_reason: string | null
          os: string | null
          refresh_token: string | null
          session_token: string
          user_id: string
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_name?: string | null
          device_type?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_activity_at?: string | null
          logged_out_at?: string | null
          logout_reason?: string | null
          os?: string | null
          refresh_token?: string | null
          session_token: string
          user_id: string
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_name?: string | null
          device_type?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_activity_at?: string | null
          logged_out_at?: string | null
          logout_reason?: string | null
          os?: string | null
          refresh_token?: string | null
          session_token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          faculty_id: string | null
          id: string
          is_active: boolean | null
          is_super_admin: boolean | null
          is_verified: boolean | null
          last_active_at: string | null
          last_login_at: string | null
          login_count: number | null
          member_id: string | null
          name: string
          notification_settings: Json | null
          phone: string | null
          platform_role:
            | Database["public"]["Enums"]["user_platform_role"]
            | null
          preferences: Json | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          faculty_id?: string | null
          id?: string
          is_active?: boolean | null
          is_super_admin?: boolean | null
          is_verified?: boolean | null
          last_active_at?: string | null
          last_login_at?: string | null
          login_count?: number | null
          member_id?: string | null
          name: string
          notification_settings?: Json | null
          phone?: string | null
          platform_role?:
            | Database["public"]["Enums"]["user_platform_role"]
            | null
          preferences?: Json | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          faculty_id?: string | null
          id?: string
          is_active?: boolean | null
          is_super_admin?: boolean | null
          is_verified?: boolean | null
          last_active_at?: string | null
          last_login_at?: string | null
          login_count?: number | null
          member_id?: string | null
          name?: string
          notification_settings?: Json | null
          phone?: string | null
          platform_role?:
            | Database["public"]["Enums"]["user_platform_role"]
            | null
          preferences?: Json | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "active_amasi_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      visa_requests: {
        Row: {
          applicant_email: string | null
          applicant_name: string
          created_at: string | null
          embassy_country: string | null
          event_id: string
          id: string
          letter_generated_at: string | null
          letter_sent_at: string | null
          letter_status: string | null
          letter_type: string | null
          letter_url: string | null
          nationality: string | null
          notes: string | null
          passport_expiry: string | null
          passport_number: string | null
          processed_by: string | null
          registration_id: string | null
          travel_dates_from: string | null
          travel_dates_to: string | null
          updated_at: string | null
          visa_type: string | null
        }
        Insert: {
          applicant_email?: string | null
          applicant_name: string
          created_at?: string | null
          embassy_country?: string | null
          event_id: string
          id?: string
          letter_generated_at?: string | null
          letter_sent_at?: string | null
          letter_status?: string | null
          letter_type?: string | null
          letter_url?: string | null
          nationality?: string | null
          notes?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          processed_by?: string | null
          registration_id?: string | null
          travel_dates_from?: string | null
          travel_dates_to?: string | null
          updated_at?: string | null
          visa_type?: string | null
        }
        Update: {
          applicant_email?: string | null
          applicant_name?: string
          created_at?: string | null
          embassy_country?: string | null
          event_id?: string
          id?: string
          letter_generated_at?: string | null
          letter_sent_at?: string | null
          letter_status?: string | null
          letter_type?: string | null
          letter_url?: string | null
          nationality?: string | null
          notes?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          processed_by?: string | null
          registration_id?: string | null
          travel_dates_from?: string | null
          travel_dates_to?: string | null
          updated_at?: string | null
          visa_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visa_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_requests_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          converted_at: string | null
          created_at: string | null
          email: string
          event_id: string
          id: string
          name: string
          notes: string | null
          notified_at: string | null
          phone: string | null
          position: number
          registration_id: string | null
          status: string | null
          ticket_type_id: string | null
          updated_at: string | null
        }
        Insert: {
          converted_at?: string | null
          created_at?: string | null
          email: string
          event_id: string
          id?: string
          name: string
          notes?: string | null
          notified_at?: string | null
          phone?: string | null
          position: number
          registration_id?: string | null
          status?: string | null
          ticket_type_id?: string | null
          updated_at?: string | null
        }
        Update: {
          converted_at?: string | null
          created_at?: string | null
          email?: string
          event_id?: string
          id?: string
          name?: string
          notes?: string | null
          notified_at?: string | null
          phone?: string | null
          position?: number
          registration_id?: string | null
          status?: string | null
          ticket_type_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          approval_status: string | null
          body_text: string
          buttons: Json | null
          category: string
          created_at: string | null
          created_by: string | null
          description: string | null
          event_id: string | null
          footer_text: string | null
          gallabox_template_id: string | null
          gallabox_template_name: string | null
          has_buttons: boolean | null
          header_content: string | null
          header_type: string | null
          id: string
          is_active: boolean | null
          name: string
          rejection_reason: string | null
          slug: string
          updated_at: string | null
          variables: string[] | null
        }
        Insert: {
          approval_status?: string | null
          body_text: string
          buttons?: Json | null
          category: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_id?: string | null
          footer_text?: string | null
          gallabox_template_id?: string | null
          gallabox_template_name?: string | null
          has_buttons?: boolean | null
          header_content?: string | null
          header_type?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          rejection_reason?: string | null
          slug: string
          updated_at?: string | null
          variables?: string[] | null
        }
        Update: {
          approval_status?: string | null
          body_text?: string
          buttons?: Json | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_id?: string | null
          footer_text?: string | null
          gallabox_template_id?: string | null
          gallabox_template_name?: string | null
          has_buttons?: boolean | null
          header_content?: string | null
          header_type?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          rejection_reason?: string | null
          slug?: string
          updated_at?: string | null
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_templates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      zoho_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string
          id: string
          refresh_token: string
          updated_at: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at: string
          id?: string
          refresh_token: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          refresh_token?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      zonal_activities: {
        Row: {
          body: string
          created_at: string
          id: string
          posted_by: string
          title: string
          updated_at: string
          zone: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          posted_by: string
          title: string
          updated_at?: string
          zone: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          posted_by?: string
          title?: string
          updated_at?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "zonal_activities_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zonal_activities_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      zonal_activity_comments: {
        Row: {
          activity_id: string
          comment: string
          created_at: string
          id: string
          posted_by: string
        }
        Insert: {
          activity_id: string
          comment: string
          created_at?: string
          id?: string
          posted_by: string
        }
        Update: {
          activity_id?: string
          comment?: string
          created_at?: string
          id?: string
          posted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "zonal_activity_comments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "zonal_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zonal_activity_comments_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zonal_activity_comments_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_amasi_members: {
        Row: {
          amasi_number: number | null
          email: string | null
          id: string | null
          joining_date: string | null
          membership_type: string | null
          name: string | null
          phone: number | null
          voting_eligible: boolean | null
        }
        Insert: {
          amasi_number?: number | null
          email?: string | null
          id?: string | null
          joining_date?: string | null
          membership_type?: string | null
          name?: string | null
          phone?: number | null
          voting_eligible?: boolean | null
        }
        Update: {
          amasi_number?: number | null
          email?: string | null
          id?: string | null
          joining_date?: string | null
          membership_type?: string | null
          name?: string | null
          phone?: number | null
          voting_eligible?: boolean | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          id: string | null
          member_id: string | null
          name: string | null
        }
        Insert: {
          avatar_url?: string | null
          id?: string | null
          member_id?: string | null
          name?: string | null
        }
        Update: {
          avatar_url?: string | null
          id?: string | null
          member_id?: string | null
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "active_amasi_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      tbl_member: {
        Row: {
          active_license: string | null
          address1: string | null
          address2: string | null
          amasi_number: number | null
          application_date: string | null
          application_no: string | null
          application_status: number | null
          asi_certificate: string | null
          asi_membership_no: string | null
          asi_state: string | null
          city: string | null
          country: string | null
          created_at: string | null
          dob: string | null
          email: string | null
          father_name: string | null
          first_name: string | null
          full_name: string | null
          gender: string | null
          id: number | null
          imr_no: string | null
          joining_date: string | null
          landline: string | null
          last_name: string | null
          letter_hod: string | null
          mbbs_certificate: string | null
          mci_certificate: string | null
          mci_number: string | null
          mci_state: string | null
          membership_type: string | null
          middle_name: string | null
          mobile: number | null
          mobile_code: string | null
          nationality: string | null
          pg_certificate: string | null
          pg_college: string | null
          pg_degree: string | null
          pg_university: string | null
          pg_year: string | null
          pincode: string | null
          profile_photo: string | null
          salutation: string | null
          ss_college: string | null
          ss_degree: string | null
          ss_university: string | null
          ss_year: string | null
          state: string | null
          status: string | null
          std_code: string | null
          ug_college: string | null
          ug_university: string | null
          ug_year: string | null
          updated_at: string | null
          voting_eligible: boolean | null
          zone: string | null
        }
        Insert: {
          active_license?: string | null
          address1?: string | null
          address2?: string | null
          amasi_number?: number | null
          application_date?: string | null
          application_no?: string | null
          application_status?: number | null
          asi_certificate?: string | null
          asi_membership_no?: string | null
          asi_state?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          dob?: string | null
          email?: string | null
          father_name?: string | null
          first_name?: string | null
          full_name?: string | null
          gender?: string | null
          id?: number | null
          imr_no?: string | null
          joining_date?: string | null
          landline?: string | null
          last_name?: string | null
          letter_hod?: string | null
          mbbs_certificate?: string | null
          mci_certificate?: string | null
          mci_number?: string | null
          mci_state?: string | null
          membership_type?: string | null
          middle_name?: string | null
          mobile?: number | null
          mobile_code?: string | null
          nationality?: string | null
          pg_certificate?: string | null
          pg_college?: string | null
          pg_degree?: string | null
          pg_university?: string | null
          pg_year?: string | null
          pincode?: string | null
          profile_photo?: string | null
          salutation?: string | null
          ss_college?: string | null
          ss_degree?: string | null
          ss_university?: string | null
          ss_year?: string | null
          state?: string | null
          status?: string | null
          std_code?: string | null
          ug_college?: string | null
          ug_university?: string | null
          ug_year?: string | null
          updated_at?: string | null
          voting_eligible?: boolean | null
          zone?: string | null
        }
        Update: {
          active_license?: string | null
          address1?: string | null
          address2?: string | null
          amasi_number?: number | null
          application_date?: string | null
          application_no?: string | null
          application_status?: number | null
          asi_certificate?: string | null
          asi_membership_no?: string | null
          asi_state?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          dob?: string | null
          email?: string | null
          father_name?: string | null
          first_name?: string | null
          full_name?: string | null
          gender?: string | null
          id?: number | null
          imr_no?: string | null
          joining_date?: string | null
          landline?: string | null
          last_name?: string | null
          letter_hod?: string | null
          mbbs_certificate?: string | null
          mci_certificate?: string | null
          mci_number?: string | null
          mci_state?: string | null
          membership_type?: string | null
          middle_name?: string | null
          mobile?: number | null
          mobile_code?: string | null
          nationality?: string | null
          pg_certificate?: string | null
          pg_college?: string | null
          pg_degree?: string | null
          pg_university?: string | null
          pg_year?: string | null
          pincode?: string | null
          profile_photo?: string | null
          salutation?: string | null
          ss_college?: string | null
          ss_degree?: string | null
          ss_university?: string | null
          ss_year?: string | null
          state?: string | null
          status?: string | null
          std_code?: string | null
          ug_college?: string | null
          ug_university?: string | null
          ug_year?: string | null
          updated_at?: string | null
          voting_eligible?: boolean | null
          zone?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      aggregate_event_analytics: {
        Args: { p_date: string; p_event_id: string }
        Returns: undefined
      }
      cleanup_expired_drafts: { Args: never; Returns: undefined }
      create_admin_user: {
        Args: {
          p_email: string
          p_name: string
          p_password: string
          p_role?: string
        }
        Returns: string
      }
      create_faculty_from_member: {
        Args: { p_created_by?: string; p_member_id: string }
        Returns: string
      }
      current_user_is_admin: { Args: never; Returns: boolean }
      current_user_zone: { Args: never; Returns: string }
      daitch_mokotoff: { Args: { "": string }; Returns: string[] }
      device_tokens_by_zone: {
        Args: { target_zone: string }
        Returns: {
          expo_push_token: string
        }[]
      }
      dmetaphone: { Args: { "": string }; Returns: string }
      dmetaphone_alt: { Args: { "": string }; Returns: string }
      generate_abstract_number: {
        Args: { p_event_id: string }
        Returns: string
      }
      generate_certificate_number: {
        Args: { p_event_slug: string; p_type: string }
        Returns: string
      }
      generate_custom_registration_id: {
        Args: { p_event_id: string }
        Returns: string
      }
      generate_print_station_token: { Args: never; Returns: string }
      generate_secure_token: { Args: { length?: number }; Returns: string }
      grant_position_atomic: {
        Args: {
          p_caller_position_holder_id: string
          p_notes?: string
          p_position_id: string
          p_target_member_id: string
        }
        Returns: {
          granted_at: string
          granted_by: string
          member_id: string
          position_holder_id: string
          position_id: string
        }[]
      }
      increment_ticket_sold_atomic: {
        Args: {
          p_payment_id: string
          p_quantity?: number
          p_ticket_type_id: string
        }
        Returns: Json
      }
      is_super_admin: { Args: never; Returns: boolean }
      is_valid_committee_decision: { Args: { d: string }; Returns: boolean }
      log_position_audit: {
        Args: {
          p_action: string
          p_event_type: string
          p_member_id: string
          p_metadata: Json
          p_notes: string
          p_position_holder_id: string
          p_position_id: string
          p_target_id: string
          p_target_type: string
        }
        Returns: string
      }
      merge_exam_marks: {
        Args: { new_marks: Json; reg_id: string }
        Returns: undefined
      }
      next_amasi_number: { Args: never; Returns: number }
      revoke_position_atomic: {
        Args: {
          p_caller_position_holder_id: string
          p_position_holder_id: string
          p_reason?: string
        }
        Returns: {
          granted_at: string
          granted_by: string
          member_id: string
          position_holder_id: string
          position_id: string
          revoke_reason: string
          revoked_at: string
          revoked_by: string
        }[]
      }
      search_people: {
        Args: {
          p_include_members?: boolean
          p_limit?: number
          p_search: string
        }
        Returns: {
          amasi_number: number
          city: string
          email: string
          id: string
          institution: string
          is_faculty: boolean
          is_member: boolean
          name: string
          phone: string
          source_type: string
          specialty: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      soundex: { Args: { "": string }; Returns: string }
      text_soundex: { Args: { "": string }; Returns: string }
      verify_admin_password: {
        Args: { p_email: string; p_password: string }
        Returns: {
          email: string
          id: string
          is_active: boolean
          name: string
          role: string
          totp_secret: string
        }[]
      }
    }
    Enums: {
      comm_channel: "email" | "whatsapp" | "sms" | "both"
      commitment_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "modified"
        | "cancelled"
        | "completed"
      email_delivery_status:
        | "queued"
        | "sent"
        | "delivered"
        | "opened"
        | "clicked"
        | "bounced"
        | "spam"
        | "failed"
      event_status:
        | "draft"
        | "setup"
        | "registration_open"
        | "active"
        | "ongoing"
        | "completed"
        | "archived"
        | "cancelled"
      event_type: "conference" | "course" | "workshop" | "webinar" | "symposium"
      faculty_session_role:
        | "speaker"
        | "chairperson"
        | "co_chairperson"
        | "moderator"
        | "panelist"
        | "coordinator"
        | "discussant"
        | "judge"
        | "guest"
      invitation_status:
        | "not_invited"
        | "invited"
        | "reminded"
        | "confirmed"
        | "declined"
        | "tentative"
      response_status:
        | "pending"
        | "accepted_all"
        | "accepted_partial"
        | "rejected"
        | "no_response"
      user_platform_role:
        | "super_admin"
        | "event_admin"
        | "committee"
        | "faculty"
        | "delegate"
      whatsapp_delivery_status:
        | "queued"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
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
      comm_channel: ["email", "whatsapp", "sms", "both"],
      commitment_status: [
        "pending",
        "accepted",
        "rejected",
        "modified",
        "cancelled",
        "completed",
      ],
      email_delivery_status: [
        "queued",
        "sent",
        "delivered",
        "opened",
        "clicked",
        "bounced",
        "spam",
        "failed",
      ],
      event_status: [
        "draft",
        "setup",
        "registration_open",
        "active",
        "ongoing",
        "completed",
        "archived",
        "cancelled",
      ],
      event_type: ["conference", "course", "workshop", "webinar", "symposium"],
      faculty_session_role: [
        "speaker",
        "chairperson",
        "co_chairperson",
        "moderator",
        "panelist",
        "coordinator",
        "discussant",
        "judge",
        "guest",
      ],
      invitation_status: [
        "not_invited",
        "invited",
        "reminded",
        "confirmed",
        "declined",
        "tentative",
      ],
      response_status: [
        "pending",
        "accepted_all",
        "accepted_partial",
        "rejected",
        "no_response",
      ],
      user_platform_role: [
        "super_admin",
        "event_admin",
        "committee",
        "faculty",
        "delegate",
      ],
      whatsapp_delivery_status: [
        "queued",
        "sent",
        "delivered",
        "read",
        "failed",
      ],
    },
  },
} as const
