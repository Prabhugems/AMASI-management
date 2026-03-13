-- Abstract Management Audit Fixes
-- Date: 2026-03-13
-- Fixes critical issues identified in A-Z audit

-- =====================================================
-- FIX 1: Add missing 'institution' column to abstracts
-- =====================================================
ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS institution TEXT;
COMMENT ON COLUMN abstracts.institution IS 'Institution/Affiliation of the presenting author';

-- =====================================================
-- FIX 2: Add missing index on session_id
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_abstracts_session ON abstracts(session_id);

-- =====================================================
-- FIX 3: Add missing performance indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_review_assignments_completed ON abstract_review_assignments(completed_at);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON abstract_notifications(sent_at);
CREATE INDEX IF NOT EXISTS idx_presenter_checkins_timestamp ON abstract_presenter_checkins(checked_in_at);
CREATE INDEX IF NOT EXISTS idx_assignment_log_created ON abstract_assignment_log(created_at);
CREATE INDEX IF NOT EXISTS idx_assignment_log_reviewer ON abstract_assignment_log(from_reviewer_id, to_reviewer_id);

-- =====================================================
-- FIX 4: Fix reviewer_expertise FK constraint
-- =====================================================
ALTER TABLE reviewer_expertise DROP CONSTRAINT IF EXISTS reviewer_expertise_category_id_fkey;
ALTER TABLE reviewer_expertise ADD CONSTRAINT reviewer_expertise_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES abstract_categories(id) ON DELETE SET NULL;

-- =====================================================
-- FIX 5: Fix check_reviewer_conflict function
-- Uses abstract_authors table instead of non-existent co_authors column
-- =====================================================
CREATE OR REPLACE FUNCTION check_reviewer_conflict(
  p_reviewer_id UUID,
  p_abstract_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_author_email TEXT;
  v_author_institution TEXT;
  v_reviewer_email TEXT;
BEGIN
  -- Get abstract author details
  SELECT presenting_author_email, institution
  INTO v_author_email, v_author_institution
  FROM abstracts WHERE id = p_abstract_id;

  -- Get reviewer email
  SELECT email INTO v_reviewer_email
  FROM abstract_reviewer_pool WHERE id = p_reviewer_id;

  -- Check if reviewer is the presenting author
  IF v_reviewer_email IS NOT NULL AND v_author_email IS NOT NULL
     AND LOWER(v_reviewer_email) = LOWER(v_author_email) THEN
    RETURN true;
  END IF;

  -- Check explicit conflicts in reviewer_conflicts table
  IF EXISTS (
    SELECT 1 FROM reviewer_conflicts
    WHERE reviewer_id = p_reviewer_id
    AND is_active = true
    AND (
      (conflicting_email IS NOT NULL AND LOWER(conflicting_email) = LOWER(v_author_email))
      OR (conflicting_institution IS NOT NULL
          AND v_author_institution IS NOT NULL
          AND LOWER(conflicting_institution) = LOWER(v_author_institution))
    )
  ) THEN
    RETURN true;
  END IF;

  -- Check co-authors using abstract_authors table (FIXED - was using non-existent co_authors column)
  IF EXISTS (
    SELECT 1 FROM abstract_reviewer_pool rp
    INNER JOIN abstract_authors aa ON aa.abstract_id = p_abstract_id
    WHERE rp.id = p_reviewer_id
    AND aa.email IS NOT NULL
    AND LOWER(rp.email) = LOWER(aa.email)
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FIX 6: Add updated_at columns to tables missing them
-- =====================================================
ALTER TABLE abstract_review_assignments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE abstract_committee_decisions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- =====================================================
-- FIX 7: Add NOT NULL constraints where needed
-- =====================================================
-- Note: Only adding if column allows (data must not have NULLs)
-- Run these manually after verifying data:
-- ALTER TABLE abstract_presenter_checkins ALTER COLUMN presenter_email SET NOT NULL;

-- =====================================================
-- FIX 8: Add video URL support to abstracts
-- =====================================================
ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS video_platform TEXT; -- youtube, vimeo, google_drive, dropbox
COMMENT ON COLUMN abstracts.video_url IS 'YouTube/Vimeo/Drive link for video submissions';
COMMENT ON COLUMN abstracts.video_platform IS 'Platform of the video URL';

-- =====================================================
-- FIX 9: Add video URL settings to abstract_settings
-- =====================================================
ALTER TABLE abstract_settings ADD COLUMN IF NOT EXISTS allow_video_url BOOLEAN DEFAULT false;
ALTER TABLE abstract_settings ADD COLUMN IF NOT EXISTS allowed_video_platforms TEXT[] DEFAULT ARRAY['youtube', 'vimeo'];
COMMENT ON COLUMN abstract_settings.allow_video_url IS 'Allow submitting YouTube/Vimeo links instead of file uploads';
COMMENT ON COLUMN abstract_settings.allowed_video_platforms IS 'Allowed video platforms: youtube, vimeo, google_drive, dropbox';

SELECT 'Audit fixes applied successfully!' AS status;
