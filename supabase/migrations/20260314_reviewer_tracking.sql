-- Reviewer Tracking Migration
-- Date: 2026-03-14
-- Description: Add columns to track reviewer activity (email opens, views, decline reasons)

-- =====================================================
-- PHASE 1: Add tracking columns to abstract_review_assignments
-- =====================================================

-- Track when the review email was opened
ALTER TABLE abstract_review_assignments ADD COLUMN IF NOT EXISTS
  email_opened_at TIMESTAMPTZ;

-- Track when reviewer last viewed an abstract
ALTER TABLE abstract_review_assignments ADD COLUMN IF NOT EXISTS
  last_viewed_at TIMESTAMPTZ;

-- Track view count
ALTER TABLE abstract_review_assignments ADD COLUMN IF NOT EXISTS
  view_count INT DEFAULT 0;

-- Track decline reason (for "Not in my speciality" and other reasons)
ALTER TABLE abstract_review_assignments ADD COLUMN IF NOT EXISTS
  declined_reason TEXT; -- not_my_specialty, conflict_of_interest, no_time, other

-- Track decline notes (for "other" reason)
ALTER TABLE abstract_review_assignments ADD COLUMN IF NOT EXISTS
  declined_notes TEXT;

-- =====================================================
-- PHASE 2: Add tracking columns to reviewer pool
-- =====================================================

-- Track email send count
ALTER TABLE abstract_reviewer_pool ADD COLUMN IF NOT EXISTS
  total_emails_sent INT DEFAULT 0;

-- Track email open count
ALTER TABLE abstract_reviewer_pool ADD COLUMN IF NOT EXISTS
  total_emails_opened INT DEFAULT 0;

-- Track last email sent
ALTER TABLE abstract_reviewer_pool ADD COLUMN IF NOT EXISTS
  last_email_sent_at TIMESTAMPTZ;

-- Track decline count
ALTER TABLE abstract_reviewer_pool ADD COLUMN IF NOT EXISTS
  decline_count INT DEFAULT 0;

-- =====================================================
-- PHASE 3: Add indexes for efficient querying
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_review_assignments_email_opened ON abstract_review_assignments(email_opened_at);
CREATE INDEX IF NOT EXISTS idx_review_assignments_last_viewed ON abstract_review_assignments(last_viewed_at);
CREATE INDEX IF NOT EXISTS idx_review_assignments_declined_reason ON abstract_review_assignments(declined_reason) WHERE declined_reason IS NOT NULL;

-- =====================================================
-- PHASE 4: Create view for reviewer activity summary
-- =====================================================

CREATE OR REPLACE VIEW reviewer_activity_summary AS
SELECT
  r.id AS reviewer_id,
  r.event_id,
  r.name,
  r.email,
  r.total_emails_sent,
  r.total_emails_opened,
  r.last_email_sent_at,
  r.last_login_at,
  r.decline_count,
  COUNT(DISTINCT ra.id) AS total_assignments,
  COUNT(CASE WHEN ra.status = 'pending' THEN 1 END) AS pending_count,
  COUNT(CASE WHEN ra.status = 'completed' THEN 1 END) AS completed_count,
  COUNT(CASE WHEN ra.status = 'declined' THEN 1 END) AS declined_count,
  COUNT(CASE WHEN ra.email_opened_at IS NOT NULL THEN 1 END) AS emails_opened,
  COUNT(CASE WHEN ra.last_viewed_at IS NOT NULL THEN 1 END) AS abstracts_viewed,
  MAX(ra.last_viewed_at) AS last_activity_at,
  -- Activity status
  CASE
    WHEN r.last_login_at IS NULL THEN 'never_logged_in'
    WHEN r.last_login_at > NOW() - INTERVAL '1 day' THEN 'active_today'
    WHEN r.last_login_at > NOW() - INTERVAL '3 days' THEN 'active_recently'
    WHEN r.last_login_at > NOW() - INTERVAL '7 days' THEN 'inactive_week'
    ELSE 'inactive_long'
  END AS activity_status,
  -- Needs reminder?
  CASE
    WHEN COUNT(CASE WHEN ra.status = 'pending' AND ra.email_opened_at IS NULL AND ra.assigned_at < NOW() - INTERVAL '3 days' THEN 1 END) > 0 THEN true
    ELSE false
  END AS needs_reminder
FROM abstract_reviewer_pool r
LEFT JOIN abstract_review_assignments ra ON r.id = ra.reviewer_id
GROUP BY r.id;

SELECT 'Reviewer tracking columns added!' AS status;
