-- Complete Abstract Workflow Migration
-- Date: 2026-03-13
-- Description: Full workflow from delegate submission to conference day attendance

-- =====================================================
-- PHASE 1: ENHANCED ABSTRACT STATUS WORKFLOW
-- =====================================================

-- Update abstracts table with complete workflow fields
ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  workflow_stage TEXT DEFAULT 'submission';
  -- submission, review, committee, scheduling, ready, presented

-- Committee decision tracking
ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  committee_decision TEXT; -- accept_oral, accept_poster, accept_video, second_review, reject

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  committee_decision_by UUID REFERENCES team_members(id);

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  committee_decision_at TIMESTAMPTZ;

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  committee_notes TEXT;

-- Second review tracking
ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  review_round INT DEFAULT 1;

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  second_review_reason TEXT;

-- Registration verification
ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  registration_verified BOOLEAN DEFAULT false;

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  registration_verified_at TIMESTAMPTZ;

-- Presenter attendance
ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  presenter_checked_in BOOLEAN DEFAULT false;

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  presenter_checked_in_at TIMESTAMPTZ;

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  presentation_completed BOOLEAN DEFAULT false;

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  presentation_completed_at TIMESTAMPTZ;

-- Presentation file
ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  presentation_file_url TEXT;

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  presentation_file_name TEXT;

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  presentation_uploaded_at TIMESTAMPTZ;

-- Communication tracking
ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  acceptance_email_sent BOOLEAN DEFAULT false;

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  acceptance_email_sent_at TIMESTAMPTZ;

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  schedule_email_sent BOOLEAN DEFAULT false;

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  schedule_email_sent_at TIMESTAMPTZ;

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  reminder_email_sent BOOLEAN DEFAULT false;

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS
  reminder_email_sent_at TIMESTAMPTZ;

-- =====================================================
-- PHASE 2: REVIEWER POOL TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS abstract_reviewer_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- Reviewer info
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  institution TEXT,
  designation TEXT,

  -- Expertise areas for matching
  expertise_areas TEXT[] DEFAULT '{}',
  specialty TEXT,

  -- Capacity management
  max_assignments INT DEFAULT 20,
  current_assignments INT DEFAULT 0,
  completed_reviews INT DEFAULT 0,

  -- Performance tracking
  avg_review_time_hours DECIMAL(5,1),
  avg_score_given DECIMAL(3,1),

  -- Status
  status TEXT DEFAULT 'active', -- active, busy, inactive

  -- Portal access
  access_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  last_login_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(event_id, email)
);

-- =====================================================
-- PHASE 3: REVIEW ASSIGNMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS abstract_review_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  abstract_id UUID NOT NULL REFERENCES abstracts(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES abstract_reviewer_pool(id) ON DELETE CASCADE,

  review_round INT DEFAULT 1,

  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES team_members(id),
  due_date TIMESTAMPTZ,

  status TEXT DEFAULT 'pending', -- pending, in_progress, completed, declined, overdue

  -- Reminder tracking
  reminder_count INT DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,

  completed_at TIMESTAMPTZ,

  UNIQUE(abstract_id, reviewer_id, review_round)
);

-- =====================================================
-- PHASE 4: COMMITTEE MEMBERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS abstract_committee_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  user_id UUID REFERENCES team_members(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,

  role TEXT DEFAULT 'member', -- chair, co_chair, member

  -- Permissions
  can_make_decisions BOOLEAN DEFAULT true,
  can_assign_reviewers BOOLEAN DEFAULT true,
  can_send_second_review BOOLEAN DEFAULT true,

  -- Portal access
  access_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(event_id, email)
);

