-- Abstract Management Module Migration
-- Date: 2026-02-05
-- Description: Adds module toggle system and abstract management tables

-- =====================================================
-- Phase 1: Module Toggle System
-- =====================================================

-- Add module toggle to event_settings
ALTER TABLE event_settings
ADD COLUMN IF NOT EXISTS enable_abstracts BOOLEAN DEFAULT false;

COMMENT ON COLUMN event_settings.enable_abstracts IS
  'Enable abstract submission module for this event';

-- =====================================================
-- Phase 2: Abstract Management Tables
-- =====================================================

-- Abstract categories/tracks
CREATE TABLE IF NOT EXISTS abstract_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  max_submissions INT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Main abstracts table
CREATE TABLE IF NOT EXISTS abstracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES registrations(id) ON DELETE SET NULL,
  category_id UUID REFERENCES abstract_categories(id) ON DELETE SET NULL,

  -- Auto-generated number
  abstract_number TEXT UNIQUE,  -- ABS-2026-001

  -- Content
  title TEXT NOT NULL,
  abstract_text TEXT NOT NULL,
  keywords TEXT[],
  presentation_type TEXT DEFAULT 'either',  -- oral, poster, video, either

  -- Authors (primary author is from registration)
  presenting_author_name TEXT NOT NULL,
  presenting_author_email TEXT NOT NULL,
  presenting_author_affiliation TEXT,
  presenting_author_phone TEXT,

  -- Status workflow
  -- submitted → under_review → revision_requested → accepted/rejected → withdrawn
  status TEXT DEFAULT 'submitted',

  decision_date TIMESTAMPTZ,
  decision_notes TEXT,
  accepted_as TEXT,  -- oral, poster, video (final decision)

  -- Presentation details (after acceptance)
  session_id UUID,  -- Link to program sessions
  session_date DATE,
  session_time TIME,
  session_location TEXT,

  -- File attachment
  file_url TEXT,
  file_name TEXT,
  file_size INT,

  -- Timestamps
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Co-authors
CREATE TABLE IF NOT EXISTS abstract_authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  abstract_id UUID NOT NULL REFERENCES abstracts(id) ON DELETE CASCADE,
  author_order INT DEFAULT 1,
  name TEXT NOT NULL,
  email TEXT,
  affiliation TEXT,
  is_presenting BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews (optional - for reviewed events)
