-- =====================================================
-- FORM MANAGEMENT SCHEMA (Fillout-style)
-- =====================================================
-- Run this SQL in Supabase SQL Editor

-- 1. FORMS - Master form definitions
CREATE TABLE IF NOT EXISTS forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  slug text UNIQUE,
  form_type text NOT NULL DEFAULT 'standalone', -- standalone | event_registration | feedback | survey | application | contact
  event_id uuid REFERENCES events(id) ON DELETE SET NULL, -- NULL for global forms
  status text NOT NULL DEFAULT 'draft', -- draft | published | archived

  -- Settings
  is_public boolean DEFAULT true,
  requires_auth boolean DEFAULT false,
  allow_multiple_submissions boolean DEFAULT false,
  submit_button_text text DEFAULT 'Submit',
  success_message text DEFAULT 'Thank you for your submission!',
  redirect_url text,

  -- Branding
  logo_url text,
  header_image_url text,
  primary_color text DEFAULT '#8B5CF6',
  background_color text,

  -- Notifications
  notify_on_submission boolean DEFAULT true,
  notification_emails text[], -- Array of email addresses

  -- Limits
  max_submissions integer,
  submission_deadline timestamptz,

  -- Metadata
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. FORM_SECTIONS - For multi-step forms (create before fields due to FK)
CREATE TABLE IF NOT EXISTS form_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 3. FORM_FIELDS - Field definitions for each form
CREATE TABLE IF NOT EXISTS form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,

  -- Field config
  field_type text NOT NULL, -- text | email | phone | number | select | multiselect | checkbox | checkboxes | radio | textarea | date | time | datetime | file | signature | rating | scale | heading | paragraph | divider | payment
  label text NOT NULL,
  placeholder text,
  help_text text,

  -- Validation
  is_required boolean DEFAULT false,
  min_length integer,
  max_length integer,
  min_value numeric,
  max_value numeric,
  pattern text, -- Regex pattern

  -- Options (for select, radio, checkbox)
  options jsonb, -- [{value: 'opt1', label: 'Option 1'}, ...]

  -- Conditional logic
  conditional_logic jsonb, -- {action: 'show', logic: 'all', rules: [{field_id: 'xxx', operator: 'equals', value: 'yes'}]}

  -- Layout
  sort_order integer NOT NULL DEFAULT 0,
  width text DEFAULT 'full', -- full | half | third
  section_id uuid REFERENCES form_sections(id) ON DELETE SET NULL, -- For multi-step/grouped forms

  -- Field-specific settings
  settings jsonb, -- Type-specific settings (e.g., file types, max file size, rating max)

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. FORM_SUBMISSIONS - Submitted form data
CREATE TABLE IF NOT EXISTS form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,

  -- Submitter info
  submitter_email text,
  submitter_name text,
  submitter_ip text,
  user_agent text,

  -- Response data
  responses jsonb NOT NULL, -- {field_id: value, ...}

  -- Status
  status text NOT NULL DEFAULT 'pending', -- pending | reviewed | approved | rejected

  -- Metadata
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id)
);

-- 5. FORM_TEMPLATES - Pre-built templates
CREATE TABLE IF NOT EXISTS form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL, -- registration | feedback | survey | application | contact | other
  thumbnail_url text,
  form_config jsonb NOT NULL, -- Complete form definition
  is_system boolean DEFAULT false, -- System templates vs user-created
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- INDEXES for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_forms_event_id ON forms(event_id);
CREATE INDEX IF NOT EXISTS idx_forms_status ON forms(status);
CREATE INDEX IF NOT EXISTS idx_forms_slug ON forms(slug);
CREATE INDEX IF NOT EXISTS idx_forms_form_type ON forms(form_type);
CREATE INDEX IF NOT EXISTS idx_forms_created_by ON forms(created_by);

CREATE INDEX IF NOT EXISTS idx_form_fields_form_id ON form_fields(form_id);
CREATE INDEX IF NOT EXISTS idx_form_fields_section_id ON form_fields(section_id);
CREATE INDEX IF NOT EXISTS idx_form_fields_sort_order ON form_fields(form_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_form_sections_form_id ON form_sections(form_id);
CREATE INDEX IF NOT EXISTS idx_form_sections_sort_order ON form_sections(form_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_form_submissions_form_id ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON form_submissions(status);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at ON form_submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_form_submissions_email ON form_submissions(submitter_email);

CREATE INDEX IF NOT EXISTS idx_form_templates_category ON form_templates(category);
CREATE INDEX IF NOT EXISTS idx_form_templates_is_system ON form_templates(is_system);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;

-- Forms policies
CREATE POLICY "Public can view published forms" ON forms
  FOR SELECT USING (status = 'published' AND is_public = true);

CREATE POLICY "Authenticated users can view all forms" ON forms
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create forms" ON forms
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update their own forms" ON forms
  FOR UPDATE TO authenticated USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own forms" ON forms
  FOR DELETE TO authenticated USING (created_by = auth.uid());

-- Form fields policies
CREATE POLICY "Anyone can view fields of published forms" ON form_fields
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM forms
      WHERE forms.id = form_fields.form_id
      AND (forms.status = 'published' OR forms.created_by = auth.uid())
    )
  );