-- =====================================================
-- PHASE 5: COMMITTEE DECISION LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS abstract_committee_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  abstract_id UUID NOT NULL REFERENCES abstracts(id) ON DELETE CASCADE,

  decision TEXT NOT NULL, -- accept_oral, accept_poster, accept_video, second_review, reject
  decision_by UUID REFERENCES abstract_committee_members(id),
  decision_by_name TEXT,

  review_round INT DEFAULT 1,

  -- For second review
  second_review_reason TEXT,
  second_review_instructions TEXT,

  -- For rejection
  rejection_reason TEXT,
  feedback_to_author TEXT,

  notes TEXT,
  decided_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PHASE 6: PRESENTER SESSIONS (Program Integration)
-- =====================================================

CREATE TABLE IF NOT EXISTS abstract_presentation_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  abstract_id UUID NOT NULL REFERENCES abstracts(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,

  -- Presentation details
  presentation_type TEXT NOT NULL, -- oral, poster, video, eposter

  -- Schedule
  presentation_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INT DEFAULT 10,

  -- Location
  hall_name TEXT,
  room_number TEXT,

  -- For posters
  poster_board_number TEXT,
  poster_zone TEXT,

  -- Order in session
  slot_order INT DEFAULT 0,

  -- Status
  is_confirmed BOOLEAN DEFAULT false,
  confirmed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(abstract_id)
);

-- =====================================================
-- PHASE 7: NOTIFICATION LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS abstract_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  abstract_id UUID NOT NULL REFERENCES abstracts(id) ON DELETE CASCADE,

  notification_type TEXT NOT NULL,
  -- submission_confirmation, under_review, revision_requested,
  -- accepted, rejected, schedule_assigned, upload_reminder,
  -- registration_reminder, day_before_reminder

  recipient_email TEXT NOT NULL,
  recipient_name TEXT,

  subject TEXT,
  body_preview TEXT,

  sent_at TIMESTAMPTZ DEFAULT NOW(),
  sent_by UUID REFERENCES team_members(id),

  -- Delivery status
  delivery_status TEXT DEFAULT 'sent', -- sent, delivered, failed, bounced

  -- Related data
  metadata JSONB DEFAULT '{}'
);

-- =====================================================
-- PHASE 8: PRESENTER CHECK-IN
-- =====================================================

