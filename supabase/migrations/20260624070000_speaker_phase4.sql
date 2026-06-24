-- Speaker & Content Management — Phase 4 (Post-event engagement)
-- Plan: /Users/prabhubalasubramaniam/.claude/plans/speaker-content-management-reactive-brooks.md
--
-- Applied to PROD via Supabase MCP as version 20260624131149 / 'speaker_phase4'.
-- This file is the committed counterpart for cross-environment reproducibility.
--
-- Defers the invited-talk review subsystem (polymorphic abstract_reviews) — left for
-- a separate "Phase 4b" migration when the review queue UI is built. Tables created
-- here cover attendee feedback, Q&A, speaker attendance check-in, and the
-- review_status column on speaker_content for the future review queue.
--
-- Purely additive. No existing data is modified.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. session_feedback — attendee ratings per session (optionally per-speaker)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS session_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  session_speaker_id UUID REFERENCES faculty_assignments(id) ON DELETE SET NULL,
  rating_overall INTEGER NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
  rating_content INTEGER CHECK (rating_content BETWEEN 1 AND 5),
  rating_delivery INTEGER CHECK (rating_delivery BETWEEN 1 AND 5),
  comments TEXT,
  respondent_registration_id UUID REFERENCES registrations(id) ON DELETE SET NULL,
  respondent_email TEXT,
  respondent_token TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One vote per (session, speaker-or-null, registration). The COALESCE trick lets
-- a NULL session_speaker_id (= session-wide rating) coexist with per-speaker
-- ratings under the same unique constraint. Predicate keeps anonymous/no-account
-- votes out of the uniqueness check (they're rate-limited only by IP elsewhere).
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_feedback_one_per_voter
  ON session_feedback(
    session_id,
    COALESCE(session_speaker_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(respondent_registration_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE respondent_registration_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_session_feedback_event ON session_feedback(event_id);
CREATE INDEX IF NOT EXISTS idx_session_feedback_session ON session_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_session_feedback_speaker ON session_feedback(session_speaker_id);

ALTER TABLE session_feedback ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='session_feedback'
      AND policyname='Service role full access session_feedback'
  ) THEN
    CREATE POLICY "Service role full access session_feedback"
      ON session_feedback FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. session_qa — Q&A captured per session, optionally directed at a speaker
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS session_qa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  session_speaker_id UUID REFERENCES faculty_assignments(id) ON DELETE SET NULL,
  asked_by_name TEXT,
  asked_by_registration_id UUID REFERENCES registrations(id) ON DELETE SET NULL,
  asked_by_email TEXT,
  question TEXT NOT NULL,
  answer TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  upvotes INTEGER NOT NULL DEFAULT 0,
  asked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  answered_by_faculty_id UUID REFERENCES faculty(id) ON DELETE SET NULL,
  ip_address INET
);

CREATE INDEX IF NOT EXISTS idx_session_qa_session ON session_qa(session_id);
CREATE INDEX IF NOT EXISTS idx_session_qa_event ON session_qa(event_id);
CREATE INDEX IF NOT EXISTS idx_session_qa_speaker ON session_qa(session_speaker_id);
CREATE INDEX IF NOT EXISTS idx_session_qa_asked_at ON session_qa(asked_at DESC);

ALTER TABLE session_qa ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='session_qa'
      AND policyname='Service role full access session_qa'
  ) THEN
    CREATE POLICY "Service role full access session_qa"
      ON session_qa FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. session_attendance_speaker — speaker check-in (late / no-show tracking)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS session_attendance_speaker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_speaker_id UUID NOT NULL UNIQUE REFERENCES faculty_assignments(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES users(id) ON DELETE SET NULL,
  device_id TEXT,
  arrived_late BOOLEAN NOT NULL DEFAULT FALSE,
  no_show BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_session_attendance_event ON session_attendance_speaker(event_id);

ALTER TABLE session_attendance_speaker ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='session_attendance_speaker'
      AND policyname='Service role full access session_attendance_speaker'
  ) THEN
    CREATE POLICY "Service role full access session_attendance_speaker"
      ON session_attendance_speaker FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 4. speaker_content.review_status — column for the deferred invited-talk
--    review queue (Phase 4b will wire the actual UI + reviewers)
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE speaker_content
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'not_required';

ALTER TABLE speaker_content DROP CONSTRAINT IF EXISTS speaker_content_review_status_check;
ALTER TABLE speaker_content ADD CONSTRAINT speaker_content_review_status_check
  CHECK (review_status IN (
    'not_required', 'pending', 'under_review', 'approved', 'revisions_requested', 'rejected'
  ));