CREATE POLICY "Form owners can manage fields" ON form_fields
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM forms
      WHERE forms.id = form_fields.form_id
      AND forms.created_by = auth.uid()
    )
  );

-- Form sections policies
CREATE POLICY "Anyone can view sections of published forms" ON form_sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM forms
      WHERE forms.id = form_sections.form_id
      AND (forms.status = 'published' OR forms.created_by = auth.uid())
    )
  );

CREATE POLICY "Form owners can manage sections" ON form_sections
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM forms
      WHERE forms.id = form_sections.form_id
      AND forms.created_by = auth.uid()
    )
  );

-- Form submissions policies
CREATE POLICY "Anyone can submit to published forms" ON form_submissions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM forms
      WHERE forms.id = form_submissions.form_id
      AND forms.status = 'published'
    )
  );

CREATE POLICY "Form owners can view submissions" ON form_submissions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM forms
      WHERE forms.id = form_submissions.form_id
      AND forms.created_by = auth.uid()
    )
  );

CREATE POLICY "Form owners can update submissions" ON form_submissions
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM forms
      WHERE forms.id = form_submissions.form_id
      AND forms.created_by = auth.uid()
    )
  );

-- Form templates policies
CREATE POLICY "Anyone can view templates" ON form_templates
  FOR SELECT USING (true);

CREATE POLICY "Only authenticated can create templates" ON form_templates
  FOR INSERT TO authenticated WITH CHECK (is_system = false);

-- =====================================================
-- TRIGGERS for updated_at
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
DROP TRIGGER IF EXISTS update_forms_updated_at ON forms;
CREATE TRIGGER update_forms_updated_at
    BEFORE UPDATE ON forms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_form_fields_updated_at ON form_fields;
CREATE TRIGGER update_form_fields_updated_at
    BEFORE UPDATE ON form_fields
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED DATA: Default Form Templates
-- =====================================================

