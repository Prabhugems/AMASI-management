export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          phone: string | null
          avatar_url: string | null
          platform_role: 'super_admin' | 'admin' | 'event_admin' | 'staff' | 'faculty' | 'member'
          is_super_admin: boolean
          is_active: boolean
          is_verified: boolean
          faculty_id: string | null
          member_id: string | null
          last_login_at: string | null
          last_active_at: string | null
          login_count: number
          timezone: string | null
          preferences: Json | null
          notification_settings: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          phone?: string | null
          avatar_url?: string | null
          platform_role?: 'super_admin' | 'admin' | 'event_admin' | 'staff' | 'faculty' | 'member'
          is_super_admin?: boolean
          is_active?: boolean
          is_verified?: boolean
          faculty_id?: string | null
          member_id?: string | null
          last_login_at?: string | null
          last_active_at?: string | null
          login_count?: number
          timezone?: string | null
          preferences?: Json | null
          notification_settings?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          phone?: string | null
          avatar_url?: string | null
          platform_role?: 'super_admin' | 'admin' | 'event_admin' | 'staff' | 'faculty' | 'member'
          is_super_admin?: boolean
          is_active?: boolean
          is_verified?: boolean
          faculty_id?: string | null
          member_id?: string | null
          last_login_at?: string | null
          last_active_at?: string | null
          login_count?: number
          timezone?: string | null
          preferences?: Json | null
          notification_settings?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      events: {
        Row: {
          id: string
          name: string
          short_name: string | null
          slug: string | null
          tagline: string | null
          description: string | null
          event_type: 'conference' | 'workshop' | 'course' | 'webinar' | 'symposium'
          status: 'draft' | 'planning' | 'registration_open' | 'ongoing' | 'completed' | 'cancelled'
          start_date: string
          end_date: string
          venue_name: string | null
          venue_address: string | null
          city: string | null
          state: string | null
          country: string | null
          is_virtual: boolean
          is_hybrid: boolean
          virtual_platform: string | null
          virtual_link: string | null
          edition: number | null
          year: string | null
          logo_url: string | null
          banner_url: string | null
          brochure_url: string | null
          website_url: string | null
          welcome_message: string | null
          scientific_chairman: string | null
          organizing_chairman: string | null
          organizing_secretary: string | null
          treasurer: string | null
          contact_email: string | null
          contact_phone: string | null
          registration_start: string | null
          registration_end: string | null
          early_bird_end: string | null
          abstract_deadline: string | null
          total_faculty: number
          confirmed_faculty: number
          pending_faculty: number
          total_sessions: number
          total_delegates: number
          visibility: string | null
          settings: Json | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          short_name?: string | null
          slug?: string | null
          tagline?: string | null
          description?: string | null
          event_type: 'conference' | 'workshop' | 'course' | 'webinar' | 'symposium'
          status?: 'draft' | 'planning' | 'registration_open' | 'ongoing' | 'completed' | 'cancelled'
          start_date: string
          end_date: string
          venue_name?: string | null
          venue_address?: string | null
          city?: string | null
          state?: string | null
          country?: string | null
          is_virtual?: boolean
          is_hybrid?: boolean
          virtual_platform?: string | null
          virtual_link?: string | null
          edition?: number | null
          year?: string | null
          logo_url?: string | null
          banner_url?: string | null
          brochure_url?: string | null
          website_url?: string | null
          welcome_message?: string | null
          scientific_chairman?: string | null
          organizing_chairman?: string | null
          organizing_secretary?: string | null
          treasurer?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          registration_start?: string | null
          registration_end?: string | null
          early_bird_end?: string | null
          abstract_deadline?: string | null
          total_faculty?: number
          confirmed_faculty?: number
          pending_faculty?: number
          total_sessions?: number
          total_delegates?: number
          visibility?: string | null
          settings?: Json | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          short_name?: string | null
          slug?: string | null
          tagline?: string | null
          description?: string | null
          event_type?: 'conference' | 'workshop' | 'course' | 'webinar' | 'symposium'
          status?: 'draft' | 'planning' | 'registration_open' | 'ongoing' | 'completed' | 'cancelled'
          start_date?: string
          end_date?: string
          venue_name?: string | null
          venue_address?: string | null
          city?: string | null
          state?: string | null
          country?: string | null
          is_virtual?: boolean
          is_hybrid?: boolean
          virtual_platform?: string | null
          virtual_link?: string | null
          edition?: number | null
          year?: string | null
          logo_url?: string | null
          banner_url?: string | null
          brochure_url?: string | null
          website_url?: string | null
          welcome_message?: string | null
          scientific_chairman?: string | null
          organizing_chairman?: string | null
          organizing_secretary?: string | null
          treasurer?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          registration_start?: string | null
          registration_end?: string | null
          early_bird_end?: string | null
          abstract_deadline?: string | null
          total_faculty?: number
          confirmed_faculty?: number
          pending_faculty?: number
          total_sessions?: number
          total_delegates?: number
          visibility?: string | null
          settings?: Json | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      faculty: {
        Row: {
          id: string
          title: string | null
          name: string
          email: string
          email_secondary: string | null
          phone: string | null
          phone_secondary: string | null
          whatsapp: string | null
          designation: string | null
          department: string | null
          institution: string | null
          institution_type: string | null
          institution_city: string | null
          qualification: string | null
          specialty: string | null
          sub_specialty: string | null
          experience_years: number | null
          bio: string | null
          photo_url: string | null
          address: string | null
          city: string | null
          state: string | null
          pincode: string | null
          country: string | null
          member_id: string | null
          user_id: string | null
          areas_of_interest: string[] | null
          linkedin: string | null
          twitter: string | null
          researchgate: string | null
          website: string | null
          orcid_id: string | null
          pubmed_id: string | null
          pan_number: string | null
          gst_number: string | null
          bank_name: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          dietary_preference: string | null
          tshirt_size: string | null
          preferred_contact: string | null
          is_reviewer: boolean
          reviewer_specialties: string | null
          status: string | null
          source: string | null
          internal_notes: string | null
          blacklist_reason: string | null
          total_events: number
          total_sessions: number
          acceptance_rate: number | null
          last_event_name: string | null
          last_event_date: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title?: string | null
          name: string
          email: string
          email_secondary?: string | null
          phone?: string | null
          phone_secondary?: string | null
          whatsapp?: string | null
          designation?: string | null
          department?: string | null
          institution?: string | null
          institution_type?: string | null
          institution_city?: string | null
          qualification?: string | null
          specialty?: string | null
          sub_specialty?: string | null
          experience_years?: number | null
          bio?: string | null
          photo_url?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          pincode?: string | null
          country?: string | null
          member_id?: string | null
          user_id?: string | null
          areas_of_interest?: string[] | null
          linkedin?: string | null
          twitter?: string | null
          researchgate?: string | null
          website?: string | null
          orcid_id?: string | null
          pubmed_id?: string | null
          pan_number?: string | null
          gst_number?: string | null
          bank_name?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          dietary_preference?: string | null
          tshirt_size?: string | null
          preferred_contact?: string | null
          is_reviewer?: boolean
          reviewer_specialties?: string | null
          status?: string | null
          source?: string | null
          internal_notes?: string | null
          blacklist_reason?: string | null
          total_events?: number
          total_sessions?: number
          acceptance_rate?: number | null
          last_event_name?: string | null
          last_event_date?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string | null
          name?: string
          email?: string
          email_secondary?: string | null
          phone?: string | null
          phone_secondary?: string | null
          whatsapp?: string | null
          designation?: string | null
          department?: string | null
          institution?: string | null
          institution_type?: string | null
          institution_city?: string | null
          qualification?: string | null
          specialty?: string | null
          sub_specialty?: string | null
          experience_years?: number | null
          bio?: string | null
          photo_url?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          pincode?: string | null
          country?: string | null
          member_id?: string | null
          user_id?: string | null
          areas_of_interest?: string[] | null
          linkedin?: string | null
          twitter?: string | null
          researchgate?: string | null
          website?: string | null
          orcid_id?: string | null
          pubmed_id?: string | null
          pan_number?: string | null
          gst_number?: string | null
          bank_name?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          dietary_preference?: string | null
          tshirt_size?: string | null
          preferred_contact?: string | null
          is_reviewer?: boolean
          reviewer_specialties?: string | null
          status?: string | null
          source?: string | null
          internal_notes?: string | null
          blacklist_reason?: string | null
          total_events?: number
          total_sessions?: number
          acceptance_rate?: number | null
          last_event_name?: string | null
          last_event_date?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      members: {
        Row: {
          id: string
          amasi_number: number | null
          name: string | null
          email: string | null
          phone: number | null
          membership_type: string | null
          status: string | null
          voting_eligible: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          amasi_number?: number | null
          name?: string | null
          email?: string | null
          phone?: number | null
          membership_type?: string | null
          status?: string | null
          voting_eligible?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          amasi_number?: number | null
          name?: string | null
          email?: string | null
          phone?: number | null
          membership_type?: string | null
          status?: string | null
          voting_eligible?: boolean | null
          created_at?: string
          updated_at?: string
        }
      }
      participants: {
        Row: {
          id: string
          event_id: string
          name: string
          email: string
          phone: string | null
          registration_id: string | null
          category: string | null
          status: string | null
          checked_in: boolean
          check_in_time: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          name: string
          email: string
          phone?: string | null
          registration_id?: string | null
          category?: string | null
          status?: string | null
          checked_in?: boolean
          check_in_time?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          name?: string
          email?: string
          phone?: string | null
          registration_id?: string | null
          category?: string | null
          status?: string | null
          checked_in?: boolean
          check_in_time?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sessions: {
        Row: {
          id: string
          event_id: string
          session_code: string | null
          session_name: string
          session_type: string
          day_number: number | null
          session_date: string
          start_time: string
          end_time: string
          duration_minutes: number | null
          hall: string | null
          floor: string | null
          description: string | null
          topics: string | null
          specialty_track: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          session_code?: string | null
          session_name: string
          session_type?: string
          day_number?: number | null
          session_date: string
          start_time: string
          end_time?: string
          duration_minutes?: number | null
          hall?: string | null
          floor?: string | null
          description?: string | null
          topics?: string | null
          specialty_track?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          session_code?: string | null
          session_name?: string
          session_type?: string
          day_number?: number | null
          session_date?: string
          start_time?: string
          end_time?: string
          duration_minutes?: number | null
          hall?: string | null
          floor?: string | null
          description?: string | null
          topics?: string | null
          specialty_track?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      event_faculty: {
        Row: {
          id: string
          event_id: string
          faculty_id: string
          invitation_status: string | null
          response_status: string | null
          invited_at: string | null
          responded_at: string | null
          total_sessions: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          faculty_id: string
          invitation_status?: string | null
          response_status?: string | null
          invited_at?: string | null
          responded_at?: string | null
          total_sessions?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          faculty_id?: string
          invitation_status?: string | null
          response_status?: string | null
          invited_at?: string | null
          responded_at?: string | null
          total_sessions?: number
          created_at?: string
          updated_at?: string
        }
      }
      forms: {
        Row: {
          id: string
          name: string
          description: string | null
          slug: string | null
          form_type: string
          event_id: string | null
          status: string
          is_public: boolean
          requires_auth: boolean
          allow_multiple_submissions: boolean
          submit_button_text: string
          success_message: string
          redirect_url: string | null
          logo_url: string | null
          header_image_url: string | null
          primary_color: string
          background_color: string | null
          notify_on_submission: boolean
          notification_emails: string[] | null
          max_submissions: number | null
          submission_deadline: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          slug?: string | null
          form_type?: string
          event_id?: string | null
          status?: string
          is_public?: boolean
          requires_auth?: boolean
          allow_multiple_submissions?: boolean
          submit_button_text?: string
          success_message?: string
          redirect_url?: string | null
          logo_url?: string | null
          header_image_url?: string | null
          primary_color?: string
          background_color?: string | null
          notify_on_submission?: boolean
          notification_emails?: string[] | null
          max_submissions?: number | null
          submission_deadline?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          slug?: string | null
          form_type?: string
          event_id?: string | null
          status?: string
          is_public?: boolean
          requires_auth?: boolean
          allow_multiple_submissions?: boolean
          submit_button_text?: string
          success_message?: string
          redirect_url?: string | null
          logo_url?: string | null
          header_image_url?: string | null
          primary_color?: string
          background_color?: string | null
          notify_on_submission?: boolean
          notification_emails?: string[] | null
          max_submissions?: number | null
          submission_deadline?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      form_fields: {
        Row: {
          id: string
          form_id: string
          field_type: string
          label: string
          placeholder: string | null
          help_text: string | null
          is_required: boolean
          min_length: number | null
          max_length: number | null
          min_value: number | null
          max_value: number | null
          pattern: string | null
          options: Json | null
          conditional_logic: Json | null
          sort_order: number
          width: string
          section_id: string | null
          settings: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          form_id: string
          field_type: string
          label: string
          placeholder?: string | null
          help_text?: string | null
          is_required?: boolean
          min_length?: number | null
          max_length?: number | null
          min_value?: number | null
          max_value?: number | null
          pattern?: string | null
          options?: Json | null
          conditional_logic?: Json | null
          sort_order?: number
          width?: string
          section_id?: string | null
          settings?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          form_id?: string
          field_type?: string
          label?: string
          placeholder?: string | null
          help_text?: string | null
          is_required?: boolean
          min_length?: number | null
          max_length?: number | null
          min_value?: number | null
          max_value?: number | null
          pattern?: string | null
          options?: Json | null
          conditional_logic?: Json | null
          sort_order?: number
          width?: string
          section_id?: string | null
          settings?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      form_submissions: {
        Row: {
          id: string
          form_id: string
          submitter_email: string | null
          submitter_name: string | null
          submitter_ip: string | null
          user_agent: string | null
          responses: Json
          status: string
          submitted_at: string
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          id?: string
          form_id: string
          submitter_email?: string | null
          submitter_name?: string | null
          submitter_ip?: string | null
          user_agent?: string | null
          responses: Json
          status?: string
          submitted_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          id?: string
          form_id?: string
          submitter_email?: string | null
          submitter_name?: string | null
          submitter_ip?: string | null
          user_agent?: string | null
          responses?: Json
          status?: string
          submitted_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
      }
      form_templates: {
        Row: {
          id: string
          name: string
          description: string | null
          category: string
          thumbnail_url: string | null
          form_config: Json
          is_system: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category: string
          thumbnail_url?: string | null
          form_config: Json
          is_system?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          category?: string
          thumbnail_url?: string | null
          form_config?: Json
          is_system?: boolean
          created_at?: string
        }
      }
    }
    abstract_categories: {
      Row: {
        id: string
        event_id: string
        name: string
        description: string | null
        max_submissions: number | null
        sort_order: number
        is_active: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        event_id: string
        name: string
        description?: string | null
        max_submissions?: number | null
        sort_order?: number
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        event_id?: string
        name?: string
        description?: string | null
        max_submissions?: number | null
        sort_order?: number
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
    }
    abstracts: {
      Row: {
        id: string
        event_id: string
        registration_id: string | null
        category_id: string | null
        abstract_number: string
        title: string
        abstract_text: string
        keywords: string[] | null
        presentation_type: string
        presenting_author_name: string
        presenting_author_email: string
        presenting_author_affiliation: string | null
        presenting_author_phone: string | null
        status: string
        decision_date: string | null
        decision_notes: string | null
        accepted_as: string | null
        session_id: string | null
        session_date: string | null
        session_time: string | null
        session_location: string | null
        file_url: string | null
        file_name: string | null
        file_size: number | null
        submitted_at: string
        updated_at: string
        created_at: string
      }
      Insert: {
        id?: string
        event_id: string
        registration_id?: string | null
        category_id?: string | null
        abstract_number?: string
        title: string
        abstract_text: string
        keywords?: string[] | null
        presentation_type?: string
        presenting_author_name: string
        presenting_author_email: string
        presenting_author_affiliation?: string | null
        presenting_author_phone?: string | null
        status?: string
        decision_date?: string | null
        decision_notes?: string | null
        accepted_as?: string | null
        session_id?: string | null
        session_date?: string | null
        session_time?: string | null
        session_location?: string | null
        file_url?: string | null
        file_name?: string | null
        file_size?: number | null
        submitted_at?: string
        updated_at?: string
        created_at?: string
      }
      Update: {
        id?: string
        event_id?: string
        registration_id?: string | null
        category_id?: string | null
        abstract_number?: string
        title?: string
        abstract_text?: string
        keywords?: string[] | null
        presentation_type?: string
        presenting_author_name?: string
        presenting_author_email?: string
        presenting_author_affiliation?: string | null
        presenting_author_phone?: string | null
        status?: string
        decision_date?: string | null
        decision_notes?: string | null
        accepted_as?: string | null
        session_id?: string | null
        session_date?: string | null
        session_time?: string | null
        session_location?: string | null
        file_url?: string | null
        file_name?: string | null
        file_size?: number | null
        submitted_at?: string
        updated_at?: string
        created_at?: string
      }
    }
    abstract_authors: {
      Row: {
        id: string
        abstract_id: string
        author_order: number
        name: string
        email: string | null
        affiliation: string | null
        is_presenting: boolean
        created_at: string
      }
      Insert: {
        id?: string
        abstract_id: string
        author_order?: number
        name: string
        email?: string | null
        affiliation?: string | null
        is_presenting?: boolean
        created_at?: string
      }
      Update: {
        id?: string
        abstract_id?: string
        author_order?: number
        name?: string
        email?: string | null
        affiliation?: string | null
        is_presenting?: boolean
        created_at?: string
      }
    }
    abstract_reviews: {
      Row: {
        id: string
        abstract_id: string
        reviewer_id: string | null
        reviewer_name: string | null
        reviewer_email: string | null
        score_originality: number | null
        score_methodology: number | null
        score_relevance: number | null
        score_clarity: number | null
        overall_score: number | null
        recommendation: string | null
        comments_to_author: string | null
        comments_private: string | null
        reviewed_at: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        abstract_id: string
        reviewer_id?: string | null
        reviewer_name?: string | null
        reviewer_email?: string | null
        score_originality?: number | null
        score_methodology?: number | null
        score_relevance?: number | null
        score_clarity?: number | null
        overall_score?: number | null
        recommendation?: string | null
        comments_to_author?: string | null
        comments_private?: string | null
        reviewed_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        abstract_id?: string
        reviewer_id?: string | null
        reviewer_name?: string | null
        reviewer_email?: string | null
        score_originality?: number | null
        score_methodology?: number | null
        score_relevance?: number | null
        score_clarity?: number | null
        overall_score?: number | null
        recommendation?: string | null
        comments_to_author?: string | null
        comments_private?: string | null
        reviewed_at?: string | null
        created_at?: string
        updated_at?: string
      }
    }
    abstract_settings: {
      Row: {
        event_id: string
        submission_opens_at: string | null
        submission_deadline: string | null
        revision_deadline: string | null
        notification_date: string | null
        max_submissions_per_person: number
        max_authors: number
        word_limit: number
        require_registration: boolean
        require_addon_id: string | null
        allowed_file_types: string[]
        max_file_size_mb: number
        presentation_types: string[]
        review_enabled: boolean
        reviewers_per_abstract: number
        blind_review: boolean
        submission_guidelines: string | null
        author_guidelines: string | null
        notify_on_submission: boolean
        notify_on_decision: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        event_id: string
        submission_opens_at?: string | null
        submission_deadline?: string | null
        revision_deadline?: string | null
        notification_date?: string | null
        max_submissions_per_person?: number
        max_authors?: number
        word_limit?: number
        require_registration?: boolean
        require_addon_id?: string | null
        allowed_file_types?: string[]
        max_file_size_mb?: number
        presentation_types?: string[]
        review_enabled?: boolean
        reviewers_per_abstract?: number
        blind_review?: boolean
        submission_guidelines?: string | null
        author_guidelines?: string | null
        notify_on_submission?: boolean
        notify_on_decision?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        event_id?: string
        submission_opens_at?: string | null
        submission_deadline?: string | null
        revision_deadline?: string | null
        notification_date?: string | null
        max_submissions_per_person?: number
        max_authors?: number
        word_limit?: number
        require_registration?: boolean
        require_addon_id?: string | null
        allowed_file_types?: string[]
        max_file_size_mb?: number
        presentation_types?: string[]
        review_enabled?: boolean
        reviewers_per_abstract?: number
        blind_review?: boolean
        submission_guidelines?: string | null
        author_guidelines?: string | null
        notify_on_submission?: boolean
        notify_on_decision?: boolean
        created_at?: string
        updated_at?: string
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      platform_role: 'super_admin' | 'admin' | 'event_admin' | 'staff' | 'faculty' | 'member'
      event_type: 'conference' | 'workshop' | 'course' | 'webinar' | 'symposium'
      event_status: 'draft' | 'planning' | 'registration_open' | 'ongoing' | 'completed' | 'cancelled'
    }
  }
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
