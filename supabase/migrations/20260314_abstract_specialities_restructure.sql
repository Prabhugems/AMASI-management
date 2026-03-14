-- Abstract Specialities Restructure Migration
-- Date: 2026-03-14
-- Description: Restructure abstracts to separate Specialities from Categories
--
-- New Structure:
-- - Specialities: Bariatric Surgery, Robotic Surgery, Solid Organ, etc.
-- - Categories: Paper, Video, Poster
-- - Competition Type: Best (award-eligible) or Free (non-competition)

-- =====================================================
-- Step 1: Rename abstract_categories to abstract_specialities
-- =====================================================

-- Rename the table
ALTER TABLE IF EXISTS abstract_categories RENAME TO abstract_specialities;

-- Rename the column in abstracts table
ALTER TABLE abstracts RENAME COLUMN category_id TO speciality_id;

-- Update foreign key constraint name
ALTER TABLE abstracts DROP CONSTRAINT IF EXISTS abstracts_category_id_fkey;
ALTER TABLE abstracts ADD CONSTRAINT abstracts_speciality_id_fkey
  FOREIGN KEY (speciality_id) REFERENCES abstract_specialities(id) ON DELETE SET NULL;

-- =====================================================
-- Step 2: Add new category fields to abstracts
-- =====================================================

-- Create enum types for the new structure
DO $$ BEGIN
  CREATE TYPE submission_category AS ENUM ('paper', 'video', 'poster');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE competition_type AS ENUM ('best', 'free');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new columns to abstracts table
ALTER TABLE abstracts
  ADD COLUMN IF NOT EXISTS submission_category submission_category DEFAULT 'paper',
  ADD COLUMN IF NOT EXISTS competition_type competition_type DEFAULT 'free';

-- =====================================================
-- Step 3: Migrate existing presentation_type to submission_category
-- =====================================================

-- Map existing presentation_type to new submission_category
UPDATE abstracts SET submission_category = 'paper' WHERE presentation_type = 'oral';
UPDATE abstracts SET submission_category = 'poster' WHERE presentation_type = 'poster';
UPDATE abstracts SET submission_category = 'video' WHERE presentation_type = 'video';

-- =====================================================
-- Step 4: Update abstract_settings for new categories
-- =====================================================

-- Add category settings to abstract_settings
ALTER TABLE abstract_settings
  ADD COLUMN IF NOT EXISTS enable_paper_category BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_video_category BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_poster_category BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_best_competition BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_free_category BOOLEAN DEFAULT true;

-- Remove old presentation_types array since we now have explicit toggles
-- (Keep for backwards compatibility but deprecate)
COMMENT ON COLUMN abstract_settings.presentation_types IS
  'DEPRECATED: Use enable_paper_category, enable_video_category, enable_poster_category instead';

-- =====================================================
-- Step 5: Create indexes for new columns
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_abstracts_speciality ON abstracts(speciality_id);
CREATE INDEX IF NOT EXISTS idx_abstracts_submission_category ON abstracts(submission_category);
CREATE INDEX IF NOT EXISTS idx_abstracts_competition_type ON abstracts(competition_type);

-- =====================================================
-- Step 6: Update RLS policies for renamed table
-- =====================================================

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Anyone can view active categories" ON abstract_specialities;
DROP POLICY IF EXISTS "Authenticated users can manage categories" ON abstract_specialities;

-- Create new policies
CREATE POLICY "Anyone can view active specialities" ON abstract_specialities
  FOR SELECT USING (is_active = true);

CREATE POLICY "Authenticated users can manage specialities" ON abstract_specialities
  FOR ALL USING (auth.role() = 'authenticated');

-- =====================================================
-- Step 7: Add award fields for Best category
-- =====================================================

-- Add award tracking fields
ALTER TABLE abstracts
  ADD COLUMN IF NOT EXISTS is_award_winner BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS award_position INT, -- 1st, 2nd, 3rd place
  ADD COLUMN IF NOT EXISTS award_notes TEXT;

-- Add index for award winners
CREATE INDEX IF NOT EXISTS idx_abstracts_award_winner ON abstracts(is_award_winner) WHERE is_award_winner = true;

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON COLUMN abstracts.speciality_id IS 'The medical speciality (Bariatric, Robotic, etc.)';
COMMENT ON COLUMN abstracts.submission_category IS 'Type of submission: paper, video, or poster';
COMMENT ON COLUMN abstracts.competition_type IS 'Whether competing for Best award or Free (non-competition)';
COMMENT ON COLUMN abstracts.is_award_winner IS 'True if this abstract won an award in Best category';
COMMENT ON COLUMN abstracts.award_position IS 'Award position: 1=First, 2=Second, 3=Third';
