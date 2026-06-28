-- Speaker & Content Management — Phase 3 (Medical compliance: CME + Disclosures + Honoraria)
-- Plan: /Users/prabhubalasubramaniam/.claude/plans/speaker-content-management-reactive-brooks.md
--
-- Pre-flight findings (2026-06-24):
--   • event_faculty is empty (0 rows) but the table already has 7 honorarium columns:
--     honorarium, honorarium_amount, honorarium_applicable, honorarium_currency (default INR),
--     honorarium_paid_date, honorarium_reference, honorarium_status. Plan called for
--     `amount_inr` + `payment_method` + `tds_deducted` + `transaction_reference`. Mapping:
--       amount_inr            → honorarium_amount (currency on honorarium_currency)
--       transaction_reference → honorarium_reference
--       payment_method        → NEW (add column below)
--       tds_deducted          → NEW (add column below)
--   • faculty_assignments has 248 distinct (event_id, faculty_id) pairs after the
--     name-matching backfill — these are the rows we'll seed event_faculty with.
--   • event_faculty.invitation_status and response_status are USER-DEFINED enums with
--     defaults ('not_invited', 'pending') — backfill omits them and lets defaults apply.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. event_faculty: add the two honoraria fields not already present
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE event_faculty
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS tds_deducted NUMERIC(12, 2);

ALTER TABLE event_faculty
  DROP CONSTRAINT IF EXISTS event_faculty_payment_method_check;
ALTER TABLE event_faculty
  ADD CONSTRAINT event_faculty_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('upi', 'bank', 'cheque', 'cash', 'waived'));

COMMENT ON COLUMN event_faculty.payment_method IS
  'How the honorarium was paid. NULL until approved + paid.';
COMMENT ON COLUMN event_faculty.tds_deducted IS
  'Indian tax deducted at source (₹). Subtracted from honorarium_amount at payout.';

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Backfill event_faculty from faculty_assignments
-- ──────────────────────────────────────────────────────────────────────────
-- One row per distinct (event_id, faculty_id) pair where faculty_id is set.
-- (event_id, faculty_id) is already UNIQUE on event_faculty.

INSERT INTO event_faculty (
  event_id,
  faculty_id,
  total_sessions,
  accepted_sessions,
  pending_sessions,
  rejected_sessions
)
SELECT
  fa.event_id,
  fa.faculty_id,
  COUNT(*) AS total_sessions,
  COUNT(*) FILTER (WHERE fa.status = 'confirmed') AS accepted_sessions,
  COUNT(*) FILTER (WHERE fa.status IN ('pending', 'invited')) AS pending_sessions,
  COUNT(*) FILTER (WHERE fa.status IN ('declined', 'cancelled')) AS rejected_sessions
FROM faculty_assignments fa
WHERE fa.faculty_id IS NOT NULL
GROUP BY fa.event_id, fa.faculty_id
ON CONFLICT (event_id, faculty_id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Trigger: auto-create event_faculty row on faculty_assignments insert
-- ──────────────────────────────────────────────────────────────────────────
-- Keeps event_faculty in sync going forward without app-layer coordination.
-- Counts stay stale until refreshed (acceptable for Phase 3 scale; refresh
-- script can be added later if needed).

CREATE OR REPLACE FUNCTION ensure_event_faculty_row()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.faculty_id IS NOT NULL THEN
    INSERT INTO event_faculty (event_id, faculty_id, total_sessions)
    VALUES (NEW.event_id, NEW.faculty_id, 1)
    ON CONFLICT (event_id, faculty_id) DO UPDATE
      SET total_sessions = event_faculty.total_sessions + 1,
          updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS faculty_assignments_ensure_event_faculty ON faculty_assignments;
CREATE TRIGGER faculty_assignments_ensure_event_faculty
  AFTER INSERT ON faculty_assignments
  FOR EACH ROW
  EXECUTE FUNCTION ensure_event_faculty_row();

-- ──────────────────────────────────────────────────────────────────────────
-- 4. session_cme — per-session CME credit assignment
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS session_cme (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  cme_credits NUMERIC(4, 2) NOT NULL DEFAULT 0,
  cme_category TEXT,
  accrediting_body TEXT,
  activity_code TEXT,
  requires_completion_quiz BOOLEAN NOT NULL DEFAULT FALSE,
  quiz_form_id UUID REFERENCES forms(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_cme_event ON session_cme(event_id);

ALTER TABLE session_cme ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='session_cme'
      AND policyname='Service role full access session_cme'
  ) THEN
    CREATE POLICY "Service role full access session_cme"
      ON session_cme FOR ALL TO service_role
      USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;

COMMENT ON COLUMN session_cme.cme_credits IS
  'CME credit hours for this session (NUMERIC(4,2) — supports e.g. 1.50, 2.25).';
COMMENT ON COLUMN session_cme.quiz_form_id IS
  'Optional FK to a form used as a post-session completion quiz. Reuses existing form builder.';

-- ──────────────────────────────────────────────────────────────────────────
-- 5. speaker_disclosures — versioned + immutable-once-signed financial disclosure
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS speaker_disclosures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  has_conflict BOOLEAN NOT NULL,
  disclosure_text TEXT,
  entities JSONB NOT NULL DEFAULT '[]'::jsonb,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signed_ip INET,
  signed_by_token TEXT,
  signature_image_url TEXT,
  pdf_storage_path TEXT,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  superseded_at TIMESTAMPTZ,
  superseded_by UUID REFERENCES speaker_disclosures(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (faculty_id, event_id, version)
);

-- At most one CURRENT disclosure per (faculty, event).
CREATE UNIQUE INDEX IF NOT EXISTS idx_speaker_disclosures_current
  ON speaker_disclosures(faculty_id, event_id)
  WHERE is_current;

CREATE INDEX IF NOT EXISTS idx_speaker_disclosures_event ON speaker_disclosures(event_id);
CREATE INDEX IF NOT EXISTS idx_speaker_disclosures_faculty ON speaker_disclosures(faculty_id);

ALTER TABLE speaker_disclosures ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='speaker_disclosures'
      AND policyname='Service role full access speaker_disclosures'
  ) THEN
    CREATE POLICY "Service role full access speaker_disclosures"
      ON speaker_disclosures FOR ALL TO service_role
      USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;

COMMENT ON COLUMN speaker_disclosures.entities IS
  'JSONB array of [{org, relationship, compensation_type}] disclosed financial interests.';
COMMENT ON COLUMN speaker_disclosures.is_current IS
  'True for the latest signed version per (faculty, event). Resigning creates a new version, sets prior is_current=false.';
COMMENT ON COLUMN speaker_disclosures.pdf_storage_path IS
  'Path inside speaker-disclosures bucket to the rendered + frozen signed PDF.';

-- ──────────────────────────────────────────────────────────────────────────
-- 6. Storage bucket: speaker-disclosures (PRIVATE — signed-URL access only)
-- ──────────────────────────────────────────────────────────────────────────
-- Different from speaker-content: disclosures are legal documents and must not
-- have anonymous public read. Admins fetch via signed URL through the API.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'speaker-disclosures',
  'speaker-disclosures',
  FALSE,
  10485760,  -- 10 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- No SELECT policy added — service role uses an internal API to mint signed URLs.
