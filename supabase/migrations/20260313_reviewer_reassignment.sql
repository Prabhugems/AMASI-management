-- Reviewer Reassignment & Category Mismatch Handling
-- Date: 2026-03-13

-- =====================================================
-- CATEGORY MISMATCH TRACKING ON ABSTRACTS
-- =====================================================

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  has_category_mismatch BOOLEAN DEFAULT false;

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  category_mismatch_reason TEXT;

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  suggested_category_id UUID REFERENCES abstract_categories(id);

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  category_flagged_by UUID;

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  category_flagged_at TIMESTAMPTZ;

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  category_changed_by UUID;

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  category_changed_at TIMESTAMPTZ;

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  category_change_notes TEXT;

-- =====================================================
-- ENHANCED REVIEW ASSIGNMENT STATUSES
-- =====================================================

-- Add comment to document statuses
COMMENT ON COLUMN abstract_review_assignments.status IS
  'pending, in_progress, completed, declined, flagged, reassigned, overdue';

-- =====================================================
-- REVIEWER CONFLICT OF INTEREST TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS reviewer_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES abstract_reviewer_pool(id) ON DELETE CASCADE,

  -- Conflict type
  conflict_type TEXT NOT NULL, -- 'author', 'institution', 'co_author', 'manual'

  -- Conflicting entity
  conflicting_email TEXT,
  conflicting_institution TEXT,

  -- Manual conflict
  conflict_reason TEXT,

  reported_by UUID,
  reported_at TIMESTAMPTZ DEFAULT NOW(),

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviewer_conflicts_reviewer ON reviewer_conflicts(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviewer_conflicts_email ON reviewer_conflicts(conflicting_email);

-- =====================================================
-- REVIEWER EXPERTISE KEYWORDS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS reviewer_expertise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES abstract_reviewer_pool(id) ON DELETE CASCADE,

  keyword TEXT NOT NULL,
  category_id UUID REFERENCES abstract_categories(id),

  proficiency_level TEXT DEFAULT 'expert', -- 'expert', 'proficient', 'familiar'

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(reviewer_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_reviewer_expertise_keyword ON reviewer_expertise(keyword);
CREATE INDEX IF NOT EXISTS idx_reviewer_expertise_category ON reviewer_expertise(category_id);

-- =====================================================
-- AUTO-ASSIGNMENT LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS abstract_assignment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  abstract_id UUID NOT NULL REFERENCES abstracts(id) ON DELETE CASCADE,

  action TEXT NOT NULL,
  -- 'auto_assigned', 'manual_assigned', 'declined', 'reassigned',
  -- 'flagged', 'extension_requested', 'extension_approved', 'category_changed'

  from_reviewer_id UUID REFERENCES abstract_reviewer_pool(id),
  to_reviewer_id UUID REFERENCES abstract_reviewer_pool(id),

  performed_by UUID, -- User/committee member who performed the action
  performed_by_name TEXT,

  reason TEXT,
  notes TEXT,

  match_score INT, -- For auto-assignment, the calculated match score

  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_log_abstract ON abstract_assignment_log(abstract_id);
CREATE INDEX IF NOT EXISTS idx_assignment_log_action ON abstract_assignment_log(action);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to check for conflicts before assignment
CREATE OR REPLACE FUNCTION check_reviewer_conflict(
  p_reviewer_id UUID,
  p_abstract_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_author_email TEXT;
  v_author_institution TEXT;
  v_has_conflict BOOLEAN := false;
BEGIN
  -- Get abstract author details
  SELECT presenting_author_email, institution
  INTO v_author_email, v_author_institution
  FROM abstracts WHERE id = p_abstract_id;

  -- Check if reviewer is the author
  IF EXISTS (
    SELECT 1 FROM abstract_reviewer_pool
    WHERE id = p_reviewer_id
    AND LOWER(email) = LOWER(v_author_email)
  ) THEN
    RETURN true;
  END IF;

  -- Check explicit conflicts
  IF EXISTS (
    SELECT 1 FROM reviewer_conflicts
    WHERE reviewer_id = p_reviewer_id
    AND is_active = true
    AND (
      LOWER(conflicting_email) = LOWER(v_author_email)
      OR (conflicting_institution IS NOT NULL
          AND v_author_institution IS NOT NULL
          AND LOWER(conflicting_institution) = LOWER(v_author_institution))
    )
  ) THEN
    RETURN true;
  END IF;

  -- Check co-authors
  IF EXISTS (
    SELECT 1 FROM abstract_reviewer_pool rp
    CROSS JOIN LATERAL jsonb_array_elements(
      (SELECT co_authors FROM abstracts WHERE id = p_abstract_id)
    ) AS author
    WHERE rp.id = p_reviewer_id
    AND LOWER(rp.email) = LOWER(author->>'email')
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function to get best matching reviewers
CREATE OR REPLACE FUNCTION get_matching_reviewers(
  p_abstract_id UUID,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  reviewer_id UUID,
  reviewer_name TEXT,
  reviewer_email TEXT,
  match_score INT,
  current_load INT,
  max_capacity INT,
  has_conflict BOOLEAN
) AS $$
DECLARE
  v_event_id UUID;
  v_keywords TEXT[];
  v_category_id UUID;
BEGIN
  -- Get abstract details
  SELECT event_id, keywords, category_id
  INTO v_event_id, v_keywords, v_category_id
  FROM abstracts WHERE id = p_abstract_id;

  RETURN QUERY
  WITH reviewer_scores AS (
    SELECT
      r.id,
      r.name,
      r.email,
      r.current_assignments,
      r.max_assignments,
      -- Calculate match score
      (
        -- Keyword matches (highest weight)
        COALESCE((
          SELECT COUNT(*) * 10
          FROM unnest(r.expertise_areas) ea
          WHERE ea = ANY(v_keywords)
        ), 0) +
        -- Category expertise
        COALESCE((
          SELECT COUNT(*) * 15
          FROM reviewer_expertise re
          WHERE re.reviewer_id = r.id
          AND re.category_id = v_category_id
        ), 0) +
        -- Capacity bonus
        CASE
          WHEN r.current_assignments < r.max_assignments * 0.5 THEN 20
          WHEN r.current_assignments < r.max_assignments * 0.8 THEN 10
          ELSE 0
        END +
        -- Experience bonus
        CASE
          WHEN r.completed_reviews > 10 THEN 10
          WHEN r.completed_reviews > 5 THEN 5
          ELSE 0
        END
      )::INT AS calculated_score,
      check_reviewer_conflict(r.id, p_abstract_id) AS conflict
    FROM abstract_reviewer_pool r
    WHERE r.event_id = v_event_id
    AND r.status = 'active'
    AND r.current_assignments < r.max_assignments
  )
  SELECT
    rs.id,
    rs.name,
    rs.email,
    rs.calculated_score,
    rs.current_assignments,
    rs.max_assignments,
    rs.conflict
  FROM reviewer_scores rs
  WHERE NOT rs.conflict
  ORDER BY rs.calculated_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE reviewer_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviewer_expertise ENABLE ROW LEVEL SECURITY;
ALTER TABLE abstract_assignment_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviewer_conflicts_auth_policy" ON reviewer_conflicts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "reviewer_expertise_auth_policy" ON reviewer_expertise
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "assignment_log_auth_policy" ON abstract_assignment_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

SELECT 'Reviewer reassignment schema created!' AS status;