CREATE TABLE IF NOT EXISTS abstract_presenter_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  abstract_id UUID NOT NULL REFERENCES abstracts(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- Presenter info
  presenter_email TEXT NOT NULL,
  presenter_name TEXT,
  registration_id UUID REFERENCES registrations(id),

  -- Check-in
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  checked_in_by UUID REFERENCES team_members(id),
  check_in_location TEXT,

  -- Presentation status
  presentation_started_at TIMESTAMPTZ,
  presentation_ended_at TIMESTAMPTZ,

  -- Notes
  notes TEXT
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_abstracts_workflow_stage ON abstracts(workflow_stage);
CREATE INDEX IF NOT EXISTS idx_abstracts_committee_decision ON abstracts(committee_decision);
CREATE INDEX IF NOT EXISTS idx_abstracts_review_round ON abstracts(review_round);
CREATE INDEX IF NOT EXISTS idx_abstracts_registration_verified ON abstracts(registration_verified);
CREATE INDEX IF NOT EXISTS idx_abstracts_presenter_checked_in ON abstracts(presenter_checked_in);

CREATE INDEX IF NOT EXISTS idx_reviewer_pool_event ON abstract_reviewer_pool(event_id);
CREATE INDEX IF NOT EXISTS idx_reviewer_pool_email ON abstract_reviewer_pool(email);
CREATE INDEX IF NOT EXISTS idx_reviewer_pool_token ON abstract_reviewer_pool(access_token);

CREATE INDEX IF NOT EXISTS idx_review_assignments_abstract ON abstract_review_assignments(abstract_id);
CREATE INDEX IF NOT EXISTS idx_review_assignments_reviewer ON abstract_review_assignments(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_review_assignments_status ON abstract_review_assignments(status);

CREATE INDEX IF NOT EXISTS idx_committee_members_event ON abstract_committee_members(event_id);
CREATE INDEX IF NOT EXISTS idx_committee_decisions_abstract ON abstract_committee_decisions(abstract_id);

CREATE INDEX IF NOT EXISTS idx_presentation_slots_event ON abstract_presentation_slots(event_id);
CREATE INDEX IF NOT EXISTS idx_presentation_slots_date ON abstract_presentation_slots(presentation_date);
CREATE INDEX IF NOT EXISTS idx_presentation_slots_session ON abstract_presentation_slots(session_id);

CREATE INDEX IF NOT EXISTS idx_notifications_abstract ON abstract_notifications(abstract_id);
CREATE INDEX IF NOT EXISTS idx_presenter_checkins_event ON abstract_presenter_checkins(event_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE abstract_reviewer_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE abstract_review_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE abstract_committee_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE abstract_committee_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE abstract_presentation_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE abstract_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE abstract_presenter_checkins ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "reviewer_pool_auth_policy" ON abstract_reviewer_pool
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "review_assignments_auth_policy" ON abstract_review_assignments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "committee_members_auth_policy" ON abstract_committee_members
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "committee_decisions_auth_policy" ON abstract_committee_decisions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "presentation_slots_auth_policy" ON abstract_presentation_slots
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "notifications_auth_policy" ON abstract_notifications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "presenter_checkins_auth_policy" ON abstract_presenter_checkins
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update workflow stage based on status changes
CREATE OR REPLACE FUNCTION update_abstract_workflow_stage()
RETURNS TRIGGER AS $$
BEGIN
  -- Update workflow stage based on status
  CASE NEW.status
    WHEN 'submitted' THEN
      NEW.workflow_stage := 'submission';
    WHEN 'under_review' THEN
      NEW.workflow_stage := 'review';
    WHEN 'review_complete' THEN
      NEW.workflow_stage := 'committee';
    WHEN 'accepted' THEN
      IF NEW.session_id IS NOT NULL OR NEW.session_date IS NOT NULL THEN
        NEW.workflow_stage := 'ready';
      ELSE
        NEW.workflow_stage := 'scheduling';
      END IF;
    WHEN 'rejected', 'withdrawn' THEN
      NEW.workflow_stage := 'closed';
    ELSE
      -- Keep existing stage
      NULL;
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_workflow_stage ON abstracts;
CREATE TRIGGER trigger_update_workflow_stage
BEFORE UPDATE ON abstracts
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status OR
      OLD.session_id IS DISTINCT FROM NEW.session_id)
EXECUTE FUNCTION update_abstract_workflow_stage();

-- Function to check registration when abstract is accepted
CREATE OR REPLACE FUNCTION check_abstract_registration()
RETURNS TRIGGER AS $$
DECLARE
  v_registration_id UUID;
BEGIN
  -- Only run when committee decision is accept
  IF NEW.committee_decision IN ('accept_oral', 'accept_poster', 'accept_video')
     AND (OLD.committee_decision IS NULL OR OLD.committee_decision != NEW.committee_decision) THEN

    -- Check if presenting author has registration
    SELECT id INTO v_registration_id
    FROM registrations
    WHERE event_id = NEW.event_id
      AND LOWER(attendee_email) = LOWER(NEW.presenting_author_email)
      AND status = 'confirmed'
    LIMIT 1;

    IF v_registration_id IS NOT NULL THEN
      NEW.registration_id := v_registration_id;
      NEW.registration_verified := true;
      NEW.registration_verified_at := NOW();
    ELSE
      NEW.registration_verified := false;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_registration ON abstracts;
CREATE TRIGGER trigger_check_registration
BEFORE UPDATE ON abstracts
FOR EACH ROW
EXECUTE FUNCTION check_abstract_registration();

-- Function to update reviewer assignment counts
CREATE OR REPLACE FUNCTION update_reviewer_assignment_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE abstract_reviewer_pool
    SET current_assignments = current_assignments + 1
    WHERE id = NEW.reviewer_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE abstract_reviewer_pool
    SET current_assignments = GREATEST(0, current_assignments - 1)
    WHERE id = OLD.reviewer_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE abstract_reviewer_pool
    SET
      current_assignments = GREATEST(0, current_assignments - 1),
      completed_reviews = completed_reviews + 1
    WHERE id = NEW.reviewer_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reviewer_counts ON abstract_review_assignments;
CREATE TRIGGER trigger_reviewer_counts
AFTER INSERT OR UPDATE OR DELETE ON abstract_review_assignments
FOR EACH ROW
EXECUTE FUNCTION update_reviewer_assignment_counts();

-- =====================================================
-- VIEWS FOR DASHBOARD
-- =====================================================

-- Abstract workflow summary view
CREATE OR REPLACE VIEW abstract_workflow_summary AS
SELECT
  a.event_id,
  COUNT(*) AS total_abstracts,
  COUNT(CASE WHEN a.workflow_stage = 'submission' THEN 1 END) AS in_submission,
  COUNT(CASE WHEN a.workflow_stage = 'review' THEN 1 END) AS in_review,
  COUNT(CASE WHEN a.workflow_stage = 'committee' THEN 1 END) AS awaiting_committee,
  COUNT(CASE WHEN a.workflow_stage = 'scheduling' THEN 1 END) AS awaiting_schedule,
  COUNT(CASE WHEN a.workflow_stage = 'ready' THEN 1 END) AS ready_to_present,
  COUNT(CASE WHEN a.status = 'accepted' THEN 1 END) AS accepted,
  COUNT(CASE WHEN a.status = 'rejected' THEN 1 END) AS rejected,
  COUNT(CASE WHEN a.registration_verified = true THEN 1 END) AS registration_verified,
  COUNT(CASE WHEN a.registration_verified = false AND a.status = 'accepted' THEN 1 END) AS registration_pending,
  COUNT(CASE WHEN a.presenter_checked_in = true THEN 1 END) AS presenters_checked_in,
  COUNT(CASE WHEN a.presentation_completed = true THEN 1 END) AS presentations_completed
FROM abstracts a
GROUP BY a.event_id;

-- Reviewer workload view
CREATE OR REPLACE VIEW reviewer_workload_summary AS
SELECT
  r.event_id,
  r.id AS reviewer_id,
  r.name,
  r.email,
  r.max_assignments,
  r.current_assignments,
  r.completed_reviews,
  COUNT(CASE WHEN ra.status = 'pending' THEN 1 END) AS pending_reviews,
  COUNT(CASE WHEN ra.status = 'overdue' THEN 1 END) AS overdue_reviews,
  r.avg_review_time_hours,
  r.status
FROM abstract_reviewer_pool r
LEFT JOIN abstract_review_assignments ra ON r.id = ra.reviewer_id
GROUP BY r.id;

-- Committee decision queue view
CREATE OR REPLACE VIEW committee_decision_queue AS
SELECT
  a.id,
  a.abstract_number,
  a.title,
  a.presenting_author_name,
  a.presenting_author_email,
  a.category_id,
  ac.name AS category_name,
  a.presentation_type,
  a.review_round,
  a.status,
  -- Aggregate review scores
  COUNT(ar.id) AS review_count,
  ROUND(AVG(ar.overall_score), 1) AS avg_score,
  ARRAY_AGG(ar.recommendation) AS recommendations,
  -- Check if all reviews complete
  BOOL_AND(ra.status = 'completed') AS all_reviews_complete
FROM abstracts a
LEFT JOIN abstract_categories ac ON a.category_id = ac.id
LEFT JOIN abstract_review_assignments ra ON a.id = ra.abstract_id AND ra.review_round = a.review_round
LEFT JOIN abstract_reviews ar ON a.id = ar.abstract_id
WHERE a.status = 'under_review' OR a.workflow_stage = 'committee'
GROUP BY a.id, ac.name;

SELECT 'Complete abstract workflow schema created!' AS status;
