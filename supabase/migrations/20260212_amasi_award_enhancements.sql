-- AMASI Award Submissions Enhancement Migration
-- Date: 2026-02-12
-- Description: Adds AMASI-specific award fields to abstract_categories and abstracts tables

-- =====================================================
-- Phase 1: Extend abstract_categories
-- =====================================================

-- Submission type determines required file type
ALTER TABLE abstract_categories
ADD COLUMN IF NOT EXISTS submission_type TEXT DEFAULT 'paper';
-- 'paper', 'video', 'poster'

-- Allowed file types for this category
ALTER TABLE abstract_categories
ADD COLUMN IF NOT EXISTS allowed_file_types TEXT[] DEFAULT ARRAY['pdf'];

-- Is file upload mandatory?
ALTER TABLE abstract_categories
ADD COLUMN IF NOT EXISTS required_file BOOLEAN DEFAULT false;

-- Declaration checkboxes: array of {text, required}
ALTER TABLE abstract_categories
ADD COLUMN IF NOT EXISTS declarations JSONB DEFAULT '[]'::jsonb;

-- Eligibility rules: {max_age, require_dob, allowed_positions}
ALTER TABLE abstract_categories
ADD COLUMN IF NOT EXISTS eligibility_rules JSONB DEFAULT '{}'::jsonb;

-- Award name (e.g. "AMASI Medal", "Dr Palanivelu Medal")
ALTER TABLE abstract_categories
ADD COLUMN IF NOT EXISTS award_name TEXT;

-- Is this an award category (vs free session)?
ALTER TABLE abstract_categories
ADD COLUMN IF NOT EXISTS is_award_category BOOLEAN DEFAULT false;

COMMENT ON COLUMN abstract_categories.submission_type IS 'paper, video, or poster - determines required file type';
COMMENT ON COLUMN abstract_categories.allowed_file_types IS 'Array of allowed file extensions e.g. {pdf} or {mp4}';
COMMENT ON COLUMN abstract_categories.required_file IS 'Whether file upload is mandatory for this category';
COMMENT ON COLUMN abstract_categories.declarations IS 'JSON array of {text, required} declaration checkboxes';
COMMENT ON COLUMN abstract_categories.eligibility_rules IS 'JSON object with eligibility criteria e.g. {max_age, require_dob, allowed_positions}';
COMMENT ON COLUMN abstract_categories.award_name IS 'Name of the award e.g. AMASI Medal';
COMMENT ON COLUMN abstract_categories.is_award_category IS 'True for award categories, false for free sessions';

-- =====================================================
-- Phase 2: Extend abstracts
-- =====================================================

-- AMASI membership number
ALTER TABLE abstracts
ADD COLUMN IF NOT EXISTS amasi_membership_number TEXT;

-- Which declarations the submitter checked
ALTER TABLE abstracts
ADD COLUMN IF NOT EXISTS declarations_accepted JSONB DEFAULT '[]'::jsonb;

-- Submitter metadata (date_of_birth, current_position, qualification)
ALTER TABLE abstracts
ADD COLUMN IF NOT EXISTS submitter_metadata JSONB DEFAULT '{}'::jsonb;

-- Award ranking (1-10) within category
ALTER TABLE abstracts
ADD COLUMN IF NOT EXISTS award_rank INT;

-- Award type: medal, certificate, bursary
ALTER TABLE abstracts
ADD COLUMN IF NOT EXISTS award_type TEXT;

-- Original category if redirected to free session
ALTER TABLE abstracts
ADD COLUMN IF NOT EXISTS redirected_from_category_id UUID REFERENCES abstract_categories(id) ON DELETE SET NULL;

-- Top 10 podium selection flag
ALTER TABLE abstracts
ADD COLUMN IF NOT EXISTS is_podium_selected BOOLEAN DEFAULT false;

COMMENT ON COLUMN abstracts.amasi_membership_number IS 'AMASI membership number (optional at submit, required for podium)';
COMMENT ON COLUMN abstracts.declarations_accepted IS 'JSON array of declaration texts that submitter checked';
COMMENT ON COLUMN abstracts.submitter_metadata IS 'JSON with date_of_birth, current_position, qualification';
COMMENT ON COLUMN abstracts.award_rank IS 'Rank 1-10 within category for awards';
COMMENT ON COLUMN abstracts.award_type IS 'medal, certificate, or bursary';
COMMENT ON COLUMN abstracts.redirected_from_category_id IS 'Original category ID if redirected to free session';
COMMENT ON COLUMN abstracts.is_podium_selected IS 'Whether abstract is selected for podium (top 10)';

-- Index for award queries
CREATE INDEX IF NOT EXISTS idx_abstracts_award_rank ON abstracts(category_id, award_rank) WHERE award_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_abstracts_redirected ON abstracts(redirected_from_category_id) WHERE redirected_from_category_id IS NOT NULL;
