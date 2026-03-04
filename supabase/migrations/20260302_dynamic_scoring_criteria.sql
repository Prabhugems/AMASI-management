-- Dynamic Scoring Criteria Migration
-- Date: 2026-03-02
-- Description: Adds dynamic scoring criteria to abstract_categories and JSONB-based
--   scores to abstract_reviews, enabling category-specific scoring (e.g., Best Poster
--   has 10 criteria scored 0-5, Best Paper has 5 criteria scored 0-10).

-- =====================================================
-- Phase 1: Extend abstract_categories with scoring criteria
-- =====================================================

-- Array of {label, description, max_score} objects defining per-category scoring rubric
ALTER TABLE abstract_categories
ADD COLUMN IF NOT EXISTS scoring_criteria JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN abstract_categories.scoring_criteria IS
  'JSON array of {label, description, max_score} defining category-specific scoring criteria';

-- =====================================================
-- Phase 2: Extend abstract_reviews with dynamic scores
-- =====================================================

-- JSONB object mapping criterion label to score, e.g. {"Originality": 8, "Methodology": 7}
ALTER TABLE abstract_reviews
ADD COLUMN IF NOT EXISTS scores JSONB DEFAULT '{}'::jsonb;

-- Raw total of all criteria scores (e.g. 42)
ALTER TABLE abstract_reviews
ADD COLUMN IF NOT EXISTS total_score DECIMAL(5,1);

-- Max achievable score for the category (e.g. 50)
ALTER TABLE abstract_reviews
ADD COLUMN IF NOT EXISTS max_possible_score DECIMAL(5,1);

-- Distinguish reviewer vs judge scores
ALTER TABLE abstract_reviews
ADD COLUMN IF NOT EXISTS review_type TEXT DEFAULT 'review';

COMMENT ON COLUMN abstract_reviews.scores IS
  'JSONB object mapping criterion label to numeric score';
COMMENT ON COLUMN abstract_reviews.total_score IS
  'Sum of all criteria scores from the scores JSONB';
COMMENT ON COLUMN abstract_reviews.max_possible_score IS
  'Maximum possible score for the category (sum of all max_score values)';
COMMENT ON COLUMN abstract_reviews.review_type IS
  'review (pre-conference reviewer) or judge_score (live conference judge)';

-- =====================================================
-- Phase 3: Update trigger to handle dynamic JSONB scores
-- =====================================================

-- Replace the trigger function to handle both legacy and dynamic scoring
CREATE OR REPLACE FUNCTION calculate_review_overall_score()
RETURNS TRIGGER AS $$
DECLARE
  v_total DECIMAL;
  v_max DECIMAL;
  v_key TEXT;
  v_value DECIMAL;
BEGIN
  -- Case 1: Dynamic JSONB scores provided (new system)
  IF NEW.scores IS NOT NULL AND NEW.scores != '{}'::jsonb THEN
    v_total := 0;
    FOR v_key, v_value IN SELECT key, value::decimal FROM jsonb_each_text(NEW.scores)
    LOOP
      v_total := v_total + v_value;
    END LOOP;

    NEW.total_score := v_total;
    -- max_possible_score is set by the API from category criteria

    -- Normalize to 10-point scale for overall_score so existing ranking/sorting works
    IF NEW.max_possible_score IS NOT NULL AND NEW.max_possible_score > 0 THEN
      NEW.overall_score := ROUND((v_total / NEW.max_possible_score) * 10, 1);
    ELSE
      NEW.overall_score := NULL;
    END IF;

  -- Case 2: Legacy fixed-column scores (backward compatibility)
  ELSIF NEW.score_originality IS NOT NULL AND
        NEW.score_methodology IS NOT NULL AND
        NEW.score_relevance IS NOT NULL AND
        NEW.score_clarity IS NOT NULL THEN
    NEW.overall_score := ROUND(
      (NEW.score_originality + NEW.score_methodology + NEW.score_relevance + NEW.score_clarity)::DECIMAL / 4,
      1
    );
    NEW.total_score := (NEW.score_originality + NEW.score_methodology + NEW.score_relevance + NEW.score_clarity)::DECIMAL;
    NEW.max_possible_score := 40;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Index for review_type filtering
CREATE INDEX IF NOT EXISTS idx_abstract_reviews_type ON abstract_reviews(review_type);