INSERT INTO form_templates (name, description, category, is_system, form_config) VALUES
(
  'Event Registration',
  'Standard event registration form with attendee details',
  'registration',
  true,
  '{
    "name": "Event Registration",
    "description": "Register for the event",
    "form_type": "event_registration",
    "settings": {
      "submit_button_text": "Register Now",
      "success_message": "Thank you for registering! You will receive a confirmation email shortly."
    },
    "fields": [
      {"field_type": "heading", "label": "Personal Information", "settings": {"heading_size": "h2"}},
      {"field_type": "text", "label": "Full Name", "is_required": true, "placeholder": "Enter your full name"},
      {"field_type": "email", "label": "Email Address", "is_required": true, "placeholder": "your@email.com"},
      {"field_type": "phone", "label": "Phone Number", "is_required": true, "placeholder": "+91 98765 43210"},
      {"field_type": "text", "label": "Institution/Organization", "placeholder": "Your institution or company"},
      {"field_type": "text", "label": "Designation", "placeholder": "Your role or title"},
      {"field_type": "divider", "label": ""},
      {"field_type": "heading", "label": "Additional Information", "settings": {"heading_size": "h2"}},
      {"field_type": "select", "label": "How did you hear about us?", "options": [{"value": "social", "label": "Social Media"}, {"value": "email", "label": "Email"}, {"value": "colleague", "label": "Colleague"}, {"value": "website", "label": "Website"}, {"value": "other", "label": "Other"}]},
      {"field_type": "textarea", "label": "Special Requirements", "placeholder": "Any dietary restrictions or accessibility needs?"}
    ]
  }'::jsonb
),
(
  'Contact Form',
  'Simple contact form for inquiries',
  'contact',
  true,
  '{
    "name": "Contact Us",
    "description": "Get in touch with us",
    "form_type": "contact",
    "settings": {
      "submit_button_text": "Send Message",
      "success_message": "Thank you for your message! We will get back to you soon."
    },
    "fields": [
      {"field_type": "text", "label": "Name", "is_required": true, "placeholder": "Your name"},
      {"field_type": "email", "label": "Email", "is_required": true, "placeholder": "your@email.com"},
      {"field_type": "phone", "label": "Phone", "placeholder": "Optional phone number"},
      {"field_type": "select", "label": "Subject", "is_required": true, "options": [{"value": "general", "label": "General Inquiry"}, {"value": "support", "label": "Support"}, {"value": "feedback", "label": "Feedback"}, {"value": "partnership", "label": "Partnership"}]},
      {"field_type": "textarea", "label": "Message", "is_required": true, "placeholder": "How can we help you?", "min_length": 10}
    ]
  }'::jsonb
),
(
  'Event Feedback',
  'Collect feedback after an event',
  'feedback',
  true,
  '{
    "name": "Event Feedback",
    "description": "Share your experience with us",
    "form_type": "feedback",
    "settings": {
      "submit_button_text": "Submit Feedback",
      "success_message": "Thank you for your valuable feedback!"
    },
    "fields": [
      {"field_type": "heading", "label": "Rate Your Experience", "settings": {"heading_size": "h2"}},
      {"field_type": "rating", "label": "Overall Event Rating", "is_required": true, "settings": {"max_rating": 5}},
      {"field_type": "rating", "label": "Content Quality", "is_required": true, "settings": {"max_rating": 5}},
      {"field_type": "rating", "label": "Speaker Quality", "is_required": true, "settings": {"max_rating": 5}},
      {"field_type": "rating", "label": "Venue & Facilities", "settings": {"max_rating": 5}},
      {"field_type": "divider", "label": ""},
      {"field_type": "heading", "label": "Your Thoughts", "settings": {"heading_size": "h2"}},
      {"field_type": "textarea", "label": "What did you like most?", "placeholder": "Share what you enjoyed..."},
      {"field_type": "textarea", "label": "What could be improved?", "placeholder": "Help us improve..."},
      {"field_type": "radio", "label": "Would you recommend this event?", "is_required": true, "options": [{"value": "yes", "label": "Yes, definitely!"}, {"value": "maybe", "label": "Maybe"}, {"value": "no", "label": "No"}]},
      {"field_type": "checkbox", "label": "I would like to be notified about future events"}
    ]
  }'::jsonb
),
(
  'Survey Form',
  'General purpose survey template',
  'survey',
  true,
  '{
    "name": "General Survey",
    "description": "Help us understand you better",
    "form_type": "survey",
    "settings": {
      "submit_button_text": "Submit Survey",
      "success_message": "Thank you for completing the survey!"
    },
    "fields": [
      {"field_type": "heading", "label": "About You", "settings": {"heading_size": "h2"}},
      {"field_type": "text", "label": "Name", "placeholder": "Optional"},
      {"field_type": "email", "label": "Email", "placeholder": "Optional - for follow-up"},
      {"field_type": "select", "label": "Age Group", "options": [{"value": "18-24", "label": "18-24"}, {"value": "25-34", "label": "25-34"}, {"value": "35-44", "label": "35-44"}, {"value": "45-54", "label": "45-54"}, {"value": "55+", "label": "55+"}]},
      {"field_type": "divider", "label": ""},
      {"field_type": "heading", "label": "Your Feedback", "settings": {"heading_size": "h2"}},
      {"field_type": "scale", "label": "How satisfied are you with our services?", "is_required": true, "settings": {"scale_min": 1, "scale_max": 10, "scale_min_label": "Not satisfied", "scale_max_label": "Very satisfied"}},
      {"field_type": "checkboxes", "label": "Which services have you used?", "options": [{"value": "courses", "label": "Courses"}, {"value": "conferences", "label": "Conferences"}, {"value": "workshops", "label": "Workshops"}, {"value": "webinars", "label": "Webinars"}]},
      {"field_type": "textarea", "label": "Additional Comments", "placeholder": "Any other feedback?"}
    ]
  }'::jsonb
),
(
  'Application Form',
  'Application form with document upload',
  'application',
  true,
  '{
    "name": "Application Form",
    "description": "Submit your application",
    "form_type": "application",
    "settings": {
      "submit_button_text": "Submit Application",
      "success_message": "Your application has been submitted successfully. We will review it and get back to you."
    },
    "fields": [
      {"field_type": "heading", "label": "Personal Details", "settings": {"heading_size": "h2"}},
      {"field_type": "text", "label": "Full Name", "is_required": true, "placeholder": "As per official documents"},
      {"field_type": "email", "label": "Email Address", "is_required": true},
      {"field_type": "phone", "label": "Mobile Number", "is_required": true},
      {"field_type": "date", "label": "Date of Birth", "is_required": true},
      {"field_type": "divider", "label": ""},
      {"field_type": "heading", "label": "Professional Information", "settings": {"heading_size": "h2"}},
      {"field_type": "text", "label": "Current Institution", "is_required": true},
      {"field_type": "text", "label": "Designation", "is_required": true},
      {"field_type": "number", "label": "Years of Experience", "min_value": 0},
      {"field_type": "textarea", "label": "Brief Bio", "is_required": true, "placeholder": "Tell us about yourself...", "min_length": 50},
      {"field_type": "divider", "label": ""},
      {"field_type": "heading", "label": "Documents", "settings": {"heading_size": "h2"}},
      {"field_type": "file", "label": "Resume/CV", "is_required": true, "settings": {"allowed_file_types": ["pdf", "doc", "docx"], "max_file_size": 5}},
      {"field_type": "file", "label": "Photo", "settings": {"allowed_file_types": ["jpg", "jpeg", "png"], "max_file_size": 2}}
    ]
  }'::jsonb
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check if tables were created successfully
DO $$
BEGIN
  RAISE NOTICE 'Form Management tables created successfully!';
  RAISE NOTICE 'Tables: forms, form_fields, form_sections, form_submissions, form_templates';
END $$;