CREATE TABLE IF NOT EXISTS abstract_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  abstract_id UUID NOT NULL REFERENCES abstracts(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  reviewer_name TEXT,
  reviewer_email TEXT,

  -- Scores (1-10)
  score_originality INT CHECK (score_originality >= 1 AND score_originality <= 10),
  score_methodology INT CHECK (score_methodology >= 1 AND score_methodology <= 10),
  score_relevance INT CHECK (score_relevance >= 1 AND score_relevance <= 10),
  score_clarity INT CHECK (score_clarity >= 1 AND score_clarity <= 10),
  overall_score DECIMAL(3,1),

  -- Decision
  recommendation TEXT,  -- accept, reject, revise, undecided
  comments_to_author TEXT,
  comments_private TEXT,

  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Abstract settings per event
CREATE TABLE IF NOT EXISTS abstract_settings (
  event_id UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,

  -- Deadlines
  submission_opens_at TIMESTAMPTZ,
  submission_deadline TIMESTAMPTZ,
  revision_deadline TIMESTAMPTZ,
  notification_date TIMESTAMPTZ,

  -- Limits
  max_submissions_per_person INT DEFAULT 3,
  max_authors INT DEFAULT 10,
  word_limit INT DEFAULT 300,

  -- Requirements
  require_registration BOOLEAN DEFAULT true,
  require_addon_id UUID REFERENCES addons(id) ON DELETE SET NULL,  -- paid submission
  allowed_file_types TEXT[] DEFAULT ARRAY['pdf'],
  max_file_size_mb INT DEFAULT 5,

  -- Presentation types allowed
  presentation_types TEXT[] DEFAULT ARRAY['oral', 'poster'],

  -- Review settings
  review_enabled BOOLEAN DEFAULT false,
  reviewers_per_abstract INT DEFAULT 2,
  blind_review BOOLEAN DEFAULT true,

  -- Guidelines
  submission_guidelines TEXT,
  author_guidelines TEXT,

  -- Email notifications
  notify_on_submission BOOLEAN DEFAULT true,
  notify_on_decision BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_abstracts_event ON abstracts(event_id);
CREATE INDEX IF NOT EXISTS idx_abstracts_registration ON abstracts(registration_id);
CREATE INDEX IF NOT EXISTS idx_abstracts_status ON abstracts(status);
CREATE INDEX IF NOT EXISTS idx_abstracts_category ON abstracts(category_id);
CREATE INDEX IF NOT EXISTS idx_abstracts_email ON abstracts(presenting_author_email);
CREATE INDEX IF NOT EXISTS idx_abstracts_number ON abstracts(abstract_number);
CREATE INDEX IF NOT EXISTS idx_abstract_authors_abstract ON abstract_authors(abstract_id);
CREATE INDEX IF NOT EXISTS idx_abstract_reviews_abstract ON abstract_reviews(abstract_id);
CREATE INDEX IF NOT EXISTS idx_abstract_categories_event ON abstract_categories(event_id);

-- =====================================================
-- Functions
-- =====================================================

-- Function to generate abstract number
CREATE OR REPLACE FUNCTION generate_abstract_number(p_event_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_count INT;
  v_number TEXT;
BEGIN
  -- Get current year
  v_year := EXTRACT(YEAR FROM NOW())::TEXT;

  -- Count existing abstracts for this event
  SELECT COUNT(*) + 1 INTO v_count
  FROM abstracts
  WHERE event_id = p_event_id;

  -- Generate number: ABS-YYYY-NNN
  v_number := 'ABS-' || v_year || '-' || LPAD(v_count::TEXT, 3, '0');

  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate overall score from individual scores
CREATE OR REPLACE FUNCTION calculate_review_overall_score()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.score_originality IS NOT NULL AND
     NEW.score_methodology IS NOT NULL AND
     NEW.score_relevance IS NOT NULL AND
     NEW.score_clarity IS NOT NULL THEN
    NEW.overall_score := ROUND(
      (NEW.score_originality + NEW.score_methodology + NEW.score_relevance + NEW.score_clarity)::DECIMAL / 4,
      1
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-calculating overall score
DROP TRIGGER IF EXISTS trigger_calculate_review_score ON abstract_reviews;
CREATE TRIGGER trigger_calculate_review_score
BEFORE INSERT OR UPDATE ON abstract_reviews
FOR EACH ROW
EXECUTE FUNCTION calculate_review_overall_score();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_abstract_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_abstracts_updated_at ON abstracts;
CREATE TRIGGER trigger_abstracts_updated_at
BEFORE UPDATE ON abstracts
FOR EACH ROW
EXECUTE FUNCTION update_abstract_updated_at();

DROP TRIGGER IF EXISTS trigger_abstract_settings_updated_at ON abstract_settings;
CREATE TRIGGER trigger_abstract_settings_updated_at
BEFORE UPDATE ON abstract_settings
FOR EACH ROW
EXECUTE FUNCTION update_abstract_updated_at();

DROP TRIGGER IF EXISTS trigger_abstract_categories_updated_at ON abstract_categories;
CREATE TRIGGER trigger_abstract_categories_updated_at
BEFORE UPDATE ON abstract_categories
FOR EACH ROW
EXECUTE FUNCTION update_abstract_updated_at();

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS
ALTER TABLE abstract_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE abstracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE abstract_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE abstract_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE abstract_settings ENABLE ROW LEVEL SECURITY;

-- Policies for abstract_categories (public read for active categories)
CREATE POLICY "Anyone can view active categories" ON abstract_categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Authenticated users can manage categories" ON abstract_categories
  FOR ALL USING (auth.role() = 'authenticated');

-- Policies for abstracts
CREATE POLICY "Authors can view their own abstracts" ON abstracts
  FOR SELECT USING (
    presenting_author_email = auth.jwt() ->> 'email'
    OR auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can manage abstracts" ON abstracts
  FOR ALL USING (auth.role() = 'authenticated');

-- Policies for abstract_authors
CREATE POLICY "Anyone can view authors of accessible abstracts" ON abstract_authors
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage authors" ON abstract_authors
  FOR ALL USING (auth.role() = 'authenticated');

-- Policies for abstract_reviews
CREATE POLICY "Authenticated users can manage reviews" ON abstract_reviews
  FOR ALL USING (auth.role() = 'authenticated');

-- Policies for abstract_settings
CREATE POLICY "Anyone can view settings" ON abstract_settings
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage settings" ON abstract_settings
  FOR ALL USING (auth.role() = 'authenticated');
